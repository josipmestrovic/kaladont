<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type {
    IdIzazova,
    OdgovorKatalogaIzazova,
    PocetakPartije,
    PotvrdaIzazova,
    RundaOtvorena,
    StanjePartije,
    StavkaKatalogaIzazovaDto,
  } from 'zajednicko';
  import { NAZIVI_PROFILA_BOTA } from 'zajednicko';
  import { dohvatiSocket } from '$lib/socket.js';
  import { dohvatiStanjeIgre, pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { aktivirajAudio, zagrijGameplayZvukove } from '$lib/audio-manager.js';
  import {
    ApiGreska,
    dohvatiKatalogIzazova,
    nazivEtape,
    noviRequestIdIzazova,
    porukaZaKodIzazova,
    spremiZadnjiChallengeId,
  } from '$lib/izazovi-klijent.js';
  import { nazivFormata, nazivPravilnika } from '$lib/igraj-rute.js';
  import { jeRegistriranKorisnik } from '$lib/identitet.js';

  const igra = dohvatiStanjeIgre();

  let odgovor = $state<OdgovorKatalogaIzazova | null>(null);
  let ucitava = $state(true);
  let greska = $state<string | null>(null);
  let odabrani = $state<StavkaKatalogaIzazovaDto | null>(null);
  let startUTijeku = $state(false);
  let startPoruka = $state<string | null>(null);
  let timeoutPotvrde: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const etape = $derived(((): { naziv: string; kartice: StavkaKatalogaIzazovaDto[] }[] => {
    const katalog = odgovor?.katalog ?? [];
    const grupe: { naziv: string; kartice: StavkaKatalogaIzazovaDto[] }[] = [];
    for (let i = 0; i < katalog.length; i += 3) {
      const kartice = katalog.slice(i, i + 3);
      const prva = kartice[0];
      if (!prva) continue;
      grupe.push({ naziv: nazivEtape(prva.redniBroj), kartice });
    }
    return grupe;
  })());

  const aktivni = $derived(odgovor?.napredak.aktivniPokusaj ?? null);
  const zvjezdice = $derived(odgovor?.napredak.izazivacZvjezdice ?? 0);
  const omogucen = $derived(odgovor?.omogucen === true);

  async function ucitaj() {
    ucitava = true;
    greska = null;
    try {
      odgovor = await dohvatiKatalogIzazova();
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

  function otvoriDetalj(stavka: StavkaKatalogaIzazovaDto) {
    odabrani = stavka;
    startPoruka = null;
  }

  function zatvoriDetalj() {
    if (startUTijeku) return;
    odabrani = null;
    startPoruka = null;
  }

  function tekstTrajanja(ms: number): string {
    return `${Math.round(ms / 1000)} s po potezu`;
  }

  function statusOznaka(status: StavkaKatalogaIzazovaDto['status']): string {
    if (status === 'zavrsen') return 'Završen';
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
        // Rezerviran, čekamo partija:pocetak.
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
        if (stavka) otvoriDetalj(stavka);
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

    // Ako je aktivan pokušaj bez partijaId (rezerviran), periodički osvježi.
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
    <p>24 razine protiv računala. Pobjeda + ciljevi = napredak.</p>
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
    {#each etape as etapa (etapa.naziv)}
      <section class="etapa" aria-labelledby={`etapa-${etapa.naziv}`}>
        <h2 id={`etapa-${etapa.naziv}`}>{etapa.naziv}</h2>
        <div class="mreza">
          {#each etapa.kartice as kartica (kartica.id)}
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
              <span class="kartica-id">{kartica.id}</span>
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
        <li><span>Pravilnik</span><strong>{nazivPravilnika(odabrani.pravila)}</strong></li>
        <li><span>Format</span><strong>{nazivFormata(odabrani.mod)}</strong></li>
        <li><span>Bot</span><strong>{NAZIVI_PROFILA_BOTA[odabrani.effectiveProfileId]}</strong></li>
        <li><span>Vrijeme</span><strong>{tekstTrajanja(odabrani.turnDurationMs)}</strong></li>
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
          Zaključano — najprije dovrši {odabrani.blockingChallengeId ?? 'prethodni izazov'}.
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
  .etapa {
    margin-top: 28px;
  }
  .etapa h2 {
    margin: 0 0 12px;
    font-size: var(--tekst-baza);
    color: var(--boja-tekst-sekundarni);
  }
  .mreza {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  @media (max-width: 520px) {
    .mreza {
      grid-template-columns: 1fr;
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
    border-color: var(--boja-isticanje-tekst);
  }
  .kartica.dostupan {
    box-shadow: inset 0 0 0 1px var(--boja-isticanje-tekst);
  }
  .kartica-id {
    font-size: var(--tekst-mali);
    font-weight: 700;
    color: var(--boja-tekst-sekundarni);
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
