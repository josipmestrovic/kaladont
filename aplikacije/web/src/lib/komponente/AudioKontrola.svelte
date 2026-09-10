<script lang="ts">
  import { onMount } from 'svelte';
  import {
    aktivirajAudio,
    audioPostavke,
    inicijalizirajAudio,
    inicijalizirajGlobalneUiZvukove,
    postaviGlasnocu,
    postaviUtišano,
  } from '$lib/audio-manager.js';

  let { plutaj = false } = $props<{ plutaj?: boolean }>();
  let volumen = $state(0.65);
  let utišano = $state(false);

  onMount(() => {
    inicijalizirajAudio();
    inicijalizirajGlobalneUiZvukove();
    const odjava = audioPostavke.subscribe((postavke) => {
      volumen = postavke.volumen;
      utišano = postavke.utišano;
    });
    return odjava;
  });

  function aktiviraj() {
    aktivirajAudio();
  }

  function promijeniVolumen(event: Event) {
    aktiviraj();
    postaviGlasnocu(Number((event.currentTarget as HTMLInputElement).value) / 100);
  }

  function promijeniUtišano() {
    aktiviraj();
    postaviUtišano(!utišano);
  }
</script>

<div class:plutaj class="audio-kontrola" role="group" aria-label="Kontrola zvuka">
  <button type="button" onclick={promijeniUtišano} aria-label={utišano ? 'Uključi zvuk' : 'Utišaj zvuk'}>
    {utišano || volumen === 0 ? '🔇' : '🔊'}
  </button>
  <input
    type="range"
    min="0"
    max="100"
    step="1"
    value={utišano ? 0 : Math.round(volumen * 100)}
    aria-label="Glasnoća zvuka"
    oninput={promijeniVolumen}
  />
</div>

<style>
  .audio-kontrola {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 112px;
  }

  .audio-kontrola.plutaj {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 20;
    padding: 6px 8px;
    border: 1px solid var(--boja-obrub, #e5ddc8);
    border-radius: 999px;
    background: white;
    box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  }

  button {
    min-width: 28px;
    min-height: 28px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
  }

  input {
    width: 72px;
    accent-color: var(--boja-primarna, #2b8a78);
  }
</style>
