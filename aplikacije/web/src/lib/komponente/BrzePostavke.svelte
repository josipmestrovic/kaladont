<script lang="ts">
  import { onMount } from 'svelte';
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
    <strong class="brze-postavke__naziv">{svijetlaUkljucena ? 'Svijetli način' : 'Tamni način'}</strong>
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={govorUkljucen}
    ariaLabel="Čitanje naglas"
    testId="brza-postavka-glas"
    onchange={(ukljucen) => postaviGlas(ukljucen)}
  >
    <strong class="brze-postavke__naziv">Čitanje naglas</strong>
  </PrekidacPostavke>

  <PrekidacPostavke
    checked={fontUkljucen}
    ariaLabel="Font za disleksiju"
    testId="brza-postavka-font"
    onchange={(ukljucen) => postaviOpenDyslexic(ukljucen)}
  >
    <strong class="brze-postavke__naziv">Font za disleksiju</strong>
  </PrekidacPostavke>
</div>

<style>
  .brze-postavke {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
    margin-inline: auto;
    min-width: 0;
  }

  .brze-postavke :global(.prekidac-postavke) {
    min-width: 0;
    width: 100%;
  }

  .brze-postavke__naziv {
    flex: 0 1 auto;
    min-width: 0;
    font-family: var(--font-tijelo);
    font-size: var(--tekst-mikro);
    font-weight: 600;
    line-height: 1.2;
    text-align: left;
    white-space: nowrap;
  }

  :global(html[data-font-disleksiju]) .brze-postavke__naziv {
    font-size: var(--tekst-sitni);
    line-height: 1.3;
  }

  /* Mobitel: 3 stupca — naziv gore, prekidač dolje. */
  @media (max-width: 999px) {
    .brze-postavke {
      gap: 8px;
    }

    .brze-postavke :global(.prekidac-postavke) {
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      min-height: 0;
      padding: 10px 6px 12px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--boja-povrsina) 78%, transparent);
    }

    .brze-postavke :global(.prekidac-postavke__sadrzaj) {
      flex: 0 0 auto;
      justify-content: center;
      width: 100%;
    }

    .brze-postavke__naziv {
      width: 100%;
      font-size: 12px;
      line-height: 1.25;
      text-align: center;
      white-space: normal;
      overflow-wrap: break-word;
      hyphens: auto;
    }

    .brze-postavke :global(.prekidac) {
      margin-left: 0;
    }

    :global(html[data-tema='svijetla']) .brze-postavke :global(.prekidac-postavke) {
      background: color-mix(in srgb, var(--boja-povrsina) 94%, transparent);
    }

    :global(html[data-font-disleksiju]) .brze-postavke__naziv {
      font-size: 13px;
      line-height: 1.3;
    }
  }

  @media (min-width: 1000px) {
    .brze-postavke {
      grid-template-columns: repeat(3, max-content);
      gap: 8px;
      width: max-content;
      max-width: 100%;
      margin-inline: 0;
      justify-content: start;
    }

    .brze-postavke :global(.prekidac-postavke) {
      width: auto;
      gap: 6px;
      padding: 5px 10px;
    }

    .brze-postavke__naziv {
      font-size: var(--tekst-mikro);
    }
  }
</style>
