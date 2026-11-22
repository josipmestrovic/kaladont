<script lang="ts">
  import { CircleHelp } from 'lucide-svelte';

  let {
    tekst,
    opis,
    id,
    ariaLabel,
    pozicioniranje = 'zadano',
  } = $props<{
    tekst?: string;
    opis: string;
    id: string;
    ariaLabel?: string;
    pozicioniranje?: 'zadano' | 'uz-okidac';
  }>();

  let otvoreno = $state(false);
  let otvorenoKlikom = $state(false);
  let omotac: HTMLSpanElement;
  const samoIkona = $derived(!tekst);
  const uzOkidac = $derived(pozicioniranje === 'uz-okidac');

  function preklopi(dogadaj: MouseEvent) {
    dogadaj.stopPropagation();
    if (otvoreno && otvorenoKlikom) {
      otvoreno = false;
      otvorenoKlikom = false;
      return;
    }
    otvoreno = true;
    otvorenoKlikom = true;
  }

  function zatvoriIzvan(dogadaj: MouseEvent) {
    if (!omotac?.contains(dogadaj.target as Node)) {
      otvoreno = false;
      otvorenoKlikom = false;
    }
  }

  function zatvori() {
    otvoreno = false;
    otvorenoKlikom = false;
  }

  function naHoverEnter() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvoreno = true;
  }

  function naHoverLeave() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvoreno = false;
  }

  function naFocus() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvoreno = true;
  }

  function naBlur() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvoreno = false;
  }
</script>

<svelte:window
  onclick={zatvoriIzvan}
  onkeydown={(dogadaj) => dogadaj.key === 'Escape' && zatvori()}
  onscroll={uzOkidac ? zatvori : undefined}
/>

<span
  class="pojam-omotac"
  class:uz-okidac={uzOkidac}
  bind:this={omotac}
  onmouseenter={naHoverEnter}
  onmouseleave={naHoverLeave}
>
  <button
    type="button"
    class="pojam-gumb"
    class:samo-ikona={samoIkona}
    aria-label={ariaLabel ?? (samoIkona ? 'Pojasni' : undefined)}
    aria-expanded={otvoreno}
    aria-controls={id}
    aria-describedby={otvoreno ? id : undefined}
    onfocus={naFocus}
    onblur={naBlur}
    onclick={preklopi}
  >
    {#if tekst}<span>{tekst}</span>{/if}
    <CircleHelp size={14} strokeWidth={2.25} aria-hidden="true" />
  </button>
  {#if otvoreno}
    <span
      id={id}
      class="pojasnjenje"
      class:uz-okidac={uzOkidac}
      role="tooltip"
      onclick={(e) => e.stopPropagation()}
    >{opis}</span>
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
    min-width: 28px;
    min-height: 28px;
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

  .pojam-gumb.samo-ikona {
    border-bottom: 0;
    justify-content: center;
  }

  .pojasnjenje {
    position: absolute;
    z-index: 30;
    left: 0;
    top: calc(100% + 8px);
    width: min(280px, calc(100vw - 32px));
    padding: 12px 14px;
    border: 1px solid var(--boja-obrub-jaci);
    border-radius: 8px;
    background: var(--boja-povrsina-2);
    box-shadow: var(--sjena-modal);
    color: var(--boja-tekst-osnovni);
    font-family: var(--font-tijelo);
    font-size: var(--tekst-sitni);
    font-weight: 500;
    line-height: 1.45;
  }

  /* Default: na užem ekranu fixed na dnu (postojeće ponašanje). */
  @media (max-width: 999px) {
    .pojasnjenje:not(.uz-okidac) {
      position: fixed;
      inset: auto 16px 16px;
      width: auto;
    }
  }

  /* Anchored način: uvijek uz okidač, i na mobitelu. */
  .pojasnjenje.uz-okidac {
    position: absolute;
    left: 0;
    right: auto;
    top: calc(100% + 8px);
    bottom: auto;
    width: min(280px, calc(100vw - 32px));
  }
</style>
