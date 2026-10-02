<script lang="ts">
  import { onMount } from 'svelte';
  import { postaviTemu, tema } from '$lib/postavke-teme.js';

  let svijetlaUkljucena = $state(false);

  onMount(() => tema.subscribe((vrijednost) => (svijetlaUkljucena = vrijednost === 'svijetla')));

  function promijeniTemu(dogadaj: Event) {
    postaviTemu((dogadaj.currentTarget as HTMLInputElement).checked ? 'svijetla' : 'tamna');
  }
</script>

<label class="prekidac-teme">
  <input
    type="checkbox"
    role="switch"
    aria-label="Svijetla tema"
    checked={svijetlaUkljucena}
    onchange={promijeniTemu}
  />
  <span class="prekidac" aria-hidden="true"><span></span></span>
  <strong class="naziv-kontrole">Svijetla tema</strong>
</label>

<style>
  .prekidac-teme {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--boja-tekst-osnovni);
    cursor: pointer;
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
    line-height: 1.2;
    font-size: var(--tekst-sitni);
  }

  @media (prefers-reduced-motion: reduce) {
    .prekidac,
    .prekidac span {
      transition: none;
    }
  }
</style>
