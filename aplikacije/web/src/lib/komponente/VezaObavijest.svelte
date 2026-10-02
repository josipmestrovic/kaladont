<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { dohvatiStanjeVeze, type StanjeVeze } from '$lib/socket.js';
  import { dohvatiStanjeIgre } from '$lib/stanje-igre.svelte.js';

  const stanjeVeze = dohvatiStanjeVeze();
  const stanjeIgre = dohvatiStanjeIgre();
  const prikazivaStanja: StanjeVeze[] = ['prekid', 'ponovno_spajanje', 'sesija_istekla', 'druga_kartica'];
  const trebaPrikazati = $derived(stanjeVeze.partijaNedostupna || prikazivaStanja.includes(stanjeVeze.stanje));

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

  function osvjezi(): void {
    window.location.reload();
  }
</script>

{#if trebaPrikazati}
  <aside class="veza-obavijest" class:kriticno={stanjeVeze.stanje === 'sesija_istekla' || stanjeVeze.stanje === 'druga_kartica'} role="status" aria-live="polite">
    <div>
      <strong>{naslov}</strong>
      <span>{opis}</span>
    </div>
    {#if stanjeVeze.partijaNedostupna}
      <button type="button" onclick={() => void goto('/')}>Na početnu</button>
    {:else if stanjeVeze.stanje === 'sesija_istekla'}
      <button type="button" onclick={() => void goto('/prijava')}>Prijavi se</button>
    {:else if stanjeVeze.stanje === 'druga_kartica'}
      <button type="button" onclick={osvjezi}>Ponovno učitaj</button>
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
    padding: 12px 16px;
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

  @media (max-width: 999px) {
    .veza-obavijest {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
