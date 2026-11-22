<script lang="ts">
  import { Bell } from 'lucide-svelte';
  import { dohvatiStanjeSanducica } from '$lib/stanje-sanducica.svelte.js';

  let { velicina = 44 }: { velicina?: number } = $props();

  const stanje = dohvatiStanjeSanducica();
  const imaNeprocitanih = $derived(stanje.brojNeprocitanih > 0);
  const aria = $derived(
    imaNeprocitanih
      ? `Obavijesti, ${stanje.brojNeprocitanih} nepročitane`
      : 'Obavijesti',
  );
  const ikonaVelicina = $derived(Math.round(velicina * 0.72));
</script>

<a href="/obavijesti" class="sanducic-ikona" aria-label={aria} style={`--sanducic-velicina: ${velicina}px`}>
  <Bell class="ikona" size={ikonaVelicina} strokeWidth={2.2} aria-hidden="true" />
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
    color: var(--boja-tekst-osnovni);
    text-decoration: none;
    flex-shrink: 0;
  }

  .sanducic-ikona:hover {
    color: var(--boja-akcent-tekst);
  }

  .ikona {
    display: block;
    flex-shrink: 0;
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
