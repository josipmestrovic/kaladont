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
    /* Sprečava da apsolutni input „pobjegne” izvan labele i lovi tuđe klikove. */
    overflow: hidden;
    isolation: isolate;
  }

  .prekidac-postavke.ukljuceno {
    background: color-mix(in srgb, var(--boja-povrsina) 82%, transparent);
    border-color: color-mix(in srgb, var(--boja-crvena) 55%, var(--boja-obrub));
  }

  .prekidac-postavke:hover {
    border-color: color-mix(in srgb, var(--boja-crvena) 40%, var(--boja-obrub));
  }

  .prekidac-postavke__sadrzaj {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
  }

  /*
   * Nevidljivi, ali i dalje u labeli — native <label> hvata klik po cijeloj
   * kontroli. Bez width/height: 100% koji u nekim layoutima rastegnuli hit-box
   * izvan labele (npr. aktivacija „Font za disleksiju” tuđim klikom).
   */
  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }

  .prekidac {
    display: flex;
    align-items: center;
    width: 30px;
    height: 18px;
    flex: 0 0 auto;
    margin-left: auto;
    padding: 2px;
    border-radius: var(--radijus-kontrola);
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
    .prekidac,
    .prekidac span {
      transition: none;
    }
  }
</style>
