<script lang="ts">
  import { CircleHelp } from 'lucide-svelte';

  let { tekst, opis, id } = $props<{ tekst: string; opis: string; id: string }>();
  let otvoreno = $state(false);
  let omotac: HTMLSpanElement;

  function preklopi(dogadaj: MouseEvent) {
    dogadaj.stopPropagation();
    otvoreno = !otvoreno;
  }

  function zatvoriIzvan(dogadaj: MouseEvent) {
    if (!omotac.contains(dogadaj.target as Node)) otvoreno = false;
  }
</script>

<svelte:window
  onclick={zatvoriIzvan}
  onkeydown={(dogadaj) => dogadaj.key === 'Escape' && (otvoreno = false)}
/>

<span class="pojam-omotac" bind:this={omotac}>
  <button
    type="button"
    class="pojam-gumb"
    aria-expanded={otvoreno}
    aria-controls={id}
    onclick={preklopi}
  >
    <span>{tekst}</span>
    <CircleHelp size={14} strokeWidth={2.25} aria-hidden="true" />
  </button>
  {#if otvoreno}
    <span id={id} class="pojasnjenje" role="tooltip">{opis}</span>
  {/if}
</span>

<style>
  .pojam-omotac {
    position: relative;
    display: inline-block;
  }

  .pojam-gumb {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    border-bottom: 1px dotted currentColor;
    background: transparent;
    color: inherit;
    font: inherit;
    font-weight: inherit;
    line-height: inherit;
    cursor: help;
  }

  .pojasnjenje {
    position: absolute;
    z-index: 30;
    left: 0;
    top: calc(100% + 8px);
    width: min(280px, calc(100vw - 32px));
    padding: 12px 14px;
    border: 1px solid #d8cfb8;
    border-radius: 8px;
    background: #fffdf7;
    box-shadow: 0 10px 28px rgb(45 39 25 / 18%);
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-tekst);
    font-size: var(--tekst-sitni);
    font-weight: 500;
    line-height: 1.45;
  }

  @media (max-width: 600px) {
    .pojasnjenje {
      position: fixed;
      inset: auto 16px 16px;
      width: auto;
    }
  }
</style>