<script lang="ts">
  import { onMount } from 'svelte';
  import PadajucaPartija from './PadajucaPartija.svelte';

  /** Širina središnjeg sadržaja naslovnice — usklađena s --sirina-grida. */
  const SIRINA_SREDISTA = 980;
  /** Minimalna širina bočne zone da animacija ima smisla (uz 28px sigurnosni umetak). */
  const MIN_ZONA = 140;

  let pauzirano = $state(false);
  let uskaZona = $state(false);
  let dovoljnoProstora = $state(true);

  function osvjeziProstor() {
    const sirina = window.innerWidth;
    const zona = (sirina - SIRINA_SREDISTA) / 2;
    dovoljnoProstora = zona >= MIN_ZONA;
    uskaZona = zona < 200;
  }

  onMount(() => {
    osvjeziProstor();
    const naVidljivost = () => {
      pauzirano = document.hidden;
    };
    naVidljivost();
    document.addEventListener('visibilitychange', naVidljivost);
    window.addEventListener('resize', osvjeziProstor);
    return () => {
      document.removeEventListener('visibilitychange', naVidljivost);
      window.removeEventListener('resize', osvjeziProstor);
    };
  });
</script>

{#if dovoljnoProstora}
  <div class="pozadina-rijeci" aria-hidden="true" data-testid="pozadina-rijeci">
    <PadajucaPartija
      strana="lijevo"
      brzinaPxPoSekundi={32}
      intervalMs={3500}
      {pauzirano}
      {uskaZona}
    />
    <PadajucaPartija
      strana="desno"
      brzinaPxPoSekundi={26}
      intervalMs={4500}
      {pauzirano}
      {uskaZona}
    />
  </div>
{/if}

<style>
  .pozadina-rijeci {
    position: absolute;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    --sirina-grida: 980px;
  }
</style>
