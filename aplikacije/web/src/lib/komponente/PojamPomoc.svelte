<script lang="ts">
  import { tick } from 'svelte';
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
  let tooltipEl: HTMLSpanElement | undefined;
  const samoIkona = $derived(!tekst);
  const uzOkidac = $derived(pozicioniranje === 'uz-okidac');

  const RUB_VIEWPORTA_PX = 16;

  function resetirajStilTooltips(tip: HTMLSpanElement) {
    tip.style.left = '0';
    tip.style.right = 'auto';
    tip.style.top = 'calc(100% + 8px)';
    tip.style.bottom = 'auto';
    tip.style.maxHeight = '';
    tip.style.overflowY = '';
  }

  async function pozicionirajUzOkidac() {
    if (!uzOkidac || !omotac) return;
    await tick();
    const tip = tooltipEl;
    if (!tip) return;
    const okidac = omotac.getBoundingClientRect();
    // Mjeri u zadanom položaju, zatim uvijek upiši konačni stil na element
    // (ne ovisi o Svelte style bindu koji može preskočiti isti string nakon resizea).
    resetirajStilTooltips(tip);
    const tipRect = tip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let leftPx = 0;
    const overflowDesno = okidac.left + tipRect.width + RUB_VIEWPORTA_PX - vw;
    if (overflowDesno > 0) leftPx = -overflowDesno;
    const overflowLijevo = okidac.left + leftPx - RUB_VIEWPORTA_PX;
    if (overflowLijevo < 0) leftPx -= overflowLijevo;

    const mjestoIspod = vh - okidac.bottom - 8 - RUB_VIEWPORTA_PX;
    const mjestoIznad = okidac.top - 8 - RUB_VIEWPORTA_PX;
    const trebaGore = tipRect.height > mjestoIspod && mjestoIznad > mjestoIspod;
    const dostupnaVisina = Math.max(80, trebaGore ? mjestoIznad : mjestoIspod);

    tip.style.left = `${leftPx}px`;
    tip.style.right = 'auto';
    tip.style.maxHeight = `${Math.min(tipRect.height, dostupnaVisina)}px`;
    tip.style.overflowY = 'auto';
    if (trebaGore) {
      tip.style.top = 'auto';
      tip.style.bottom = 'calc(100% + 8px)';
    } else {
      tip.style.top = 'calc(100% + 8px)';
      tip.style.bottom = 'auto';
    }
  }

  function otvori(klikom: boolean) {
    otvoreno = true;
    otvorenoKlikom = klikom;
    if (uzOkidac) void pozicionirajUzOkidac();
  }

  function preklopi(dogadaj: MouseEvent) {
    dogadaj.stopPropagation();
    if (otvoreno && otvorenoKlikom) {
      otvoreno = false;
      otvorenoKlikom = false;
      return;
    }
    otvori(true);
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
    otvori(false);
  }

  function naHoverLeave() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvoreno = false;
  }

  function naFocus() {
    if (!uzOkidac || otvorenoKlikom) return;
    otvori(false);
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
  onresize={uzOkidac && otvoreno ? () => void pozicionirajUzOkidac() : undefined}
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
      bind:this={tooltipEl}
      onclick={(e) => e.stopPropagation()}
    >{opis}</span>
  {/if}
</span>

<style>
  .pojam-omotac {
    position: relative;
    display: inline-block;
  }

  .pojam-omotac.uz-okidac {
    overflow: visible;
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
    max-height: min(50vh, 320px);
    overflow-y: auto;
  }
</style>
