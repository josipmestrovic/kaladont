<script lang="ts">
  import { onMount } from 'svelte';
  import { glasUkljucen, postaviGlas } from '$lib/glasovni-manager.js';
  import { openDyslexicUkljucen, postaviOpenDyslexic } from '$lib/postavke-fonta.js';

  let { ugradeno = false } = $props<{ ugradeno?: boolean }>();
  let fontUkljucen = $state(false);
  let govorUkljucen = $state(false);

  onMount(() => {
    const odjavaFonta = openDyslexicUkljucen.subscribe((vrijednost) => (fontUkljucen = vrijednost));
    const odjavaGovora = glasUkljucen.subscribe((vrijednost) => (govorUkljucen = vrijednost));
    return () => {
      odjavaFonta();
      odjavaGovora();
    };
  });

  function promijeniFont(dogadaj: Event) {
    postaviOpenDyslexic((dogadaj.currentTarget as HTMLInputElement).checked);
  }

  function promijeniGovor(dogadaj: Event) {
    postaviGlas((dogadaj.currentTarget as HTMLInputElement).checked);
  }
</script>

<div class:ugradeno class="kontrole-pristupacnosti" role="group" aria-label="Postavke pristupačnosti">
  <label class="kontrola-pristupacnosti">
    <input
      type="checkbox"
      role="switch"
      aria-label="Font za disleksiju"
      checked={fontUkljucen}
      onchange={promijeniFont}
    />
    <span class="prekidac" aria-hidden="true"><span></span></span>
    <strong class="naziv-kontrole">Font za disleksiju</strong>
  </label>

  <label class="kontrola-pristupacnosti">
    <input
      type="checkbox"
      role="switch"
      aria-label="Čitanje naglas"
      checked={govorUkljucen}
      onchange={promijeniGovor}
    />
    <span class="prekidac" aria-hidden="true"><span></span></span>
    <strong class="naziv-kontrole">Čitanje naglas</strong>
  </label>
</div>

<style>
  .kontrole-pristupacnosti {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
  }

  .kontrola-pristupacnosti {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-width: 0;
    min-height: var(--visina-kontrole, 56px);
    padding: 8px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: var(--boja-povrsina);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
  }

  .ugradeno .kontrola-pristupacnosti {
    padding-inline: 0;
    border: 0;
    background: transparent;
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .prekidac {
    display: flex;
    align-items: center;
    width: 42px;
    height: 24px;
    flex: 0 0 auto;
    padding: 3px;
    border-radius: 999px;
    background: var(--boja-obrub-jaci);
    transition: background-color 160ms ease;
  }

  .prekidac span {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    transition: transform 160ms ease;
  }

  input:checked + .prekidac {
    background: var(--boja-mint);
  }

  input:checked + .prekidac span {
    transform: translateX(18px);
  }

  input:focus-visible + .prekidac {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
  }

  .naziv-kontrole {
    display: block;
    min-width: 0;
    line-height: 1.2;
    font-size: var(--tekst-sitni);
  }

  @media (max-width: 420px) {
    .kontrole-pristupacnosti {
      gap: 4px;
    }

    .kontrola-pristupacnosti {
      gap: 6px;
      padding-inline: 6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .prekidac,
    .prekidac span {
      transition: none;
    }
  }
</style>