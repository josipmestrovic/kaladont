<script lang="ts">
  import { onDestroy } from 'svelte';
  import { pustiAudio } from '$lib/audio-manager.js';

  /** Autoritativni rok prve runde (ISO). */
  let { rokIso }: { rokIso: string } = $props();

  let broj = $state<number | null>(null);
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let zadnjaOdsviranaSek = Number.POSITIVE_INFINITY;

  function ocisti() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function azuriraj() {
    const preostaloMs = new Date(rokIso).getTime() - Date.now();
    if (preostaloMs <= 0) {
      broj = null;
      ocisti();
      return;
    }
    const preostaloSek = Math.min(3, Math.max(1, Math.ceil(preostaloMs / 1000)));
    broj = preostaloSek;
    if (preostaloSek < zadnjaOdsviranaSek) {
      zadnjaOdsviranaSek = preostaloSek;
      pustiAudio('odbrojavanje-single-count-sound');
    }
  }

  $effect(() => {
    ocisti();
    zadnjaOdsviranaSek = Number.POSITIVE_INFINITY;
    if (!rokIso) {
      broj = null;
      return;
    }
    azuriraj();
    intervalId = setInterval(azuriraj, 250);
    return () => ocisti();
  });

  onDestroy(ocisti);
</script>

{#if broj !== null}
  <div class="pocetno-odbrojavanje" data-testid="pocetno-odbrojavanje" aria-live="polite">
    <p class="pocetno-odbrojavanje-naslov">Igra počinje za</p>
    <p class="pocetno-odbrojavanje-broj">{broj}</p>
  </div>
{:else}
  <p class="priprema-partije" data-testid="pocetno-odbrojavanje-cekanje">Igra počinje…</p>
{/if}

<style>
  .pocetno-odbrojavanje {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
    padding: 16px 0;
    text-align: center;
  }
  .pocetno-odbrojavanje-naslov {
    margin: 0;
    color: var(--boja-tekst-sekundarni);
    font-size: var(--tekst-baza);
    font-weight: 600;
  }
  .pocetno-odbrojavanje-broj {
    margin: 0;
    font-family: var(--font-naslov);
    font-size: clamp(3rem, 12vw, 4.5rem);
    font-weight: 700;
    line-height: 1;
    color: var(--boja-tekst-osnovni);
    min-width: 1.2em;
  }
  .priprema-partije {
    padding: 16px 0;
    color: var(--boja-tekst-sekundarni);
    text-align: center;
  }
</style>
