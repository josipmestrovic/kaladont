<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import { inicijalizirajAudio, inicijalizirajGlobalneUiZvukove } from '$lib/audio-manager.js';
  import Header from '$lib/komponente/Header.svelte';

  let { children } = $props();

  // Čekaonica (/red) i aktivna partija (/partija/*) nemaju zaglavlje radi igre na punom ekranu.
  const bezHeadera = $derived(
    $page.url.pathname === '/red' || $page.url.pathname.startsWith('/partija/'),
  );

  onMount(() => {
    inicijalizirajAudio();
    inicijalizirajGlobalneUiZvukove();
    pokreniSlusateljeIgre();
  });
</script>

{#if !bezHeadera}
  <Header />
{/if}

<div class="stranica">
  {@render children()}
</div>

<style>
  .stranica {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 16px;
  }

  @media (min-width: 768px) {
    .stranica {
      max-width: 980px;
    }
  }
</style>
