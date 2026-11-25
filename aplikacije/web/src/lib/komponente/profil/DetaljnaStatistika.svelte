<script lang="ts">
  import { formatirajTrajanjeMs } from './tipovi.js';
  import type { DnkMetrike } from './tipovi.js';

  let {
    metrike,
    prosjekBodova,
  }: {
    metrike: DnkMetrike;
    prosjekBodova: number | null;
  } = $props();

  const stavke = $derived([
    {
      naziv: 'Eliminacije po igri',
      vrijednost: metrike.eliminacijePoPartiji.toLocaleString('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      naziv: 'Prosječno vrijeme poteza',
      vrijednost: formatirajTrajanjeMs(
        metrike.prosjekPrihvacenogPotezaMs > 0 ? metrike.prosjekPrihvacenogPotezaMs : null,
      ),
    },
    {
      naziv: 'Duge riječi po igri',
      vrijednost: metrike.dugeRijeciPoPartiji.toLocaleString('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      naziv: 'Rijetke riječi po igri',
      vrijednost: metrike.rijetkeRijeciPoPartiji.toLocaleString('hr-HR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    {
      naziv: 'Prosjek bodova',
      vrijednost: prosjekBodova === null
        ? '—'
        : prosjekBodova.toLocaleString('hr-HR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
  ]);
</script>

<section class="detaljna" aria-labelledby="detaljna-naslov">
  <h2 id="detaljna-naslov">Igra u brojkama</h2>
  <ul>
    {#each stavke as stavka}
      <li>
        <span>{stavka.naziv}</span>
        <strong>{stavka.vrijednost}</strong>
      </li>
    {/each}
  </ul>
</section>

<style>
  .detaljna {
    display: grid;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--boja-obrub);
    border-radius: var(--radijus-kartica, 8px);
    background: var(--boja-povrsina);
  }
  h2 { margin: 0; font-family: var(--font-naslov); font-size: 1.25rem; }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0;
  }
  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--boja-obrub);
  }
  li span { color: var(--boja-tekst-sekundarni); font-size: var(--tekst-mali); }
  li strong { font-variant-numeric: tabular-nums; }

  @media (max-width: 999px) {
    ul { grid-template-columns: 1fr; }
  }
</style>
