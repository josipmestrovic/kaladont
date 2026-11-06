<script lang="ts">
  import { dohvatiRedDostignuca, zatvoriDostignuce } from '$lib/obavijesti-dostignuca.svelte.js';
  import { ikonaDostignuca } from '$lib/ikone-dostignuca.js';

  const stanje = dohvatiRedDostignuca();
</script>

{#if stanje.stavke.length > 0}
  <div class="red-dostignuca">
    {#each stanje.stavke as stavka (stavka.id)}
      <aside class="dostignuce-obavijest" role="status" aria-live="polite">
        <img src={ikonaDostignuca(stavka.dostignuceId)} alt="" />
        <p>
          <strong>{stavka.naziv}</strong>
          <span>{stavka.novaRazina}. zvjezdica od {stavka.maksimalnaRazina}</span>
        </p>
        <button type="button" class="zatvori" aria-label="Zatvori obavijest" onclick={() => zatvoriDostignuce(stavka.id)}>×</button>
      </aside>
    {/each}
  </div>
{/if}

<style>
  .red-dostignuca {
    display: grid;
    gap: 8px;
    pointer-events: auto;
  }

  .dostignuce-obavijest {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 12px;
    padding: 12px 44px 12px 14px;
    position: relative;
    border: 2px solid var(--boja-uspjeh-tekst);
    border-radius: 10px;
    background: var(--boja-uspjeh-pozadina);
    color: var(--boja-uspjeh-tekst);
    box-shadow: var(--sjena-modal);
  }

  .dostignuce-obavijest img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    flex: none;
  }

  .dostignuce-obavijest p {
    display: grid;
    margin: 0;
    gap: 2px;
  }

  .dostignuce-obavijest strong {
    font-size: 1.05rem;
    line-height: 1.3;
  }

  .dostignuce-obavijest span {
    font-size: 0.92rem;
    line-height: 1.3;
  }

  .dostignuce-obavijest button.zatvori {
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
</style>
