<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';

  interface AgregatPocetnih {
    od: string;
    do: string;
    kontekst: string | null;
    vremenskaZona: string;
    posjecenost: string;
    dodijeljene: number;
    rezervni: number;
    udioRezervnog: number | null;
    nemaKandidata: number;
    raniIncidenti: number;
    udioRanihIncidenata: number | null;
    incidentiNa1: number;
    incidentiNa2: number;
    dvaOdgovoraOk: number;
    nepotpuna: number;
    zatvorenaDrugim: number;
  }

  interface IncidentRedak {
    id: string;
    igraId: string;
    redniBrojOtvaranja: number;
    kontekst: string;
    mod: string;
    sustavskaRijec: string | null;
    izvor: string;
    odgovor1: string | null;
    odgovor2: string | null;
    incidentPozicija: number | null;
    incidentRijecUzrok: string | null;
    incidentRazlog: string | null;
    dodijeljenoU: string;
  }

  interface Dnevno {
    dani: { dan: string; zapocete: number; zavrsene: number }[];
    ljudi: {
      igraci: number;
      igraciS2Plus: number;
      postotakS2Plus: number | null;
      postotakGost: number | null;
      postotakRegistriran: number | null;
      sudjelovanjaGost: number;
      sudjelovanjaRegistriran: number;
    };
  }

  interface StatusAnalitike {
    imaMjerenja: boolean;
    mjerenjeOd: string | null;
    zadnjiZapisU: string | null;
    otvaranja: { ukupno: number; otvoreni: number; nepotpuni: number };
    igre: { ukupno: number; bezIshoda: number };
    napomena: string;
  }

  let od = $state('');
  let doDana = $state('');
  let kontekst = $state<'' | 'javna' | 'privatna' | 'trening'>('');
  let status = $state<StatusAnalitike | null>(null);
  let agregat = $state<AgregatPocetnih | null>(null);
  let dnevno = $state<Dnevno | null>(null);
  let incidenti = $state<IncidentRedak[]>([]);
  let ukupnoIncidenata = $state(0);
  let stranica = $state(1);
  let greska = $state<string | null>(null);
  let odabraniId = $state<string | null>(null);
  let detalj = $state<Record<string, unknown> | null>(null);

  function postotak(vrijednost: number | null): string {
    if (vrijednost === null) return '—';
    return `${vrijednost.toFixed(1)} %`;
  }

  function query(): string {
    const params = new URLSearchParams();
    if (od) params.set('od', od);
    if (doDana) params.set('do', doDana);
    if (kontekst) params.set('kontekst', kontekst);
    params.set('stranica', String(stranica));
    return params.toString();
  }

  async function ucitaj() {
    greska = null;
    const q = query();
    const rezultati = await Promise.allSettled([
      api<AgregatPocetnih & { ok: boolean }>(`/admin/analitika/pocetne-rijeci?${q}`),
      api<{ ok: boolean; ukupno: number; incidenti: IncidentRedak[] }>(`/admin/analitika/incidenti?${q}`),
      api<Dnevno & { ok: boolean; od: string; do: string }>(`/admin/analitika/dnevno?${q}`),
      api<StatusAnalitike & { ok: boolean }>('/admin/analitika/status'),
    ]);
    const greske: string[] = [];
    const [a, i, d, s] = rezultati;
    if (a.status === 'fulfilled') {
      agregat = a.value;
      if (!od) od = a.value.od;
      if (!doDana) doDana = a.value.do;
    } else {
      greske.push(a.reason instanceof Error ? a.reason.message : 'Početne riječi nisu dostupne.');
    }
    if (i.status === 'fulfilled') {
      incidenti = i.value.incidenti;
      ukupnoIncidenata = i.value.ukupno;
    } else {
      greske.push(i.reason instanceof Error ? i.reason.message : 'Incidenti nisu dostupni.');
    }
    if (d.status === 'fulfilled') dnevno = d.value;
    else greske.push(d.reason instanceof Error ? d.reason.message : 'Dnevno igranje nije dostupno.');
    if (s.status === 'fulfilled') status = s.value;
    else greske.push(s.reason instanceof Error ? s.reason.message : 'Status nije dostupan.');
    greska = greske.length > 0 ? greske.join(' ') : null;
  }

  async function otvoriDetalj(id: string) {
    odabraniId = id;
    detalj = null;
    try {
      const odgovor = await api<{ ok: boolean; incident: Record<string, unknown> }>(`/admin/analitika/incidenti/${id}`);
      detalj = odgovor.incident;
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Detalj incidenta nije dostupan.';
    }
  }

  onMount(() => {
    void ucitaj();
  });
</script>

<svelte:head>
  <title>Analitika | Admin | Kaladont</title>
</svelte:head>

<h1>Analitika</h1>
<p class="opis">Minimalni pregled početnih riječi, dnevnog igranja i ponavljanja. Posjećenost još nije uključena.</p>

{#if status}
  <p class="status" role="status">
    {#if status.imaMjerenja}
      Mjerenje od {new Date(status.mjerenjeOd!).toLocaleString('hr-HR')};
      zadnji zapis {status.zadnjiZapisU ? new Date(status.zadnjiZapisU).toLocaleString('hr-HR') : '—'};
      otvorenih prozora {status.otvaranja.otvoreni}, nepotpunih {status.otvaranja.nepotpuni};
      igara bez ishoda {status.igre.bezIshoda}.
    {:else}
      Nema mjerenja — još nema zabilježenih događaja analitike.
    {/if}
  </p>
  <p class="meta">{status.napomena}</p>
{/if}

{#if greska}
  <p role="alert">{greska}</p>
{/if}

<form class="filteri" onsubmit={(e) => { e.preventDefault(); stranica = 1; void ucitaj(); }}>
  <label>Od <input type="date" bind:value={od} /></label>
  <label>Do <input type="date" bind:value={doDana} /></label>
  <label>Kontekst
    <select bind:value={kontekst}>
      <option value="">Svi</option>
      <option value="javna">Javna</option>
      <option value="privatna">Privatna</option>
      <option value="trening">Trening</option>
    </select>
  </label>
  <button type="submit">Osvježi</button>
</form>

{#if dnevno}
  <section aria-labelledby="dnevno-naslov">
    <h2 id="dnevno-naslov">Dnevno igranje</h2>
    <dl class="kartice">
      <div><dt>Gost sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakGost)}</dd></div>
      <div><dt>Registrirani sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakRegistriran)}</dd></div>
      <div><dt>Igrači s 2+ igrama</dt><dd>{dnevno.ljudi.igraciS2Plus} / {dnevno.ljudi.igraci} ({postotak(dnevno.ljudi.postotakS2Plus)})</dd></div>
    </dl>
    <table>
      <thead>
        <tr><th>Dan</th><th>Započete</th><th>Završene</th></tr>
      </thead>
      <tbody>
        {#each dnevno.dani as red (red.dan)}
          <tr>
            <td>{red.dan}</td>
            <td>{red.zapocete}</td>
            <td>{red.zavrsene}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
{/if}

{#if agregat}
  <section aria-labelledby="pocetne-naslov">
    <h2 id="pocetne-naslov">Početne riječi</h2>
    <p class="meta">Zona: {agregat.vremenskaZona} · {agregat.od} – {agregat.do}</p>
    <dl class="kartice">
      <div><dt>Dodijeljene početne</dt><dd>{agregat.dodijeljene}</dd></div>
      <div><dt>Rezervni odabir</dt><dd>{agregat.rezervni} ({postotak(agregat.udioRezervnog)})</dd></div>
      <div><dt>Rani incidenti</dt><dd>{agregat.raniIncidenti} ({postotak(agregat.udioRanihIncidenata)})</dd></div>
      <div><dt>Incidenti na 1 / 2</dt><dd>{agregat.incidentiNa1} / {agregat.incidentiNa2}</dd></div>
      <div><dt>Dva odgovora OK</dt><dd>{agregat.dvaOdgovoraOk}</dd></div>
      <div><dt>Nepotpuna / drugim</dt><dd>{agregat.nepotpuna} / {agregat.zatvorenaDrugim}</dd></div>
      <div><dt>Nema kandidata</dt><dd>{agregat.nemaKandidata}</dd></div>
    </dl>
  </section>
{/if}

<section aria-labelledby="incidenti-naslov">
  <h2 id="incidenti-naslov">Rani incidenti</h2>
  <p class="meta">Ukupno: {ukupnoIncidenata}</p>
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
            <td>
              {incident.sustavskaRijec ?? '—'}
              → {incident.odgovor1 ?? '—'}
              {#if incident.odgovor2}→ {incident.odgovor2}{/if}
            </td>
            <td>{incident.incidentPozicija ?? '—'}</td>
            <td>{incident.izvor}</td>
            <td><button type="button" onclick={() => void otvoriDetalj(incident.id)}>Detalj</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <div class="stranicenje">
      <button type="button" disabled={stranica <= 1} onclick={() => { stranica -= 1; void ucitaj(); }}>Prethodna</button>
      <span>Stranica {stranica}</span>
      <button type="button" disabled={stranica * 50 >= ukupnoIncidenata} onclick={() => { stranica += 1; void ucitaj(); }}>Sljedeća</button>
    </div>
  {/if}
</section>

{#if odabraniId && detalj}
  <section aria-labelledby="detalj-naslov">
    <h2 id="detalj-naslov">Detalj incidenta</h2>
    <pre>{JSON.stringify(detalj, null, 2)}</pre>
  </section>
{/if}

<style>
  .opis, .meta { color: #444; margin-bottom: 12px; }
  .status { border: 1px solid #ccc; padding: 10px 12px; margin-bottom: 12px; background: #fafafa; }
  .filteri { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin-bottom: 24px; }
  .filteri label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
  .kartice { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .kartice div { border: 1px solid #ddd; padding: 12px; }
  .kartice dt { font-size: 0.85rem; color: #555; }
  .kartice dd { margin: 4px 0 0; font-size: 1.25rem; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; text-align: left; padding: 8px; vertical-align: top; }
  .stranicenje { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
  pre { background: #f6f6f6; padding: 12px; overflow: auto; }
</style>
