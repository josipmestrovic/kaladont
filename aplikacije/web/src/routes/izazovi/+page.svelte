<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type {
    AgregatLevelaIzazovaDto,
    FormatIzazova,
    IdIzazova,
    LevelIzazova,
    OdgovorKatalogaIzazova,
    PocetakPartije,
    PotvrdaIzazova,
    RundaOtvorena,
    StanjePartije,
    StavkaKatalogaIzazovaDto,
  } from 'zajednicko';
  import {
    FORMATI_IZAZOVA,
    NAZIVI_FORMATA_IZAZOVA,
    NAZIVI_LEVELA_IZAZOVA,
    PRAG_DUGE_RIJECI_IZAZOVA,
  } from 'zajednicko';
  import { dohvatiSocket } from '$lib/socket.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import {
    ApiGreska,
    dohvatiKatalogIzazova,
    noviRequestIdIzazova,
    parsirajLevelIzUrl,
    porukaZaKodIzazova,
    spremiZadnjiChallengeId,
    tekstRazlogaZakljucavanja,
    zadaniLevelIzazova,
  } from '$lib/izazovi-klijent.js';
  import PojamPomoc from '$lib/komponente/PojamPomoc.svelte';

  const UKUPNO_IZAZOVA = 60;

  type UvjetKartice = {
    kljuc: 'duge_rijeci' | 'bez_pogreske' | 'bez_ka' | 'brzi_timer';
    naziv: string;
    opis: string;
  };

  /** Opisi posebnih uvjeta na karticama. */
  const OPISI_UVJETA = {
    duge_rijeci: (broj: number) =>
      broj === 1
        ? `Moraš odigrati 1 riječ od najmanje ${PRAG_DUGE_RIJECI_IZAZOVA} slova.`
        : `Moraš odigrati ${broj} riječi od najmanje ${PRAG_DUGE_RIJECI_IZAZOVA} slova.`,
    bez_pogreske:
      'Ne smiješ pogriješiti nijednu riječ. Prva pogrešna riječ završava izazov — moraš pobijediti bez greške.',
    bez_ka:
      'Ne smiješ završiti riječ na ka. Ako odigraš riječ koja završava na ka, izazov odmah završava.',
    brzi_timer: (sek: number) =>
      `Na svom potezu imaš samo ${sek} sekundi za odgovor umjesto uobičajenih 30.`,
  } as const;

  const igra = dohvatiStanjeIgre();

  let odgovor = $state<OdgovorKatalogaIzazova | null>(null);
  let ucitava = $state(true);
  let greska = $state<string | null>(null);
  let odabraniLevel = $state<LevelIzazova>(1);
  let levelObavijest = $state<string | null>(null);
  let startUTijeku = $state(false);
  let startPoruka = $state<string | null>(null);
  let timeoutPotvrde: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const aktivni = $derived(odgovor?.napredak.aktivniPokusaj ?? null);
  const omogucen = $derived(odgovor?.omogucen === true);
  const leveli = $derived(odgovor?.napredak.leveli ?? []);
  const aktivniAgregat = $derived(leveli.find((L) => L.level === odabraniLevel) ?? null);
  const ukupnoZavrseno = $derived(odgovor?.napredak.zavrseniChallengeIds.length ?? 0);
  const ukupnoPostotak = $derived(Math.round((ukupnoZavrseno / UKUPNO_IZAZOVA) * 100));

  const karticePoFormatu = $derived(((): {
    format: FormatIzazova;
    naziv: string;
    zavrseno: number;
    kartice: StavkaKatalogaIzazovaDto[];
  }[] => {
    const katalog = odgovor?.katalog ?? [];
    const agregati = aktivniAgregat?.formati ?? [];
    return FORMATI_IZAZOVA.map((format) => {
      const agregat = agregati.find((f) => f.format === format);
      const kartice = katalog
        .filter((s) => s.level === odabraniLevel && s.format === format)
        .sort((a, b) => a.redoslijedUFormatu - b.redoslijedUFormatu);
      return {
        format,
        naziv: agregat?.naziv ?? NAZIVI_FORMATA_IZAZOVA[format],
        zavrseno: agregat?.zavrseno ?? 0,
        kartice,
      };
    });
  })());

  async function ucitaj() {
    ucitava = true;
    greska = null;
    try {
      odgovor = await dohvatiKatalogIzazova();
      primijeniLevelIzUrl(odgovor.napredak.leveli);
    } catch (e) {
      greska =
        e instanceof ApiGreska
          ? porukaZaKodIzazova(e.kod, e.message)
          : 'Katalog izazova trenutačno nije dostupan.';
      odgovor = null;
    } finally {
      ucitava = false;
    }
  }

  function levelJeOtkljucan(level: LevelIzazova, lista: AgregatLevelaIzazovaDto[]): boolean {
    return lista.find((L) => L.level === level)?.status !== 'zakljucan';
  }

  function primijeniLevelIzUrl(lista: AgregatLevelaIzazovaDto[]) {
    const zatrazeni = parsirajLevelIzUrl($page.url.searchParams.get('level'));
    const zadani = zadaniLevelIzazova(lista);
    if (zatrazeni && levelJeOtkljucan(zatrazeni, lista)) {
      odabraniLevel = zatrazeni;
      levelObavijest = null;
      sinkronizirajUrl(zatrazeni, false);
      return;
    }
    if (zatrazeni && !levelJeOtkljucan(zatrazeni, lista)) {
      odabraniLevel = zadani;
      levelObavijest = `Level ${zatrazeni} još nije otključan — prikazujem ${NAZIVI_LEVELA_IZAZOVA[zadani]}.`;
      sinkronizirajUrl(zadani, true);
      return;
    }
    odabraniLevel = zadani;
    levelObavijest = null;
    sinkronizirajUrl(zadani, true);
  }

  function sinkronizirajUrl(level: LevelIzazova, replace: boolean) {
    const url = new URL($page.url);
    if (url.searchParams.get('level') === String(level)) return;
    url.searchParams.set('level', String(level));
    void goto(`${url.pathname}?${url.searchParams.toString()}`, {
      replaceState: replace,
      keepFocus: true,
      noScroll: true,
    });
  }

  function odaberiLevel(level: LevelIzazova) {
    if (!odgovor) return;
    if (!levelJeOtkljucan(level, odgovor.napredak.leveli)) return;
    odabraniLevel = level;
    levelObavijest = null;
    sinkronizirajUrl(level, false);
  }

  function statusAria(status: StavkaKatalogaIzazovaDto['status']): string {
    if (status === 'zavrsen') return 'završen';
    if (status === 'dostupan') return 'dostupan';
    return 'zaključan';
  }

  /** Posebni uvjeti kartice — duge riječi, bez pogreške, ne-ka, brzi timer. */
  function posebniUvjeti(kartica: StavkaKatalogaIzazovaDto): UvjetKartice[] {
    const uvjeti: UvjetKartice[] = [];
    const duge = kartica.ciljevi.dugeRijeci ?? 0;
    if (duge > 0) {
      uvjeti.push({
        kljuc: 'duge_rijeci',
        naziv: duge === 1
          ? `1× ≥${PRAG_DUGE_RIJECI_IZAZOVA} slova`
          : `${duge}× ≥${PRAG_DUGE_RIJECI_IZAZOVA} slova`,
        opis: OPISI_UVJETA.duge_rijeci(duge),
      });
    }
    if (kartica.ciljevi.bezPogreske) {
      uvjeti.push({
        kljuc: 'bez_pogreske',
        naziv: 'Bez pogreške',
        opis: OPISI_UVJETA.bez_pogreske,
      });
    }
    if (kartica.ciljevi.bezZavrsavanjaNaKa) {
      uvjeti.push({
        kljuc: 'bez_ka',
        naziv: 'Ne završi na ka',
        opis: OPISI_UVJETA.bez_ka,
      });
    }
    if (kartica.turnDurationMs < 30_000) {
      const sek = Math.round(kartica.turnDurationMs / 1000);
      uvjeti.push({
        kljuc: 'brzi_timer',
        naziv: `${sek} s`,
        opis: OPISI_UVJETA.brzi_timer(sek),
      });
    }
    return uvjeti;
  }

  function klikNaKarticu(kartica: StavkaKatalogaIzazovaDto) {
    if (startUTijeku) return;
    if (kartica.status === 'zakljucan') {
      startPoruka = tekstRazlogaZakljucavanja(kartica.razlogZakljucavanja);
      return;
    }
    zapocni(kartica.id);
  }

  function zapocni(challengeId: IdIzazova) {
    if (startUTijeku) return;
    if (!omogucen) {
      startPoruka = 'Izazovi još nisu dostupni.';
      return;
    }
    startUTijeku = true;
    startPoruka = null;
    spremiZadnjiChallengeId(challengeId);
    igra.izazovChallengeId = challengeId;
    const socket = dohvatiSocket();
    if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
    timeoutPotvrde = setTimeout(() => {
      startUTijeku = false;
      startPoruka = 'Poslužitelj ne odgovara. Pokušaj ponovno.';
    }, 10_000);
    const potvrda: PotvrdaIzazova = (ishod) => {
      if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
      timeoutPotvrde = null;
      if (ishod.rezerviran) {
        if (ishod.partijaId && ishod.pokrenut) {
          void goto(`/partija/${ishod.partijaId}`);
          return;
        }
        if (ishod.pokrenut === false) {
          startUTijeku = false;
          startPoruka =
            ishod.status === 'tehnicki_prekinuto'
              ? 'Izazov se nije mogao pokrenuti. Pokušaj ponovno.'
              : 'Partija još nije krenula. Pokušaj ponovno ili osvježi mapu.';
          void ucitaj();
          return;
        }
        return;
      }
      startUTijeku = false;
      if (ishod.kod === 'VEC_U_PARTIJI' && igra.partijaId) {
        void goto(`/partija/${igra.partijaId}`);
        return;
      }
      startPoruka = porukaZaKodIzazova(ishod.kod, ishod.poruka);
    };
    socket.emit('izazov:zapocni', { challengeId, requestId: noviRequestIdIzazova() }, potvrda);
  }

  function tipkaNaKartici(dogadaj: KeyboardEvent, kartica: StavkaKatalogaIzazovaDto) {
    if (dogadaj.key !== 'Enter' && dogadaj.key !== ' ') return;
    // Tooltip gumbi unutar kartice imaju vlastiti Enter — ne pokreći izazov.
    if (dogadaj.target !== dogadaj.currentTarget) return;
    dogadaj.preventDefault();
    klikNaKarticu(kartica);
  }

  function nastaviAktivni() {
    if (!aktivni?.partijaId) {
      void ucitaj();
      return;
    }
    spremiZadnjiChallengeId(aktivni.challengeId);
    igra.izazovChallengeId = aktivni.challengeId;
    void goto(`/partija/${aktivni.partijaId}`);
  }

  onMount(() => {
    zagrijGameplayZvukove();
    pokreniSlusateljeIgre();
    aktivirajAudio();
    void ucitaj().then(() => {
      const zatrazeni = $page.url.searchParams.get('zapocni');
      if (zatrazeni && odgovor) {
        const stavka = odgovor.katalog.find((s) => s.id === zatrazeni);
        if (stavka) {
          if (levelJeOtkljucan(stavka.level, odgovor.napredak.leveli)) {
            odabraniLevel = stavka.level;
            sinkronizirajUrl(stavka.level, true);
          }
          klikNaKarticu(stavka);
        }
      }
    });

    const socket = dohvatiSocket();
    const naPocetak = (pocetak: PocetakPartije) => {
      if (pocetak.kontekst !== 'izazov') return;
      startUTijeku = false;
      void goto(`/partija/${pocetak.partijaId}`);
    };
    const naStanje = (stanje: StanjePartije) => {
      if (stanje.kontekst === 'izazov' && !stanje.zavrsena) {
        startUTijeku = false;
        void goto(`/partija/${stanje.partijaId}`);
      }
    };
    const naRundu = (_runda: RundaOtvorena) => {
      if (igra.kontekst === 'izazov' && igra.partijaId) {
        startUTijeku = false;
        void goto(`/partija/${igra.partijaId}`);
      }
    };
    socket.on('partija:pocetak', naPocetak);
    socket.on('partija:stanje', naStanje);
    socket.on('partija:runda-otvorena', naRundu);

    pollTimer = setInterval(() => {
      if (aktivni && !aktivni.partijaId) void ucitaj();
    }, 4_000);

    return () => {
      socket.off('partija:pocetak', naPocetak);
      socket.off('partija:stanje', naStanje);
      socket.off('partija:runda-otvorena', naRundu);
    };
  });

  onDestroy(() => {
    if (timeoutPotvrde) clearTimeout(timeoutPotvrde);
    if (pollTimer) clearInterval(pollTimer);
  });
</script>

<svelte:head>
  <title>Izazovi | Kaladont</title>
</svelte:head>

<main class="izazovi-stranica">
  <header class="naslov">
    <h1>Izazovi</h1>
    <p class="podnaslov">Pobijedi izazove i otključaj nove razine.</p>
  </header>

  {#if odgovor && !omogucen}
    <p class="banner-info" role="status" data-testid="izazov-u-pripremi">
      Izazovi su u pripremi — možeš pregledati karte, ali start još nije otvoren.
    </p>
  {/if}

  {#if aktivni}
    <div class="banner-aktivni" role="status" data-testid="izazov-aktivni">
      <p>
        Aktivan pokušaj: <strong>{aktivni.challengeId}</strong>
        {#if aktivni.status === 'rezerviran'}(priprema…){:else}(u tijeku){/if}
      </p>
      {#if aktivni.partijaId}
        <button type="button" class="primarni-gumb" onclick={nastaviAktivni}>Nastavi</button>
      {:else}
        <button type="button" class="sporedni-gumb" onclick={() => ucitaj()}>Osvježi</button>
      {/if}
    </div>
  {/if}

  {#if startPoruka}
    <p class="banner-info" role="status" data-testid="izazov-start-poruka">{startPoruka}</p>
  {/if}

  {#if ucitava && !odgovor}
    <p class="ucitavanje" role="status">Učitavanje izazova…</p>
  {:else if greska && !odgovor}
    <p class="greska" role="alert">{greska}</p>
    <button type="button" class="primarni-gumb" onclick={() => ucitaj()}>Pokušaj ponovno</button>
  {:else if odgovor}
    <section class="meta-blok" aria-label="Napredak izazova" data-testid="izazov-meta">
      <div class="meta-napredak">
        <p class="meta-napredak-naslov">Napredak</p>
        <p class="meta-napredak-broj" data-testid="izazov-ukupni-napredak">
          {ukupnoZavrseno} / {UKUPNO_IZAZOVA} izazova završeno
        </p>
        <div
          class="meta-traka"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={UKUPNO_IZAZOVA}
          aria-valuenow={ukupnoZavrseno}
          aria-label="Ukupni napredak izazova"
        >
          <span class="meta-traka-ispuna" style={`width: ${ukupnoPostotak}%`}></span>
        </div>
      </div>
    </section>

    <nav class="pogled-tabovi" aria-label="Leveli izazova" data-testid="izazov-level-tabovi">
      {#each leveli as L (L.level)}
        <button
          type="button"
          class:aktivan={L.level === odabraniLevel}
          class:zakljucan={L.status === 'zakljucan'}
          data-testid={`izazov-level-${L.level}`}
          aria-pressed={L.level === odabraniLevel}
          disabled={L.status === 'zakljucan'}
          onclick={() => odaberiLevel(L.level)}
        >
          <span class="tab-naziv">{L.naziv}</span>
          <span class="tab-meta">{L.zavrseno}/{L.ukupno}</span>
        </button>
      {/each}
    </nav>

    {#if levelObavijest}
      <p class="banner-info" role="status" data-testid="izazov-level-obavijest">{levelObavijest}</p>
    {/if}

    {#if startUTijeku}
      <p class="ucitavanje" role="status" data-testid="izazov-pokretanje">Pokretanje izazova…</p>
    {/if}

    {#each karticePoFormatu as sekcija (sekcija.format)}
      <section
        class="format-sekcija"
        aria-labelledby={`format-${sekcija.format}`}
        data-testid={`izazov-format-${sekcija.format}`}
      >
        <div class="format-glava">
          <h2 id={`format-${sekcija.format}`}>
            {sekcija.naziv}
            <span class="format-meta">· {sekcija.zavrseno}/5</span>
          </h2>
          <div class="format-tocke" aria-hidden="true">
            {#each Array.from({ length: 5 }, (_, i) => i < sekcija.zavrseno) as gotovo}
              <span class="format-tocka" class:gotovo></span>
            {/each}
          </div>
        </div>
        <div class="mreza">
          {#each sekcija.kartice as kartica (kartica.id)}
            {@const uvjeti = posebniUvjeti(kartica)}
            <div
              class="kartica"
              class:zakljucan={kartica.status === 'zakljucan'}
              class:zavrsen={kartica.status === 'zavrsen'}
              class:dostupan={kartica.status === 'dostupan'}
              class:ceka={startUTijeku}
              role="button"
              tabindex={startUTijeku ? -1 : 0}
              data-testid={`izazov-kartica-${kartica.id}`}
              data-status={kartica.status}
              aria-label={`Izazov ${kartica.redoslijedUFormatu}, ${statusAria(kartica.status)}`}
              aria-disabled={startUTijeku}
              onclick={() => klikNaKarticu(kartica)}
              onkeydown={(e) => tipkaNaKartici(e, kartica)}
            >
              <span class="kartica-glava">
                <strong class="kartica-broj">{kartica.redoslijedUFormatu}</strong>
                {#if kartica.status === 'zavrsen'}
                  <span class="kvacica" aria-hidden="true" title="Završeno">✓</span>
                {:else if kartica.status === 'zakljucan'}
                  <span class="brava" aria-hidden="true" title="Zaključan">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                      <path
                        d="M8 1a3 3 0 0 0-3 3v2H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-1V4a3 3 0 0 0-3-3Zm1.5 5h-3V4a1.5 1.5 0 1 1 3 0v2Z"
                      />
                    </svg>
                  </span>
                {:else}
                  <span class="kartica-strelica" aria-hidden="true" title="Dostupan">›</span>
                {/if}
              </span>
              <span class="kartica-uvjeti">
                <span class="kartica-uvjeti-oznaka">Posebni uvjet:</span>
                {#if uvjeti.length === 0}
                  <span class="kartica-uvjet-nema">nema</span>
                {:else}
                  <span class="kartica-uvjeti-lista">
                    {#each uvjeti as uvjet, i (uvjet.kljuc)}
                      {#if i > 0}
                        <span class="kartica-uvjet-razdjelnik" aria-hidden="true">|</span>
                      {/if}
                      <PojamPomoc
                        tekst={uvjet.naziv}
                        opis={uvjet.opis}
                        id={`izazov-uvjet-${kartica.id}-${uvjet.kljuc}`}
                        ariaLabel={`Što znači ${uvjet.naziv}?`}
                        pozicioniranje="uz-okidac"
                      />
                    {/each}
                  </span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}

  <p class="povratak"><a href="/">← Povratak na naslovnu</a></p>
</main>

<style>
  .izazovi-stranica {
    max-width: 960px;
    margin: 0 auto;
    padding: 16px 16px 48px;
  }

  .naslov h1 {
    margin: 0;
    font-size: var(--naslov-3);
  }

  .podnaslov {
    margin: 6px 0 0;
    color: var(--boja-tekst-sekundarni);
  }

  .meta-blok {
    margin: 18px 0 0;
    padding: 14px 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    background: var(--boja-povrsina-2);
  }

  .meta-napredak-naslov {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .meta-napredak-broj {
    margin: 4px 0 0;
    color: var(--boja-tekst-osnovni);
    font-weight: 700;
    font-size: var(--tekst-baza);
  }

  .meta-traka {
    margin-top: 8px;
    height: 10px;
    border-radius: 999px;
    background: var(--boja-povrsina-3);
    overflow: hidden;
  }

  .meta-traka-ispuna {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--boja-zuta-krema);
    min-width: 0;
    transition: width 0.25s ease;
  }

  .banner-info,
  .banner-aktivni {
    margin: 14px 0 0;
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--boja-povrsina-2);
    border: 1px solid var(--boja-obrub);
  }

  .banner-aktivni {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .banner-aktivni p {
    margin: 0;
  }

  .pogled-tabovi {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 16px 0 0;
  }

  @media (min-width: 640px) {
    .pogled-tabovi {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .pogled-tabovi button {
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .pogled-tabovi button.aktivan {
    border-color: var(--boja-cta-pozadina);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
  }

  .pogled-tabovi button.zakljucan,
  .pogled-tabovi button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .tab-meta {
    font-weight: 600;
    opacity: 0.85;
  }

  .format-sekcija {
    margin-top: 24px;
  }

  .format-glava {
    margin: 0 0 12px;
  }

  .format-sekcija h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--boja-tekst-osnovni);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .format-meta {
    font-weight: 600;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }

  .format-tocke {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .format-tocka {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1.5px solid var(--boja-obrub-jaci);
    background: transparent;
  }

  .format-tocka.gotovo {
    background: var(--boja-zuta-krema);
    border-color: var(--boja-zuta-krema);
  }

  .mreza {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  @media (min-width: 720px) {
    .mreza {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .kartica {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-height: 104px;
    padding: 14px;
    text-align: left;
    border: 1px solid var(--boja-obrub);
    border-radius: 12px;
    background: var(--boja-povrsina);
    color: inherit;
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }

  .kartica:hover:not(:disabled),
  .kartica:focus-visible:not(:disabled) {
    border-color: var(--boja-isticanje-tekst);
    outline: none;
  }

  .kartica.ceka {
    cursor: wait;
  }

  .kartica.zakljucan {
    opacity: 0.68;
    background: var(--boja-povrsina-3);
  }

  .kartica.zavrsen {
    border-color: var(--boja-zlato-obrub);
    box-shadow: inset 0 0 0 1px var(--boja-zlato-obrub);
  }

  .kartica.dostupan {
    box-shadow: inset 0 0 0 1px rgb(248 221 154 / 35%);
  }

  .kartica-glava {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .kartica-broj {
    font-size: 1.35rem;
    line-height: 1.1;
    font-weight: 800;
  }

  .kvacica {
    color: var(--boja-zlato-tekst);
    font-weight: 800;
  }

  .brava {
    color: var(--boja-tekst-sekundarni);
    display: inline-flex;
  }

  .kartica-strelica {
    color: var(--boja-tekst-sekundarni);
    font-size: 1.25rem;
    line-height: 1;
    font-weight: 700;
  }

  .kartica-uvjeti {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 6px;
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
    line-height: 1.45;
  }

  .kartica-uvjeti-oznaka {
    font-weight: 700;
  }

  .kartica-uvjet-nema {
    font-weight: 600;
  }

  .kartica-uvjeti-lista {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
  }

  .kartica-uvjet-razdjelnik {
    color: var(--boja-tekst-sekundarni);
    opacity: 0.7;
    font-weight: 600;
  }

  .kartica-uvjeti :global(.pojam-gumb) {
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
    font-weight: 700;
    min-width: 0;
    min-height: 0;
  }

  .kartica-uvjeti :global(.pojasnjenje) {
    z-index: 40;
  }

  .ucitavanje,
  .greska {
    margin: 16px 0;
  }

  .greska {
    color: var(--boja-opasnost, #b00020);
  }

  .povratak {
    margin-top: 32px;
  }

  .povratak a {
    color: var(--boja-tekst-sekundarni);
  }

  .primarni-gumb,
  .sporedni-gumb {
    display: inline-flex;
    align-items: center;
    border-radius: var(--radijus-pill);
    padding: 10px 20px;
    font-weight: 700;
    border: none;
    cursor: pointer;
  }

  .primarni-gumb {
    background: var(--boja-pozadina-primarna);
    color: var(--boja-tekst-na-primarnoj, #fff);
  }

  .sporedni-gumb {
    background: transparent;
    border: 1px solid var(--boja-obrub);
    color: inherit;
  }
</style>
