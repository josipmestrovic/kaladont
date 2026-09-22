<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import PadajuceRijeci from '$lib/komponente/PadajuceRijeci.svelte';
  import { inicijalizirajGostSesiju } from '$lib/identitet.js';
  import { inicijalizirajAudio, inicijalizirajGlobalneUiZvukove } from '$lib/audio-manager.js';
  import Header from '$lib/komponente/Header.svelte';
  import VezaObavijest from '$lib/komponente/VezaObavijest.svelte';

  let { children } = $props();
  let identitetSpreman = $state(false);
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

  // Čekaonica (/red) i aktivna partija (/partija/*) nemaju zaglavlje radi igre na punom ekranu.
  const bezHeadera = $derived(
    $page.url.pathname === '/red' || $page.url.pathname.startsWith('/partija/'),
  );

  onMount(async () => {
    await inicijalizirajGostSesiju();
    identitetSpreman = true;
    inicijalizirajAudio();
    inicijalizirajGlobalneUiZvukove();
    pokreniSlusateljeIgre();
  });
</script>

<div class:landing-shell={$page.url.pathname === '/'} class="aplikacija">
  <VezaObavijest />
  {#if $page.url.pathname === '/'}<PadajuceRijeci />{/if}
  {#if identitetSpreman && !bezHeadera}
    <Header {prethodnaPutanja} {mozeNaprijed} />
  {/if}
  <div class:landing-stranica={$page.url.pathname === '/'} class="stranica">
    {#if identitetSpreman}{@render children()}{/if}
  </div>
</div>

<style>
  .aplikacija {
    position: relative;
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

  .stranica {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    margin: 0 auto;
    padding: 0 16px;
    overflow-x: hidden;
  }

  @media (min-width: 768px) {
    .stranica {
      max-width: 980px;
    }

    .stranica.landing-stranica {
      max-width: 100%;
      padding-inline: 0;
    }
  }

  .stranica.landing-stranica {
    min-height: calc(100dvh - 64px);
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 767px) {
    .stranica.landing-stranica {
      overflow-x: hidden;
    }
  }
</style>
