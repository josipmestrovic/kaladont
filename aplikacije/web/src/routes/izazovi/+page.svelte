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
    NAZIVI_PROFILA_BOTA,
    NAZIVI_VARIJANTI_IZAZOVA,
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
  import { nazivFormata, nazivPravilnika } from '$lib/igraj-rute.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';

  const igra = dohvatiStanjeIgre();

  let odgovor = $state<OdgovorKatalogaIzazova | null>(null);
  let ucitava = $state(true);
  let greska = $state<string | null>(null);
  let odabrani = $state<StavkaKatalogaIzazovaDto | null>(null);
  let odabraniLevel = $state<LevelIzazova>(1);
  let levelObavijest = $state<string | null>(null);
  let startUTijeku = $state(false);
  let startPoruka = $state<string | null>(null);
  let timeoutPotvrde: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const aktivni = $derived(odgovor?.napredak.aktivniPokusaj ?? null);
  const zvjezdice = $derived(odgovor?.napredak.izazivacZvjezdice ?? 0);
  const omogucen = $derived(odgovor?.omogucen === true);
  const leveli = $derived(odgovor?.napredak.leveli ?? []);
  const aktivniAgregat = $derived(leveli.find((L) => L.level === odabraniLevel) ?? null);

  const karticePoFormatu = $derived(((): { format: FormatIzazova; naziv: string; zavrseno: number; kartice: StavkaKatalogaIzazovaDto[] }[] => {
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
    if (!levelJeOtkljucan(level, odgovor.napredak.leveli)) {
      levelObavijest = `Level ${level} (${NAZIVI_LEVELA_IZAZOVA[level]}) još nije otključan.`;
      return;
    }
    odabraniLevel = level;
    levelObavijest = null;
    sinkronizirajUrl(level, false);
  }

  function otvoriDetalj(stavka: StavkaKatalogaIzazovaDto) {
    odabrani = stavka;
    startPoruka = null;
  }

  function zatvoriDetalj() {
    if (startUTijeku) return;
    odabrani = null;
    startPoruka = null;
  }

  function tekstTrajanjaCovjek(ms: number): string {
    return `${Math.round(ms / 1000)} s (tvoj potez)`;
  }

  function statusOznaka(status: StavkaKatalogaIzazovaDto['status']): string {
    if (status === 'zavrsen') return 'Odrađeno';
    if (status === 'dostupan') return 'Dostupan';
    return 'Zaključan';
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
          otvoriDetalj(stavka);
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
    <p>Četiri levela, tri formata, pet varijanti — pobjeda (i bez pogreške gdje treba) = napredak.</p>
    <div class="izazivac" aria-label={`Izazivač: ${zvjezdice} od 5 zvjezdica`}>
      <span class="izazivac-naziv">Izazivač</span>
      <span class="zvjezdice">
        {#each Array.from({ length: 5 }, (_, i) => i < zvjezdice) as puna}
          <img
            src={puna ? '/ikone/27-zvjezdica-puna.png' : '/ikone/26-zvjezdica-prazna.png'}
            alt=""
            aria-hidden="true"
            width="22"
            height="22"
          />
        {/each}
      </span>
    </div>
  </header>

  {#if !omogucen && odgovor}
    <p class="banner-info" role="status" data-testid="izazov-nedostupan">
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

  {#if !jeRegistriranKorisnik()}
    <p class="gost-napomena">
      Gost može igrati Izazove. Prijava na <strong>postojeći</strong> račun ne spaja gost progres —
      registracija novog računa zadržava napredak s ovog uređaja.
    </p>
  {/if}

  {#if ucitava && !odgovor}
    <p class="ucitavanje" role="status">Učitavanje izazova…</p>
  {:else if greska && !odgovor}
    <p class="greska" role="alert">{greska}</p>
    <button type="button" class="primarni-gumb" onclick={() => ucitaj()}>Pokušaj ponovno</button>
  {:else if odgovor}
    <nav class="pogled-tabovi" aria-label="Leveli izazova" data-testid="izazov-level-tabovi">
      {#each leveli as L (L.level)}
        <button
          type="button"
          class:aktivan={L.level === odabraniLevel}
          class:zakljucan={L.status === 'zakljucan'}
          data-testid={`izazov-level-${L.level}`}
          aria-pressed={L.level === odabraniLevel}
          aria-disabled={L.status === 'zakljucan'}
          onclick={() => odaberiLevel(L.level)}
        >
          {L.naziv}
          <span class="tab-meta">{L.zavrseno}/{L.ukupno}</span>
        </button>
      {/each}
    </nav>

    {#if levelObavijest}
      <p class="banner-info" role="status" data-testid="izazov-level-obavijest">{levelObavijest}</p>
    {/if}

    {#if aktivniAgregat}
      <p class="level-sažetak" data-testid="izazov-level-sazetak">
        {aktivniAgregat.naziv} · {aktivniAgregat.zavrseno}/{aktivniAgregat.ukupno} · bot
        {NAZIVI_PROFILA_BOTA[aktivniAgregat.profileId]}
      </p>
    {/if}

    {#each karticePoFormatu as sekcija (sekcija.format)}
      <section class="format-sekcija" aria-labelledby={`format-${sekcija.format}`} data-testid={`izazov-format-${sekcija.format}`}>
        <h2 id={`format-${sekcija.format}`}>
          {sekcija.naziv}
          <span class="format-meta">{sekcija.zavrseno}/5</span>
        </h2>
        <div class="mreza">
          {#each sekcija.kartice as kartica (kartica.id)}
            <button
              type="button"
              class="kartica"
              class:zakljucan={kartica.status === 'zakljucan'}
              class:zavrsen={kartica.status === 'zavrsen'}
              class:dostupan={kartica.status === 'dostupan'}
              data-testid={`izazov-kartica-${kartica.id}`}
              data-status={kartica.status}
              aria-label={`${kartica.id} ${kartica.naziv}, ${statusOznaka(kartica.status)}`}
              onclick={() => otvoriDetalj(kartica)}
            >
              <span class="kartica-glava">
                <span class="kartica-id">{kartica.redoslijedUFormatu}. {NAZIVI_VARIJANTI_IZAZOVA[kartica.varijanta]}</span>
                {#if kartica.status === 'zavrsen'}
                  <span class="kvacica" aria-hidden="true">✓</span>
                {/if}
              </span>
              <strong class="kartica-naziv">{kartica.naziv}</strong>
              <span class="kartica-meta">{statusOznaka(kartica.status)} · {kartica.xp} XP</span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  {/if}

  <p class="povratak"><a href="/">← Povratak na naslovnu</a></p>
</main>

{#if odabrani}
  <div class="modal-podloga" role="presentation" onclick={zatvoriDetalj}>
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="izazov-detalj-naslov"
      data-testid="izazov-detalj"
      onclick={(e) => e.stopPropagation()}
    >
      <header>
        <p class="detalj-id">{odabrani.id}</p>
        <h2 id="izazov-detalj-naslov">{odabrani.naziv}</h2>
        <p class="detalj-status">{statusOznaka(odabrani.status)}</p>
      </header>
      <p class="detalj-cilj">{odabrani.opisCilja}</p>
      <ul class="detalj-lista">
        <li><span>Level</span><strong>{NAZIVI_LEVELA_IZAZOVA[odabrani.level]}</strong></li>
        <li><span>Pravilnik</span><strong>{nazivPravilnika(odabrani.pravila)}</strong></li>
        <li><span>Format</span><strong>{nazivFormata(odabrani.mod)}</strong></li>
        <li><span>Bot</span><strong>{NAZIVI_PROFILA_BOTA[odabrani.effectiveProfileId]}</strong></li>
        <li><span>Tvoj potez</span><strong>{tekstTrajanjaCovjek(odabrani.turnDurationMs)}</strong></li>
        <li><span>Bot potez</span><strong>{Math.round(odabrani.botTurnDurationMs / 1000)} s</strong></li>
        <li>
          <span>XP</span>
          <strong>
            {odabrani.xp}
            {#if odabrani.xpOsvojen} (već osvojen){/if}
          </strong>
        </li>
      </ul>
      {#if odabrani.status === 'zakljucan'}
        <p class="detalj-lock" role="status">
          {tekstRazlogaZakljucavanja(odabrani.razlogZakljucavanja)}
        </p>
      {/if}
      {#if startPoruka}
        <p class="greska" role="alert">{startPoruka}</p>
      {/if}
      <div class="detalj-akcije">
        <button
          type="button"
          class="primarni-gumb"
          data-testid="izazov-start"
          disabled={odabrani.status === 'zakljucan' || startUTijeku || !omogucen}
          onclick={() => {
            if (odabrani) zapocni(odabrani.id);
          }}
        >
          {#if startUTijeku}
            Pokretanje…
          {:else if !omogucen}
            Još nije dostupno
          {:else if odabrani.status === 'zakljucan'}
            Zaključano
          {:else if odabrani.status === 'zavrsen'}
            Igraj ponovno
          {:else}
            Započni
          {/if}
        </button>
        <button type="button" class="sporedni-gumb" disabled={startUTijeku} onclick={zatvoriDetalj}
          >Zatvori</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .izazovi-stranica {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 16px 48px;
  }
  .naslov h1 {
    margin: 0 0 6px;
    font-size: var(--naslov-3);
  }
  .naslov p {
    margin: 0 0 12px;
    color: var(--boja-tekst-sekundarni);
  }
  .izazivac {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
  }
  .izazivac-naziv {
    font-weight: 700;
  }
  .zvjezdice {
    display: inline-flex;
    gap: 2px;
  }
  .banner-info,
  .banner-aktivni,
  .gost-napomena {
    margin: 16px 0;
    padding: 12px 14px;
    border-radius: 8px;
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
  .gost-napomena {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
  }
  .pogled-tabovi {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 20px 0 8px;
  }
  .pogled-tabovi button {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
    padding: 9px 14px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-pill);
    background: var(--boja-povrsina-2);
    color: var(--boja-tekst-osnovni);
    font: inherit;
    font-size: var(--tekst-sitni);
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  @media (min-width: 560px) {
    .pogled-tabovi button {
      flex: 1 1 0;
    }
  }
  .pogled-tabovi button.aktivan {
    border-color: var(--boja-cta-pozadina);
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
  }
  .pogled-tabovi button.zakljucan {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .tab-meta {
    font-weight: 600;
    opacity: 0.85;
  }
  .level-sažetak {
    margin: 0 0 16px;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-mali);
  }
  .format-sekcija {
    margin-top: 22px;
  }
  .format-sekcija h2 {
    margin: 0 0 12px;
    font-size: var(--tekst-baza);
    color: var(--boja-tekst-sekundarni);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .format-meta {
    font-weight: 600;
    font-size: var(--tekst-mali);
  }
  .mreza {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  @media (min-width: 560px) {
    .mreza {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .kartica {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: 96px;
    padding: 12px;
    text-align: left;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: var(--boja-povrsina);
    color: inherit;
    cursor: pointer;
  }
  .kartica:hover,
  .kartica:focus-visible {
    border-color: var(--boja-isticanje-tekst);
    outline: none;
  }
  .kartica.zakljucan {
    opacity: 0.72;
  }
  .kartica.zavrsen {
    border-color: #e67e22;
    box-shadow: inset 0 0 0 1px #e67e22;
  }
  .kartica.dostupan {
    box-shadow: inset 0 0 0 1px var(--boja-isticanje-tekst);
  }
  .kartica-glava {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .kartica-id {
    font-size: var(--tekst-mali);
    font-weight: 700;
    color: var(--boja-tekst-sekundarni);
  }
  .kvacica {
    color: #e67e22;
    font-weight: 800;
  }
  .kartica-naziv {
    font-size: var(--tekst-baza);
    line-height: 1.25;
  }
  .kartica-meta {
    font-size: var(--tekst-mali);
    color: var(--boja-tekst-sekundarni);
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
  .modal-podloga {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(0 0 0 / 45%);
  }
  .modal {
    width: min(100%, 420px);
    max-height: min(90dvh, 640px);
    overflow: auto;
    padding: 20px;
    border-radius: 12px;
    background: var(--boja-povrsina);
    border: 1px solid var(--boja-obrub);
  }
  .detalj-id {
    margin: 0;
    font-weight: 700;
    color: var(--boja-tekst-sekundarni);
  }
  .modal h2 {
    margin: 4px 0 0;
    font-size: var(--naslov-3);
  }
  .detalj-status {
    margin: 4px 0 12px;
    color: var(--boja-tekst-sekundarni);
  }
  .detalj-cilj {
    margin: 0 0 16px;
    font-weight: 600;
  }
  .detalj-lista {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
  }
  .detalj-lista li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  .detalj-lista span {
    color: var(--boja-tekst-sekundarni);
  }
  .detalj-lock {
    margin: 0 0 12px;
    color: var(--boja-tekst-sekundarni);
  }
  .detalj-akcije {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
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
  .primarni-gumb:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .sporedni-gumb {
    background: transparent;
    border: 1px solid var(--boja-obrub);
    color: inherit;
  }
</style>
