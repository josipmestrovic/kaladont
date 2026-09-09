<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import RaniPristupBaner from '$lib/komponente/RaniPristupBaner.svelte';

  interface Profil {
    igracId: string;
    nadimak: string;
  }

  interface Partija {
    partijaId: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
    nacinIspadanja: string | null;
    pocetak: string;
    kraj: string | null;
  }

  interface PovijestOdgovor {
    ok: boolean;
    partije: Partija[];
  }

  let profil = $state<Profil | null>(null);
  let partije = $state<Partija[]>([]);
  let greska = $state<string | null>(null);
  let ucitavanje = $state(true);

  onMount(async () => {
    try {
      profil = await api<Profil>('/profil');
      if (profil) {
        const odgovor = await api<PovijestOdgovor>(`/povijest/${profil.igracId}`);
        partije = odgovor.partije;
      }
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Neuspjelo dohvaćanje podataka.';
    } finally {
      ucitavanje = false;
    }
  });

  function formatirajDatum(datum: string): string {
    const d = new Date(datum);
    return d.toLocaleDateString('hr-HR', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function plasmaMjesto(plasman: number): string {
    switch (plasman) {
      case 1:
        return '🥇 1. mjesto';
      case 2:
        return '🥈 2. mjesto';
      case 3:
        return '🥉 3. mjesto';
      case 4:
        return '4. mjesto';
      default:
        return `${plasman}. mjesto`;
    }
  }
</script>

<h1>Moja povijest</h1>

<RaniPristupBaner />

{#if greska}
  <p role="alert" class="greska">{greska}</p>
  <p><a href="/prijava">Prijavi se</a></p>
{:else if ucitavanje}
  <p>Učitavanje...</p>
{:else if profil}
  <h2>Partije — {profil.nadimak}</h2>
  {#if partije.length === 0}
    <p>Nema dostupnih partija. <a href="/red">Kreni igrati!</a></p>
  {:else}
    <table class="tablica-partija">
      <thead>
        <tr>
          <th>Vrijeme</th>
          <th>Plasman</th>
          <th>Bodovi</th>
          <th>Eliminacije</th>
          <th>Akcija</th>
        </tr>
      </thead>
      <tbody>
        {#each partije as partija (partija.partijaId)}
          <tr>
            <td>{formatirajDatum(partija.pocetak)}</td>
            <td>{plasmaMjesto(partija.plasman)}</td>
            <td class="bodovi">{partija.bodovi}</td>
            <td class="eliminacije">{partija.eliminacije}</td>
            <td>
              <a href="/partija/{partija.partijaId}" class="vidi-gumb">
                Vidi detalje
              </a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{:else}
  <p>Trebam se spojiti...</p>
{/if}

<style>
  .greska {
    color: #d32f2f;
    font-weight: bold;
    padding: 12px;
    background: #ffcdd2;
    border-radius: 4px;
  }

  .tablica-partija {
    width: 100%;
    border-collapse: collapse;
    margin-top: 16px;
  }

  .tablica-partija th {
    background: #f5f5f5;
    padding: 12px;
    text-align: left;
    font-weight: bold;
    border-bottom: 2px solid #ddd;
  }

  .tablica-partija td {
    padding: 12px;
    border-bottom: 1px solid #eee;
  }

  .tablica-partija tr:hover {
    background: #fafafa;
  }

  .bodovi {
    text-align: center;
    font-weight: bold;
  }

  .eliminacije {
    text-align: center;
  }

  .vidi-gumb {
    color: #0066cc;
    text-decoration: none;
    padding: 6px 12px;
    border: 1px solid #0066cc;
    border-radius: 4px;
    display: inline-block;
  }

  .vidi-gumb:hover {
    background: #0066cc;
    color: white;
  }

  @media (max-width: 640px) {
    .tablica-partija {
      font-size: var(--tekst-mali);
    }

    .tablica-partija th,
    .tablica-partija td {
      padding: 8px;
    }

    .vidi-gumb {
      padding: 4px 8px;
      font-size: var(--tekst-sitni);
    }
  }
</style>
