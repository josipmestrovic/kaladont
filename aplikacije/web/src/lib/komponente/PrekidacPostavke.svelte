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

<label class="prekidac-postavke" data-testid={testId}>
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
    gap: 8px;
    min-width: 0;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--boja-obrub);
    border-radius: 10px;
    background: color-mix(in srgb, var(--boja-povrsina) 72%, transparent);
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
  }

  .prekidac-postavke__sadrzaj {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
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
    width: 36px;
    height: 22px;
    flex: 0 0 auto;
    margin-left: auto;
    padding: 2px;
    border-radius: 999px;
    background: var(--boja-obrub-jaci);
    transition: background-color 160ms ease;
  }

  .prekidac span {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    transition: transform 160ms ease;
  }

  input:checked + .prekidac {
    background: var(--boja-mint);
  }

  input:checked + .prekidac span {
    transform: translateX(14px);
  }

  input:focus-visible + .prekidac {
    outline: 3px solid var(--boja-fokus);
    outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .prekidac,
    .prekidac span {
      transition: none;
    }
  }
</style>
