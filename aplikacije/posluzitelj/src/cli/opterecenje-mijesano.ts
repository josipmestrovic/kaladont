import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import {
  MAKS_TRAJANJE_STAGING_TESTA_MS,
  RASPODJELA_LOKALNOG_SMOKE,
  provjeriPrethodnuRazinuStagingTesta,
  rasporediMijesaniTest,
  validirajAdresuLokalnogTesta,
  validirajAdresuLokalnogWeba,
  validirajTrajanjeLokalnogSmokea,
  validirajUlazMijesanogTesta,
  zakljucajStagingTest,
  zabiljeziRezultatStagingTesta,
  odobriRazinuPokusa,
  OtkazanoPokretanje,
  sljedecaRazina,
  validirajPreskakanjePrethodneRazine,
  validirajTransportOpterecenja,
} from './opterecenje-postavke.js';
import { ucitajSnimkuRjecnika } from './opterecenje-rjecnik.js';
import { SimulatorMijesanihBotova, izradiGrupeBotova } from './opterecenje-mijesani-botovi.js';
import { ocijeniMijesanoMjerenje, ocijeniRacunalneProtivnike, percentilMjerenja, procitajHttpSazetak } from './opterecenje-ocjena.js';
import {
  PORUKA_BEZ_METRIKA_BOTOVA, azurirajStagingLease, dohvatiHealth, imaMetrikeBotova, odgodi,
  pokreniObnavljanjeLeasea, type HealthSnapshot,
} from './opterecenje-staging.js';
import {
  finalizirajIzvjestaj, formatirajNapredak, formatirajSazetak, korijenIzvjestaja,
  ocistiTerminalTekst, prikaziTrajanje, spremiIzvjestaj, type IzvjestajPokusa,
} from './opterecenje-izvjestaj.js';

const MAKS_STOPA_GRESAKA = 0.005;

interface PostavkeMijesanogTesta {
  adresa: string;
  webAdresa: string;
  brojKorisnika: number;
  trajanjeMs: number;
  potvrdaDesetTisuca: string | undefined;
  putanjaRjecnika: string;
  lokalniSmoke: boolean;
  lokalniK6: boolean;
  prethodnaRazinaPreskocena: boolean;
  transport: 'polling-websocket' | 'websocket';
}

interface UzorakHealtha {
  vrijemeMs: number;
  health: HealthSnapshot;
  botovi: ReturnType<SimulatorMijesanihBotova['uzorak']>;
}

const argumenti = new Map(
  process.argv.slice(2).map((argument) => {
    const [naziv, ...ostatak] = argument.replace(/^--/, '').split('=');
    return [naziv, ostatak.join('=')] as const;
  }),
);

function ucitajPostavke(): PostavkeMijesanogTesta {
  const adresa = argumenti.get('adresa');
  const webAdresa = argumenti.get('web-adresa');
  const trajanjeSirovo = argumenti.get('trajanje-ms');
  const putanjaRjecnika = argumenti.get('rjecnik-snimka');
  const lokalniSmoke = argumenti.get('lokalno') === 'DA';
  const lokalniK6 = argumenti.get('http-generator') === 'k6';
  const prethodnaRazinaPreskocena = validirajPreskakanjePrethodneRazine(argumenti.get('preskoci-prethodnu-razinu'), lokalniSmoke);
  const transport = validirajTransportOpterecenja(argumenti.get('transport'));
  if (argumenti.has('http-generator') && (!lokalniSmoke || !lokalniK6)) {
    throw new Error('--http-generator=k6 dopušten je samo kao izričit lokalni pokus.');
  }
  if (!adresa || trajanjeSirovo === undefined || !putanjaRjecnika) {
    throw new Error('Test zahtijeva --adresa, --trajanje-ms i --rjecnik-snimka.');
  }

  const trajanjeMs = Number(trajanjeSirovo);
  if (!path.isAbsolute(putanjaRjecnika)) {
    throw new Error('--rjecnik-snimka mora biti apsolutna putanja do lokalne datoteke izvan repozitorija.');
  }

  if (lokalniSmoke) {
    if (argumenti.has('klijenti')) throw new Error('Lokalni smoke koristi fiksnih 14 virtualnih korisnika.');
    if (!webAdresa) throw new Error('Lokalni smoke zahtijeva --web-adresa razvojne stranice na portu 5173.');
    const lokalnaAdresa = validirajAdresuLokalnogTesta(adresa);
    const lokalnaWebAdresa = validirajAdresuLokalnogWeba(webAdresa);
    validirajTrajanjeLokalnogSmokea(trajanjeMs);
    return {
      adresa: lokalnaAdresa.origin,
      webAdresa: lokalnaWebAdresa.origin,
      brojKorisnika: RASPODJELA_LOKALNOG_SMOKE.ukupnoKorisnika,
      trajanjeMs,
      potvrdaDesetTisuca: undefined,
      putanjaRjecnika,
      lokalniSmoke: true,
      lokalniK6,
      prethodnaRazinaPreskocena,
      transport,
    };
  }

  if (argumenti.has('lokalno')) throw new Error('Za lokalni smoke koristi --lokalno=DA.');
  const brojSirovi = argumenti.get('klijenti');
  if (brojSirovi === undefined) throw new Error('Miješani staging test zahtijeva --klijenti.');
  const brojKorisnika = Number(brojSirovi);
  const stagingAdresa = validirajUlazMijesanogTesta({
    adresa,
    brojKorisnika,
    trajanjeMs,
    velicinaVala: 10,
    razmakValaMs: 1_000,
    potvrdaDesetTisuca: argumenti.get('potvrdi-10000'),
  });

  return {
    adresa: stagingAdresa.origin,
    webAdresa: stagingAdresa.origin,
    brojKorisnika,
    trajanjeMs,
    potvrdaDesetTisuca: argumenti.get('potvrdi-10000'),
    putanjaRjecnika,
    lokalniSmoke: false,
    lokalniK6: false,
    prethodnaRazinaPreskocena,
    transport,
  };
}

async function validirajPutanjuSnimke(putanja: string): Promise<string> {
  const stvarnaPutanja = await realpath(putanja);
  if (!(await stat(stvarnaPutanja)).isFile()) throw new Error('Rječnička snimka mora biti datoteka.');
  const korijenRepozitorija = fileURLToPath(new URL('../../../../', import.meta.url));
  const relativnaPutanja = path.relative(korijenRepozitorija, stvarnaPutanja);
  if (relativnaPutanja === '' || (!relativnaPutanja.startsWith('..') && !path.isAbsolute(relativnaPutanja))) {
    throw new Error('Rječnička snimka mora biti izvan repozitorija.');
  }
  return stvarnaPutanja;
}

function provjeriK6(): void {
  const rezultat = spawnSync('k6', ['version'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
  if (rezultat.error || rezultat.status !== 0) {
    throw new Error('Nije pronađen k6. Instaliraj k6 prije pokretanja miješanog staging testa.');
  }
}

function pokreniK6(
  adresa: string,
  brojPosjetitelja: number,
  rampaMs: number,
  drzanjeMs: number,
  runId: string,
  summaryPutanja: string,
  lokalniSmoke: boolean,
  zabiljezi: (tekst: string) => void,
): ChildProcess {
  const putanjaSkripta = fileURLToPath(new URL('../../../../skripte/testiranje/opterecenje-http.js', import.meta.url));
  const proces = spawn('k6', ['run', '--summary-export', summaryPutanja, putanjaSkripta], {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      CILJNA_ADRESA: adresa,
      BROJ_POSJETITELJA: String(brojPosjetitelja),
      RAMPA_MS: String(rampaMs),
      DRZANJE_MS: String(drzanjeMs),
      RUN_ID: runId,
      LOKALNI_SMOKE: lokalniSmoke ? 'DA' : 'NE',
    },
  });
  proces.stderr?.on('data', (komad: Buffer) => {
    const poruka = komad.toString('utf8').trim();
    if (poruka) zabiljezi(`[k6] ${poruka}`);
  });
  return proces;
}

function cekajK6(proces: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    proces.once('error', reject);
    proces.once('exit', (kod, signal) => {
      if (kod !== null) resolve(kod);
      else reject(new Error(`k6 je prekinut signalom ${signal ?? 'nepoznato'}.`));
    });
  });
}

function percentil(vrijednosti: readonly number[], udio: number): number {
  if (vrijednosti.length === 0) return 0;
  const sortirano = [...vrijednosti].sort((a, b) => a - b);
  return sortirano[Math.min(sortirano.length - 1, Math.ceil(sortirano.length * udio) - 1)]!;
}

async function cekajDo(vrijemeMs: number, signal: AbortSignal): Promise<void> {
  while (Date.now() < vrijemeMs && !signal.aborted) {
    await odgodi(Math.min(250, vrijemeMs - Date.now()), signal);
  }
  if (signal.aborted) throw new Error('Test je prekinut.');
}

async function pokreniHttpLokalno(adresa: string, trajanjeMs: number, signal: AbortSignal) {
  const stranice = [
    { putanja: '/', udio: 60 },
    { putanja: '/ljestvice', udio: 20 },
    { putanja: '/novosti', udio: 10 },
    { putanja: '/pravila-kaladonta?tema=pravila', udio: 10 },
  ];
  const latencijiPoStranici = new Map(stranice.map((stranica) => [stranica.putanja, [] as number[]]));
  const pogreskePoStranici = new Map(stranice.map((stranica) => [stranica.putanja, [] as string[]]));
  const statusiPoStranici = new Map(stranice.map((stranica) => [stranica.putanja, {} as Record<string, number>]));
  const krajMs = Date.now() + trajanjeMs;
  let brojZahtjeva = 0;
  let brojGresaka = 0;

  const pokreniPosjetitelja = async () => {
    while (Date.now() < krajMs && !signal.aborted) {
      const slucajniBroj = Math.random() * 100;
      let kumulativno = 0;
      const stranica = stranice.find((kandidat) => {
        kumulativno += kandidat.udio;
        return slucajniBroj < kumulativno;
      }) ?? stranice[0]!;
      const pocetak = performance.now();
      brojZahtjeva += 1;
      try {
        const odgovor = await fetch(`${adresa}${stranica.putanja}`, {
          headers: { Accept: 'text/html' },
          redirect: 'manual',
          signal: AbortSignal.any([signal, AbortSignal.timeout(3_000)]),
        });
        const statusi = statusiPoStranici.get(stranica.putanja)!;
        statusi[String(odgovor.status)] = (statusi[String(odgovor.status)] ?? 0) + 1;
        await odgovor.arrayBuffer();
        if (odgovor.status !== 200) {
          brojGresaka += 1;
          pogreskePoStranici.get(stranica.putanja)!.push(`HTTP ${odgovor.status}`);
        }
        latencijiPoStranici.get(stranica.putanja)!.push(performance.now() - pocetak);
      } catch {
        if (signal.aborted) break;
        brojGresaka += 1;
        pogreskePoStranici.get(stranica.putanja)!.push('Mrežna pogreška ili timeout');
      }
      await odgodi(3_000 + Math.floor(Math.random() * 4_000), signal).catch(() => undefined);
    }
  };

  await Promise.all(Array.from({ length: RASPODJELA_LOKALNOG_SMOKE.brojPosjetitelja }, pokreniPosjetitelja));
  const latencije = [...latencijiPoStranici.values()].flat();
  return {
    brojZahtjeva,
    stopaGresaka: brojGresaka / Math.max(1, brojZahtjeva),
    p95Ms: percentil(latencije, 0.95),
    najviseVus: RASPODJELA_LOKALNOG_SMOKE.brojPosjetitelja,
    najmanjeVusDrzanja: RASPODJELA_LOKALNOG_SMOKE.brojPosjetitelja,
    brojZahtjevaDrzanja: brojZahtjeva,
    udioValjanihOdgovora: brojZahtjeva > 0 ? (brojZahtjeva - brojGresaka) / brojZahtjeva : 0,
    statusiPoStranici: Object.fromEntries(statusiPoStranici),
    pogreskePoStranici: Object.fromEntries(
      [...pogreskePoStranici].map(([putanja, pogreske]) => [putanja, pogreske.slice(0, 10)]),
    ),
  };
}

async function glavno(): Promise<void> {
  const postavke = ucitajPostavke();
  if (!postavke.lokalniSmoke && !process.stdin.isTTY) throw new OtkazanoPokretanje('Staging zahtijeva interaktivni terminal; priprema nije kontaktirala staging.');
  console.log('Priprema miješanog pokusa; opterećenje još nije pokrenuto.');
  const raspodjela = postavke.lokalniSmoke
    ? RASPODJELA_LOKALNOG_SMOKE
    : rasporediMijesaniTest(postavke.brojKorisnika);
  const trajanjeRampeBotovaMs = Math.ceil(raspodjela.brojIgraca / 7 * 1_000);
  const trajanjeRampeHttpMs = Math.ceil(raspodjela.brojPosjetitelja / 3 * 1_000);
  // Četveroboj započet pred kraj držanja treba 3 eliminacije × (potez + 10 s izbora riječi sustava) ≈ 40 s.
  const timeoutCiscenjaMs = postavke.lokalniSmoke ? 60_000 : 180_000;
  const ukupnoPlaniranoMs = trajanjeRampeBotovaMs + trajanjeRampeHttpMs + postavke.trajanjeMs + timeoutCiscenjaMs + 10_000;
  if (!postavke.lokalniSmoke && ukupnoPlaniranoMs > MAKS_TRAJANJE_STAGING_TESTA_MS) {
    throw new Error('Rampa, držanje i čišćenje premašuju ukupni staging limit od dvije ure.');
  }
  if (!postavke.lokalniSmoke || postavke.lokalniK6) provjeriK6();
  const putanjaRjecnika = await validirajPutanjuSnimke(postavke.putanjaRjecnika);
  const rjecnik = await ucitajSnimkuRjecnika(putanjaRjecnika);
  const baseline = await dohvatiHealth(postavke.adresa);
  if (!imaMetrikeBotova(baseline)) {
    throw new Error(PORUKA_BEZ_METRIKA_BOTOVA);
  }
  const profilId = `${postavke.lokalniSmoke ? 'lokalni-smoke-v5' : 'mijesani-k6-socket-v5'}:${rjecnik.sha256}:${postavke.trajanjeMs}${postavke.transport === 'websocket' ? ':websocket' : ''}`;
  const runId = randomUUID();
  const direktorijIzvjestaja = path.join(korijenIzvjestaja(), runId);
  const summaryPutanja = path.join(direktorijIzvjestaja, 'k6-sazetak.json');
  const reportPutanja = path.join(direktorijIzvjestaja, 'rezultat.json');
  const prethodnaPotvrda = postavke.lokalniSmoke ? undefined : await provjeriPrethodnuRazinuStagingTesta(
      postavke.adresa,
      postavke.brojKorisnika,
      undefined,
      Date.now(),
      profilId,
      baseline.digest,
      postavke.prethodnaRazinaPreskocena,
    );
  console.log([
    `Okolina: ${postavke.lokalniSmoke ? 'LOKALNI SMOKE, samo provjera generatora' : 'STAGING'}`,
    `Cilj: ${postavke.adresa}; razina: ${postavke.brojKorisnika}; pokus: ${runId}`,
    `Izdanje: ${baseline.verzija}; digest: ${baseline.digest}`,
    `Profil: ${profilId}`,
    `Transport: ${postavke.transport}`,
    `Raspodjela: ${raspodjela.brojIgracaDvoboja} dvoboj, ${raspodjela.brojIgracaJavnogCetveroboja} javni četveroboj, ${raspodjela.brojIgracaPrivatnogCetveroboja} privatni četveroboj, ${raspodjela.brojTreninga} trening protiv Računala, ${raspodjela.brojPosjetitelja} HTTP`,
    `Botovi na poslužitelju: fond slobodnih ${baseline.fondSlobodni}, u partiji ${baseline.botoviUPartiji}, popuna dvoboj ${baseline.botoviDvoboj === true ? 'uključena' : 'isključena'}, četveroboj ${baseline.botoviCetveroboj === true ? 'uključena' : 'isključena'}`,
    `Rampa igrača ${prikaziTrajanje(trajanjeRampeBotovaMs)}, HTTP ${prikaziTrajanje(trajanjeRampeHttpMs)}; držanje ${prikaziTrajanje(postavke.trajanjeMs)}`,
    `Prethodni prolaz: ${postavke.prethodnaRazinaPreskocena ? 'RUČNO PRESKOČEN; niže razine nisu potvrđene' : prethodnaPotvrda ? `${prethodnaPotvrda.brojKorisnika}, runId ${prethodnaPotvrda.runId}, ${new Date(prethodnaPotvrda.zavrsenoU).toISOString()}` : 'nije potreban za početnu razinu / lokalni smoke'}`,
    `Izvještaji: ${direktorijIzvjestaja}`,
  ].map(ocistiTerminalTekst).join('\n'));
  if (!postavke.lokalniSmoke) {
    await odobriRazinuPokusa(postavke.brojKorisnika, async () => {
      const trenutniHealth = await dohvatiHealth(postavke.adresa);
      if (trenutniHealth.digest !== baseline.digest) throw new Error('Izdanje je promijenjeno tijekom čekanja potvrde. Ponovno pokreni pripremu.');
      const trenutnaPotvrda = await provjeriPrethodnuRazinuStagingTesta(postavke.adresa, postavke.brojKorisnika, undefined, Date.now(), profilId, baseline.digest, postavke.prethodnaRazinaPreskocena);
      if (trenutnaPotvrda?.runId !== prethodnaPotvrda?.runId) throw new Error('Prethodni prolaz promijenio se tijekom čekanja. Ponovno pregledaj rezultat.');
    });
  }
  await mkdir(direktorijIzvjestaja, { recursive: true, mode: 0o700 });
  await writeFile(path.join(direktorijIzvjestaja, 'dnevnik.txt'), 'Priprema je završena.\n', { flag: 'wx', mode: 0o600 });
  const oslobodiLokalnuBravu = postavke.lokalniSmoke
    ? async () => undefined
    : await zakljucajStagingTest(postavke.adresa);
  const kontroler = new AbortController();
  const rucniKontroler = new AbortController();
  const loopLag = monitorEventLoopDelay({ resolution: 20 });
  const cpuPrije = process.cpuUsage();
  const pocetak = Date.now();
  const uzorci: UzorakHealtha[] = [];
  let procesK6: ChildProcess | undefined;
  let procesK6Ishod: Promise<number> | undefined;
  let lokalniHttpIshod: ReturnType<typeof pokreniHttpLokalno> | undefined;
  let izvjestaj: IzvjestajPokusa = {
    verzijaFormata: 1, runId, vrijeme: new Date().toISOString(), cilj: postavke.adresa,
    razina: postavke.brojKorisnika, lokalniSmoke: postavke.lokalniSmoke, profilId,
    pokrenuto: false,
    digest: baseline.digest, ishod: 'FAIL', razlog: null, provjere: {},
    prethodniRunId: prethodnaPotvrda?.runId ?? null, raspodjela, direktorijIzvjestaja,
    prethodnaRazinaPreskocena: postavke.prethodnaRazinaPreskocena,
    transport: postavke.transport,
    sljedecaRazina: postavke.lokalniSmoke ? null : sljedecaRazina(postavke.brojKorisnika),
    odobrenoU: postavke.lokalniSmoke ? null : new Date().toISOString(),
    upozorenja: [
      'CPU vrijeme i RSS odnose se samo na Node generator, ne k6 ili cijeli VPS. PostgreSQL, Caddy i VPS CPU/I/O pratiti zasebno.',
      ...(postavke.prethodnaRazinaPreskocena ? ['Operater je ručno preskočio prethodnu razinu; niže razine nisu potvrđene. Raniji rezultati nisu promijenjeni.'] : []),
      ...(postavke.transport === 'websocket' ? ['Dijagnostički profil koristi izravni WebSocket; ne provjerava polling ni nadogradnju transporta i ne otključava standardni profil.'] : []),
    ],
  };
  const dnevnik: string[] = [];
  const zabiljezi = (tekst: string) => {
    const cistiTekst = ocistiTerminalTekst(tekst).slice(0, 2_048);
    if (dnevnik.length < 4_000) dnevnik.push(`${new Date().toISOString()} ${cistiTekst}`);
    console.log(cistiTekst);
  };
  zabiljezi(postavke.lokalniSmoke ? 'Lokalni smoke; nije staging odobrenje.' : `Operater je unio POKRENI ${postavke.brojKorisnika}; runId ${runId}.`);
  let rucniPrekid = false;
  let stagingLeaseDrzan = false;
  let zaustaviObnavljanjeLeasea: (() => void) | undefined;
  let razlogPrekida: string | null = null;
  let nadzorUTijeku = false;
  let nadzorZaustavljen = false;
  let nadzorObecanje: Promise<void> | undefined;
  let zadnjiHealthU = Date.now();
  let zadnjiHealth = baseline;
  let faza = 'Priprema';
  let krajFaze: number | null = null;
  // Tempo mora ostati ispod poslužiteljskog limita od 30 događaja/min po igraču (SOCKET_DOGADAJI_PO_PROZORU),
  // inače se potez:rijec tiho odbacuje i VU čeka istek od 30 s; trening je najbrži jer Računalo odgovara za ~300 ms.
  const simulator = new SimulatorMijesanihBotova({
    adresa: postavke.adresa,
    timeoutMs: 15_000,
    cekanjePotezaMinMs: postavke.lokalniSmoke ? 1_000 : 3_000,
    cekanjePotezaMaksMs: postavke.lokalniSmoke ? 3_000 : 10_000,
    maksPotezaPoPartiji: postavke.lokalniSmoke ? 4 : 24,
    transport: postavke.transport,
  }, rjecnik, (razlog) => {
    razlogPrekida = razlog;
    kontroler.abort();
  });
  const prekini = () => {
    razlogPrekida = 'Prekid na zahtjev operatera.';
    rucniPrekid = true;
    rucniKontroler.abort();
    kontroler.abort();
    if (procesK6 && procesK6.exitCode === null) procesK6.kill('SIGTERM');
  };
  const sigurnosniTimer = setTimeout(() => {
    razlogPrekida = 'Prekoračeno je maksimalno ukupno trajanje testa.';
    kontroler.abort();
    if (procesK6 && procesK6.exitCode === null) procesK6.kill('SIGTERM');
  }, postavke.lokalniSmoke ? 180_000 : MAKS_TRAJANJE_STAGING_TESTA_MS);
  const nadzorTimer = setInterval(() => {
    if (nadzorUTijeku || kontroler.signal.aborted || nadzorZaustavljen) return;
    nadzorUTijeku = true;
    nadzorObecanje = dohvatiHealth(postavke.adresa, kontroler.signal).then((health) => {
      if (nadzorZaustavljen) return;
      if (health.digest !== baseline.digest) throw new Error('Izdanje aplikacije promijenilo se tijekom testa.');
      zadnjiHealthU = Date.now();
      zadnjiHealth = health;
      simulator.uzorak();
    }).catch((greska: unknown) => {
      if (nadzorZaustavljen || kontroler.signal.aborted) return;
      razlogPrekida = greska instanceof Error ? greska.message : String(greska);
      kontroler.abort();
      if (procesK6 && procesK6.exitCode === null) procesK6.kill('SIGTERM');
    }).finally(() => { nadzorUTijeku = false; });
  }, 5_000);
  const prikaziNapredak = () => {
    const tekst = formatirajNapredak({
      faza, protekloMs: Date.now() - pocetak,
      preostaloMs: krajFaze === null ? null : Math.max(0, krajFaze - Date.now()),
      botovi: simulator.uzorak(), zavrsenePoVrsti: simulator.sazetak().zavrsenePoVrsti,
      ciljaniIgraci: raspodjela.brojIgraca, planiraniHttp: raspodjela.brojPosjetitelja,
      healthStarostMs: Date.now() - zadnjiHealthU,
      ciljaniTreninzi: raspodjela.brojTreninga,
      racunalo: { botoviUPartiji: zadnjiHealth.botoviUPartiji, botIsteci: zadnjiHealth.botIsteci, eventLoopP95Ms: zadnjiHealth.eventLoopP95Ms },
    });
    for (const redak of tekst.split('\n')) zabiljezi(redak);
  };
  const promijeniFazu = (naziv: string, krajMs: number | null = null) => {
    faza = naziv;
    krajFaze = krajMs;
    prikaziNapredak();
  };
  const napredakTimer = setInterval(prikaziNapredak, 10_000);

  loopLag.enable();
  process.on('SIGINT', prekini);
  process.on('SIGTERM', prekini);
  try {
    if (!postavke.lokalniSmoke) {
      await azurirajStagingLease(postavke.adresa, runId, 'acquire');
      stagingLeaseDrzan = true;
      zaustaviObnavljanjeLeasea = pokreniObnavljanjeLeasea(
        postavke.adresa,
        runId,
        kontroler.signal,
        (razlog) => {
          razlogPrekida = `Staging lease je izgubljen: ${razlog}`;
          kontroler.abort();
          if (procesK6 && procesK6.exitCode === null) procesK6.kill('SIGTERM');
        },
      );
    }
    promijeniFazu('Rampa igrača', pocetak + trajanjeRampeBotovaMs);
    const grupe = izradiGrupeBotova(raspodjela);
    let rasporedenoIgraca = 0;
    const posloviGrupa: Promise<void>[] = [];
    const omjerIgracaUSekundi = raspodjela.brojIgraca / trajanjeRampeBotovaMs;
    for (const grupa of grupe) {
      const ciljanoVrijeme = pocetak + Math.ceil((rasporedenoIgraca + grupa.botovi.length) / omjerIgracaUSekundi);
      await cekajDo(ciljanoVrijeme, kontroler.signal);
      izvjestaj.pokrenuto = true;
      posloviGrupa.push(simulator.pokreniGrupu(grupa, kontroler.signal).catch((greska: unknown) => {
        const poruka = greska instanceof Error ? greska.message : String(greska);
        razlogPrekida = poruka;
        kontroler.abort();
      }));
      rasporedenoIgraca += grupa.botovi.length;
    }
    await Promise.all(posloviGrupa);
    if (kontroler.signal.aborted) throw new Error(razlogPrekida ?? 'Test je prekinut tijekom rampe.');

    if (postavke.lokalniSmoke && !postavke.lokalniK6) {
      lokalniHttpIshod = pokreniHttpLokalno(postavke.webAdresa, postavke.trajanjeMs, kontroler.signal);
    } else {
      promijeniFazu('Rampa HTTP korisnika', Date.now() + trajanjeRampeHttpMs);
      procesK6 = pokreniK6(
        postavke.webAdresa,
        raspodjela.brojPosjetitelja,
        trajanjeRampeHttpMs,
        postavke.trajanjeMs,
        runId,
        summaryPutanja,
        postavke.lokalniSmoke,
        zabiljezi,
      );
      procesK6Ishod = cekajK6(procesK6).catch((greska: unknown) => {
        razlogPrekida = greska instanceof Error ? greska.message : String(greska);
        kontroler.abort();
        return -1;
      });
      const ocekivaniK6Kraj = Date.now() + trajanjeRampeHttpMs + postavke.trajanjeMs + 5_000;
      procesK6.once('exit', (kod) => {
        if ((kod !== 0 || Date.now() < ocekivaniK6Kraj - 2_000) && !kontroler.signal.aborted) {
          razlogPrekida = `k6 je završio prije planiranog kraja ili s kodom ${kod ?? 'nepoznato'}.`;
          kontroler.abort();
        }
      });
    }

    const pocetakMijesanogDrzanja = Date.now() + (postavke.lokalniSmoke && !postavke.lokalniK6 ? 0 : trajanjeRampeHttpMs);
    const kraj = pocetakMijesanogDrzanja + postavke.trajanjeMs;
    if (postavke.lokalniSmoke && !postavke.lokalniK6) promijeniFazu('Mjerenje', kraj);
    let sljedeciHealthUzorak = Date.now();
    while (Date.now() < kraj && !kontroler.signal.aborted) {
      await odgodi(1_000, kontroler.signal);
      const botovi = simulator.uzorak();
      if (Date.now() >= pocetakMijesanogDrzanja && faza !== 'Mjerenje') promijeniFazu('Mjerenje', kraj);
      if (Date.now() < sljedeciHealthUzorak) {
        uzorci.push({ vrijemeMs: Date.now() - pocetak, health: zadnjiHealth, botovi });
        continue;
      }
      sljedeciHealthUzorak = Date.now() + 5_000;
      const health = await dohvatiHealth(postavke.adresa, kontroler.signal);
      if (health.digest !== baseline.digest) {
        razlogPrekida = 'Digest staging poslužitelja promijenio se tijekom testa.';
        kontroler.abort();
        break;
      }
      zadnjiHealth = health;
      zadnjiHealthU = Date.now();
      uzorci.push({ vrijemeMs: Date.now() - pocetak, health, botovi });
    }

    if (kontroler.signal.aborted) throw new Error(razlogPrekida ?? 'Test je prekinut.');
    const stvarnoDrzanjeMs = Math.max(0, Math.min(Date.now(), kraj) - pocetakMijesanogDrzanja);
    const httpMetrike = postavke.lokalniSmoke && !postavke.lokalniK6
      ? await lokalniHttpIshod!
      : await (async () => {
        const k6Kod = await procesK6Ishod;
        if (k6Kod !== 0) throw new Error(`k6 je završio s izlaznim kodom ${k6Kod}.`);
        const k6Sazetak = JSON.parse(await readFile(summaryPutanja, 'utf8')) as Record<string, unknown>;
        return procitajHttpSazetak(k6Sazetak);
      })();
    const pocetakCiscenjaMs = Date.now();
    promijeniFazu('Dovršavanje partija', pocetakCiscenjaMs + timeoutCiscenjaMs);
    await simulator.dovrsiPartije(timeoutCiscenjaMs, kontroler.signal);
    const ciscenjeMs = Date.now() - pocetakCiscenjaMs;
    const zavrsniHealth = await dohvatiHealth(postavke.adresa, kontroler.signal);
    uzorci.push({ vrijemeMs: Date.now() - pocetak, health: zavrsniHealth, botovi: simulator.uzorak() });
    const botSazetak = simulator.sazetak();
    const latencijePoVrsti = Object.fromEntries(Object.entries(botSazetak.latencijePoVrsti).map(([vrsta, mjerenja]) => [vrsta, {
      brojPoteza: mjerenja.brojPoteza,
      brojSpremanja: mjerenja.brojSpremanja,
      p95PotezMs: percentilMjerenja(mjerenja.poteziMs, 0.95),
      p95SpremanjeMs: percentilMjerenja(mjerenja.spremanjaMs, 0.95),
    }]));
    const uzorciMijesanogDrzanja = uzorci.filter((uzorak) => uzorak.vrijemeMs >= pocetakMijesanogDrzanja - pocetak);
    const aktivniIgraciP95 = percentil(uzorciMijesanogDrzanja.map((uzorak) => uzorak.botovi.aktivniIgraci), 0.95);
    const aktivneVezeNajmanje = uzorciMijesanogDrzanja.length > 0
      ? Math.min(...uzorciMijesanogDrzanja.map((uzorak) => uzorak.botovi.spojeni))
      : 0;
    const ocjena = ocijeniMijesanoMjerenje({
      poteziMs: botSazetak.poteziMs,
      spremanjaMs: botSazetak.spremanjaMs,
      aktivniIgraci: uzorciMijesanogDrzanja.map((uzorak) => uzorak.botovi.aktivniIgraci),
      igrackiKorisnici: uzorciMijesanogDrzanja.map((uzorak) => uzorak.botovi.spojeni),
      ciljaniIgraci: raspodjela.brojIgraca,
      planiranoDrzanjeMs: postavke.trajanjeMs,
      stvarnoDrzanjeMs,
    });
    const ocjenaRacunala = ocijeniRacunalneProtivnike({
      brojTreninga: raspodjela.brojTreninga,
      zavrsenihTreninga: botSazetak.zavrsenePoVrsti.trening,
      aktivniTreninziUzorci: uzorciMijesanogDrzanja.map((uzorak) => uzorak.botovi.aktivniTreninzi),
      poteziTreningaMs: botSazetak.latencijePoVrsti.trening.poteziMs,
      istekRacunalaGenerator: botSazetak.istekRacunala,
      odbijeniTreninzi: botSazetak.odbijeniTreninzi,
      botIsteciPocetak: baseline.botIsteci,
      botIsteciKraj: zavrsniHealth.botIsteci,
      botTehnickeGreskePocetak: baseline.botTehnickeGreske,
      botTehnickeGreskeKraj: zavrsniHealth.botTehnickeGreske,
      eventLoopP95Uzorci: uzorci
        .filter((uzorak, indeks, svi) => indeks === 0 || uzorak.health !== svi[indeks - 1]!.health)
        .map((uzorak) => uzorak.health.eventLoopP95Ms),
    });
    const provjere = {
      ...ocjena.provjere,
      ...ocjenaRacunala.provjere,
      digestNepromijenjen: uzorci.every((uzorak) => uzorak.health.digest === baseline.digest),
      aktivneVeze: aktivneVezeNajmanje >= Math.ceil(raspodjela.brojIgraca * 0.995),
      imaPoteza: botSazetak.brojPoteza > 0,
      imaZavrsenihPartija: botSazetak.zavrsenePartije > 0,
      sviNaciniZavrsavaju: Object.values(botSazetak.zavrsenePoVrsti).every((broj) => broj > 0),
      latencijeSvihNacina: Object.entries(latencijePoVrsti).every(([vrsta, mjerenja]) =>
        mjerenja.p95PotezMs !== null && mjerenja.p95PotezMs <= 250 &&
        (vrsta === 'trening' || (mjerenja.p95SpremanjeMs !== null && mjerenja.p95SpremanjeMs <= 1_000))),
      partijeDovrsene: simulator.uzorak().aktivnePartije === 0,
      svaSpremanjaPotvrdena: botSazetak.partijeBezSpremanja === 0,
      tehnickeGreske: botSazetak.brojTehnickihGresaka / Math.max(1, botSazetak.brojPoteza + raspodjela.ukupnoKorisnika) < MAKS_STOPA_GRESAKA,
      neocekivaniPrekidi: botSazetak.brojNeocekivanihPrekida === 0,
      httpZahtjevi: httpMetrike.brojZahtjeva > 0,
      httpCiljaniVus: httpMetrike.najmanjeVusDrzanja >= raspodjela.brojPosjetitelja && httpMetrike.brojZahtjevaDrzanja > 0,
      httpStatusi: httpMetrike.udioValjanihOdgovora === 1,
      httpPogreske: httpMetrike.stopaGresaka < MAKS_STOPA_GRESAKA,
      httpP95: httpMetrike.p95Ms < 1_000,
      health: uzorci.length > 0,
    };
    const profilProsao = Object.values(provjere).every(Boolean);
    const cpu = process.cpuUsage(cpuPrije);
    izvjestaj = {
      ...izvjestaj,
      runId,
      cilj: postavke.adresa,
      webCilj: postavke.webAdresa,
      verzija: baseline.verzija,
      digest: baseline.digest,
      profilId,
      rjecnik: { brojRijeci: rjecnik.brojRijeci, sha256: rjecnik.sha256 },
      raspodjela,
      trajanje: {
        rampaBotovaMs: trajanjeRampeBotovaMs,
        rampaHttpMs: trajanjeRampeHttpMs,
        ciljaniMijesaniDrzanjeMs: postavke.trajanjeMs,
        stvarnoMijesaniDrzanjeMs: Math.max(0, stvarnoDrzanjeMs),
        ciscenjeMs,
        ukupnoMs: Date.now() - pocetak,
      },
      botovi: {
        ...botSazetak,
        latencijePoVrsti,
        aktivniIgraciP95,
        najmanjeAktivnihIgraca: ocjena.najmanjeAktivnihIgraca,
        najmanjeIgrackihKorisnika: ocjena.najmanjeIgrackihKorisnika,
        p95PotezMs: ocjena.p95PotezMs,
        p95SpremanjeMs: ocjena.p95SpremanjeMs,
      },
      racunalo: {
        ciljaniTreninzi: raspodjela.brojTreninga,
        zavrseniTreninzi: botSazetak.zavrsenePoVrsti.trening,
        najmanjeAktivnihTreninga: ocjenaRacunala.najmanjeTreninga,
        medijanAktivnihTreninga: ocjenaRacunala.medijanTreninga,
        p95PotezTreningaMs: ocjenaRacunala.p95PotezTreningaMs,
        p50OdgovorRacunalaMs: percentilMjerenja(botSazetak.odgovoriRacunalaMs, 0.5),
        p95OdgovorRacunalaMs: percentilMjerenja(botSazetak.odgovoriRacunalaMs, 0.95),
        brojOdgovoraRacunala: botSazetak.brojOdgovoraRacunala,
        istekRacunalaGenerator: botSazetak.istekRacunala,
        istekBotovaPosluzitelj: ocjenaRacunala.deltaIsteka,
        tehnickeGreskeBotovaPosluzitelj: ocjenaRacunala.deltaGresaka,
        odbijeniTreninzi: botSazetak.odbijeniTreninzi,
        vanjskiSudioniciJavnih: botSazetak.vanjskiSudioniciJavnih,
        eventLoopPosluziteljaP95Ms: ocjenaRacunala.eventLoopP95Ms,
        fondSlobodniPocetak: baseline.fondSlobodni,
        fondSlobodniKraj: zavrsniHealth.fondSlobodni,
      },
      http: httpMetrike,
      generator: {
        rssBajtovi: process.memoryUsage().rss,
        cpuMs: (cpu.user + cpu.system) / 1_000,
        eventLoopP95Ms: loopLag.percentile(95) / 1e6,
      },
      healthUzoraka: uzorci,
      provjere,
      ishod: profilProsao ? 'PASS' : 'FAIL',
    };
  } catch (greska) {
    const poruka = greska instanceof Error ? greska.message : String(greska);
    if (!razlogPrekida) razlogPrekida = poruka;
    kontroler.abort();
    if (procesK6 && procesK6.exitCode === null) procesK6.kill('SIGTERM');
    izvjestaj = {
      ...izvjestaj,
      ishod: rucniPrekid ? 'ABORTED' : 'FAIL',
      razlog: razlogPrekida,
      ukupnoMs: Date.now() - pocetak,
      botovi: simulator.sazetak(),
      healthUzoraka: uzorci,
    };
    zabiljezi(`Pokretanje/mjerenje nije uspjelo: ${poruka}`);
  } finally {
    nadzorZaustavljen = true;
    clearInterval(nadzorTimer);
    promijeniFazu('Čišćenje');
    const greskeCiscenja: string[] = [];
    const pocetakZavrsnogCiscenja = Date.now();
    const ocisti = async (naziv: string, posao: () => Promise<unknown>) => {
      try { await posao(); }
      catch (greska) { greskeCiscenja.push(`${naziv}: ${greska instanceof Error ? greska.message : String(greska)}`); }
    };
    await ocisti('Botovi', () => simulator.zatvori());
    await ocisti('HTTP korisnici', async () => {
      if (lokalniHttpIshod) await lokalniHttpIshod;
      if (procesK6 && procesK6.exitCode === null && procesK6.signalCode === null) procesK6.kill('SIGTERM');
      if (procesK6Ishod) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            procesK6?.kill('SIGKILL');
            reject(new Error('k6 nije završio tijekom čišćenja.'));
          }, 15_000);
          void procesK6Ishod!.then(() => resolve(), reject).finally(() => clearTimeout(timer));
        });
      }
    });
    await ocisti('Health nadzor', async () => { await nadzorObecanje; });
    zaustaviObnavljanjeLeasea?.();
    if (stagingLeaseDrzan) await ocisti('Staging lease', () => azurirajStagingLease(postavke.adresa, runId, 'release'));
    await ocisti('Lokalna brava', oslobodiLokalnuBravu);
    clearTimeout(sigurnosniTimer);
    clearInterval(napredakTimer);
    loopLag.disable();
    if (kontroler.signal.aborted && izvjestaj.ishod === 'PASS') {
      izvjestaj.ishod = rucniPrekid ? 'ABORTED' : 'FAIL';
      izvjestaj.razlog = razlogPrekida;
    }
    const trajanje = (izvjestaj.trajanje ?? {}) as Record<string, unknown>;
    izvjestaj.trajanje = { ...trajanje, zavrsnoCiscenjeMs: Date.now() - pocetakZavrsnogCiscenja, ukupnoMs: Date.now() - pocetak };
    izvjestaj.faza = 'Završeno';
    try {
      izvjestaj = await finalizirajIzvjestaj(izvjestaj, {
        signal: rucniKontroler.signal,
        greskeCiscenja,
        spremi: async (rezultat) => {
          await writeFile(path.join(direktorijIzvjestaja, 'dnevnik.txt'), `${dnevnik.join('\n')}\n`, { mode: 0o600 });
          await spremiIzvjestaj(rezultat, direktorijIzvjestaja);
        },
        potvrdi: async (rezultat) => {
          if (!postavke.lokalniSmoke && rezultat.pokrenuto) await zabiljeziRezultatStagingTesta(
            postavke.adresa, postavke.brojKorisnika, rezultat.ishod, undefined, Date.now(), profilId, baseline.digest,
            { runId, izvjestajPutanja: reportPutanja },
          );
        },
      });
      console.log(formatirajSazetak(izvjestaj));
      process.exitCode = izvjestaj.ishod === 'PASS' ? 0 : izvjestaj.ishod === 'ABORTED' ? 130 : 1;
    } catch (greska) {
      process.exitCode = rucniPrekid ? 130 : 1;
      console.error(ocistiTerminalTekst(`TEST ${rucniPrekid ? 'PREKINUT' : 'NIJE PROŠAO'}: završni zapis nije dovršen. ${greska instanceof Error ? greska.message : String(greska)}; artefakti: ${direktorijIzvjestaja}. Ne nastavljati na veću razinu.`));
    } finally {
      process.off('SIGINT', prekini);
      process.off('SIGTERM', prekini);
    }
  }
}

void glavno().catch((greska: unknown) => {
  console.error(ocistiTerminalTekst(`PRIPREMA ${greska instanceof OtkazanoPokretanje ? 'OTKAZANA' : 'NIJE USPJELA'}: ${greska instanceof Error ? greska.message : String(greska)} Opterećenje nije pokrenuto; prethodne potvrde nisu poništene.`));
  process.exitCode = greska instanceof OtkazanoPokretanje ? 130 : 1;
});
