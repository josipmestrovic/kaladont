<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';

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
    incidentiNa3: number;
    dvaOdgovoraOk: number;
    triOdgovoraOk: number;
    prozorOk: number;
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
    odgovor3: string | null;
    incidentPozicija: number | null;
    incidentRijecUzrok: string | null;
    incidentRazlog: string | null;
    dodijeljenoU: string;
  }

  interface Dnevno {
    dani: { dan: string; zapocete: number; zavrsene: number }[];
    ljudi: {
      igraci: number;
      ponavljanja: { prag: number; broj: number; postotak: number | null }[];
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

  interface WilsonInterval {
    low: number;
    high: number;
  }

  interface RedakIzazova {
    challengeId: string;
    definitionVersion: number;
    botProfileVersion: number | null;
    turnDurationMs: number | null;
    started: number;
    aktivni: number;
    tehnicki: number;
    uspjesi: number;
    neuspjesi: number;
    igrackiZavrseni: number;
    attemptSuccessBrojnik: number;
    attemptSuccessNazivnik: number;
    attemptSuccessRate: number | null;
    gameWon: number;
    gameWonRate: number | null;
    uniqueStarted: number;
    uniqueSuccess: number;
    uniqueSuccessRate: number | null;
    uniqueSuccessWilson: WilsonInterval | null;
    maliUzorak: boolean;
    firstTrySuccess: number;
    firstTryPlayers: number;
    firstTryRate: number | null;
    attemptsToFirstSuccessMedian: number | null;
    trajanjeMedianMs: number | null;
    trajanjeP90Ms: number | null;
    reasons: Record<string, number>;
    startedGost: number;
    startedRegistriran: number;
    uspjesiGost: number;
    uspjesiRegistriran: number;
  }

  interface AgregatIzazova {
    od: string;
    do: string;
    vremenskaZona: string;
    ukupno: {
      started: number;
      aktivni: number;
      tehnicki: number;
      uspjesi: number;
      neuspjesi: number;
      uniqueStarted: number;
      uniqueSuccess: number;
      uniqueSuccessRate: number | null;
      uniqueSuccessWilson: WilsonInterval | null;
      maliUzorak: boolean;
    };
    redovi: RedakIzazova[];
  }

  let od = $state('');
  let doDana = $state('');
  let kontekst = $state<'' | 'javna' | 'privatna' | 'trening' | 'izazov'>('');
  let izazovChallengeId = $state('');
  let izazovAccountType = $state<'' | 'gost' | 'registriran'>('');
  let status = $state<StatusAnalitike | null>(null);
  let agregat = $state<AgregatPocetnih | null>(null);
  let dnevno = $state<Dnevno | null>(null);
  let izazovi = $state<AgregatIzazova | null>(null);
  let incidenti = $state<IncidentRedak[]>([]);
  let ukupnoIncidenata = $state(0);
  let stranica = $state(1);
  let greska = $state<string | null>(null);
  let odabraniId = $state<string | null>(null);
  let detalj = $state<Record<string, unknown> | null>(null);
  let uklanjanjeUTijeku = $state<string | null>(null);

  function postotak(vrijednost: number | null): string {
    if (vrijednost === null) return '—';
    return `${vrijednost.toFixed(1)} %`;
  }

  function lanacIncidente(incident: IncidentRedak): string {
    const dijelovi = [incident.sustavskaRijec ?? '—', incident.odgovor1 ?? '—'];
    if (incident.odgovor2) dijelovi.push(incident.odgovor2);
    if (incident.odgovor3) dijelovi.push(incident.odgovor3);
    return dijelovi.join(' → ');
  }

  async function izbaciIzSigurnogSkupa(rijec: string | null) {
    if (!rijec || uklanjanjeUTijeku) return;
    if (!confirm(`Izbaciti „${rijec}” iz sigurnog skupa?`)) return;
    uklanjanjeUTijeku = rijec;
    greska = null;
    try {
      const odgovor = await api<{ ok: boolean; promjena: string; rijec: string }>(
        `/admin/rjecnik/sigurni-skup/${encodeURIComponent(rijec)}`,
        { method: 'DELETE' },
      );
      if (odgovor.promjena === 'uklonjena') pokaziUspjeh(`„${rijec}” izbačena iz sigurnog skupa.`);
      else pokaziUspjeh(`„${rijec}” nije bila u sigurnom skupu.`);
    } catch (e) {
      greska = e instanceof Error ? e.message : 'Izbacivanje iz sigurnog skupa nije uspjelo.';
    } finally {
      uklanjanjeUTijeku = null;
    }
  }

  function query(): string {
    const params = new URLSearchParams();
    if (od) params.set('od', od);
    if (doDana) params.set('do', doDana);
    if (kontekst) params.set('kontekst', kontekst);
    params.set('stranica', String(stranica));
    return params.toString();
  }

  function queryIzazovi(): string {
    const params = new URLSearchParams();
    if (od) params.set('od', od);
    if (doDana) params.set('do', doDana);
    if (izazovChallengeId) params.set('challengeId', izazovChallengeId);
    if (izazovAccountType) params.set('accountTypeAtStart', izazovAccountType);
    return params.toString();
  }

  function formatMs(ms: number | null): string {
    if (ms === null) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  function wilsonTekst(w: WilsonInterval | null): string {
    if (!w) return '—';
    return `${w.low.toFixed(1)}–${w.high.toFixed(1)} %`;
  }

  async function preuzmiCsv() {
    greska = null;
    try {
      const { apiUrl } = await import('$lib/api-url.js');
      const { osigurajAuthToken } = await import('$lib/identitet.js');
      const token = await osigurajAuthToken();
      const odgovor = await fetch(apiUrl(`/admin/analitika/izazovi.csv?${queryIzazovi()}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!odgovor.ok) {
        throw new Error(`CSV nije dostupan (${odgovor.status})`);
      }
      const blob = await odgovor.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `izazovi-${od || 'od'}_${doDana || 'do'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      greska = e instanceof Error ? e.message : 'CSV preuzimanje nije uspjelo.';
    }
  }

  async function ucitaj() {
    greska = null;
    const q = query();
    const qIz = queryIzazovi();
    const rezultati = await Promise.allSettled([
      api<AgregatPocetnih & { ok: boolean }>(`/admin/analitika/pocetne-rijeci?${q}`),
      api<{ ok: boolean; ukupno: number; incidenti: IncidentRedak[] }>(`/admin/analitika/incidenti?${q}`),
      api<Dnevno & { ok: boolean; od: string; do: string }>(`/admin/analitika/dnevno?${q}`),
      api<StatusAnalitike & { ok: boolean }>('/admin/analitika/status'),
      api<AgregatIzazova & { ok: boolean }>(`/admin/analitika/izazovi?${qIz}`),
    ]);
    const greske: string[] = [];
    const [a, i, d, s, iz] = rezultati;
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
    if (iz.status === 'fulfilled') izazovi = iz.value;
    else greske.push(iz.reason instanceof Error ? iz.reason.message : 'Izazovi analitika nije dostupna.');
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
      <option value="izazov">Izazov</option>
    </select>
  </label>
  <label>Izazov
    <input type="text" bind:value={izazovChallengeId} placeholder="npr. IZ01" maxlength="4" />
  </label>
  <label>Račun (Izazov)
    <select bind:value={izazovAccountType}>
      <option value="">Svi</option>
      <option value="gost">Gost</option>
      <option value="registriran">Registriran</option>
    </select>
  </label>
  <button type="submit">Osvježi</button>
</form>

{#if izazovi}
  <section aria-labelledby="izazovi-naslov">
    <h2 id="izazovi-naslov">Izazovi</h2>
    <p class="meta">
      Zona: {izazovi.vremenskaZona} · {izazovi.od} – {izazovi.do}
      · kohorta po startedAt · verzije odvojene
      {#if izazovi.ukupno.maliUzorak}
        · <strong>mali uzorak</strong> (&lt;30 unique igrača)
      {/if}
    </p>
    <dl class="kartice">
      <div><dt>Pokrenuti</dt><dd>{izazovi.ukupno.started}</dd></div>
      <div><dt>Aktivni</dt><dd>{izazovi.ukupno.aktivni}</dd></div>
      <div><dt>Tehnički</dt><dd>{izazovi.ukupno.tehnicki}</dd></div>
      <div><dt>Uspjesi / neuspjesi</dt><dd>{izazovi.ukupno.uspjesi} / {izazovi.ukupno.neuspjesi}</dd></div>
      <div>
        <dt>Unique uspjeh</dt>
        <dd>
          {izazovi.ukupno.uniqueSuccess} / {izazovi.ukupno.uniqueStarted}
          ({postotak(izazovi.ukupno.uniqueSuccessRate)})
        </dd>
      </div>
      <div><dt>Wilson 95%</dt><dd>{wilsonTekst(izazovi.ukupno.uniqueSuccessWilson)}</dd></div>
    </dl>
    <p class="meta">
      <button type="button" onclick={() => void preuzmiCsv()}>Preuzmi CSV</button>
      (bez osobnih podataka)
    </p>
    {#if izazovi.redovi.length === 0}
      <p>Nema pokušaja Izazova u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Izazov</th>
            <th>Verzija</th>
            <th>Timer</th>
            <th>Started</th>
            <th>Uspjeh pokušaja</th>
            <th>gameWon</th>
            <th>Unique</th>
            <th>First-try</th>
            <th>Do 1. uspjeha</th>
            <th>Trajanje med/p90</th>
            <th>Razlozi</th>
          </tr>
        </thead>
        <tbody>
          {#each izazovi.redovi as red (`${red.challengeId}-${red.definitionVersion}-${red.botProfileVersion}-${red.turnDurationMs}`)}
            <tr>
              <td>
                {red.challengeId}
                {#if red.maliUzorak}<span class="meta"> · mali</span>{/if}
              </td>
              <td>d{red.definitionVersion}{#if red.botProfileVersion != null}/b{red.botProfileVersion}{/if}</td>
              <td>{red.turnDurationMs != null ? `${red.turnDurationMs / 1000}s` : '—'}</td>
              <td>{red.started} <span class="meta">(akt {red.aktivni}, teh {red.tehnicki})</span></td>
              <td>
                {red.attemptSuccessBrojnik}/{red.attemptSuccessNazivnik}
                ({postotak(red.attemptSuccessRate)})
              </td>
              <td>{red.gameWon}/{red.igrackiZavrseni} ({postotak(red.gameWonRate)})</td>
              <td>
                {red.uniqueSuccess}/{red.uniqueStarted} ({postotak(red.uniqueSuccessRate)})
                <span class="meta">W {wilsonTekst(red.uniqueSuccessWilson)}</span>
              </td>
              <td>{red.firstTrySuccess}/{red.firstTryPlayers} ({postotak(red.firstTryRate)})</td>
              <td>{red.attemptsToFirstSuccessMedian ?? '—'}</td>
              <td>{formatMs(red.trajanjeMedianMs)} / {formatMs(red.trajanjeP90Ms)}</td>
              <td class="meta">
                {#each Object.entries(red.reasons) as [razlog, broj]}
                  {razlog}:{broj}
                  {' '}
                {:else}
                  —
                {/each}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

{#if dnevno}
  <section aria-labelledby="dnevno-naslov">
    <h2 id="dnevno-naslov">Dnevno igranje</h2>
    <dl class="kartice">
      <div><dt>Gost sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakGost)}</dd></div>
      <div><dt>Registrirani sudjelovanja</dt><dd>{postotak(dnevno.ljudi.postotakRegistriran)}</dd></div>
      {#each dnevno.ljudi.ponavljanja as p (p.prag)}
        <div><dt>Igrači s {p.prag}+ igrama</dt><dd>{p.broj} / {dnevno.ljudi.igraci} ({postotak(p.postotak)})</dd></div>
      {/each}
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
      <div><dt>Incidenti na 1 / 2 / 3</dt><dd>{agregat.incidentiNa1} / {agregat.incidentiNa2} / {agregat.incidentiNa3}</dd></div>
      <div><dt>3 odgovora OK</dt><dd>{agregat.prozorOk} <span class="meta">(3: {agregat.triOdgovoraOk}, legacy 2: {agregat.dvaOdgovoraOk})</span></dd></div>
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
            <td>{lanacIncidente(incident)}</td>
            <td>{incident.incidentPozicija ?? '—'}</td>
            <td>{incident.izvor}</td>
            <td class="akcije-inc">
              <button type="button" onclick={() => void otvoriDetalj(incident.id)}>Detalj</button>
              {#if incident.sustavskaRijec}
                <button
                  type="button"
                  disabled={uklanjanjeUTijeku === incident.sustavskaRijec}
                  onclick={() => void izbaciIzSigurnogSkupa(incident.sustavskaRijec)}
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
  .akcije-inc { display: flex; flex-wrap: wrap; gap: 8px; }
  pre { background: #f6f6f6; padding: 12px; overflow: auto; }
</style>
