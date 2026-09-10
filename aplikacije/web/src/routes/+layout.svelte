<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { pokreniSlusateljeIgre } from '$lib/stanje-igre.svelte.js';
  import Header from '$lib/komponente/Header.svelte';
  import AudioKontrola from '$lib/komponente/AudioKontrola.svelte';

  let { children } = $props();

  // Landing i aktivna partija imaju vlastito zaglavlje.
  const bezHeadera = $derived(
    $page.url.pathname === '/' ||
      $page.url.pathname === '/red' ||
      $page.url.pathname.startsWith('/partija/'),
  );

  onMount(() => {
    pokreniSlusateljeIgre();
  });
</script>

<div class="stranica">
  {#if !bezHeadera}
    <Header />
  {:else}
    <AudioKontrola plutaj />
  {/if}
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
