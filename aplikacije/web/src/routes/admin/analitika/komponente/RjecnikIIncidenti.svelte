<script lang="ts">
  import type { AgregatPocetnih, IncidentRedak } from '../tipovi.js';
  import { postotak } from '../format.js';
  import AnalitikaKpi from './AnalitikaKpi.svelte';

  function lanacIncidente(incident: IncidentRedak): string {
    const dijelovi = [incident.sustavskaRijec ?? '—', incident.odgovor1 ?? '—'];
    if (incident.odgovor2) dijelovi.push(incident.odgovor2);
    if (incident.odgovor3) dijelovi.push(incident.odgovor3);
    return dijelovi.join(' → ');
  }

  let {
    agregat,
    incidenti,
    ukupno,
    stranica,
    ucitava,
    greska,
    odabraniId,
    detalj,
    uklanjanjeUTijeku,
    onStranica,
    onDetalj,
    onIzbaci,
  }: {
    agregat: AgregatPocetnih | null;
    incidenti: IncidentRedak[];
    ukupno: number;
    stranica: number;
    ucitava: boolean;
    greska: string | null;
    odabraniId: string | null;
    detalj: Record<string, unknown> | null;
    uklanjanjeUTijeku: string | null;
    onStranica: (nova: number) => void;
    onDetalj: (id: string) => void;
    onIzbaci: (rijec: string | null) => void;
  } = $props();
</script>

{#if ucitava}
  <p class="meta" role="status">Učitavanje…</p>
{:else if greska}
  <p role="alert">{greska}</p>
{:else}
  {#if agregat}
    <section aria-labelledby="pocetne-naslov">
      <h2 id="pocetne-naslov">Početne riječi</h2>
      <p class="meta">Zona: {agregat.vremenskaZona} · {agregat.od} – {agregat.do}</p>
      <AnalitikaKpi>
        <div><dt>Dodijeljene početne</dt><dd>{agregat.dodijeljene}</dd></div>
        <div><dt>Rezervni odabir</dt><dd>{agregat.rezervni} ({postotak(agregat.udioRezervnog)})</dd></div>
        <div><dt>Rani incidenti</dt><dd>{agregat.raniIncidenti} ({postotak(agregat.udioRanihIncidenata)})</dd></div>
        <div><dt>Incidenti na 1 / 2 / 3</dt><dd>{agregat.incidentiNa1} / {agregat.incidentiNa2} / {agregat.incidentiNa3}</dd></div>
        <div>
          <dt>3 odgovora OK</dt>
          <dd>
            {agregat.prozorOk}
            <span class="meta">(3: {agregat.triOdgovoraOk}, legacy 2: {agregat.dvaOdgovoraOk})</span>
          </dd>
        </div>
        <div><dt>Nepotpuna / drugim</dt><dd>{agregat.nepotpuna} / {agregat.zatvorenaDrugim}</dd></div>
        <div><dt>Nema kandidata</dt><dd>{agregat.nemaKandidata}</dd></div>
      </AnalitikaKpi>
    </section>
  {/if}

  <section aria-labelledby="incidenti-naslov">
    <h2 id="incidenti-naslov">Rani incidenti</h2>
    <p class="meta">Ukupno: {ukupno}</p>
    {#if incidenti.length === 0}
      <p>Nema ranih incidenata u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Vrijeme</th>
            <th>Kontekst</th>
            <th>Lanac</th>
            <th>Poz.</th>
            <th>Izvor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each incidenti as incident (incident.id)}
            <tr>
              <td>{new Date(incident.dodijeljenoU).toLocaleString('hr-HR')}</td>
              <td>{incident.kontekst}</td>
              <td>{lanacIncidente(incident)}</td>
              <td>{incident.incidentPozicija ?? '—'}</td>
              <td>{incident.izvor}</td>
              <td class="akcije-inc">
                <button type="button" onclick={() => onDetalj(incident.id)}>Detalj</button>
                {#if incident.sustavskaRijec}
                  <button
                    type="button"
                    disabled={uklanjanjeUTijeku === incident.sustavskaRijec}
                    onclick={() => onIzbaci(incident.sustavskaRijec)}
                  >
                    {uklanjanjeUTijeku === incident.sustavskaRijec ? 'Radim…' : 'Izbaci iz sigurnog skupa'}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <div class="stranicenje">
        <button type="button" disabled={stranica <= 1} onclick={() => onStranica(stranica - 1)}>Prethodna</button>
        <span>Stranica {stranica}</span>
        <button type="button" disabled={stranica * 50 >= ukupno} onclick={() => onStranica(stranica + 1)}
          >Sljedeća</button
        >
      </div>
    {/if}
  </section>

  {#if odabraniId && detalj}
    <section aria-labelledby="detalj-naslov">
      <h2 id="detalj-naslov">Detalj incidenta</h2>
      <pre>{JSON.stringify(detalj, null, 2)}</pre>
    </section>
  {/if}
{/if}