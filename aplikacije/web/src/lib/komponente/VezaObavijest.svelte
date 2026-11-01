<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { dohvatiStanjeVeze, type StanjeVeze } from '$lib/socket.js';
  import { dohvatiStanjeIgre } from '$lib/stanje-igre.svelte.js';

  const stanjeVeze = dohvatiStanjeVeze();
  const stanjeIgre = dohvatiStanjeIgre();
  const prikazivaStanja: StanjeVeze[] = ['prekid', 'ponovno_spajanje', 'sesija_istekla', 'druga_kartica'];
  const obavijestAktivna = $derived(stanjeVeze.partijaNedostupna || prikazivaStanja.includes(stanjeVeze.stanje));
  let obavijestZatvorena = $state(false);
  let obavijest: HTMLElement | undefined = $state();
  const trebaPrikazati = $derived(obavijestAktivna && !obavijestZatvorena);

  $effect(() => {
    if (!obavijestAktivna) obavijestZatvorena = false;
  });

  onMount(() => {
    function zatvoriKlikomIzvan(dogadaj: MouseEvent): void {
      if (!trebaPrikazati || !obavijest || !(dogadaj.target instanceof Node)) return;
      if (!obavijest.contains(dogadaj.target)) obavijestZatvorena = true;
    }

    document.addEventListener('click', zatvoriKlikomIzvan);
    return () => document.removeEventListener('click', zatvoriKlikomIzvan);
  });

  $effect(() => {
    if (!$page.url.pathname.startsWith('/partija/') || $page.url.pathname.startsWith('/partija/arhiva/')) {
      stanjeVeze.partijaNedostupna = false;
      return;
    }
    if (stanjeVeze.stanje !== 'spremno') return;
    const ocekivaniId = $page.params.id;
    const timer = window.setTimeout(() => {
      if (ocekivaniId && stanjeIgre.partijaId !== ocekivaniId) stanjeVeze.partijaNedostupna = true;
    }, 3_000);
    return () => window.clearTimeout(timer);
  });

  const naslov = $derived(
    stanjeVeze.partijaNedostupna
      ? 'Partija više nije dostupna.'
      : stanjeVeze.stanje === 'sesija_istekla'
      ? 'Sesija je istekla.'
      : stanjeVeze.stanje === 'druga_kartica'
        ? 'Ova je kartica zatvorena.'
        : stanjeVeze.stanje === 'ponovno_spajanje'
          ? 'Pokušavamo ponovno povezivanje.'
          : 'Veza je prekinuta.',
  );

  const opis = $derived(
    stanjeVeze.partijaNedostupna
      ? 'Vjerojatno je došlo do ponovnog pokretanja poslužitelja.'
      : stanjeVeze.stanje === 'sesija_istekla'
      ? 'Prijavi se ponovno kako bi nastavio/la.'
      : stanjeVeze.stanje === 'druga_kartica'
        ? 'Isti identitet otvoren je u drugoj kartici.'
        : stanjeVeze.stanje === 'ponovno_spajanje'
          ? `Pokušaj ${Math.max(1, stanjeVeze.brojPokusaja)}...`
          : 'Čekamo da se veza s poslužiteljem vrati.',
  );

  function prijaviSe(): void {
    obavijestZatvorena = true;
    void goto('/prijava');
  }
</script>

{#if trebaPrikazati}
  <aside bind:this={obavijest} class="veza-obavijest" class:kriticno={stanjeVeze.stanje === 'sesija_istekla' || stanjeVeze.stanje === 'druga_kartica'} role="status" aria-live="polite">
    <div>
      <strong>{naslov}</strong>
      <span>{opis}</span>
    </div>
    <button type="button" class="zatvori" aria-label="Zatvori obavijest" onclick={() => (obavijestZatvorena = true)}>×</button>
    {#if stanjeVeze.partijaNedostupna}
      <button type="button" onclick={() => void goto('/')}>Na početnu</button>
    {:else if stanjeVeze.stanje === 'sesija_istekla'}
      <button type="button" onclick={prijaviSe}>Prijavi se</button>
    {/if}
  </aside>
{/if}

<style>
  .veza-obavijest {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 44px 12px 16px;
    position: relative;
    border: 1px solid var(--boja-zlato-obrub);
    border-radius: 8px;
    background: var(--boja-zlato-pozadina);
    color: var(--boja-zlato-tekst);
    box-shadow: var(--sjena-modal);
  }

  .veza-obavijest.kriticno {
    border-color: var(--boja-poraz-tekst);
    background: var(--boja-poraz-pozadina);
    color: var(--boja-poraz-tekst);
  }

  .veza-obavijest div {
    display: grid;
    gap: 2px;
  }

  .veza-obavijest span {
    font-size: 0.9rem;
  }

  .veza-obavijest button {
    flex: 0 0 auto;
    padding: 7px 12px;
    border: 1px solid var(--boja-cta-pozadina);
    border-radius: 6px;
    background: var(--boja-cta-pozadina);
    color: var(--boja-cta-tekst);
    cursor: pointer;
  }

  .veza-obavijest button.zatvori {
    position: absolute;
    top: 6px;
    right: 6px;
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
  }

  @media (max-width: 999px) {
    .veza-obavijest {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
