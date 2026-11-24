<script lang="ts">
  import { onMount } from 'svelte';
  import { Moon, Sun, Type, Volume2 } from 'lucide-svelte';
  import { glasUkljucen, postaviGlas } from '$lib/glasovni-manager.js';
  import { openDyslexicUkljucen, postaviOpenDyslexic } from '$lib/postavke-fonta.js';
  import { postaviTemu, tema } from '$lib/postavke-teme.js';
  import PrekidacPostavke from './PrekidacPostavke.svelte';

  const IKONA = 22;

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
    {#if svijetlaUkljucena}
      <Sun class="brze-postavke__ikona" size={IKONA} strokeWidth={2} aria-hidden="true" />
      <strong class="brze-postavke__naziv">Svijetli način</strong>
    {:else}
      <Moon class="brze-postavke__ikona" size={IKONA} strokeWidth={2} aria-hidden="true" />
      <strong class="brze-postavke__naziv">Tamni način</strong>
    {/if}
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={govorUkljucen}
    ariaLabel="Čitanje naglas"
    testId="brza-postavka-glas"
    onchange={(ukljucen) => postaviGlas(ukljucen)}
  >
    <Volume2 class="brze-postavke__ikona" size={IKONA} strokeWidth={2} aria-hidden="true" />
    <strong class="brze-postavke__naziv">Čitanje naglas</strong>
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={fontUkljucen}
    ariaLabel="Font za disleksiju"
    testId="brza-postavka-font"
    onchange={(ukljucen) => postaviOpenDyslexic(ukljucen)}
  >
    <Type class="brze-postavke__ikona" size={IKONA} strokeWidth={2} aria-hidden="true" />
    <strong class="brze-postavke__naziv">Font za disleksiju</strong>
  </PrekidacPostavke>
</div>

<style>
  .brze-postavke {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    justify-content: center;
    gap: 8px 10px;
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
    min-width: 0;
  }

  .brze-postavke :global(.brze-postavke__ikona) {
    flex: 0 0 auto;
    color: var(--boja-tekst-sekundarni);
  }

  .brze-postavke__naziv {
    min-width: 0;
    font-family: var(--font-tijelo);
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    text-align: left;
  }

  :global(html[data-font-disleksiju]) .brze-postavke {
    gap: 10px;
  }

  :global(html[data-font-disleksiju]) .brze-postavke__naziv {
    font-size: 15px;
    line-height: 1.35;
  }

  @media (min-width: 1000px) {
    .brze-postavke {
      gap: 10px 12px;
      flex-wrap: nowrap;
    }

    .brze-postavke__naziv {
      font-size: 15px;
    }
  }

  @media (max-width: 379px) {
    .brze-postavke {
      gap: 8px;
    }
  }
</style>
