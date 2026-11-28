<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { pokaziUspjeh } from '$lib/uspjeh-obavijest.svelte.js';
  import AnalitikaFilteri from './komponente/AnalitikaFilteri.svelte';
  import BotoviIBalans from './komponente/BotoviIBalans.svelte';
  import Cekaonica from './komponente/Cekaonica.svelte';
  import Gamifikacija from './komponente/Gamifikacija.svelte';
  import IgraciIRast from './komponente/IgraciIRast.svelte';
  import Izazovi from './komponente/Izazovi.svelte';
  import Partije from './komponente/Partije.svelte';
  import RjecnikIIncidenti from './komponente/RjecnikIIncidenti.svelte';
  import {
    endpointiOsvjezavanja,
    endpointiPaginacijeIncidenata,
    putanjaEndpointa,
    tabPrikazujeIzazovFiltere,
    tabPrikazujeKontekst,
    TokenUcitavanja,
    type EndpointAnalitike,
  } from './ucitavanje.js';
  import {
    TABOVI_ANALITIKE,
    type AgregatBotova,
    type AgregatCekanjaOdgovor,
    type AgregatGamifikacije,
    type AgregatIgraca,
    type AgregatIzazova,
    type AgregatPartija,
    type AgregatPocetnih,
    type Dnevno,
    type IncidentRedak,
    type KontekstFilter,
    type StanjeTaba,
    type StatusAnalitike,
    type TabAnalitike,
  } from './tipovi.js';

  let tab = $state<TabAnalitike>('igraci');
  let od = $state('');
  let doDana = $state('');
  let kontekst = $state<KontekstFilter>('');
  let izazovChallengeId = $state('');
  let izazovAccountType = $state<'' | 'gost' | 'registriran'>('');
  let stranica = $state(1);

  let status = $state<StatusAnalitike | null>(null);
  let igraciAgregat = $state<AgregatIgraca | null>(null);
  let dnevno = $state<Dnevno | null>(null);
  let partijeAgregat = $state<AgregatPartija | null>(null);
  let cekanjeAgregat = $state<AgregatCekanjaOdgovor | null>(null);
  let botoviAgregat = $state<AgregatBotova | null>(null);
  let izazovi = $state<AgregatIzazova | null>(null);
  let gamifikacijaAgregat = $state<AgregatGamifikacije | null>(null);
  let agregat = $state<AgregatPocetnih | null>(null);
  let incidenti = $state<IncidentRedak[]>([]);
  let ukupnoIncidenata = $state(0);
  let odabraniId = $state<string | null>(null);
  let detalj = $state<Record<string, unknown> | null>(null);
  let uklanjanjeUTijeku = $state<string | null>(null);

  const praznoStanje = (): StanjeTaba => ({ ucitava: false, greska: null, ucitano: false });
  let stanja = $state<Record<TabAnalitike, StanjeTaba>>({
    igraci: praznoStanje(),
    partije: praznoStanje(),
    cekaonica: praznoStanje(),
    botovi: praznoStanje(),
    izazovi: praznoStanje(),
    gamifikacija: praznoStanje(),
    rjecnik: praznoStanje(),
  });
  let statusGreska = $state<string | null>(null);

  const tokeni = {
    igraci: new TokenUcitavanja(),
    partije: new TokenUcitavanja(),
    cekaonica: new TokenUcitavanja(),
    botovi: new TokenUcitavanja(),
    izazovi: new TokenUcitavanja(),
    gamifikacija: new TokenUcitavanja(),
    rjecnik: new TokenUcitavanja(),
    status: new TokenUcitavanja(),
  };

  function filteri() {
    return {
      od,
      doDana,
      kontekst,
      izazovChallengeId,
      izazovAccountType,
      stranicaIncidenata: stranica,
    };
  }

  function ocistiPodatkeTaba(t: TabAnalitike) {
    switch (t) {
      case 'igraci':
        igraciAgregat = null;
        dnevno = null;
        break;
      case 'partije':
        partijeAgregat = null;
        break;
      case 'cekaonica':
        cekanjeAgregat = null;
        break;
      case 'botovi':
        botoviAgregat = null;
        break;
      case 'izazovi':
        izazovi = null;
        break;
      case 'gamifikacija':
        gamifikacijaAgregat = null;
        break;
      case 'rjecnik':
        agregat = null;
        incidenti = [];
        ukupnoIncidenata = 0;
        odabraniId = null;
        detalj = null;
        break;
    }
  }

  function porukaGreske(endpoint: EndpointAnalitike, razlog: unknown): string {
    const tekst = razlog instanceof Error ? razlog.message : 'Nepoznata greška';
    const oznake: Record<EndpointAnalitike, string> = {
      status: 'Status',
      igraci: 'Igrači',
      dnevno: 'Dnevno igranje',
      partije: 'Partije',
      cekanje: 'Čekaonica',
      botovi: 'Botovi',
      izazovi: 'Izazovi',
      gamifikacija: 'Gamifikacija',
      'pocetne-rijeci': 'Početne riječi',
      incidenti: 'Incidenti',
    };
    return `${oznake[endpoint]}: ${tekst}`;
  }

  async function ucitajEndpoint(
    endpoint: EndpointAnalitike,
    t: TabAnalitike,
    f: ReturnType<typeof filteri>,
  ): Promise<{ endpoint: EndpointAnalitike; ok: true; value: unknown } | { endpoint: EndpointAnalitike; ok: false; reason: unknown }> {
    try {
      const putanja = putanjaEndpointa(endpoint, t, f);
      const value = await api(putanja);
      return { endpoint, ok: true, value };
    } catch (reason) {
      return { endpoint, ok: false, reason };
    }
  }

  function primijeniOdgovor(endpoint: EndpointAnalitike, value: unknown) {
    switch (endpoint) {
      case 'status':
        status = value as StatusAnalitike;
        break;
      case 'igraci': {
        const v = value as AgregatIgraca;
        igraciAgregat = v;
        if (!od && v.od) od = v.od;
        if (!doDana && v.do) doDana = v.do;
        break;
      }
      case 'dnevno':
        dnevno = value as Dnevno;
        break;
      case 'partije': {
        const v = value as AgregatPartija;
        partijeAgregat = v;
        if (!od && v.od) od = v.od;
        if (!doDana && v.do) doDana = v.do;
        break;
      }
      case 'cekanje':
        cekanjeAgregat = value as AgregatCekanjaOdgovor;
        break;
      case 'botovi':
        botoviAgregat = value as AgregatBotova;
        break;
      case 'izazovi':
        izazovi = value as AgregatIzazova;
        break;
      case 'gamifikacija':
        gamifikacijaAgregat = value as AgregatGamifikacije;
        break;
      case 'pocetne-rijeci': {
        const v = value as AgregatPocetnih;
        agregat = v;
        if (!od && v.od) od = v.od;
        if (!doDana && v.do) doDana = v.do;
        break;
      }
      case 'incidenti': {
        const v = value as { ukupno: number; incidenti: IncidentRedak[] };
        incidenti = v.incidenti;
        ukupnoIncidenata = v.ukupno;
        break;
      }
    }
  }

  async function ucitajTab(t: TabAnalitike, opcije: { samoIncidenti?: boolean; zadrziPodatke?: boolean } = {}) {
    const f = filteri();
    const endpointi = opcije.samoIncidenti
      ? endpointiPaginacijeIncidenata()
      : endpointiOsvjezavanja(t);
    const token = tokeni[t].novi();
    const statusToken = endpointi.includes('status') ? tokeni.status.novi() : null;

    if (!opcije.zadrziPodatke && !opcije.samoIncidenti) {
      ocistiPodatkeTaba(t);
    }

    // Paginacija incidenata ne zamjenjuje cijeli panel loadingom.
    if (!opcije.samoIncidenti) {
      stanja[t] = { ucitava: true, greska: null, ucitano: stanja[t].ucitano };
    }
    if (endpointi.includes('status')) statusGreska = null;

    const rezultati = await Promise.all(endpointi.map((e) => ucitajEndpoint(e, t, f)));

    if (!tokeni[t].jeAktualan(token)) return;

    const greske: string[] = [];
    for (const r of rezultati) {
      if (r.endpoint === 'status' && statusToken !== null && !tokeni.status.jeAktualan(statusToken)) {
        continue;
      }
      if (r.ok) {
        primijeniOdgovor(r.endpoint, r.value);
      } else if (r.endpoint === 'status') {
        statusGreska = porukaGreske('status', r.reason);
      } else {
        greske.push(porukaGreske(r.endpoint, r.reason));
      }
    }

    stanja[t] = {
      ucitava: false,
      greska: greske.length > 0 ? greske.join(' ') : null,
      ucitano: true,
    };
  }

  function odaberiTab(novi: TabAnalitike) {
    if (tab === novi) return;
    tab = novi;
    if (!stanja[novi].ucitano && !stanja[novi].ucitava) {
      void ucitajTab(novi);
    }
  }

  function osvjeziAktivni() {
    if (tab === 'rjecnik') stranica = 1;
    void ucitajTab(tab);
  }

  function promijeniStranicuIncidenata(nova: number) {
    stranica = nova;
    void ucitajTab('rjecnik', { samoIncidenti: true, zadrziPodatke: true });
  }

  async function otvoriDetalj(id: string) {
    odabraniId = id;
    detalj = null;
    try {
      const odgovor = await api<{ ok: boolean; incident: Record<string, unknown> }>(
        `/admin/analitika/incidenti/${id}`,
      );
      detalj = odgovor.incident;
    } catch (e) {
      stanja.rjecnik = {
        ...stanja.rjecnik,
        greska: e instanceof Error ? e.message : 'Detalj incidenta nije dostupan.',
      };
    }
  }

  async function izbaciIzSigurnogSkupa(rijec: string | null) {
    if (!rijec || uklanjanjeUTijeku) return;
    if (!confirm(`Izbaciti „${rijec}” iz sigurnog skupa?`)) return;
    uklanjanjeUTijeku = rijec;
    try {
      const odgovor = await api<{ ok: boolean; promjena: string; rijec: string }>(
        `/admin/rjecnik/sigurni-skup/${encodeURIComponent(rijec)}`,
        { method: 'DELETE' },
      );
      if (odgovor.promjena === 'uklonjena') pokaziUspjeh(`„${rijec}” izbačena iz sigurnog skupa.`);
      else pokaziUspjeh(`„${rijec}” nije bila u sigurnom skupu.`);
    } catch (e) {
      stanja.rjecnik = {
        ...stanja.rjecnik,
        greska: e instanceof Error ? e.message : 'Izbacivanje iz sigurnog skupa nije uspjelo.',
      };
    } finally {
      uklanjanjeUTijeku = null;
    }
  }

  async function preuzmiCsv() {
    try {
      const { apiUrl } = await import('$lib/api-url.js');
      const { osigurajAuthToken } = await import('$lib/identitet.js');
      const token = await osigurajAuthToken();
      const { queryIzazovi } = await import('./ucitavanje.js');
      const odgovor = await fetch(apiUrl(`/admin/analitika/izazovi.csv?${queryIzazovi(filteri())}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!odgovor.ok) throw new Error(`CSV nije dostupan (${odgovor.status})`);
      const blob = await odgovor.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `izazovi-${od || 'od'}_${doDana || 'do'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      stanja.izazovi = {
        ...stanja.izazovi,
        greska: e instanceof Error ? e.message : 'CSV preuzimanje nije uspjelo.',
      };
    }
  }

  onMount(() => {
    void ucitajTab('igraci');
  });
</script>

<svelte:head>
  <title>Analitika | Admin | Kaladont</title>
</svelte:head>

<h1>Analitika</h1>
<p class="opis">
  Interna analitika po tematskim tabovima. Posjećenost (Umami) ostaje zaseban alat.
</p>

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
{:else if statusGreska}
  <p class="meta" role="alert">{statusGreska}</p>
{/if}

<AnalitikaFilteri
  bind:od
  bind:doDana
  bind:kontekst
  bind:izazovChallengeId
  bind:izazovAccountType
  prikaziKontekst={tabPrikazujeKontekst(tab)}
  prikaziIzazov={tabPrikazujeIzazovFiltere(tab)}
  onOsvjezi={osvjeziAktivni}
/>

<div class="tabovi" role="tablist" aria-label="Tematske cjeline analitike">
  {#each TABOVI_ANALITIKE as t (t.id)}
    <button
      type="button"
      role="tab"
      id="tab-{t.id}"
      aria-selected={tab === t.id}
      aria-controls="panel-{t.id}"
      class:odabran={tab === t.id}
      tabindex={tab === t.id ? 0 : -1}
      onclick={() => odaberiTab(t.id)}
    >
      {t.oznaka}
    </button>
  {/each}
</div>

<div
  class="panel"
  role="tabpanel"
  id="panel-{tab}"
  aria-labelledby="tab-{tab}"
>
  {#if tab === 'igraci'}
    <IgraciIRast
      igraci={igraciAgregat}
      {dnevno}
      ucitava={stanja.igraci.ucitava}
      greska={stanja.igraci.greska}
    />
  {:else if tab === 'partije'}
    <Partije
      partije={partijeAgregat}
      ucitava={stanja.partije.ucitava}
      greska={stanja.partije.greska}
    />
  {:else if tab === 'cekaonica'}
    <Cekaonica
      cekanje={cekanjeAgregat}
      ucitava={stanja.cekaonica.ucitava}
      greska={stanja.cekaonica.greska}
    />
  {:else if tab === 'botovi'}
    <BotoviIBalans
      botovi={botoviAgregat}
      ucitava={stanja.botovi.ucitava}
      greska={stanja.botovi.greska}
    />
  {:else if tab === 'izazovi'}
    <Izazovi
      {izazovi}
      ucitava={stanja.izazovi.ucitava}
      greska={stanja.izazovi.greska}
      onPreuzmiCsv={() => void preuzmiCsv()}
    />
  {:else if tab === 'gamifikacija'}
    <Gamifikacija
      agregat={gamifikacijaAgregat}
      ucitava={stanja.gamifikacija.ucitava}
      greska={stanja.gamifikacija.greska}
    />
  {:else if tab === 'rjecnik'}
    <RjecnikIIncidenti
      {agregat}
      {incidenti}
      ukupno={ukupnoIncidenata}
      {stranica}
      ucitava={stanja.rjecnik.ucitava}
      greska={stanja.rjecnik.greska}
      {odabraniId}
      {detalj}
      {uklanjanjeUTijeku}
      onStranica={promijeniStranicuIncidenata}
      onDetalj={(id) => void otvoriDetalj(id)}
      onIzbaci={(rijec) => void izbaciIzSigurnogSkupa(rijec)}
    />
  {/if}
</div>

<style>
  .opis, .meta { color: #444; margin-bottom: 12px; }
  .status { border: 1px solid #ccc; padding: 10px 12px; margin-bottom: 12px; background: #fafafa; }
  :global(.filteri) { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin-bottom: 16px; }
  :global(.filteri label) { display: flex; flex-direction: column; gap: 4px; font-weight: 600; }
  .tabovi {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 20px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 0;
  }
  .tabovi button {
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    padding: 8px 12px;
    cursor: pointer;
    font-weight: 600;
    color: #444;
    border-radius: 6px 6px 0 0;
  }
  .tabovi button.odabran {
    background: #f5f5f5;
    border-color: #ccc;
    color: #111;
    margin-bottom: -1px;
    padding-bottom: 9px;
  }
  .tabovi button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
  .panel :global(.kartice) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .panel :global(.kartice div) { border: 1px solid #ddd; padding: 12px; }
  .panel :global(.kartice dt) { font-size: 0.85rem; color: #555; }
  .panel :global(.kartice dd) { margin: 4px 0 0; font-size: 1.25rem; font-weight: 700; }
  .panel { overflow-x: auto; }
  .panel :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
    min-width: 640px;
  }
  .panel :global(th), .panel :global(td) {
    border-bottom: 1px solid #ddd;
    text-align: left;
    padding: 8px;
    vertical-align: top;
  }
  .panel :global(.stranicenje) { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
  .panel :global(.akcije-inc) { display: flex; flex-wrap: wrap; gap: 8px; }
  .panel :global(pre) { background: #f6f6f6; padding: 12px; overflow: auto; }
  @media (prefers-color-scheme: dark) {
    .opis, .meta { color: #bbb; }
    .status { background: #1a1a1a; border-color: #444; }
    .tabovi { border-bottom-color: #444; }
    .tabovi button { color: #bbb; }
    .tabovi button.odabran { background: #222; border-color: #444; color: #f5f5f5; }
    .panel :global(.kartice div) { border-color: #444; }
    .panel :global(th), .panel :global(td) { border-bottom-color: #444; }
    .panel :global(pre) { background: #1a1a1a; }
  }
</style>
