<script lang="ts">
  import type { AgregatCekanjaOdgovor } from '../tipovi.js';
  import { formatSekundi, nazivIshodaCekanja, postotak } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  let {
    cekanje,
    ucitava,
    greska,
  }: {
    cekanje: AgregatCekanjaOdgovor | null;
    ucitava: boolean;
    greska: string | null;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else if cekanje}
  <section aria-labelledby="cekanje-naslov">
    <h2 id="cekanje-naslov">Čekaonica</h2>
    <p class="meta">Samo Brza igra.</p>
    {#if !cekanje.dostupno}
      <p class="meta">{cekanje.razlog ?? 'Nije dostupno za odabrani kontekst.'}</p>
    {:else if cekanje.ukupno}
      <p class="meta">
        Zona: {cekanje.vremenskaZona} · {cekanje.od} – {cekanje.do}
        · kohorta po kraju čekanja
        · mjerenje od {cekanje.mjerenjeOd ?? '—'}
      </p>
      <p class="meta">{cekanje.napomena}</p>
      <AnalitikaKpi>
        <div><dt>Terminalni pokušaji</dt><dd>{cekanje.ukupno.terminalniPokusaji}</dd></div>
        <div>
          <dt>Uparivanje</dt>
          <dd>
            {cekanje.ukupno.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}
            ({postotak(cekanje.ukupno.ishodi.find((x) => x.ishod === 'uparivanje')?.postotak ?? null)})
          </dd>
        </div>
        <div>
          <dt>Napuštanje</dt>
          <dd>
            {cekanje.ukupno.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}
            ({postotak(cekanje.ukupno.ishodi.find((x) => x.ishod === 'napustanje')?.postotak ?? null)})
          </dd>
        </div>
        <div>
          <dt>Do uparivanja (medijan)</dt>
          <dd>{formatSekundi(cekanje.ukupno.trajanjeDoUparivanja.medijanSekundi)}</dd>
        </div>
        <div>
          <dt>Do napuštanja (medijan)</dt>
          <dd>{formatSekundi(cekanje.ukupno.trajanjeDoNapustanja.medijanSekundi)}</dd>
        </div>
      </AnalitikaKpi>
      <h3>Ishodi</h3>
      <table>
        <thead>
          <tr>
            <th>Ishod</th>
            <th>Broj</th>
            <th>Udio</th>
          </tr>
        </thead>
        <tbody>
          {#each cekanje.ukupno.ishodi as red (red.ishod)}
            <tr>
              <td>{nazivIshodaCekanja(red.ishod)}</td>
              <td>{red.broj}</td>
              <td>{postotak(red.postotak)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <h3>Trajanje</h3>
      <table>
        <thead>
          <tr>
            <th>Metrika</th>
            <th>Prosjek</th>
            <th>Medijan</th>
            <th>P90</th>
            <th>P95</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Do uparivanja</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoUparivanja.prosjekSekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoUparivanja.medijanSekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoUparivanja.p90Sekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoUparivanja.p95Sekundi ?? null)}</td>
            <td>{cekanje.ukupno.trajanjeDoUparivanja.uzorak}</td>
          </tr>
          <tr>
            <td>Do napuštanja</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoNapustanja.prosjekSekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoNapustanja.medijanSekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoNapustanja.p90Sekundi)}</td>
            <td>{formatSekundi(cekanje.ukupno.trajanjeDoNapustanja.p95Sekundi ?? null)}</td>
            <td>{cekanje.ukupno.trajanjeDoNapustanja.uzorak}</td>
          </tr>
        </tbody>
      </table>
      <h3>Distribucija napuštanja</h3>
      <table>
        <thead>
          <tr>
            <th>Interval (s)</th>
            <th>Broj</th>
            <th>Udio napuštanja</th>
          </tr>
        </thead>
        <tbody>
          {#each cekanje.ukupno.distribucijaNapustanja as red (red.interval)}
            <tr>
              <td>{red.interval}</td>
              <td>{red.broj}</td>
              <td>{postotak(red.postotak)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if cekanje.gosti && cekanje.registrirani}
        <h3>Gosti vs registrirani</h3>
        <table>
          <thead>
            <tr>
              <th>Segment</th>
              <th>Pokušaji</th>
              <th>Uparivanje</th>
              <th>Napuštanje</th>
              <th>Medijan do uparivanja</th>
              <th>Medijan do napuštanja</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Gosti</td>
              <td>{cekanje.gosti.terminalniPokusaji}</td>
              <td>{cekanje.gosti.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}</td>
              <td>{cekanje.gosti.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}</td>
              <td>{formatSekundi(cekanje.gosti.trajanjeDoUparivanja.medijanSekundi)}</td>
              <td>{formatSekundi(cekanje.gosti.trajanjeDoNapustanja.medijanSekundi)}</td>
            </tr>
            <tr>
              <td>Registrirani</td>
              <td>{cekanje.registrirani.terminalniPokusaji}</td>
              <td>{cekanje.registrirani.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}</td>
              <td>{cekanje.registrirani.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}</td>
              <td>{formatSekundi(cekanje.registrirani.trajanjeDoUparivanja.medijanSekundi)}</td>
              <td>{formatSekundi(cekanje.registrirani.trajanjeDoNapustanja.medijanSekundi)}</td>
            </tr>
          </tbody>
        </table>
      {/if}
    {/if}
  </section>
{/if}