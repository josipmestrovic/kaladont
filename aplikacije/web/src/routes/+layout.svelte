<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import { page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { inicijalizirajGostSesiju } from '$lib/identitet.js';
  import { inicijalizirajAudio, inicijalizirajGlobalneUiZvukove } from '$lib/audio-manager.js';
  import Header from '$lib/komponente/Header.svelte';

  let { children } = $props();
  let identitetSpreman = $state(false);
  let prethodnaPutanja = $state<string | null>(null);

  beforeNavigate(({ from, to }) => {
    if (from && to) prethodnaPutanja = from.url.pathname;
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

{#if identitetSpreman && !bezHeadera}
  <Header {prethodnaPutanja} />
{/if}

<div class:landing-stranica={$page.url.pathname === '/'} class="stranica">
  {#if identitetSpreman}{@render children()}{/if}
</div>

<style>
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
