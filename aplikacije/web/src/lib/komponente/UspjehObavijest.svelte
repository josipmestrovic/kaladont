<script lang="ts">
  import { dohvatiUspjehObavijest, zatvoriUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

  const stanje = dohvatiUspjehObavijest();
</script>

{#if stanje.poruka}
  <aside class="uspjeh-obavijest" role="status" aria-live="polite">
    <strong>{stanje.poruka}</strong>
    <button type="button" class="zatvori" aria-label="Zatvori obavijest" onclick={zatvoriUspjeh}>×</button>
  </aside>
{/if}

<style>
  .uspjeh-obavijest {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 48px 16px 20px;
    position: relative;
    border: 2px solid var(--boja-uspjeh-tekst);
    border-radius: 10px;
    background: var(--boja-uspjeh-pozadina);
    color: var(--boja-uspjeh-tekst);
    box-shadow: var(--sjena-modal);
    animation: uspjeh-ulaz 0.45s ease-out;
  }

  .uspjeh-obavijest strong {
    font-weight: 700;
    font-size: 1.05rem;
    line-height: 1.35;
  }

  .uspjeh-obavijest button.zatvori {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }

  @keyframes uspjeh-ulaz {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
