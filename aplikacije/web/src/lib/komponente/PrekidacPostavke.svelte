<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    checked = false,
    ariaLabel,
    testId,
    onchange,
    children,
  }: {
    checked?: boolean;
    ariaLabel: string;
    testId?: string;
    onchange: (ukljucen: boolean) => void;
    children: Snippet;
  } = $props();

  function naPromjenu(dogadaj: Event) {
    onchange((dogadaj.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="prekidac-postavke" class:ukljuceno={checked} data-testid={testId}>
  <span class="prekidac-postavke__sadrzaj">
    {@render children()}
  </span>
  <input
    type="checkbox"
    role="switch"
    aria-label={ariaLabel}
    checked={checked}
    onchange={naPromjenu}
  />
  <span class="prekidac" aria-hidden="true"><span></span></span>
</label>

<style>
  .prekidac-postavke {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    width: 100%;
    min-height: 36px;
    padding: 5px 10px;
    border: 1px solid var(--boja-obrub);
    border-radius: 8px;
    background: color-mix(in srgb, var(--boja-povrsina) 55%, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
    transition:
      border-color 160ms ease,
      background-color 160ms ease,
      transform 160ms ease,
      box-shadow 160ms ease;
  }

  .prekidac-postavke.ukljuceno {
    background: color-mix(in srgb, var(--boja-povrsina) 82%, transparent);
    border-color: color-mix(in srgb, var(--boja-crvena) 55%, var(--boja-obrub));
  }

  .prekidac-postavke:hover {
    border-color: color-mix(in srgb, var(--boja-crvena) 55%, var(--boja-obrub));
    background: color-mix(in srgb, var(--boja-crvena) 14%, var(--boja-povrsina));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(0 0 0 / 18%);
  }

  .prekidac-postavke:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .prekidac-postavke__sadrzaj {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .prekidac {
    display: flex;
    align-items: center;
    width: 30px;
    height: 18px;
    flex: 0 0 auto;
    margin-left: auto;
    padding: 2px;
    border-radius: 999px;
    background: var(--boja-obrub-jaci);
    transition: background-color 160ms ease;
  }

  .prekidac span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 18%);
    transition: transform 160ms ease;
  }

  input:checked + .prekidac {
    background: var(--boja-crvena);
  }

  input:checked + .prekidac span {
    transform: translateX(12px);
  }

  input:focus-visible + .prekidac {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
  }

  :global(html[data-tema='svijetla']) .prekidac-postavke {
    background: color-mix(in srgb, var(--boja-povrsina) 88%, transparent);
  }

  :global(html[data-tema='svijetla']) .prekidac-postavke.ukljuceno {
    background: color-mix(in srgb, var(--boja-crvena) 12%, var(--boja-povrsina));
  }

  @media (prefers-reduced-motion: reduce) {
    .prekidac-postavke,
    .prekidac,
    .prekidac span {
      transition: none;
    }

    .prekidac-postavke:hover,
    .prekidac-postavke:active {
      transform: none;
      box-shadow: none;
    }
  }
</style>
