<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ADRESA_POSLUZITELJA } from '$lib/konfiguracija.js';
  import { dohvatiAuthToken } from '$lib/identitet.js';

  interface StavkaLjestvice {
    mjesto: number;
    nadimak: string;
    rang: string;
    prosjekBodova: number;
    odigrane: number;
    postotakPobjeda: number;
  }

  interface StavkaRijeci {
    mjesto: number;
    rijec: string;
    brojUpotreba: number;
    postotakPartija: number;
  }

  let ljestvica = $state<StavkaLjestvice[]>([]);
  let mojeMjesto = $state<StavkaLjestvice | null>(null);
  let topRijeci = $state<StavkaRijeci[]>([]);
  let ucitavaIgraci = $state(false);
  let ucitavaRijeci = $state(false);
  let prosirenoIgraci = $state(false);
  let prosirenoRijeci = $state(false);
  const tab = $derived($page.url.searchParams.get('tab') === 'rijeci' ? 'rijeci' : 'igraci');

  async function ucitajIgrace(limit: 10 | 100) {
    ucitavaIgraci = true;
    try {
      const odgovor = await fetch(`${ADRESA_POSLUZITELJA}/ljestvica?limit=${limit}`, {
        headers: { authorization: `Bearer ${dohvatiAuthToken()}` },
      });
      const tijelo = (await odgovor.json()) as { ljestvica: StavkaLjestvice[]; mojeMjesto: StavkaLjestvice | null };
      ljestvica = tijelo.ljestvica;
      mojeMjesto = tijelo.mojeMjesto;
      if (limit === 100) prosirenoIgraci = true;
    } finally {
      ucitavaIgraci = false;
    }
  }

  async function ucitajRijeci(limit: 10 | 100) {
    ucitavaRijeci = true;
    try {
      const odgovor = await fetch(`${ADRESA_POSLUZITELJA}/rijeci/top?limit=${limit}`);
      const tijelo = (await odgovor.json()) as { rijeci: StavkaRijeci[] };
      topRijeci = tijelo.rijeci;
      if (limit === 100) prosirenoRijeci = true;
    } finally {
      ucitavaRijeci = false;
    }
  }

  onMount(() => {
    ucitajIgrace(10);
    ucitajRijeci(10);
  });

  function odaberiTab(novi: 'igraci' | 'rijeci') {
    goto(`/ljestvica?tab=${novi}`, { replaceState: true, noScroll: true });
  }

  const mojeMjestoUListi = $derived(mojeMjesto && ljestvica.some((s) => s.mjesto === mojeMjesto!.mjesto && s.nadimak === mojeMjesto!.nadimak));
</script>

<h1>Ljestvica</h1>

<div class="tabovi" role="tablist">
  <button type="button" role="tab" aria-selected={tab === 'igraci'} class:aktivan={tab === 'igraci'} onclick={() => odaberiTab('igraci')}>
    Igrači
  </button>
  <button type="button" role="tab" aria-selected={tab === 'rijeci'} class:aktivan={tab === 'rijeci'} onclick={() => odaberiTab('rijeci')}>
    Riječi
  </button>
</div>

{#if tab === 'igraci'}
  <p>Top {prosirenoIgraci ? '100' : '10'} igrača po prosjeku bodova (minimalno 10 odigranih partija).</p>

  {#if ljestvica.length === 0 && !ucitavaIgraci}
    <p>Odigraj 10 partija da uđeš na ljestvicu.</p>
  {:else}
    <table>
      <thead>
        <tr><th>#</th><th>Nadimak</th><th>Rang</th><th>Prosjek</th><th>Partije</th><th>% pobjeda</th></tr>
      </thead>
      <tbody>
        {#each ljestvica as stavka (stavka.mjesto)}
          <tr>
            <td>{stavka.mjesto}</td>
            <td>{stavka.nadimak}</td>
            <td>{stavka.rang}</td>
            <td>{stavka.prosjekBodova.toFixed(2)}</td>
            <td>{stavka.odigrane}</td>
            <td>{stavka.postotakPobjeda.toFixed(0)}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if !prosirenoIgraci}
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajIgrace(100)} disabled={ucitavaIgraci}>
        {ucitavaIgraci ? 'Učitavanje…' : 'Učitaj do 100'}
      </button>
    {/if}
    {#if mojeMjesto && !mojeMjestoUListi}
      <p class="moje-mjesto">
        Tvoje mjesto: #{mojeMjesto.mjesto} — {mojeMjesto.rang}, prosjek {mojeMjesto.prosjekBodova.toFixed(2)}
      </p>
    {/if}
  {/if}
{:else}
  <p>Top {prosirenoRijeci ? '100' : '10'} najčešće odigranih riječi u svim partijama.</p>

  {#if topRijeci.length === 0 && !ucitavaRijeci}
    <p>Još nema dovoljno odigranih partija.</p>
  {:else}
    <table>
      <thead>
        <tr><th>#</th><th>Riječ</th><th>Broj upotreba</th><th>% partija</th></tr>
      </thead>
      <tbody>
        {#each topRijeci as stavka (stavka.mjesto)}
          <tr>
            <td>{stavka.mjesto}</td>
            <td>{stavka.rijec}</td>
            <td>{stavka.brojUpotreba}</td>
            <td>{stavka.postotakPartija.toFixed(0)}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if !prosirenoRijeci}
      <button type="button" class="ucitaj-vise-gumb" onclick={() => ucitajRijeci(100)} disabled={ucitavaRijeci}>
        {ucitavaRijeci ? 'Učitavanje…' : 'Učitaj do 100'}
      </button>
    {/if}
  {/if}
{/if}

<style>
  .tabovi {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 1px solid #e5ddc8;
  }

  .tabovi button {
    background: none;
    border: none;
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--tekst-baza);
    color: #7a7264;
    border-bottom: 2px solid transparent;
  }

  .tabovi button.aktivan {
    color: #1d6f5c;
    font-weight: bold;
    border-bottom-color: #2fa98c;
  }

  .moje-mjesto {
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--boja-isticanje-slova);
    border-radius: 6px;
    font-size: var(--tekst-mali);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: var(--radijus-kartica);
    overflow: hidden;
  }

  th {
    text-align: left;
    padding: 10px 12px;
    font-size: var(--tekst-sitni);
    color: var(--boja-tekst-sekundarni);
    border-bottom: 1px solid #e5ddc8;
  }

  td {
    padding: 10px 12px;
    font-size: var(--tekst-baza);
  }

  tbody tr:nth-child(odd) {
    background: #fbf7ee;
  }

  .ucitaj-vise-gumb {
    display: block;
    margin: 16px auto 0;
    background: none;
    border: 1px solid var(--boja-pozadina-primarna);
    color: var(--boja-pozadina-primarna);
    padding: 8px 24px;
    border-radius: var(--radijus-pill);
    cursor: pointer;
  }

  .ucitaj-vise-gumb:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
