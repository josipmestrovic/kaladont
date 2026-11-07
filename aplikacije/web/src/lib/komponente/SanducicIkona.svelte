<script lang="ts">
  import { dohvatiStanjeSanducica } from '$lib/stanje-sanducica.svelte.js';

  let { velicina = 44 }: { velicina?: number } = $props();

  const stanje = dohvatiStanjeSanducica();
  const imaNeprocitanih = $derived(stanje.brojNeprocitanih > 0);
  const aria = $derived(
    imaNeprocitanih
      ? `Obavijesti, ${stanje.brojNeprocitanih} nepročitane`
      : 'Obavijesti',
  );
</script>

<a href="/obavijesti" class="sanducic-ikona" aria-label={aria} style={`--sanducic-velicina: ${velicina}px`}>
  <img
    class="ikona"
    src="/ikone/81-mailbox.webp"
    alt=""
    aria-hidden="true"
    width={velicina}
    height={velicina}
  />
  {#if imaNeprocitanih}
    <span class="tockica" aria-hidden="true"></span>
  {/if}
</a>

<style>
  .sanducic-ikona {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--sanducic-velicina, 44px);
    height: var(--sanducic-velicina, 44px);
    min-width: 44px;
    min-height: 44px;
    text-decoration: none;
    flex-shrink: 0;
  }

  .ikona {
    width: var(--sanducic-velicina, 44px);
    height: var(--sanducic-velicina, 44px);
    object-fit: contain;
    display: block;
  }

  .tockica {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #e23b3b;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
</style>
