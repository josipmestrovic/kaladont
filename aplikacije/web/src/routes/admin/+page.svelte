<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import NadzorPosluzitelja from '$lib/komponente/NadzorPosluzitelja.svelte';
  import AdminBotovi from '$lib/komponente/AdminBotovi.svelte';

  interface StatistikaCekanja {
    dani: number;
    poDanu: {
      dan: string; mod: 'cetiri_igraca' | 'dva_igraca'; partije: number;
      prosjekCekanjaMs: number | null; medijanCekanjaMs: number | null; p95CekanjaMs: number | null;
      partijeBezBotova: number; partijeSJednimBotom: number; partijeSDvaBota: number; partijeSTriBota: number;
    }[];
    pobjedePoSastavu: { mod: 'cetiri_igraca' | 'dva_igraca'; brojBotova: number; partije: number; pobjedeLjudi: number; udioPobjedaLjudi: number | null }[];
    eliminacijeBotova: { nacinIspadanja: string; broj: number }[];
    zivo: {
      fond: { ukupno: number; slobodni: number; rezervirani: number; uPartiji: number; iscrpljenja: number };
      bot: { planirano: number; odigranihRijeci: number; namjernihPropusta: number; bezRijeci: number; zastarjelo: number; tehnickeGreske: number; dobrovoljniKa: number; prisilniKa: number; propustPrimljenogKa: number };
      trening: { aktivni: number; zapoceti: number; odbijeni: number; neuspjeli: number };
      zastavice: { trening: boolean; botoviDvoboj: boolean; botoviCetveroboj: boolean };
    } | null;
  }

  let statistika = $state<StatistikaCekanja | null>(null);
  let daniStatistike = $state(7);
  let greskaStatistike = $state<string | null>(null);
  let greska = $state<string | null>(null);
  const nazivModa = (mod: 'cetiri_igraca' | 'dva_igraca') => (mod === 'dva_igraca' ? 'Dvoboj' : 'Četveroboj');
  const sekunde = (ms: number | null) => (ms === null ? '–' : `${(ms / 1000).toFixed(1)} s`);

  async function ucitajStatistiku() {
    greskaStatistike = null;
    try {
      statistika = await api<StatistikaCekanja>(`/admin/statistike/cekanje?dani=${daniStatistike}`);
      greska = null;
    } catch (e) {
      greskaStatistike = e instanceof Error ? e.message : 'Statistika nije dostupna.';
      if (e instanceof Error && /pristup|prijava|admin/i.test(e.message)) greska = e.message;
    }
  }

  onMount(() => {
    void ucitajStatistiku();
  });
</script>

<svelte:head>
  <title>Administracija | Kaladont</title>
</svelte:head>

<h1>Admin</h1>

{#if greska}
  <p role="alert">{greska}</p>
{:else}
  <NadzorPosluzitelja />
  <AdminBotovi />
  <h2 id="statistika-cekanja">Statistika čekanja i botova</h2>
  <p class="opis-statistike">Čekanje se mjeri samo ljudima (najdulje čekanje za stolom). Broj botova je broj mjesta koja je popunio bot. Služi podeavanju pragova i fonda prema ADR-017.</p>
  <label class="izbor-razdoblja">Razdoblje
    <select bind:value={daniStatistike} onchange={() => void ucitajStatistiku()}>
      <option value={1}>1 dan</option>
      <option value={7}>7 dana</option>
      <option value={30}>30 dana</option>
      <option value={90}>90 dana</option>
    </select>
  </label>
  {#if greskaStatistike}
    <p role="alert">{greskaStatistike}</p>
  {:else if statistika}
    {#if statistika.zivo}
      <dl class="zivo-stanje">
        <dt>Zastavice</dt>
        <dd>Trening {statistika.zivo.zastavice.trening ? 'uključen' : 'isključen'} · Dvoboj botovi {statistika.zivo.zastavice.botoviDvoboj ? 'uključeni' : 'isključeni'} · Četveroboj botovi {statistika.zivo.zastavice.botoviCetveroboj ? 'uključeni' : 'isključeni'}</dd>
        <dt>Fond botova</dt>
        <dd>{statistika.zivo.fond.slobodni} slobodnih / {statistika.zivo.fond.rezervirani} rezerviranih / {statistika.zivo.fond.uPartiji} u partiji od {statistika.zivo.fond.ukupno}; iscrpljenja od pokretanja: {statistika.zivo.fond.iscrpljenja}</dd>
        <dt>Botovi od pokretanja</dt>
        <dd>{statistika.zivo.bot.odigranihRijeci} riječi · {statistika.zivo.bot.dobrovoljniKa} dobrovoljnih KA · {statistika.zivo.bot.prisilniKa} prisilnih KA · {statistika.zivo.bot.propustPrimljenogKa} propusta tuđeg KA · {statistika.zivo.bot.namjernihPropusta} namjernih propusta · {statistika.zivo.bot.bezRijeci} bez riječi · {statistika.zivo.bot.zastarjelo} zastarjelih · {statistika.zivo.bot.tehnickeGreske} tehničkih grešaka</dd>
        <dt>Zagrijavanje</dt>
        <dd>{statistika.zivo.trening.aktivni} aktivnih · {statistika.zivo.trening.zapoceti} započetih · {statistika.zivo.trening.odbijeni} odbijenih · {statistika.zivo.trening.neuspjeli} neuspjelih</dd>
      </dl>
    {/if}
    {#if statistika.poDanu.length === 0}
      <p>Nema završenih javnih partija u odabranom razdoblju.</p>
    {:else}
      <table class="tablica tablica-mobilni-retci">
        <thead>
          <tr>
            <th scope="col">Dan</th>
            <th scope="col">Mod</th>
            <th scope="col">Partije</th>
            <th scope="col">Prosjek čekanja</th>
            <th scope="col">Medijan</th>
            <th scope="col">P95</th>
            <th scope="col">0 botova</th>
            <th scope="col">1 bot</th>
            <th scope="col">2 bota</th>
            <th scope="col">3 bota</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.poDanu as redak (`${redak.dan}-${redak.mod}`)}
            <tr>
              <td>{redak.dan}</td>
              <td data-label="Mod">{nazivModa(redak.mod)}</td>
              <td data-label="Partije">{redak.partije}</td>
              <td data-label="Prosjek čekanja">{sekunde(redak.prosjekCekanjaMs)}</td>
              <td data-label="Medijan čekanja">{sekunde(redak.medijanCekanjaMs)}</td>
              <td data-label="P95 čekanja">{sekunde(redak.p95CekanjaMs)}</td>
              <td data-label="Partije bez botova">{redak.partijeBezBotova}</td>
              <td data-label="Partije s jednim botom">{redak.partijeSJednimBotom}</td>
              <td data-label="Partije s dva bota">{redak.partijeSDvaBota}</td>
              <td data-label="Partije s tri bota">{redak.partijeSTriBota}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if statistika.pobjedePoSastavu.length > 0}
      <h3>Pobjede ljudi po sastavu stola</h3>
      <table class="tablica tablica-mobilni-retci">
        <thead>
          <tr>
            <th scope="col">Mod</th>
            <th scope="col">Botova za stolom</th>
            <th scope="col">Partije</th>
            <th scope="col">Pobjede ljudi</th>
            <th scope="col">Udio</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.pobjedePoSastavu as redak (`${redak.mod}-${redak.brojBotova}`)}
            <tr>
              <td>{nazivModa(redak.mod)}</td>
              <td data-label="Botova za stolom">{redak.brojBotova}</td>
              <td data-label="Partije">{redak.partije}</td>
              <td data-label="Pobjede ljudi">{redak.pobjedeLjudi}</td>
              <td data-label="Udio pobjeda ljudi">{redak.udioPobjedaLjudi === null ? '–' : `${Math.round(redak.udioPobjedaLjudi * 100)} %`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if statistika.eliminacijeBotova.length > 0}
      <h3>Kako botovi ispadaju</h3>
      <table class="tablica">
        <thead>
          <tr>
            <th scope="col">Način</th>
            <th scope="col">Broj</th>
          </tr>
        </thead>
        <tbody>
          {#each statistika.eliminacijeBotova as redak (redak.nacinIspadanja)}
            <tr>
              <td>{redak.nacinIspadanja}</td>
              <td>{redak.broj}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  {/if}
{/if}

<style>
  .opis-statistike {
    color: #555;
    font-size: var(--tekst-mali);
  }

  .izbor-razdoblja {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    margin: 8px 0;
  }

  .zivo-stanje {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 16px;
    margin: 12px 0;
    font-size: var(--tekst-sitni);
  }

  .zivo-stanje dt {
    font-weight: bold;
  }

  .zivo-stanje dd {
    margin: 0;
  }

  @media (max-width: 480px) {
    .zivo-stanje {
      grid-template-columns: 1fr;
    }
  }

  .tablica {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: var(--tekst-sitni);
  }

  .tablica th {
    background: #f5f5f5;
    padding: 12px;
    text-align: left;
    font-weight: bold;
    border-bottom: 2px solid #ddd;
  }

  .tablica td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
  }

  .tablica tr:hover {
    background: #fafafa;
  }
</style>
