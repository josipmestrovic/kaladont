<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import PadajuceRijeci from '$lib/komponente/PadajuceRijeci.svelte';
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
  import { inicijalizirajGlas } from '$lib/glasovni-manager.js';
  import Header from '$lib/komponente/Header.svelte';
  import VezaObavijest from '$lib/komponente/VezaObavijest.svelte';
  import UspjehObavijest from '$lib/komponente/UspjehObavijest.svelte';
  import DostignuceObavijest from '$lib/komponente/DostignuceObavijest.svelte';
  import CitanjeNaglasObavijest from '$lib/komponente/CitanjeNaglasObavijest.svelte';
  import SanducicToast from '$lib/komponente/SanducicToast.svelte';
  import RedCekanjaKostur from '$lib/komponente/RedCekanjaKostur.svelte';
  import { jeIndeksabilnaPutanja } from '$lib/seo.js';

  let { children, data } = $props();
  let sesijaSpreman = $state(false);
  let prethodnaPutanja = $state<string | null>(null);
  let mozeNaprijed = $state(false);
  let povijestAplikacije: string[] = [];
  let indeksPovijesti = -1;

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

  // Naslovnica, čekaonica i aktivna partija nemaju zajedničko zaglavlje.
  const bezHeadera = $derived(
    $page.url.pathname === '/' || $page.url.pathname === '/red' || $page.url.pathname.startsWith('/partija/'),
  );
  const urlCilja = $derived($navigating?.to?.url ?? $page.url);
  // Kostur na /red: dok sesija nije gotova ili dok traje navigacija prema redu.
  const prikaziKosturCekanja = $derived(
    urlCilja.pathname === '/red' &&
      ((!sesijaSpreman && $page.url.pathname === '/red') || (sesijaSpreman && $navigating !== null)),
  );
  const brojMjestaKostura = $derived(urlCilja.searchParams.get('mod') === 'dva_igraca' ? 2 : 4);
  // Naslovnica: children uvijek. Ostalo: SSR odmah, klijent čeka sesiju.
  const prikaziChildren = $derived(
    $page.url.pathname === '/' || !browser || sesijaSpreman,
  );
  const robotsMeta = $derived(
    jeIndeksabilnaPutanja($page.url.pathname) ? 'index, follow' : 'noindex, follow',
  );

  onMount(() => {
    inicijalizirajTemu();
    inicijalizirajFontPostavku();
    inicijalizirajGlas();
    inicijalizirajAudio();

    let zaustaviEvidenciju = () => {};
    let zaustaviObavijesti = () => {};
    let zaustaviSanducic = () => {};
    const naNaslovnici = $page.url.pathname === '/';
    const sesija = inicijalizirajGostSesiju();
    postaviPutanjuSanducica($page.url.pathname);

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
      zaustaviEvidenciju();
      zaustaviObavijesti();
      zaustaviSanducic();
    };
  });
</script>

<svelte:head>
  <meta name="robots" content={robotsMeta} />
  {#if data.umami}
    <script
      defer
      src="{data.umami.url}/script.js"
      data-website-id={data.umami.websiteId}
    ></script>
  {/if}
</svelte:head>

<div class:landing-shell={$page.url.pathname === '/'} class="aplikacija">
  <div class="status-obavijesti">
    <VezaObavijest />
    <UspjehObavijest />
    <SanducicToast />
    <DostignuceObavijest />
    <CitanjeNaglasObavijest />
  </div>
  {#if $page.url.pathname === '/'}<PadajuceRijeci />{/if}
  {#if sesijaSpreman && !bezHeadera}
    <Header {prethodnaPutanja} {mozeNaprijed} />
  {/if}
  <div class:landing-stranica={$page.url.pathname === '/'} class="stranica">
    {#if prikaziKosturCekanja}
      <RedCekanjaKostur ukupnoMjesta={brojMjestaKostura} />
    {:else if prikaziChildren}
      <div class="stranica-sadrzaj">
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

  .aplikacija :global(.header),
  .aplikacija .stranica {
    position: relative;
    z-index: 1;
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

    .stranica.landing-stranica {
      max-width: 100%;
      padding-inline: 0;
    }
  }

  .stranica.landing-stranica {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 999px) {
    .stranica.landing-stranica {
      overflow-x: clip;
    }
  }
</style>
