<script lang="ts">
  import { onMount } from 'svelte';
  import { ALargeSmall, Moon, Sun, Volume2, VolumeX } from 'lucide-svelte';
  import { glasUkljucen, postaviGlas } from '$lib/glasovni-manager.js';
  import { openDyslexicUkljucen, postaviOpenDyslexic } from '$lib/postavke-fonta.js';
  import { postaviTemu, tema } from '$lib/postavke-teme.js';
  import PrekidacPostavke from './PrekidacPostavke.svelte';

  let svijetlaUkljucena = $state(false);
  let govorUkljucen = $state(false);
  let fontUkljucen = $state(false);

  onMount(() => {
    const odjavaTeme = tema.subscribe((vrijednost) => (svijetlaUkljucena = vrijednost === 'svijetla'));
    const odjavaGovora = glasUkljucen.subscribe((vrijednost) => (govorUkljucen = vrijednost));
    const odjavaFonta = openDyslexicUkljucen.subscribe((vrijednost) => (fontUkljucen = vrijednost));
    return () => {
      odjavaTeme();
      odjavaGovora();
      odjavaFonta();
    };
  });
</script>

<div
  class="brze-postavke"
  role="group"
  aria-label="Brze postavke"
  data-testid="naslovnica-brze-postavke"
>
  <PrekidacPostavke
    checked={svijetlaUkljucena}
    ariaLabel="Svijetli način"
    testId="brza-postavka-tema"
    onchange={(ukljucen) => postaviTemu(ukljucen ? 'svijetla' : 'tamna')}
  >
    <span class="brze-postavke__ikona" aria-hidden="true">
      {#if svijetlaUkljucena}
        <Sun size={24} strokeWidth={2} />
      {:else}
        <Moon size={24} strokeWidth={2} />
      {/if}
    </span>
    <strong class="brze-postavke__naziv">Svijetli način</strong>
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={govorUkljucen}
    ariaLabel="Čitanje naglas"
    testId="brza-postavka-glas"
    onchange={(ukljucen) => postaviGlas(ukljucen)}
  >
    <span class="brze-postavke__ikona" aria-hidden="true">
      {#if govorUkljucen}
        <Volume2 size={24} strokeWidth={2} />
      {:else}
        <VolumeX size={24} strokeWidth={2} />
      {/if}
    </span>
    <strong class="brze-postavke__naziv">Čitanje naglas</strong>
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={fontUkljucen}
    ariaLabel="Font za disleksiju"
    testId="brza-postavka-font"
    onchange={(ukljucen) => postaviOpenDyslexic(ukljucen)}
  >
    <span class="brze-postavke__ikona" aria-hidden="true">
      <ALargeSmall size={24} strokeWidth={2} />
    </span>
    <strong class="brze-postavke__naziv">Font za disleksiju</strong>
  </PrekidacPostavke>
</div>

<style>
  .brze-postavke {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    gap: 8px 12px;
    width: 100%;
    margin-inline: auto;
    min-width: 0;
    position: relative;
    z-index: 0;
    isolation: isolate;
  }

  .brze-postavke :global(.prekidac-postavke) {
    min-width: 0;
    width: 100%;
    max-width: 100%;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    align-self: start;
    gap: 8px;
    min-height: 44px;
    height: auto;
    padding: 8px 4px 10px;
    border: 0;
    border-radius: 10px;
    background: transparent;
  }

  .brze-postavke :global(.prekidac-postavke.ukljuceno) {
    background: transparent;
    border-color: transparent;
  }

  .brze-postavke :global(.prekidac-postavke:hover) {
    border-color: transparent;
  }

  .brze-postavke :global(.prekidac-postavke:focus-within) {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
    border-radius: 10px;
  }

  .brze-postavke :global(.prekidac-postavke__sadrzaj) {
    flex: 0 0 auto;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    width: 100%;
  }

  .brze-postavke :global(.prekidac) {
    margin-left: 0;
  }

  .brze-postavke__ikona {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: var(--boja-zuta-krema);
  }

  .brze-postavke__ikona :global(svg) {
    width: 24px;
    height: 24px;
  }

  .brze-postavke__naziv {
    flex: 0 1 auto;
    min-width: 0;
    width: 100%;
    font-family: var(--font-tijelo);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    text-align: center;
    white-space: normal;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  :global(html[data-font-disleksiju]) .brze-postavke__naziv {
    font-size: 14px;
    line-height: 1.3;
  }

  :global(html[data-tema='svijetla']) .brze-postavke__ikona {
    color: color-mix(in srgb, var(--boja-akcent-tekst) 85%, #1a1815);
  }

  @media (max-width: 359px) {
    .brze-postavke {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
      max-width: 280px;
    }

    .brze-postavke :global(.prekidac-postavke) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
    }

    .brze-postavke :global(.prekidac-postavke__sadrzaj) {
      flex-direction: row;
      justify-content: flex-start;
      width: auto;
    }

    .brze-postavke__naziv {
      width: auto;
      text-align: left;
      font-size: 14px;
    }
  }

  @media (min-width: 1000px) {
    .brze-postavke {
      width: auto;
      max-width: none;
      margin-inline: 0;
      gap: 4px 10px;
      grid-template-columns: repeat(3, max-content);
    }

    .brze-postavke :global(.prekidac-postavke) {
      width: auto;
      min-width: 108px;
      padding: 6px 8px 8px;
    }

    .brze-postavke__naziv {
      font-size: 16px;
    }

    :global(html[data-font-disleksiju]) .brze-postavke__naziv {
      font-size: 16px;
    }
  }
</style>
