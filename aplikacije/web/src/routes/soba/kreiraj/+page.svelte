<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    Check,
    ClipboardList,
    Crown,
    Info,
    Lock,
    Play,
    Timer,
  } from 'lucide-svelte';
  import {
    REDOSLIJED_PRAVILNIKA,
    TEKSTOVI_PRAVILNIKA,
  } from '$lib/igraj-rute.js';
  import {
    SVE_VRSTE_RIJECI,
    jePoznatiPravilnik,
    type PostavkePrivatneSobe,
    type PravilnikPartije,
    type VrstaRijeci,
  } from 'zajednicko';
  import { dohvatiSocket } from '$lib/socket.js';
  import { zabiljeziUmamiDogadjaj } from '$lib/umami.js';

  const TIMEOUT_ODGOVORA_MS = 8000;

  const OZNACI_VRSTA: Record<VrstaRijeci, string> = {
    imenica: 'Imenice',
    glagol: 'Glagoli',
    pridjev: 'Pridjevi',
    prilog: 'Prilozi',
    zamjenica: 'Zamjenice',
    broj: 'Brojevi',
    prijedlog: 'Prijedlozi',
    veznik: 'Veznici',
    cestica: 'Čestice',
    uzvik: 'Usklici',
    vlastito_ime: 'Vlastita imena',
  };

  const OPCIJE_TAJMERA = [
    { sek: 15, oznaka: '15 s' },
    { sek: 30, oznaka: '30 s' },
    { sek: 60, oznaka: '60 s' },
    { sek: 0, oznaka: 'Bez tajmera' },
  ] as const;

  let trajanjePotezaSek = $state(30);
  let eliminacijskiBodovi = $state(true);
  // ?pravila= iz queryja; inače prvi u redu (lijevo).
  let pravilnik = $state<PravilnikPartije>((() => {
    const izQuery = $page.url.searchParams.get('pravila');
    return jePoznatiPravilnik(izQuery) ? izQuery : REDOSLIJED_PRAVILNIKA[0]!;
  })());
  let odabraneVrste = $state<Set<VrstaRijeci>>(new Set(SVE_VRSTE_RIJECI));
  let poruka = $state<string | null>(null);
  let slanjeUTijeku = $state(false);
  let timeoutOdgovora: ReturnType<typeof setTimeout> | null = null;
  /** Lokalna zaštita od ponovljenog `soba:stvorena` za istu potvrdu. */
  let umamiKreiranaKod: string | null = null;

  function ocistiTimeoutOdgovora() {
    if (timeoutOdgovora) {
      clearTimeout(timeoutOdgovora);
      timeoutOdgovora = null;
    }
  }

  const sveVrsteOdabrane = $derived(
    odabraneVrste.size === SVE_VRSTE_RIJECI.length &&
      SVE_VRSTE_RIJECI.every((v) => odabraneVrste.has(v)),
  );
  const samoImenice = $derived(odabraneVrste.size === 1 && odabraneVrste.has('imenica'));

  const sazetakVremena = $derived(
    trajanjePotezaSek === 0
      ? 'Bez tajmera'
      : trajanjePotezaSek === 1
        ? '1 sekunda'
        : `${trajanjePotezaSek} sekundi`,
  );

  const sazetakVrsta = $derived(
    sveVrsteOdabrane ? 'Sve' : samoImenice ? 'Samo imenice' : `${odabraneVrste.size} odabrano`,
  );

  function ukljuciSve() {
    odabraneVrste = new Set(SVE_VRSTE_RIJECI);
  }

  function iskljuciSve() {
    odabraneVrste = new Set(['imenica']);
  }

  function preklopiVrstu(v: VrstaRijeci) {
    if (v === 'imenica') return;
    const novi = new Set(odabraneVrste);
    if (novi.has(v)) {
      if (novi.size > 1) novi.delete(v);
    } else {
      novi.add(v);
    }
    odabraneVrste = novi;
  }

  onMount(() => {
    const socket = dohvatiSocket();

    const naStvorenu = (payload: { kod: string }) => {
      ocistiTimeoutOdgovora();
      slanjeUTijeku = false;
      if (payload.kod && payload.kod !== umamiKreiranaKod) {
        umamiKreiranaKod = payload.kod;
        zabiljeziUmamiDogadjaj('privatna-soba-kreirana');
      }
      void goto(`/soba/${payload.kod}`);
    };

    const naGresku = (greska: { kod?: string; poruka: string }) => {
      ocistiTimeoutOdgovora();
      slanjeUTijeku = false;
      if (greska.kod === 'EMAIL_NIJE_POTVRDEN') {
        void goto('/potvrdi-email');
        return;
      }
      poruka = greska.poruka;
    };

    socket.on('soba:stvorena', naStvorenu);
    socket.on('greska', naGresku);

    return () => {
      socket.off('soba:stvorena', naStvorenu);
      socket.off('greska', naGresku);
    };
  });

  onDestroy(() => {
    ocistiTimeoutOdgovora();
  });

  async function stvoriSobu(e: SubmitEvent) {
    e.preventDefault();
    if (slanjeUTijeku) return;
    slanjeUTijeku = true;
    poruka = null;

    const postavke: PostavkePrivatneSobe = {
      trajanjePotezaSek,
      eliminacijskiBodovi,
      dopusteneVrste: [...odabraneVrste],
      pravila: pravilnik,
    };

    ocistiTimeoutOdgovora();
    // Timeout ne otključava gumb — drugi emit može stići kao VEC_U_SOBI nakon
    // uspješnog soba:stvorena i zatvoriti sobu preko lobby overlaya.
    timeoutOdgovora = setTimeout(() => {
      timeoutOdgovora = null;
      poruka = 'Poslužitelj ne odgovara. Još čekam odgovor…';
    }, TIMEOUT_ODGOVORA_MS);

    const socket = dohvatiSocket();
    socket.emit('soba:stvori', { postavke });
  }
</script>

<svelte:head>
  <title>Nova privatna soba | Kaladont</title>
</svelte:head>

<main class="kreiraj-sobu">
  <header class="uvod">
    <h1>Nova privatna soba</h1>
    <p class="podnaslov">
      Odaberi pravila i pozovi do 8 igrača. Poveznicu za pozivanje dobit ćeš nakon stvaranja sobe.
    </p>
  </header>

  <form onsubmit={stvoriSobu}>
    <section class="grupa" aria-labelledby="naslov-pravila">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <Crown size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-pravila">Pravila igre</h2>
      </div>

      <div class="opcije-gumbi opcije-gumbi--pravila" role="radiogroup" aria-label="Pravilnik">
        {#each REDOSLIJED_PRAVILNIKA as p (p)}
          <button
            type="button"
            class="odabir-gumb"
            class:odabran={pravilnik === p}
            role="radio"
            aria-checked={pravilnik === p}
            onclick={() => (pravilnik = p)}
          >
            {#if pravilnik === p}
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
            {/if}
            {TEKSTOVI_PRAVILNIKA[p].naziv}
          </button>
        {/each}
      </div>

      <div class="pravila-opis">
        <p>{TEKSTOVI_PRAVILNIKA[pravilnik].opis}</p>
      </div>
    </section>

    <section class="grupa" aria-labelledby="naslov-postavke">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <Timer size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-postavke">Postavke igre</h2>
      </div>

      <div class="postavka-blok">
        <label class="prekidac-redak">
          <span class="prekidac-tekst">
            <strong>Bodovi za izbacivanje</strong>
            <small>+1 bod kada tvoja riječ izbaci protivnika.</small>
          </span>
          <span class="prekidac-omot">
            <input
              type="checkbox"
              role="switch"
              aria-label="Bodovi za izbacivanje"
              bind:checked={eliminacijskiBodovi}
            />
            <span class="prekidac" aria-hidden="true"><span></span></span>
          </span>
        </label>
      </div>

      <div class="postavka-blok">
        <div class="tajmer-zaglavlje">
          <strong class="sub-naslov">Vrijeme za potez</strong>
          <span class="tajmer-hint">Standardno: 30 sekundi</span>
        </div>
        <div class="opcije-gumbi opcije-gumbi--tajmer" role="radiogroup" aria-label="Vrijeme za potez">
          {#each OPCIJE_TAJMERA as opcija (opcija.sek)}
            <button
              type="button"
              class="odabir-gumb"
              class:odabran={trajanjePotezaSek === opcija.sek}
              role="radio"
              aria-checked={trajanjePotezaSek === opcija.sek}
              onclick={() => (trajanjePotezaSek = opcija.sek)}
            >
              {#if trajanjePotezaSek === opcija.sek}
                <Check size={16} strokeWidth={2.6} aria-hidden="true" />
              {/if}
              {opcija.oznaka}
            </button>
          {/each}
        </div>
      </div>
    </section>

    <section class="grupa" aria-labelledby="naslov-vrste">
      <div class="grupa-glava">
        <span class="grupa-ikona grupa-ikona--slova" aria-hidden="true">
          <span>A</span><span>B</span>
        </span>
        <h2 id="naslov-vrste">Vrste riječi</h2>
      </div>

      <div class="opcije-gumbi opcije-gumbi--brze" role="group" aria-label="Brzi odabir vrsta">
        <button
          type="button"
          class="odabir-gumb"
          class:odabran={sveVrsteOdabrane}
          aria-pressed={sveVrsteOdabrane}
          onclick={ukljuciSve}
        >
          {#if sveVrsteOdabrane}
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          {/if}
          Sve riječi
        </button>
        <button
          type="button"
          class="odabir-gumb"
          class:odabran={samoImenice}
          aria-pressed={samoImenice}
          onclick={iskljuciSve}
        >
          {#if samoImenice}
            <Check size={16} strokeWidth={2.6} aria-hidden="true" />
          {/if}
          Samo imenice
        </button>
      </div>

      <div class="vrste-mrezica">
        {#each SVE_VRSTE_RIJECI as vrsta (vrsta)}
          <label
            class="vrsta-labela"
            class:aktivno={odabraneVrste.has(vrsta)}
            class:zakljucano={vrsta === 'imenica'}
            title={vrsta === 'imenica' ? 'Imenice su uvijek uključene.' : undefined}
          >
            {#if vrsta === 'imenica'}
              <span class="vrsta-oznaka" aria-hidden="true">
                <Lock size={14} strokeWidth={2.4} />
              </span>
              <input
                type="checkbox"
                checked
                disabled
                aria-label="Imenice"
              />
              <span>Imenice <em>(obavezno)</em></span>
            {:else}
              <input
                type="checkbox"
                checked={odabraneVrste.has(vrsta)}
                onchange={() => preklopiVrstu(vrsta)}
              />
              <span>{OZNACI_VRSTA[vrsta]}</span>
            {/if}
          </label>
        {/each}
      </div>

      <p class="info-napomena">
        <Info size={16} strokeWidth={2.2} aria-hidden="true" />
        <span>Imenice su uvijek uključene kako bi bilo dovoljno mogućih nastavaka.</span>
      </p>
    </section>

    <section class="grupa sazetak" aria-labelledby="naslov-sazetak">
      <div class="grupa-glava">
        <span class="grupa-ikona" aria-hidden="true">
          <ClipboardList size={22} strokeWidth={2.2} />
        </span>
        <h2 id="naslov-sazetak">Sažetak sobe</h2>
      </div>

      <dl class="sazetak-tablica">
        <div>
          <dt>Pravilnik</dt>
          <dd>{TEKSTOVI_PRAVILNIKA[pravilnik].naziv}</dd>
        </div>
        <div>
          <dt>Vrijeme</dt>
          <dd>{sazetakVremena}</dd>
        </div>
        <div>
          <dt>Bodovi za izbacivanje</dt>
          <dd>{eliminacijskiBodovi ? 'Uključeno' : 'Isključeno'}</dd>
        </div>
        <div>
          <dt>Vrste riječi</dt>
          <dd>{sazetakVrsta}</dd>
        </div>
      </dl>

      {#if poruka}
        <p role="alert" class="greska">{poruka}</p>
      {/if}

      <button type="submit" class="glavni-gumb" disabled={slanjeUTijeku} aria-busy={slanjeUTijeku}>
        {#if !slanjeUTijeku}
          <Play size={18} strokeWidth={2.6} aria-hidden="true" />
        {/if}
        {slanjeUTijeku ? (poruka ? 'Još čekam…' : 'Stvaranje sobe...') : 'Stvori privatnu sobu'}
      </button>
    </section>
  </form>
</main>

<style>
  .kreiraj-sobu {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 20px 0 48px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .uvod {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h1 {
    font-family: var(--font-naslov);
    font-size: clamp(28px, 4.5vw, 40px);
    line-height: 1.15;
    margin: 0;
  }

  .podnaslov {
    margin: 0;
    max-width: 42rem;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    line-height: 1.45;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grupa {
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica);
    padding: 18px;
    box-shadow: var(--sjena-suptilna);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .grupa-glava {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .grupa h2 {
    font-family: var(--font-naslov);
    font-size: clamp(18px, 2.4vw, 22px);
    margin: 0;
    line-height: 1.2;
  }

  .grupa-ikona {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    border-radius: 10px;
    background: color-mix(in srgb, var(--boja-isticanje-slova) 22%, transparent);
    color: var(--boja-isticanje-tekst);
  }

  .grupa-ikona--slova {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-family: var(--font-naslov);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  .grupa-ikona--slova span {
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: var(--boja-isticanje-slova);
    color: var(--boja-cta-tekst);
    line-height: 1;
  }

  .opcije-gumbi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .opcije-gumbi--pravila,
  .opcije-gumbi--brze {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }

  .opcije-gumbi--tajmer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .odabir-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 16px;
    border: 2px solid var(--boja-obrub);
    border-radius: var(--radijus-kontrola);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
    text-align: center;
  }

  .odabir-gumb.odabran {
    background: var(--boja-cta-pozadina);
    border-color: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
  }

  .pravila-opis {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pravila-opis p {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.45;
  }

  .postavka-blok {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
  }

  .postavka-blok + .postavka-blok {
    border-top: 1px solid var(--boja-obrub);
    padding-top: 14px;
  }

  .prekidac-redak {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
  }

  .prekidac-tekst {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .prekidac-tekst strong {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-naslov);
  }

  .prekidac-tekst small {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.4;
  }

  .prekidac-omot {
    position: relative;
    flex: 0 0 auto;
  }

  .prekidac-omot input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .prekidac {
    display: flex;
    align-items: center;
    width: 46px;
    height: 28px;
    padding: 3px;
    border-radius: var(--radijus-kontrola);
    background: var(--boja-obrub-jaci);
    transition: background-color 160ms ease;
  }

  .prekidac span {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: white;
    transition: transform 160ms ease;
  }

  .prekidac-omot input:checked + .prekidac {
    background: var(--boja-uspjeh-tekst);
  }

  .prekidac-omot input:checked + .prekidac span {
    transform: translateX(18px);
  }

  .prekidac-omot input:focus-visible + .prekidac {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
  }

  .tajmer-zaglavlje {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 12px;
  }

  .sub-naslov {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-naslov);
  }

  .tajmer-hint {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .vrste-mrezica {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .vrsta-labela {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 8px 10px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font-size: var(--tekst-sitni);
    font-weight: 600;
    cursor: pointer;
    user-select: none;
  }

  .vrsta-labela input {
    width: 18px;
    height: 18px;
    flex: 0 0 auto;
    accent-color: var(--boja-isticanje-slova);
    cursor: pointer;
  }

  .vrsta-labela.aktivno {
    border-color: color-mix(in srgb, var(--boja-isticanje-slova) 55%, var(--boja-obrub));
    background: color-mix(in srgb, var(--boja-isticanje-slova) 12%, var(--boja-povrsina-2));
  }

  .vrsta-labela.zakljucano {
    border-color: color-mix(in srgb, var(--boja-uspjeh-tekst) 45%, var(--boja-obrub));
    background: color-mix(in srgb, var(--boja-uspjeh-tekst) 14%, var(--boja-povrsina-2));
    color: var(--boja-uspjeh-tekst);
    cursor: default;
  }

  .vrsta-labela.zakljucano input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .vrsta-labela.zakljucano em {
    font-style: normal;
    font-weight: 700;
    opacity: 0.85;
  }

  .vrsta-oznaka {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }

  .info-napomena {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
    line-height: 1.4;
  }

  .info-napomena :global(svg) {
    flex: 0 0 auto;
    margin-top: 1px;
    color: var(--boja-isticanje-tekst);
  }

  .sazetak {
    gap: 16px;
  }

  .sazetak-tablica {
    display: grid;
    gap: 0;
    margin: 0;
  }

  .sazetak-tablica > div {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--boja-obrub);
  }

  .sazetak-tablica dt {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-sitni);
  }

  .sazetak-tablica dd {
    margin: 0;
    text-align: right;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    color: var(--boja-tekst-naslov);
  }

  .glavni-gumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 14px 24px;
    border: none;
    border-radius: var(--radijus-kontrola);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    font-family: var(--font-naslov);
    font-size: clamp(18px, 2.5vw, 22px);
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
  }

  .glavni-gumb:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .greska {
    margin: 0;
    color: var(--boja-poraz-tekst);
    font-weight: 600;
    font-size: var(--tekst-sitni);
  }

  @media (min-width: 600px) {
    .kreiraj-sobu {
      padding-top: 28px;
    }

    .grupa {
      padding: 22px;
    }

    .opcije-gumbi--pravila {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .opcije-gumbi--brze {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .opcije-gumbi--tajmer {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .vrste-mrezica {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

  }

  @media (prefers-reduced-motion: reduce) {
    .prekidac,
    .prekidac span {
      transition: none;
    }
  }
</style>
