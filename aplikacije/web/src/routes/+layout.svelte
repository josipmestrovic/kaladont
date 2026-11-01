<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { navigating, page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import PadajuceRijeci from '$lib/komponente/PadajuceRijeci.svelte';
  import { inicijalizirajGostSesiju } from '$lib/identitet.js';
  import { inicijalizirajAudio, inicijalizirajGlobalneUiZvukove } from '$lib/audio-manager.js';
  import { ucitajCoreAsete } from '$lib/asetovi-core.js';
  import { inicijalizirajFontPostavku } from '$lib/postavke-fonta.js';
  import { inicijalizirajTemu } from '$lib/postavke-teme.js';
  import { inicijalizirajGlas } from '$lib/glasovni-manager.js';
  import Header from '$lib/komponente/Header.svelte';
  import VezaObavijest from '$lib/komponente/VezaObavijest.svelte';
  import CitanjeNaglasObavijest from '$lib/komponente/CitanjeNaglasObavijest.svelte';
  import RedCekanjaKostur from '$lib/komponente/RedCekanjaKostur.svelte';
  import BootUcitavanje from '$lib/komponente/BootUcitavanje.svelte';

  const PRAG_INSTANT_BOOTA_MS = 250;

  let { children } = $props();
  let spreman = $state(false);
  let napredakBoota = $state(0);
  let prikaziBootProgress = $state(false);
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
  // Kostur samo dok traje navigacija prema /red; boot gate zamjenjuje stari !identitetSpreman slučaj.
  const prikaziKosturCekanja = $derived(
    spreman && urlCilja.pathname === '/red' && $navigating !== null,
  );
  const brojMjestaKostura = $derived(urlCilja.searchParams.get('mod') === 'dva_igraca' ? 2 : 4);

  onMount(async () => {
    inicijalizirajTemu();
    inicijalizirajFontPostavku();
    inicijalizirajGlas();
    inicijalizirajAudio();

    const pocetak = performance.now();
    // Prikaži progress tek ako boot traje dovoljno dugo — inače nema flasha na return visit.
    const timerProgressa = window.setTimeout(() => {
      if (!spreman) prikaziBootProgress = true;
    }, PRAG_INSTANT_BOOTA_MS);

    try {
      await Promise.all([
        inicijalizirajGostSesiju(),
        ucitajCoreAsete((p) => {
          napredakBoota = p;
        }),
      ]);
    } finally {
      window.clearTimeout(timerProgressa);
    }

    inicijalizirajGlobalneUiZvukove();
    pokreniSlusateljeIgre();

    const trajanje = performance.now() - pocetak;
    if (trajanje < PRAG_INSTANT_BOOTA_MS) prikaziBootProgress = false;
    spreman = true;
  });
</script>

<div class:landing-shell={$page.url.pathname === '/'} class="aplikacija">
  <div class="status-obavijesti">
    <VezaObavijest />
    <CitanjeNaglasObavijest />
  </div>
  {#if $page.url.pathname === '/' && spreman}<PadajuceRijeci />{/if}
  {#if spreman && !bezHeadera}
    <Header {prethodnaPutanja} {mozeNaprijed} />
  {/if}
  <div class:landing-stranica={$page.url.pathname === '/'} class="stranica">
    {#if !spreman}
      {#if prikaziBootProgress}
        <BootUcitavanje napredak={napredakBoota} />
      {/if}
    {:else if prikaziKosturCekanja}
      <RedCekanjaKostur ukupnoMjesta={brojMjestaKostura} />
    {:else}
      {@render children()}
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
  .status-obavijesti :global(.obavijest-citanja-naglas) {
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
