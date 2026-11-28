<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { inicijalizirajGostSesiju } from '$lib/identitet.js';
  import { pokreniEvidencijuAktivnogDana } from '$lib/aktivnost-dana.js';
  import { pokreniObavijestiDostignuca } from '$lib/obavijesti-dostignuca.svelte.js';
  import { pokreniSanducic, postaviPutanjuSanducica } from '$lib/stanje-sanducica.svelte.js';
  import {
    inicijalizirajAudio,
    inicijalizirajGlobalneUiZvukove,
    preucitajUiZvukove,
  } from '$lib/audio-manager.js';
  import { ucitajKriticneIkone, ucitajPozadinskeAseteLandinga } from '$lib/asetovi-core.js';
  import { inicijalizirajFontPostavku } from '$lib/postavke-fonta.js';
  import { inicijalizirajTemu } from '$lib/postavke-teme.js';
  import {
    animiranaPozadinaUkljucena,
    inicijalizirajAnimacijuPozadine,
  } from '$lib/postavke-animacije.js';
  import { glasUkljucen, inicijalizirajGlas } from '$lib/glasovni-manager.js';
  import {
    ucitajCitanjeNaglasObavijest,
    ucitajPadajuceRijeci,
  } from '$lib/dinamicni-ucitavac.js';
  import Header from '$lib/komponente/Header.svelte';
  import VezaObavijest from '$lib/komponente/VezaObavijest.svelte';
  import UspjehObavijest from '$lib/komponente/UspjehObavijest.svelte';
  import DostignuceObavijest from '$lib/komponente/DostignuceObavijest.svelte';
  import SanducicToast from '$lib/komponente/SanducicToast.svelte';
  import ObavijestNovihMisija from '$lib/komponente/ObavijestNovihMisija.svelte';
  import RedCekanjaKostur from '$lib/komponente/RedCekanjaKostur.svelte';
  import { jeIndeksabilnaPutanja } from '$lib/seo.js';
  import type { Component } from 'svelte';

  let { children, data } = $props();
  let sesijaSpreman = $state(false);
  let desktopPadajuceRijeci = $state(false);
  let reducedMotion = $state(false);
  let animacijaUkljucena = $state(true);
  let prethodnaPutanja = $state<string | null>(null);
  let mozeNaprijed = $state(false);
  let povijestAplikacije: string[] = [];
  let indeksPovijesti = -1;
  let PadajuceRijeciKomponenta = $state<Component | null>(null);
  let CitanjeNaglasKomponenta = $state<Component | null>(null);

  function putanja(dogadaj: { url: URL }): string {
    return `${dogadaj.url.pathname}${dogadaj.url.search}${dogadaj.url.hash}`;
  }

  beforeNavigate(({ from, to }) => {
    if (from && to) prethodnaPutanja = from.url.pathname;
  });

  afterNavigate(({ to, type }) => {
    if (!to) return;
    const novaPutanja = putanja(to);
    postaviPutanjuSanducica(to.url.pathname);
    if (povijestAplikacije.length === 0) {
      povijestAplikacije = [novaPutanja];
      indeksPovijesti = 0;
      return;
    }
    if (type === 'popstate') {
      const indeks = povijestAplikacije.lastIndexOf(novaPutanja);
      if (indeks >= 0) indeksPovijesti = indeks;
    } else {
      povijestAplikacije = povijestAplikacije.slice(0, indeksPovijesti + 1);
      povijestAplikacije.push(novaPutanja);
      indeksPovijesti += 1;
    }
    mozeNaprijed = indeksPovijesti < povijestAplikacije.length - 1;
  });

  // Čekaonica i partija nemaju zajedničko zaglavlje. Naslovnica: logo lijevo + profil desno.
  const bezHeadera = $derived(
    $page.url.pathname === '/red' || $page.url.pathname.startsWith('/partija/'),
  );
  const urlCilja = $derived($navigating?.to?.url ?? $page.url);
  // Kostur na /red: dok sesija nije gotova ili dok traje navigacija prema redu.
  const prikaziKosturCekanja = $derived(
    urlCilja.pathname === '/red' &&
      ((!sesijaSpreman && $page.url.pathname === '/red') || (sesijaSpreman && $navigating !== null)),
  );
  const brojMjestaKostura = $derived((() => {
    const mod = urlCilja.searchParams.get('mod');
    // PR06: kostur prati stvarni format (2/3/4); puna Igraj matrica dolazi u PR14.
    if (mod === 'dva_igraca') return 2;
    if (mod === 'tri_igraca') return 3;
    return 4;
  })());
  // Indeksabilne rute: children odmah (SSR + klijent, bez flasha).
  // Ostalo: čekaj gost-sesiju da socket/API imaju token prije interakcije.
  const prikaziChildren = $derived(
    jeIndeksabilnaPutanja($page.url.pathname) || sesijaSpreman,
  );
  const robotsMeta = $derived(
    jeIndeksabilnaPutanja($page.url.pathname) ? 'index, follow' : 'noindex, follow',
  );
  // Bočne partije: desktop prostor + ručna postavka; reduced motion ima prednost.
  const prikaziPadajuceRijeci = $derived(
    $page.url.pathname === '/' &&
      sesijaSpreman &&
      desktopPadajuceRijeci &&
      animacijaUkljucena &&
      !reducedMotion,
  );

  $effect(() => {
    if (!prikaziPadajuceRijeci || PadajuceRijeciKomponenta) return;
    let otkazano = false;
    void ucitajPadajuceRijeci()
      .then((komponenta) => {
        if (!otkazano) PadajuceRijeciKomponenta = komponenta as Component;
      })
      .catch(() => {
        // Dekorativna animacija — tihi pad ne smije blokirati naslovnicu.
      });
    return () => {
      otkazano = true;
    };
  });

  $effect(() => {
    const ukljucen = $glasUkljucen;
    if (!ukljucen || CitanjeNaglasKomponenta) return;
    let otkazano = false;
    void ucitajCitanjeNaglasObavijest()
      .then((komponenta) => {
        if (!otkazano) CitanjeNaglasKomponenta = komponenta as Component;
      })
      .catch(() => {
        // Obavijest o čitanju nije kritična za igru.
      });
    return () => {
      otkazano = true;
    };
  });

  onMount(() => {
    inicijalizirajTemu();
    inicijalizirajFontPostavku();
    inicijalizirajAnimacijuPozadine();
    inicijalizirajGlas();
    inicijalizirajAudio();

    let zaustaviEvidenciju = () => {};
    let zaustaviObavijesti = () => {};
    let zaustaviSanducic = () => {};
    const naNaslovnici = $page.url.pathname === '/';
    const sesija = inicijalizirajGostSesiju();
    postaviPutanjuSanducica($page.url.pathname);

    const odjavaAnimacije = animiranaPozadinaUkljucena.subscribe((v) => {
      animacijaUkljucena = v;
    });

    // Padajuće partije od 1280px — uži desktop nema dovoljno bočnog prostora uz 980px sadržaj.
    const upitPadajucih = window.matchMedia('(min-width: 1280px)');
    const upitReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const osvjeziPadajuce = () => {
      desktopPadajuceRijeci = upitPadajucih.matches;
    };
    const osvjeziReduced = () => {
      reducedMotion = upitReduced.matches;
    };
    osvjeziPadajuce();
    osvjeziReduced();
    upitPadajucih.addEventListener('change', osvjeziPadajuce);
    upitReduced.addEventListener('change', osvjeziReduced);

    void (async () => {
      try {
        void ucitajKriticneIkone();
        await sesija.catch(() => {});
        sesijaSpreman = true;
        if (naNaslovnici) {
          ucitajPozadinskeAseteLandinga();
          preucitajUiZvukove();
        }
      } catch {
        sesijaSpreman = true;
      }

      inicijalizirajGlobalneUiZvukove();
      pokreniSlusateljeIgre();
      zaustaviEvidenciju = pokreniEvidencijuAktivnogDana();
      zaustaviObavijesti = pokreniObavijestiDostignuca();
      zaustaviSanducic = pokreniSanducic();
    })();

    return () => {
      odjavaAnimacije();
      upitPadajucih.removeEventListener('change', osvjeziPadajuce);
      upitReduced.removeEventListener('change', osvjeziReduced);
      zaustaviEvidenciju();
      zaustaviObavijesti();
      zaustaviSanducic();
    };
  });
</script>

<svelte:head>
  <meta name="robots" content={robotsMeta} />
  {#if data.umami}
    <!-- Fail-closed stub (sync) → defer IIFE iz TS → defer Umami. Bez sync mrežnog fetcha sanitizera. -->
    {@html `<script>window.kaladontUmamiBeforeSend=window.kaladontUmamiBeforeSend||function(){return false;};</script>`}
    <script defer src="/umami-before-send.js"></script>
    <script
      defer
      src="{data.umami.url}/script.js"
      data-website-id={data.umami.websiteId}
      data-before-send="kaladontUmamiBeforeSend"
    ></script>
  {/if}
</svelte:head>

<div class:landing-shell={$page.url.pathname === '/'} class="aplikacija">
  <div class="status-obavijesti">
    <VezaObavijest />
    <UspjehObavijest />
    <SanducicToast />
    <ObavijestNovihMisija />
    <DostignuceObavijest />
    {#if CitanjeNaglasKomponenta}
      <CitanjeNaglasKomponenta />
    {/if}
  </div>
  {#if prikaziPadajuceRijeci && PadajuceRijeciKomponenta}
    <PadajuceRijeciKomponenta />
  {/if}
  <!-- Naslovnica: Header (s h1) i u SSR-u prije gost-sesije, radi indeksabilnog naslova. -->
  {#if !bezHeadera && (sesijaSpreman || $page.url.pathname === '/')}
    <Header {prethodnaPutanja} {mozeNaprijed} />
  {/if}
  <div
    class:landing-stranica={$page.url.pathname === '/'}
    class:stranica--partija={$page.url.pathname.startsWith('/partija/')}
    class="stranica"
  >
    {#if prikaziKosturCekanja}
      <RedCekanjaKostur ukupnoMjesta={brojMjestaKostura} />
    {:else if prikaziChildren}
      <!-- Indeksabilni SSR ostaje u DOM-u; inert sprječava klikove prije gost-sesije/hidracije. -->
      <div class="stranica-sadrzaj" inert={!sesijaSpreman ? true : undefined}>
        {@render children()}
      </div>
    {/if}
  </div>
</div>

<style>
  .aplikacija {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
  }

  /* Header iznad .stranica — inače profil-izbornik završi ispod sadržaja stranice. */
  .aplikacija :global(.header) {
    position: relative;
    z-index: 10;
  }

  .aplikacija .stranica {
    position: relative;
    z-index: 1;
  }

  /* Naslovnički Header mora ostati absolute overlay (ne relative iz pravila iznad). */
  .aplikacija.landing-shell :global(.header.header--naslovnica) {
    position: absolute;
    z-index: 10;
  }

  .aplikacija.landing-shell {
    isolation: isolate;
  }

  .status-obavijesti {
    position: fixed;
    z-index: 20;
    top: 12px;
    left: 50%;
    display: grid;
    width: min(620px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    gap: 8px;
    overflow-y: auto;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .status-obavijesti :global(.veza-obavijest),
  .status-obavijesti :global(.obavijest-citanja-naglas),
  .status-obavijesti :global(.red-dostignuca),
  .status-obavijesti :global(.sanducic-toast),
  .status-obavijesti :global(.misije-toast),
  .status-obavijesti :global(.uspjeh-obavijest) {
    position: relative;
    inset: auto;
    width: 100%;
    transform: none;
    pointer-events: auto;
  }

  .stranica {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    margin: 0 auto;
    padding: 0 16px;
    overflow-x: clip;
  }

  .stranica-sadrzaj {
    display: contents;
  }

  @media (min-width: 1000px) {
    .stranica {
      max-width: 980px;
    }
  }

  /* Naslovnica: bez dodatnog side-paddinga — širinu dijele header i .landing (16px). */
  .stranica.landing-stranica {
    max-width: 100%;
    padding-inline: 0;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  /* Partija: pusti bleed gornje meta trake (100vw); html/body i dalje clipaju scroll. */
  .stranica.stranica--partija {
    overflow-x: visible;
  }

  @media (max-width: 999px) {
    .stranica.landing-stranica {
      overflow-x: clip;
    }
  }
</style>
