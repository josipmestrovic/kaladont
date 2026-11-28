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

  interface AgregatIgraca {
    od: string;
    do: string;
    kontekst: string | null;
    vremenskaZona: string;
    danas: string;
    referentniDan: string;
    referentniDanNezavrsen: boolean;
    mjerenjeOd: string | null;
    napomena: string;
    kpi: {
      dau: number;
      wau: number;
      mau: number;
      dauMau: number | null;
      registracijeRaspon: number;
      konverzija30d: { gosti: number; konvertirani: number; postotak: number | null };
      konverzijaDosadNezrele: { gosti: number; konvertirani: number; postotak: number | null };
    };
    retencijaUkupno: {
      d1: { povratnici: number; kohorta: number; postotak: number | null };
      d7: { povratnici: number; kohorta: number; postotak: number | null };
      d30: { povratnici: number; kohorta: number; postotak: number | null };
    };
    dani: { dan: string; dau: number; novi: number; povratni: number; registracije: number }[];
    retencijaKohorte: {
      kohortaDan: string;
      noviIgraci: number;
      d1Povratnici: number | null;
      d1Postotak: number | null;
      d7Povratnici: number | null;
      d7Postotak: number | null;
      d30Povratnici: number | null;
      d30Postotak: number | null;
      d1Zrela: boolean;
      d7Zrela: boolean;
      d30Zrela: boolean;
    }[];
  }

  let od = $state('');
  let doDana = $state('');
  let kontekst = $state<'' | 'javna' | 'privatna' | 'trening' | 'izazov'>('');
  let izazovChallengeId = $state('');
  let izazovAccountType = $state<'' | 'gost' | 'registriran'>('');
  let status = $state<StatusAnalitike | null>(null);
  let agregat = $state<AgregatPocetnih | null>(null);
  let dnevno = $state<Dnevno | null>(null);
  let igraciAgregat = $state<AgregatIgraca | null>(null);
  let partijeAgregat = $state<AgregatPartija | null>(null);
  let cekanjeAgregat = $state<AgregatCekanjaOdgovor | null>(null);
  let botoviAgregat = $state<AgregatBotova | null>(null);
  let gamifikacijaAgregat = $state<AgregatGamifikacije | null>(null);
  let izazovi = $state<AgregatIzazova | null>(null);

  interface SazetakMisijaVrste {
    dodijeljene: number;
    dovrsene: number;
    aktivne: number;
    zamijenjene: number;
    istekle: number;
    primatelji: number;
    dovrsitelji: number;
    udioTrenutnoDovrsenih: number | null;
    terminalnaStopaDovrsavanja: number | null;
    terminalniNazivnik: number;
    vrijemeDovrsetka: { prosjekSekundi: number | null; medijanSekundi: number | null; uzorak: number };
  }

  interface AgregatGamifikacije {
    od: string;
    do: string;
    kontekst: string | null;
    vremenskaZona: string;
    napomena: string;
    razdoblje: {
      misije: { dnevne: SazetakMisijaVrste; tjedne: SazetakMisijaVrste; napomenaNazivnika: string };
      predlosci: {
        predlozakId: string;
        naziv: string;
        vrsta: string;
        verzijaDefinicije: number;
        dodjele: number;
        dovrsene: number;
        zamijenjene: number;
        istekle: number;
        aktivne: number;
        terminalnaStopaDovrsavanja: number | null;
        stopaZamjenjivanja: number | null;
        maliUzorak: boolean;
      }[];
      zamjene: {
        ukupno: number;
        jedinstveniIgraci: number;
        dnevne: number;
        tjedne: number;
        najcesceZamijenjeni: { predlozakId: string; naziv: string; broj: number }[];
        najcesceDobiveniKaoZamjena: { predlozakId: string; naziv: string; broj: number }[];
      };
      dotokDnevnih: { dodijeljeno: number; preskoceno: number; napomena: string };
      doprinosi: Record<string, { doprinosi: number; distinctIgara: number }>;
      xpMisija: {
        ukupnoStvarno: number;
        dnevneStvarno: number;
        tjedneStvarno: number;
        brojNagrada: number;
        primatelji: number;
        prosjekStvarnogPoNagradi: number | null;
      };
      xpIzazova: {
        prviUspjesi: number;
        jedinstveniIgraci: number;
        awardedXpUkupno: number;
        prosjekPoPrvomUspjehu: number | null;
      };
      prvaOtkljucavanjaDostignuca: number;
      otkljucavanjaRijeci: number;
    };
    trenutacniPresjek: {
      oznaka: string;
      bazaIgraca: number;
      xpRazine: {
        poRasponu: { raspon: string; broj: number }[];
        prosjekXp: number | null;
        medijanXp: number | null;
        prosjekRazina: number | null;
        medijanRazina: number | null;
        napredovaliIznadPrve: number;
        uzorak: number;
      };
      dostignuca: {
        igraciSBaremJednim: number;
        prosjekOtkljucanih: number | null;
        prosjekZvjezdica: number | null;
        medijanZvjezdica: number | null;
        igraciSMaksimalnoDovrsenimPojedinim: number;
        poDostignucu: {
          id: string;
          naziv: string;
          otkljucani: number;
          udioOtkljucanih: number | null;
          naMaksimalnojRazini: number;
          prosjekZvjezdicaOtkljucanih: number | null;
          maksimalnaRazina: number;
        }[];
      };
      kolekcija: {
        igraciSBaremJednomRijeci: number;
        distinctRijeciGlobalno: number;
        prosjekVelicine: number | null;
        medijanVelicine: number | null;
        brojDugihOtkljucavanja: number;
        brojRijetkihOtkljucavanja: number;
        raspodjelaVelicine: { raspon: string; broj: number }[];
      };
    };
  }

  interface TrajanjeStat {
    prosjekSekundi: number | null;
    medijanSekundi: number | null;
    p90Sekundi: number | null;
    p95Sekundi?: number | null;
    uzorak: number;
  }

  interface SegmentCekanja {
    terminalniPokusaji: number;
    ishodi: { ishod: string; broj: number; postotak: number | null }[];
    trajanjeDoUparivanja: TrajanjeStat;
    trajanjeDoNapustanja: TrajanjeStat;
    distribucijaNapustanja: { interval: string; broj: number; postotak: number | null }[];
  }

  interface AgregatCekanjaOdgovor {
    ok: boolean;
    dostupno: boolean;
    razlog?: string;
    od: string;
    do: string;
    kontekst?: string | null;
    vremenskaZona?: string;
    danas?: string;
    mjerenjeOd?: string | null;
    napomena?: string;
    ukupno?: SegmentCekanja;
    gosti?: SegmentCekanja;
    registrirani?: SegmentCekanja;
  }

  interface MetrikaPobjedaBotova {
    zavrseneProtivBotova: number;
    pobjedeLjudi: number;
    pobjedeBotova: number;
    nepoznatPobjednik: number;
    udioPobjedaLjudi: number | null;
    udioPobjedaBotova: number | null;
    maliUzorak: boolean;
    wilsonLjudi: WilsonInterval | null;
  }

  interface AgregatBotova {
    od: string;
    do: string;
    kontekst: string | null;
    vremenskaZona: string;
    napomena: string;
    pokrivenost: {
      zapocete: number;
      sastav: { broj: number; postotak: number | null };
      profil: { broj: number; postotak: number | null };
      pobjednik: { broj: number; postotak: number | null };
      eliminacije: { broj: number; postotak: number | null };
    };
    uspjesnost: {
      ukupno: MetrikaPobjedaBotova;
      poProfilu: (MetrikaPobjedaBotova & { profil: string })[];
      poFormatu: (MetrikaPobjedaBotova & { mod: string })[];
      poPravilima: (MetrikaPobjedaBotova & { pravila: string })[];
      poVerziji: (MetrikaPobjedaBotova & { verzija: string })[];
    };
    sastavJavnih: (MetrikaPobjedaBotova & { sastav: string; brojIgara: number; udio: number | null })[];
    eliminacije: {
      ljudi: { razlog: string; broj: number; postotak: number | null }[];
      botovi: { razlog: string; broj: number; postotak: number | null }[];
    };
    trajanje: {
      poProfilu: (TrajanjeStat & { profil: string })[];
      poFormatu: (TrajanjeStat & { mod: string })[];
      poPravilima: (TrajanjeStat & { pravila: string })[];
    };
  }

  interface AgregatPartija {
    od: string;
    do: string;
    kontekst: string | null;
    vremenskaZona: string;
    napomena: string;
    sazetak: {
      zapocete: number;
      zavrsene: number;
      prekinute: number;
      nepotpuno: number;
      bezIshoda: number;
      jedinstveniIgraci: number;
      stopaZavrsavanja: number | null;
      pokrivenostTerminalnih: number | null;
      trajanje: TrajanjeStat;
      pokrivenostPravila: number | null;
    };
    nacini: {
      kontekst: string;
      zapocete: number;
      zavrsene: number;
      prekinute: number;
      nepotpuno: number;
      bezIshoda: number;
      jedinstveniIgraci: number;
      udioZapocetih: number | null;
      stopaZavrsavanja: number | null;
      pokrivenostTerminalnih: number | null;
      trajanje: TrajanjeStat;
    }[];
    formati: {
      kontekst: string | null;
      mod: string;
      zapocete: number;
      zavrsene: number;
      udioZapocetih: number | null;
      stopaZavrsavanja: number | null;
      trajanje: TrajanjeStat;
    }[];
    pravila: {
      pravila: string;
      zapocete: number;
      zavrsene: number;
      udioZapocetih: number | null;
      stopaZavrsavanja: number | null;
      trajanje: TrajanjeStat;
    }[];
  }
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

  function retencijaTekst(postotakVrijednost: number | null, povratnici: number, kohorta: number): string {
    if (postotakVrijednost === null) return 'Još nema dovoljno podataka';
    return `${povratnici} / ${kohorta} (${postotak(postotakVrijednost)})`;
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

  function formatSekundi(sekunde: number | null): string {
    if (sekunde === null) return '—';
    if (sekunde < 60) return `${sekunde.toFixed(0)} s`;
    return `${(sekunde / 60).toFixed(1)} min`;
  }

  function nazivKonteksta(k: string): string {
    if (k === 'javna') return 'Brza igra';
    if (k === 'privatna') return 'Privatne sobe';
    if (k === 'trening') return 'Trening';
    if (k === 'izazov') return 'Izazovi';
    return k;
  }

  function nazivModa(m: string): string {
    if (m === 'dva_igraca') return 'Dvoboj';
    if (m === 'tri_igraca') return 'Troboj';
    if (m === 'cetiri_igraca') return 'Četveroboj';
    return m;
  }

  function nazivPravila(p: string): string {
    if (p === 'klasicni') return 'Klasični';
    if (p === 'ka_zna') return 'KA-ZNA';
    if (p === 'dokazi_nastavak') return 'Dokaži nastavak';
    if (p === 'nepoznato') return 'Nepoznato';
    return p;
  }

  function nazivIshodaCekanja(i: string): string {
    if (i === 'uparivanje') return 'Uparivanje';
    if (i === 'napustanje') return 'Napuštanje';
    if (i === 'prekid_veze') return 'Prekid veze';
    if (i === 'promjena_reda') return 'Promjena reda';
    if (i === 'uklonjen') return 'Uklonjen';
    return i;
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
      api<AgregatIgraca & { ok: boolean }>(`/admin/analitika/igraci?${q}`),
      api<AgregatPartija & { ok: boolean }>(`/admin/analitika/partije?${q}`),
      api<AgregatCekanjaOdgovor>(`/admin/analitika/cekanje?${q}`),
      api<AgregatBotova & { ok: boolean }>(`/admin/analitika/botovi?${q}`),
      api<AgregatGamifikacije & { ok: boolean }>(`/admin/analitika/gamifikacija?${q}`),
      api<StatusAnalitike & { ok: boolean }>('/admin/analitika/status'),
      api<AgregatIzazova & { ok: boolean }>(`/admin/analitika/izazovi?${qIz}`),
    ]);
    const greske: string[] = [];
    const [a, i, d, ig, p, c, b, g, s, iz] = rezultati;
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
    if (ig.status === 'fulfilled') igraciAgregat = ig.value;
    else greske.push(ig.reason instanceof Error ? ig.reason.message : 'Analitika igrača nije dostupna.');
    if (p.status === 'fulfilled') partijeAgregat = p.value;
    else greske.push(p.reason instanceof Error ? p.reason.message : 'Analitika partija nije dostupna.');
    if (c.status === 'fulfilled') cekanjeAgregat = c.value;
    else greske.push(c.reason instanceof Error ? c.reason.message : 'Analitika čekaonice nije dostupna.');
    if (b.status === 'fulfilled') botoviAgregat = b.value;
    else greske.push(b.reason instanceof Error ? b.reason.message : 'Analitika botova nije dostupna.');
    if (g.status === 'fulfilled') gamifikacijaAgregat = g.value;
    else greske.push(g.reason instanceof Error ? g.reason.message : 'Analitika gamifikacije nije dostupna.');
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
<p class="opis">Pregled početnih riječi, dnevnog igranja, aktivnosti igrača, retencije, konverzije i javne čekaonice. Posjećenost još nije uključena.</p>

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
    <input type="text" bind:value={izazovChallengeId} placeholder="npr. IZ-L1-DV-01" maxlength="32" />
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

{#if partijeAgregat}
  <section aria-labelledby="partije-naslov">
    <h2 id="partije-naslov">Partije i načini igranja</h2>
    <p class="meta">
      Zona: {partijeAgregat.vremenskaZona} · {partijeAgregat.od} – {partijeAgregat.do}
      · kohorta po početku igre
      {#if partijeAgregat.kontekst}
        · kontekst: {nazivKonteksta(partijeAgregat.kontekst)}
      {/if}
    </p>
    <p class="meta">{partijeAgregat.napomena}</p>
    <dl class="kartice">
      <div><dt>Započete</dt><dd>{partijeAgregat.sazetak.zapocete}</dd></div>
      <div><dt>Završene</dt><dd>{partijeAgregat.sazetak.zavrsene}</dd></div>
      <div><dt>Stopa završavanja</dt><dd>{postotak(partijeAgregat.sazetak.stopaZavrsavanja)}</dd></div>
      <div><dt>Prosječno trajanje</dt><dd>{formatSekundi(partijeAgregat.sazetak.trajanje.prosjekSekundi)}</dd></div>
      <div><dt>Jedinstveni igrači</dt><dd>{partijeAgregat.sazetak.jedinstveniIgraci}</dd></div>
      <div><dt>Pokrivenost pravila</dt><dd>{postotak(partijeAgregat.sazetak.pokrivenostPravila)}</dd></div>
    </dl>
    <h3>Načini igranja</h3>
    <table>
      <thead>
        <tr>
          <th>Način</th>
          <th>Započete</th>
          <th>Završene</th>
          <th>Prekinute</th>
          <th>Bez ishoda</th>
          <th>Udio</th>
          <th>Stopa</th>
          <th>Igrači</th>
          <th>Prosjek / medijan / P90</th>
        </tr>
      </thead>
      <tbody>
        {#each partijeAgregat.nacini as red (red.kontekst)}
          <tr>
            <td>{nazivKonteksta(red.kontekst)}</td>
            <td>{red.zapocete}</td>
            <td>{red.zavrsene}</td>
            <td>{red.prekinute}</td>
            <td>{red.bezIshoda}</td>
            <td>{postotak(red.udioZapocetih)}</td>
            <td>{postotak(red.stopaZavrsavanja)}</td>
            <td>{red.jedinstveniIgraci}</td>
            <td>
              {formatSekundi(red.trajanje.prosjekSekundi)}
              / {formatSekundi(red.trajanje.medijanSekundi)}
              / {formatSekundi(red.trajanje.p90Sekundi)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <h3>Formati</h3>
    {#if partijeAgregat.formati.length === 0}
      <p>Nema zapisa formata u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Kontekst</th>
            <th>Format</th>
            <th>Započete</th>
            <th>Završene</th>
            <th>Udio</th>
            <th>Stopa</th>
            <th>Prosjek / medijan / P90</th>
          </tr>
        </thead>
        <tbody>
          {#each partijeAgregat.formati as red (`${red.kontekst}-${red.mod}`)}
            <tr>
              <td>{red.kontekst ? nazivKonteksta(red.kontekst) : '—'}</td>
              <td>{nazivModa(red.mod)}</td>
              <td>{red.zapocete}</td>
              <td>{red.zavrsene}</td>
              <td>{postotak(red.udioZapocetih)}</td>
              <td>{postotak(red.stopaZavrsavanja)}</td>
              <td>
                {formatSekundi(red.trajanje.prosjekSekundi)}
                / {formatSekundi(red.trajanje.medijanSekundi)}
                / {formatSekundi(red.trajanje.p90Sekundi)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <h3>Pravila</h3>
    <table>
      <thead>
        <tr>
          <th>Pravilnik</th>
          <th>Započete</th>
          <th>Završene</th>
          <th>Udio</th>
          <th>Stopa</th>
          <th>Prosjek / medijan / P90</th>
        </tr>
      </thead>
      <tbody>
        {#each partijeAgregat.pravila as red (red.pravila)}
          <tr>
            <td>{nazivPravila(red.pravila)}</td>
            <td>{red.zapocete}</td>
            <td>{red.zavrsene}</td>
            <td>{postotak(red.udioZapocetih)}</td>
            <td>{postotak(red.stopaZavrsavanja)}</td>
            <td>
              {formatSekundi(red.trajanje.prosjekSekundi)}
              / {formatSekundi(red.trajanje.medijanSekundi)}
              / {formatSekundi(red.trajanje.p90Sekundi)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="meta">
      Ishodi ukupno: završene {partijeAgregat.sazetak.zavrsene},
      prekinute {partijeAgregat.sazetak.prekinute},
      nepotpuno {partijeAgregat.sazetak.nepotpuno},
      bez ishoda {partijeAgregat.sazetak.bezIshoda}
      · pokrivenost terminalnih {postotak(partijeAgregat.sazetak.pokrivenostTerminalnih)}
      · trajanje uzorak {partijeAgregat.sazetak.trajanje.uzorak}
      (medijan {formatSekundi(partijeAgregat.sazetak.trajanje.medijanSekundi)},
      P90 {formatSekundi(partijeAgregat.sazetak.trajanje.p90Sekundi)})
    </p>
  </section>
{/if}

{#if cekanjeAgregat}
  <section aria-labelledby="cekanje-naslov">
    <h2 id="cekanje-naslov">Čekaonica (javna)</h2>
    {#if !cekanjeAgregat.dostupno}
      <p class="meta">{cekanjeAgregat.razlog ?? 'Nije dostupno za odabrani kontekst.'}</p>
    {:else if cekanjeAgregat.ukupno}
      <p class="meta">
        Zona: {cekanjeAgregat.vremenskaZona} · {cekanjeAgregat.od} – {cekanjeAgregat.do}
        · kohorta po kraju čekanja
        · mjerenje od {cekanjeAgregat.mjerenjeOd ?? '—'}
      </p>
      <p class="meta">{cekanjeAgregat.napomena}</p>
      <dl class="kartice">
        <div><dt>Terminalni pokušaji</dt><dd>{cekanjeAgregat.ukupno.terminalniPokusaji}</dd></div>
        <div>
          <dt>Uparivanje</dt>
          <dd>
            {cekanjeAgregat.ukupno.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}
            ({postotak(cekanjeAgregat.ukupno.ishodi.find((x) => x.ishod === 'uparivanje')?.postotak ?? null)})
          </dd>
        </div>
        <div>
          <dt>Napuštanje</dt>
          <dd>
            {cekanjeAgregat.ukupno.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}
            ({postotak(cekanjeAgregat.ukupno.ishodi.find((x) => x.ishod === 'napustanje')?.postotak ?? null)})
          </dd>
        </div>
        <div>
          <dt>Do uparivanja (medijan)</dt>
          <dd>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoUparivanja.medijanSekundi)}</dd>
        </div>
        <div>
          <dt>Do napuštanja (medijan)</dt>
          <dd>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoNapustanja.medijanSekundi)}</dd>
        </div>
      </dl>
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
          {#each cekanjeAgregat.ukupno.ishodi as red (red.ishod)}
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
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoUparivanja.prosjekSekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoUparivanja.medijanSekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoUparivanja.p90Sekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoUparivanja.p95Sekundi ?? null)}</td>
            <td>{cekanjeAgregat.ukupno.trajanjeDoUparivanja.uzorak}</td>
          </tr>
          <tr>
            <td>Do napuštanja</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoNapustanja.prosjekSekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoNapustanja.medijanSekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoNapustanja.p90Sekundi)}</td>
            <td>{formatSekundi(cekanjeAgregat.ukupno.trajanjeDoNapustanja.p95Sekundi ?? null)}</td>
            <td>{cekanjeAgregat.ukupno.trajanjeDoNapustanja.uzorak}</td>
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
          {#each cekanjeAgregat.ukupno.distribucijaNapustanja as red (red.interval)}
            <tr>
              <td>{red.interval}</td>
              <td>{red.broj}</td>
              <td>{postotak(red.postotak)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if cekanjeAgregat.gosti && cekanjeAgregat.registrirani}
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
              <td>{cekanjeAgregat.gosti.terminalniPokusaji}</td>
              <td>{cekanjeAgregat.gosti.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}</td>
              <td>{cekanjeAgregat.gosti.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}</td>
              <td>{formatSekundi(cekanjeAgregat.gosti.trajanjeDoUparivanja.medijanSekundi)}</td>
              <td>{formatSekundi(cekanjeAgregat.gosti.trajanjeDoNapustanja.medijanSekundi)}</td>
            </tr>
            <tr>
              <td>Registrirani</td>
              <td>{cekanjeAgregat.registrirani.terminalniPokusaji}</td>
              <td>{cekanjeAgregat.registrirani.ishodi.find((x) => x.ishod === 'uparivanje')?.broj ?? 0}</td>
              <td>{cekanjeAgregat.registrirani.ishodi.find((x) => x.ishod === 'napustanje')?.broj ?? 0}</td>
              <td>{formatSekundi(cekanjeAgregat.registrirani.trajanjeDoUparivanja.medijanSekundi)}</td>
              <td>{formatSekundi(cekanjeAgregat.registrirani.trajanjeDoNapustanja.medijanSekundi)}</td>
            </tr>
          </tbody>
        </table>
      {/if}
    {/if}
  </section>
{/if}

{#if botoviAgregat}
  <section aria-labelledby="botovi-naslov">
    <h2 id="botovi-naslov">Botovi i balans</h2>
    <p class="meta">
      Zona: {botoviAgregat.vremenskaZona} · {botoviAgregat.od} – {botoviAgregat.do}
      · kohorta po početku igre
      {#if botoviAgregat.kontekst}
        · kontekst: {nazivKonteksta(botoviAgregat.kontekst)}
      {/if}
    </p>
    <p class="meta">{botoviAgregat.napomena}</p>
    <dl class="kartice">
      <div><dt>Završene vs botovi</dt><dd>{botoviAgregat.uspjesnost.ukupno.zavrseneProtivBotova}</dd></div>
      <div><dt>Pobjede ljudi</dt><dd>{botoviAgregat.uspjesnost.ukupno.pobjedeLjudi} ({postotak(botoviAgregat.uspjesnost.ukupno.udioPobjedaLjudi)})</dd></div>
      <div><dt>Pobjede botova</dt><dd>{botoviAgregat.uspjesnost.ukupno.pobjedeBotova} ({postotak(botoviAgregat.uspjesnost.ukupno.udioPobjedaBotova)})</dd></div>
      <div><dt>Wilson ljudi</dt><dd>{wilsonTekst(botoviAgregat.uspjesnost.ukupno.wilsonLjudi)}</dd></div>
      <div><dt>Pokrivenost sastava</dt><dd>{postotak(botoviAgregat.pokrivenost.sastav.postotak)}</dd></div>
      <div><dt>Pokrivenost profila</dt><dd>{postotak(botoviAgregat.pokrivenost.profil.postotak)}</dd></div>
    </dl>
    {#if botoviAgregat.uspjesnost.ukupno.maliUzorak}
      <p class="meta"><strong>Mali uzorak</strong> (&lt;30 završenih s poznatim pobjednikom)</p>
    {/if}

    <h3>Uspješnost po profilu</h3>
    {#if botoviAgregat.uspjesnost.poProfilu.length === 0}
      <p>Nema završenih igara protiv botova u odabranom razdoblju.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Profil</th>
            <th>Završene</th>
            <th>Ljudi</th>
            <th>Botovi</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botoviAgregat.uspjesnost.poProfilu as red (red.profil)}
            <tr>
              <td>{red.profil}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Sastav javnih stolova</h3>
    {#if botoviAgregat.sastavJavnih.length === 0}
      <p>Nema javnih igara s poznatim sastavom.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Sastav</th>
            <th>Igre</th>
            <th>Udio</th>
            <th>Pobjede ljudi</th>
            <th>Pobjede botova</th>
            <th>Udio ljudi</th>
          </tr>
        </thead>
        <tbody>
          {#each botoviAgregat.sastavJavnih as red (red.sastav)}
            <tr>
              <td>{red.sastav}</td>
              <td>{red.brojIgara}</td>
              <td>{postotak(red.udio)}</td>
              <td>{red.pobjedeLjudi}</td>
              <td>{red.pobjedeBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Eliminacije</h3>
    <table>
      <thead>
        <tr>
          <th>Razlog</th>
          <th>Ljudi</th>
          <th>Udio ljudi</th>
          <th>Botovi</th>
          <th>Udio botova</th>
        </tr>
      </thead>
      <tbody>
        {#each botoviAgregat.eliminacije.ljudi as red, indeks (red.razlog)}
          <tr>
            <td>{red.razlog}</td>
            <td>{red.broj}</td>
            <td>{postotak(red.postotak)}</td>
            <td>{botoviAgregat.eliminacije.botovi[indeks]?.broj ?? 0}</td>
            <td>{postotak(botoviAgregat.eliminacije.botovi[indeks]?.postotak ?? null)}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Trajanje po profilu</h3>
    {#if botoviAgregat.trajanje.poProfilu.length === 0}
      <p>Nema uzorka trajanja.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Profil</th>
            <th>Prosjek</th>
            <th>Medijan</th>
            <th>P90</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botoviAgregat.trajanje.poProfilu as red (red.profil)}
            <tr>
              <td>{red.profil}</td>
              <td>{formatSekundi(red.prosjekSekundi)}</td>
              <td>{formatSekundi(red.medijanSekundi)}</td>
              <td>{formatSekundi(red.p90Sekundi)}</td>
              <td>{red.uzorak}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Verzije i pokrivenost</h3>
    <p class="meta">
      Pokrivenost: sastav {postotak(botoviAgregat.pokrivenost.sastav.postotak)},
      profil {postotak(botoviAgregat.pokrivenost.profil.postotak)},
      pobjednik {postotak(botoviAgregat.pokrivenost.pobjednik.postotak)},
      eliminacije {postotak(botoviAgregat.pokrivenost.eliminacije.postotak)}
      od {botoviAgregat.pokrivenost.zapocete} započetih.
    </p>
    {#if botoviAgregat.uspjesnost.poVerziji.length > 0}
      <table>
        <thead>
          <tr>
            <th>Verzija (politika/profil)</th>
            <th>Završene</th>
            <th>Udio ljudi</th>
            <th>Uzorak</th>
          </tr>
        </thead>
        <tbody>
          {#each botoviAgregat.uspjesnost.poVerziji as red (red.verzija)}
            <tr>
              <td>{red.verzija}</td>
              <td>{red.zavrseneProtivBotova}</td>
              <td>{postotak(red.udioPobjedaLjudi)}{#if red.maliUzorak} · mali{/if}</td>
              <td>{red.pobjedeLjudi + red.pobjedeBotova}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

{#if gamifikacijaAgregat}
  <section aria-labelledby="gamifikacija-naslov">
    <h2 id="gamifikacija-naslov">Gamifikacija</h2>
    <p class="meta">
      Zona: {gamifikacijaAgregat.vremenskaZona} · {gamifikacijaAgregat.od} – {gamifikacijaAgregat.do}
      {#if gamifikacijaAgregat.kontekst}
        · kontekst: {nazivKonteksta(gamifikacijaAgregat.kontekst)}
      {/if}
    </p>
    <p class="meta">{gamifikacijaAgregat.napomena}</p>

    <h3>Dnevne i tjedne misije</h3>
    <p class="meta">{gamifikacijaAgregat.razdoblje.misije.napomenaNazivnika}</p>
    <dl class="kartice">
      <div><dt>Dnevne dodijeljene</dt><dd>{gamifikacijaAgregat.razdoblje.misije.dnevne.dodijeljene}</dd></div>
      <div><dt>Dnevne dovršene</dt><dd>{gamifikacijaAgregat.razdoblje.misije.dnevne.dovrsene} ({postotak(gamifikacijaAgregat.razdoblje.misije.dnevne.udioTrenutnoDovrsenih)})</dd></div>
      <div><dt>Dnevne terminalna stopa</dt><dd>{postotak(gamifikacijaAgregat.razdoblje.misije.dnevne.terminalnaStopaDovrsavanja)} (n={gamifikacijaAgregat.razdoblje.misije.dnevne.terminalniNazivnik})</dd></div>
      <div><dt>Dnevne aktivne</dt><dd>{gamifikacijaAgregat.razdoblje.misije.dnevne.aktivne}</dd></div>
      <div><dt>Tjedne dodijeljene</dt><dd>{gamifikacijaAgregat.razdoblje.misije.tjedne.dodijeljene}</dd></div>
      <div><dt>Tjedne dovršene</dt><dd>{gamifikacijaAgregat.razdoblje.misije.tjedne.dovrsene} ({postotak(gamifikacijaAgregat.razdoblje.misije.tjedne.udioTrenutnoDovrsenih)})</dd></div>
      <div><dt>Tjedne terminalna stopa</dt><dd>{postotak(gamifikacijaAgregat.razdoblje.misije.tjedne.terminalnaStopaDovrsavanja)} (n={gamifikacijaAgregat.razdoblje.misije.tjedne.terminalniNazivnik})</dd></div>
      <div><dt>Zamjene (ukupno)</dt><dd>{gamifikacijaAgregat.razdoblje.zamjene.ukupno} · {gamifikacijaAgregat.razdoblje.zamjene.jedinstveniIgraci} igrača</dd></div>
    </dl>

    <h3>Uspješnost predložaka</h3>
    {#if gamifikacijaAgregat.razdoblje.predlosci.length === 0}
      <p class="meta">Nema dodjela u rasponu.</p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Predložak</th>
            <th>Vrsta</th>
            <th>v</th>
            <th>Dodjele</th>
            <th>Dovršene</th>
            <th>Zamjene</th>
            <th>Terminalna</th>
          </tr>
        </thead>
        <tbody>
          {#each gamifikacijaAgregat.razdoblje.predlosci.slice(0, 40) as red (`${red.predlozakId}-${red.vrsta}-${red.verzijaDefinicije}`)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.vrsta}</td>
              <td>{red.verzijaDefinicije}</td>
              <td>{red.dodjele}</td>
              <td>{red.dovrsene}</td>
              <td>{red.zamijenjene}</td>
              <td>{postotak(red.terminalnaStopaDovrsavanja)}{#if red.maliUzorak} · mali{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>XP nagrade (razdoblje)</h3>
    <dl class="kartice">
      <div><dt>XP misija (stvarno)</dt><dd>{gamifikacijaAgregat.razdoblje.xpMisija.ukupnoStvarno}</dd></div>
      <div><dt>Dnevne / tjedne</dt><dd>{gamifikacijaAgregat.razdoblje.xpMisija.dnevneStvarno} / {gamifikacijaAgregat.razdoblje.xpMisija.tjedneStvarno}</dd></div>
      <div><dt>Nagrade misija</dt><dd>{gamifikacijaAgregat.razdoblje.xpMisija.brojNagrada} · {gamifikacijaAgregat.razdoblje.xpMisija.primatelji} primatelja</dd></div>
      <div><dt>Prosjek XP/nagrada</dt><dd>{gamifikacijaAgregat.razdoblje.xpMisija.prosjekStvarnogPoNagradi?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>XP izazova (prvi uspjeh)</dt><dd>{gamifikacijaAgregat.razdoblje.xpIzazova.awardedXpUkupno}</dd></div>
      <div><dt>Prvi uspjesi</dt><dd>{gamifikacijaAgregat.razdoblje.xpIzazova.prviUspjesi} · {gamifikacijaAgregat.razdoblje.xpIzazova.jedinstveniIgraci} igrača</dd></div>
      <div><dt>Dotok dnevnih</dt><dd>{gamifikacijaAgregat.razdoblje.dotokDnevnih.dodijeljeno} dodijeljeno / {gamifikacijaAgregat.razdoblje.dotokDnevnih.preskoceno} preskočeno</dd></div>
      <div><dt>Otključavanja (★ / riječi)</dt><dd>{gamifikacijaAgregat.razdoblje.prvaOtkljucavanjaDostignuca} / {gamifikacijaAgregat.razdoblje.otkljucavanjaRijeci}</dd></div>
    </dl>
    <p class="meta">
      Doprinosi: javna {gamifikacijaAgregat.razdoblje.doprinosi.javna?.doprinosi ?? 0}
      · trening {gamifikacijaAgregat.razdoblje.doprinosi.trening?.doprinosi ?? 0}
      · izazov {gamifikacijaAgregat.razdoblje.doprinosi.izazov?.doprinosi ?? 0}
    </p>

    <h3>Raspodjela XP razina (trenutačno)</h3>
    <p class="meta">Baza igrača: {gamifikacijaAgregat.trenutacniPresjek.bazaIgraca} · nije XP zarađen u filteru datuma.</p>
    <dl class="kartice">
      <div><dt>Prosjek / medijan XP</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.xpRazine.prosjekXp?.toFixed(0) ?? '—'} / {gamifikacijaAgregat.trenutacniPresjek.xpRazine.medijanXp?.toFixed(0) ?? '—'}</dd></div>
      <div><dt>Prosjek / medijan razina</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.xpRazine.prosjekRazina?.toFixed(1) ?? '—'} / {gamifikacijaAgregat.trenutacniPresjek.xpRazine.medijanRazina?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>Iznad razine 1</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.xpRazine.napredovaliIznadPrve}</dd></div>
    </dl>
    {#if gamifikacijaAgregat.trenutacniPresjek.xpRazine.poRasponu.length > 0}
      <table>
        <thead><tr><th>Raspon razine</th><th>Igrači</th></tr></thead>
        <tbody>
          {#each gamifikacijaAgregat.trenutacniPresjek.xpRazine.poRasponu as red (red.raspon)}
            <tr><td>{red.raspon}</td><td>{red.broj}</td></tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Dostignuća i zvjezdice (trenutačno)</h3>
    <dl class="kartice">
      <div><dt>S barem jednim</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.dostignuca.igraciSBaremJednim}</dd></div>
      <div><dt>Prosjek otključanih</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.dostignuca.prosjekOtkljucanih?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>Prosjek / medijan ★</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.dostignuca.prosjekZvjezdica?.toFixed(1) ?? '—'} / {gamifikacijaAgregat.trenutacniPresjek.dostignuca.medijanZvjezdica?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>S max pojedinim</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.dostignuca.igraciSMaksimalnoDovrsenimPojedinim}</dd></div>
    </dl>
    {#if gamifikacijaAgregat.trenutacniPresjek.dostignuca.poDostignucu.length > 0}
      <table>
        <thead>
          <tr>
            <th>Dostignuće</th>
            <th>Otključano</th>
            <th>Udio</th>
            <th>Na max</th>
            <th>Prosjek ★</th>
          </tr>
        </thead>
        <tbody>
          {#each gamifikacijaAgregat.trenutacniPresjek.dostignuca.poDostignucu as red (red.id)}
            <tr>
              <td>{red.naziv}</td>
              <td>{red.otkljucani}</td>
              <td>{postotak(red.udioOtkljucanih)}</td>
              <td>{red.naMaksimalnojRazini}/{red.maksimalnaRazina}</td>
              <td>{red.prosjekZvjezdicaOtkljucanih?.toFixed(2) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <h3>Kolekcije riječi (trenutačno)</h3>
    <dl class="kartice">
      <div><dt>S barem jednom riječi</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.kolekcija.igraciSBaremJednomRijeci}</dd></div>
      <div><dt>Distinct riječi</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.kolekcija.distinctRijeciGlobalno}</dd></div>
      <div><dt>Prosjek / medijan veličine</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.kolekcija.prosjekVelicine?.toFixed(1) ?? '—'} / {gamifikacijaAgregat.trenutacniPresjek.kolekcija.medijanVelicine?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>Duge / rijetke (redovi)</dt><dd>{gamifikacijaAgregat.trenutacniPresjek.kolekcija.brojDugihOtkljucavanja} / {gamifikacijaAgregat.trenutacniPresjek.kolekcija.brojRijetkihOtkljucavanja}</dd></div>
    </dl>
  </section>
{/if}

{#if igraciAgregat}
  <section aria-labelledby="igraci-naslov">
    <h2 id="igraci-naslov">Igrači i rast</h2>
    <p class="meta">
      Zona: {igraciAgregat.vremenskaZona} · {igraciAgregat.od} – {igraciAgregat.do}
      · referentni dan {igraciAgregat.referentniDan}
      · mjerenje od {igraciAgregat.mjerenjeOd ?? '—'}
      {#if igraciAgregat.kontekst}
        · kontekst: {igraciAgregat.kontekst} (aktivnost filtrirana; registracije uvijek globalne)
      {/if}
    </p>
    {#if igraciAgregat.referentniDanNezavrsen}
      <p class="meta" role="status">Referentni dan još nije završen — DAU/WAU/MAU su djelomični.</p>
    {/if}
    <p class="meta">{igraciAgregat.napomena}</p>
    <dl class="kartice">
      <div><dt>DAU</dt><dd>{igraciAgregat.kpi.dau}</dd></div>
      <div><dt>WAU</dt><dd>{igraciAgregat.kpi.wau}</dd></div>
      <div><dt>MAU</dt><dd>{igraciAgregat.kpi.mau}</dd></div>
      <div><dt>DAU/MAU</dt><dd>{postotak(igraciAgregat.kpi.dauMau)}</dd></div>
      <div><dt>Registracije (raspon)</dt><dd>{igraciAgregat.kpi.registracijeRaspon}</dd></div>
      <div>
        <dt>Konverzija 30d</dt>
        <dd>
          {#if igraciAgregat.kpi.konverzija30d.postotak === null && igraciAgregat.kpi.konverzija30d.gosti === 0}
            Još nema dovoljno podataka
          {:else}
            {igraciAgregat.kpi.konverzija30d.konvertirani} / {igraciAgregat.kpi.konverzija30d.gosti}
            ({postotak(igraciAgregat.kpi.konverzija30d.postotak)})
          {/if}
        </dd>
      </div>
      <div>
        <dt>D1 retencija</dt>
        <dd>{retencijaTekst(igraciAgregat.retencijaUkupno.d1.postotak, igraciAgregat.retencijaUkupno.d1.povratnici, igraciAgregat.retencijaUkupno.d1.kohorta)}</dd>
      </div>
      <div>
        <dt>D7 retencija</dt>
        <dd>{retencijaTekst(igraciAgregat.retencijaUkupno.d7.postotak, igraciAgregat.retencijaUkupno.d7.povratnici, igraciAgregat.retencijaUkupno.d7.kohorta)}</dd>
      </div>
      <div>
        <dt>D30 retencija</dt>
        <dd>{retencijaTekst(igraciAgregat.retencijaUkupno.d30.postotak, igraciAgregat.retencijaUkupno.d30.povratnici, igraciAgregat.retencijaUkupno.d30.kohorta)}</dd>
      </div>
    </dl>
    {#if igraciAgregat.kpi.konverzijaDosadNezrele.gosti > 0}
      <p class="meta">
        Konverzija dosad (nezrele kohorte):
        {igraciAgregat.kpi.konverzijaDosadNezrele.konvertirani} / {igraciAgregat.kpi.konverzijaDosadNezrele.gosti}
        ({postotak(igraciAgregat.kpi.konverzijaDosadNezrele.postotak)})
      </p>
    {/if}
    <table>
      <thead>
        <tr><th>Dan</th><th>DAU</th><th>Novi</th><th>Povratni</th><th>Registracije</th></tr>
      </thead>
      <tbody>
        {#each igraciAgregat.dani as red (red.dan)}
          <tr>
            <td>{red.dan}</td>
            <td>{red.dau}</td>
            <td>{red.novi}</td>
            <td>{red.povratni}</td>
            <td>{red.registracije}</td>
          </tr>
        {/each}
      </tbody>
    </table>
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
