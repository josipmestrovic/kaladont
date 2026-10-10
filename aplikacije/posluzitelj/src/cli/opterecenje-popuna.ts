/**
 * Predtest popune javnog reda botovima (ADR-017). Svaki virtualni korisnik ulazi SAM u red svojeg moda
 * (sljedeći tek kad prethodni dobije `partija:pocetak`), pa poslužitelj mora rezervirati i dovesti botove
 * točno po pragovima iz docs/02-pravila-igre/botovi.md: dvoboj 30 s (1 bot), četveroboj 20/30/40 s (3 bota).
 * Zaseban je od miješanog stres testa i ne otključava njegove razine.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { io, type Socket } from 'socket.io-client';
import type { Eliminacija, KrajPartije, PocetakPartije, PrihvacenPotez, RundaOtvorena, StanjeReda } from 'zajednicko';
import {
  OtkazanoPokretanje, odobriRazinuPokusa, validirajAdresuLokalnogTesta, validirajAdresuStaginga, zakljucajStagingTest,
} from './opterecenje-postavke.js';
import { ucitajSnimkuRjecnika, type SnimkaRjecnika } from './opterecenje-rjecnik.js';
import {
  OCEKIVANO_CEKANJE_POPUNE_MS, OCEKIVANI_BOTOVI_POPUNE, TOLERANCIJA_POPUNE_MS, ocijeniPopunuReda,
  type MjerenjePopune, type ModPopune,
} from './opterecenje-ocjena.js';
import {
  PORUKA_BEZ_METRIKA_BOTOVA, azurirajStagingLease, dohvatiHealth, imaMetrikeBotova, odgodi,
  pokreniObnavljanjeLeasea, type HealthSnapshot,
} from './opterecenje-staging.js';
import {
  finalizirajIzvjestaj, formatirajSazetak, korijenIzvjestaja, ocistiTerminalTekst, prikaziTrajanje, spremiIzvjestaj,
  type IzvjestajPokusa,
} from './opterecenje-izvjestaj.js';

const MODOVI: readonly ModPopune[] = ['dva_igraca', 'cetiri_igraca'];
const MAKS_VU_PO_MODU = 10;
const POTEZA_VU_PRIJE_PREDAJE = 2;
const MAKS_ROK_KRAJA_MS = 15 * 60_000;

interface PostavkePopune {
  adresa: string;
  putanjaRjecnika: string;
  lokalno: boolean;
  brojPoModu: number;
  rokKrajaMs: number;
}

interface PartijaVu extends MjerenjePopune {
  partijaId: string | null;
  mojIgracId: string | null;
  vanjski: Set<string>;
  iskoristeneGrupe: Set<string>;
  pokusaneRijeci: Set<string>;
  odigranoVu: number;
  turnToken: string | null;
  kraj: Promise<void>;
  zavrsi: () => void;
}

const argumenti = new Map(
  process.argv.slice(2).map((argument) => {
    const [naziv, ...ostatak] = argument.replace(/^--/, '').split('=');
    return [naziv, ostatak.join('=')] as const;
  }),
);

function ucitajPostavke(): PostavkePopune {
  const adresa = argumenti.get('adresa');
  const putanjaRjecnika = argumenti.get('rjecnik-snimka');
  const lokalno = argumenti.get('lokalno') === 'DA';
  if (argumenti.has('lokalno') && !lokalno) throw new Error('Za lokalni predtest koristi --lokalno=DA.');
  if (!adresa || !putanjaRjecnika) throw new Error('Predtest zahtijeva --adresa i --rjecnik-snimka.');
  if (!path.isAbsolute(putanjaRjecnika)) throw new Error('--rjecnik-snimka mora biti apsolutna putanja do lokalne datoteke izvan repozitorija.');
  const brojPoModu = Number(argumenti.get('broj') ?? MAKS_VU_PO_MODU);
  if (!Number.isInteger(brojPoModu) || brojPoModu < 1 || brojPoModu > MAKS_VU_PO_MODU) {
    throw new Error(`--broj mora biti cijeli broj od 1 do ${MAKS_VU_PO_MODU} virtualnih korisnika po modu.`);
  }
  const rokKrajaMs = Number(argumenti.get('rok-kraja-ms') ?? 240_000);
  if (!Number.isInteger(rokKrajaMs) || rokKrajaMs < 30_000 || rokKrajaMs > MAKS_ROK_KRAJA_MS) {
    throw new Error(`--rok-kraja-ms mora biti između 30000 i ${MAKS_ROK_KRAJA_MS}.`);
  }
  const url = lokalno ? validirajAdresuLokalnogTesta(adresa) : validirajAdresuStaginga(adresa);
  return { adresa: url.origin, putanjaRjecnika, lokalno, brojPoModu, rokKrajaMs };
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

function provjeriPreduvjete(health: HealthSnapshot): void {
  if (!imaMetrikeBotova(health) || health.fondIscrpljenja === null) throw new Error(PORUKA_BEZ_METRIKA_BOTOVA);
  if (health.botoviDvoboj !== true || health.botoviCetveroboj !== true) {
    throw new Error('Popuna botovima nije uključena (BOTOVI_DVOBOJ/BOTOVI_CETVEROBOJ); uključi je za termin i ponovno pokreni poslužitelj.');
  }
  const potrebno = OCEKIVANI_BOTOVI_POPUNE.dva_igraca + OCEKIVANI_BOTOVI_POPUNE.cetiri_igraca;
  if ((health.fondSlobodni ?? 0) < potrebno) {
    throw new Error(`Fond ima ${health.fondSlobodni} slobodnih botova; predtest traži najmanje ${potrebno} (seed-botova).`);
  }
  if (health.aktivnePartije > 0 || health.botoviUPartiji! > 0) {
    throw new Error(`Poslužitelj već ima ${health.aktivnePartije} aktivnih partija i ${health.botoviUPartiji} botova u partiji; predtest traži miran poslužitelj.`);
  }
}

class GeneratorPopune {
  private readonly socketi = new Set<Socket>();
  readonly mjerenja: PartijaVu[] = [];
  readonly greske: string[] = [];
  brojTehnickihGresaka = 0;
  brojNeocekivanihPrekida = 0;
  private zatvaranje = false;

  constructor(
    private readonly adresa: string,
    private readonly rjecnik: SnimkaRjecnika,
    private readonly signal: AbortSignal,
    private readonly zabiljezi: (tekst: string) => void,
  ) {}

  /** Jedan VU: spajanje, ulazak u red, mjerenje do početka; partija se zatim igra u pozadini do kraja. */
  async odigrajJednog(mod: ModPopune): Promise<PartijaVu> {
    let zavrsi: () => void = () => undefined;
    const kraj = new Promise<void>((resolve) => { zavrsi = resolve; });
    const partija: PartijaVu = {
      mod, cekanjeMs: null, brojBotova: null, rezervacijeMs: [], potezaBota: 0, zavrsena: false,
      partijaId: null, mojIgracId: null, vanjski: new Set(), iskoristeneGrupe: new Set(), pokusaneRijeci: new Set(),
      odigranoVu: 0, turnToken: null, kraj, zavrsi,
    };
    this.mjerenja.push(partija);
    const socket = io(this.adresa, {
      auth: { token: `gost.${randomUUID().replaceAll('-', '')}` },
      forceNew: true,
      reconnection: false,
      transports: ['polling', 'websocket'],
      timeout: 15_000,
    });
    this.socketi.add(socket);
    await this.cekaj(socket, 'connect', 15_000);

    let usaoU: number | null = null;
    let pocetak: ((poruka: PocetakPartije) => void) | null = null;
    const pocetakObecanje = new Promise<PocetakPartije>((resolve) => { pocetak = resolve; });
    let timerPoteza: NodeJS.Timeout | null = null;

    socket.on('red:stanje', (stanje: StanjeReda) => {
      if (usaoU === null || partija.cekanjeMs !== null) return;
      const tudja = stanje.mjesta.filter((mjesto) => mjesto !== null && mjesto.igracId !== stanje.mojIgracId).length;
      while (partija.rezervacijeMs.length < tudja) partija.rezervacijeMs.push(performance.now() - usaoU);
    });
    socket.on('partija:pocetak', (poruka: PocetakPartije) => {
      if (partija.partijaId !== null || usaoU === null) return;
      partija.partijaId = poruka.partijaId;
      partija.mojIgracId = poruka.mojIgracId;
      partija.cekanjeMs = performance.now() - usaoU;
      for (const sjedalo of poruka.sjedala) if (sjedalo.igracId !== poruka.mojIgracId) partija.vanjski.add(sjedalo.igracId);
      partija.brojBotova = partija.vanjski.size;
      pocetak?.(poruka);
    });
    socket.on('partija:runda-otvorena', (poruka: RundaOtvorena) => {
      if (!partija.partijaId) return;
      for (const grupa of this.rjecnik.grupeZaRijec(poruka.rijec)) partija.iskoristeneGrupe.add(grupa);
      partija.turnToken = poruka.turnToken;
      partija.pokusaneRijeci.clear();
      if (poruka.naPotezuId === partija.mojIgracId) timerPoteza = this.zakaziPotez(socket, partija, poruka.trazenaSlova, poruka.turnToken);
    });
    socket.on('potez:prihvacen', (poruka: PrihvacenPotez) => {
      if (!partija.partijaId) return;
      for (const grupa of this.rjecnik.grupeZaRijec(poruka.rijec)) partija.iskoristeneGrupe.add(grupa);
      if (partija.vanjski.has(poruka.igracId)) partija.potezaBota += 1;
      else if (poruka.igracId === partija.mojIgracId) partija.odigranoVu += 1;
      partija.turnToken = poruka.turnToken;
      partija.pokusaneRijeci.clear();
      if (poruka.istekPotezaIso && poruka.sljedeciId === partija.mojIgracId) {
        timerPoteza = this.zakaziPotez(socket, partija, poruka.trazenaSlova, poruka.turnToken);
      }
    });
    socket.on('potez:odbijen', (poruka: { kod: string }) => {
      if (poruka.kod === 'RIJEC_ISKORISTENA') return;
      this.brojTehnickihGresaka += 1;
      this.greske.push(`VU-u je odbijen potez: ${poruka.kod}`);
    });
    socket.on('partija:eliminacija', (poruka: Eliminacija) => {
      if (partija.vanjski.has(poruka.igracId) && poruka.razlog === 'istek') this.greske.push(`Bot ${poruka.igracId.slice(0, 8)} eliminiran istekom u partiji ${partija.partijaId}.`);
    });
    socket.on('partija:kraj', (poruka: KrajPartije) => {
      if (poruka.partijaId !== partija.partijaId) return;
      partija.zavrsena = true;
      if (timerPoteza) clearTimeout(timerPoteza);
      socket.emit('partija:izadji');
      partija.zavrsi();
    });
    socket.on('greska', (poruka: { kod: string; poruka: string }) => {
      this.brojTehnickihGresaka += 1;
      this.greske.push(`${poruka.kod}: ${poruka.poruka}`);
    });
    socket.on('disconnect', (razlog: string) => {
      this.socketi.delete(socket);
      if (!this.zatvaranje && !this.signal.aborted) {
        this.brojNeocekivanihPrekida += 1;
        this.greske.push(`Neočekivani prekid veze (${razlog}).`);
      }
      partija.zavrsi();
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Ulazak VU-a u javni red nije potvrđen.')), 15_000);
      socket.emit('red:udji', { mod }, (stanje: unknown) => {
        clearTimeout(timer);
        if (!stanje) {
          reject(new Error('Poslužitelj je odbio ulazak VU-a u javni red.'));
          return;
        }
        usaoU = performance.now();
        resolve();
      });
    });

    const rok = OCEKIVANO_CEKANJE_POPUNE_MS[mod] + 10 * TOLERANCIJA_POPUNE_MS;
    const ishod = await Promise.race([
      pocetakObecanje.then(() => 'pocetak' as const),
      odgodi(rok, this.signal).then(() => 'istek' as const),
    ]);
    if (ishod === 'istek') {
      this.zabiljezi(`${mod}: partija nije počela unutar ${prikaziTrajanje(rok)}; VU napušta red.`);
      socket.emit('red:izadji');
      partija.zavrsi();
    } else {
      this.zabiljezi(`${mod}: početak nakon ${(partija.cekanjeMs! / 1000).toFixed(1)} s, botova ${partija.brojBotova}, rezervacije ${partija.rezervacijeMs.map((ms) => `${(ms / 1000).toFixed(1)} s`).join(', ') || 'nisu viđene'}`);
    }
    return partija;
  }

  /** VU odigra nekoliko riječi pa „Ne znam”: botovi moraju igrati i bez čovjeka, a partija mora završiti. */
  private zakaziPotez(socket: Socket, partija: PartijaVu, trazenaSlova: string, turnToken: string): NodeJS.Timeout {
    return setTimeout(() => {
      if (this.signal.aborted || partija.zavrsena || partija.turnToken !== turnToken) return;
      void (async () => {
        const rijec = partija.odigranoVu >= POTEZA_VU_PRIJE_PREDAJE
          ? null
          : await this.rjecnik.nasumicnaRijec(trazenaSlova, partija.iskoristeneGrupe, partija.pokusaneRijeci);
        if (this.signal.aborted || partija.zavrsena || partija.turnToken !== turnToken) return;
        if (!rijec) {
          socket.emit('potez:ne-znam');
          return;
        }
        partija.pokusaneRijeci.add(rijec);
        socket.emit('potez:rijec', { rijec });
      })();
    }, 2_000 + Math.random() * 2_000);
  }

  private cekaj(socket: Socket, dogadaj: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Događaj ${dogadaj} nije stigao na vrijeme.`)), timeoutMs);
      socket.once(dogadaj, () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (greska: Error) => { clearTimeout(timer); reject(greska); });
    });
  }

  async cekajKrajeve(rokMs: number): Promise<void> {
    await Promise.race([
      Promise.all(this.mjerenja.map((partija) => partija.kraj)),
      odgodi(rokMs, this.signal).catch(() => undefined),
    ]);
  }

  zatvori(): void {
    this.zatvaranje = true;
    for (const socket of this.socketi) {
      if (socket.connected) {
        socket.emit('red:izadji');
        socket.emit('partija:izadji');
      }
      socket.disconnect();
      socket.removeAllListeners();
    }
    this.socketi.clear();
  }
}

async function glavno(): Promise<void> {
  const postavke = ucitajPostavke();
  if (!postavke.lokalno && !process.stdin.isTTY) throw new OtkazanoPokretanje('Staging zahtijeva interaktivni terminal; priprema nije kontaktirala staging.');
  console.log('Priprema predtesta popune reda; VU-ovi još nisu spojeni.');
  const putanjaRjecnika = await validirajPutanjuSnimke(postavke.putanjaRjecnika);
  const rjecnik = await ucitajSnimkuRjecnika(putanjaRjecnika);
  const baseline = await dohvatiHealth(postavke.adresa);
  provjeriPreduvjete(baseline);
  const ukupnoVu = postavke.brojPoModu * MODOVI.length;
  const profilId = `popuna-v1:${rjecnik.sha256}`;
  const runId = randomUUID();
  const direktorijIzvjestaja = path.join(korijenIzvjestaja(), runId);
  console.log([
    `Okolina: ${postavke.lokalno ? 'LOKALNO, nije dokaz staging ponašanja' : 'STAGING'}`,
    `Cilj: ${postavke.adresa}; pokus: ${runId}`,
    `Izdanje: ${baseline.verzija}; digest: ${baseline.digest}`,
    `Profil: ${profilId}`,
    `Plan: ${postavke.brojPoModu} VU u dvoboju (očekivano 30 s, 1 bot) i ${postavke.brojPoModu} VU u četveroboju (očekivano 40 s, 3 bota; rezervacije na 20 i 30 s); tolerancija ±${TOLERANCIJA_POPUNE_MS / 1000} s`,
    `Fond: slobodnih ${baseline.fondSlobodni}, u partiji ${baseline.botoviUPartiji}, iscrpljenja ${baseline.fondIscrpljenja}`,
    `Procijenjeno trajanje: ulasci ≈ ${prikaziTrajanje(postavke.brojPoModu * OCEKIVANO_CEKANJE_POPUNE_MS.cetiri_igraca)} + dovršavanje partija do ${prikaziTrajanje(postavke.rokKrajaMs)}`,
    `Izvještaji: ${direktorijIzvjestaja}`,
  ].map(ocistiTerminalTekst).join('\n'));
  if (!postavke.lokalno) {
    await odobriRazinuPokusa(ukupnoVu, async () => {
      const trenutni = await dohvatiHealth(postavke.adresa);
      if (trenutni.digest !== baseline.digest) throw new Error('Izdanje je promijenjeno tijekom čekanja potvrde. Ponovno pokreni pripremu.');
      provjeriPreduvjete(trenutni);
    });
  }
  await mkdir(direktorijIzvjestaja, { recursive: true, mode: 0o700 });
  await writeFile(path.join(direktorijIzvjestaja, 'dnevnik.txt'), 'Priprema je završena.\n', { flag: 'wx', mode: 0o600 });
  const oslobodiLokalnuBravu = postavke.lokalno ? async () => undefined : await zakljucajStagingTest(postavke.adresa);
  const kontroler = new AbortController();
  const rucniKontroler = new AbortController();
  const pocetak = Date.now();
  const dnevnik: string[] = [];
  const zabiljezi = (tekst: string) => {
    const cistiTekst = ocistiTerminalTekst(tekst).slice(0, 2_048);
    if (dnevnik.length < 4_000) dnevnik.push(`${new Date().toISOString()} ${cistiTekst}`);
    console.log(cistiTekst);
  };
  let izvjestaj: IzvjestajPokusa = {
    verzijaFormata: 1, runId, vrijeme: new Date().toISOString(), cilj: postavke.adresa,
    razina: ukupnoVu, lokalniSmoke: postavke.lokalno, profilId, pokrenuto: false,
    digest: baseline.digest, ishod: 'FAIL', razlog: null, provjere: {},
    vrsta: 'popuna', direktorijIzvjestaja, sljedecaRazina: null, prethodniRunId: null,
    odobrenoU: postavke.lokalno ? null : new Date().toISOString(),
    upozorenja: ['Predtest popune ne otključava razine miješanog testa. Botovi nakon predaje VU-a dovršavaju partiju sami; fond se oslobađa tek po kraju.'],
  };
  zabiljezi(postavke.lokalno ? 'Lokalni predtest; nije staging odobrenje.' : `Operater je unio POKRENI ${ukupnoVu}; runId ${runId}.`);
  let rucniPrekid = false;
  let stagingLeaseDrzan = false;
  let zaustaviObnavljanjeLeasea: (() => void) | undefined;
  let razlogPrekida: string | null = null;
  const generator = new GeneratorPopune(postavke.adresa, rjecnik, kontroler.signal, zabiljezi);
  const prekini = () => {
    razlogPrekida = 'Prekid na zahtjev operatera.';
    rucniPrekid = true;
    rucniKontroler.abort();
    kontroler.abort();
  };
  const sigurnosniTimer = setTimeout(() => {
    razlogPrekida = 'Prekoračeno je maksimalno ukupno trajanje predtesta.';
    kontroler.abort();
  }, postavke.brojPoModu * (OCEKIVANO_CEKANJE_POPUNE_MS.cetiri_igraca + 10 * TOLERANCIJA_POPUNE_MS) + postavke.rokKrajaMs + 120_000);
  const nadzorTimer = setInterval(() => {
    void dohvatiHealth(postavke.adresa, kontroler.signal).then((health) => {
      if (health.digest !== baseline.digest) throw new Error('Izdanje aplikacije promijenilo se tijekom predtesta.');
    }).catch((greska: unknown) => {
      if (kontroler.signal.aborted) return;
      razlogPrekida = greska instanceof Error ? greska.message : String(greska);
      kontroler.abort();
    });
  }, 10_000);
  process.on('SIGINT', prekini);
  process.on('SIGTERM', prekini);
  try {
    if (!postavke.lokalno) {
      await azurirajStagingLease(postavke.adresa, runId, 'acquire');
      stagingLeaseDrzan = true;
      zaustaviObnavljanjeLeasea = pokreniObnavljanjeLeasea(postavke.adresa, runId, kontroler.signal, (razlog) => {
        razlogPrekida = `Staging lease je izgubljen: ${razlog}`;
        kontroler.abort();
      });
    }
    izvjestaj.pokrenuto = true;
    // Modovi imaju odvojene redove pa teku usporedno; unutar moda VU-ovi ulaze strogo serijski.
    await Promise.all(MODOVI.map(async (mod) => {
      for (let redni = 0; redni < postavke.brojPoModu && !kontroler.signal.aborted; redni += 1) {
        await generator.odigrajJednog(mod);
      }
    }));
    if (kontroler.signal.aborted) throw new Error(razlogPrekida ?? 'Predtest je prekinut.');
    zabiljezi(`Svi ulasci obavljeni; čekanje kraja partija do ${prikaziTrajanje(postavke.rokKrajaMs)}.`);
    const pocetakCekanjaKraja = Date.now();
    await generator.cekajKrajeve(postavke.rokKrajaMs);
    let zavrsniHealth = await dohvatiHealth(postavke.adresa, kontroler.signal);
    // Fond se oslobađa tek kad motor otpusti partiju; kratko pričekaj da se brojač slegne.
    const rokFonda = Date.now() + 30_000;
    while ((zavrsniHealth.botoviUPartiji ?? 0) > (baseline.botoviUPartiji ?? 0) && Date.now() < rokFonda && !kontroler.signal.aborted) {
      await odgodi(2_000, kontroler.signal);
      zavrsniHealth = await dohvatiHealth(postavke.adresa, kontroler.signal);
    }
    const mjerenja: MjerenjePopune[] = generator.mjerenja.map(({ mod, cekanjeMs, brojBotova, rezervacijeMs, potezaBota, zavrsena }) =>
      ({ mod, cekanjeMs, brojBotova, rezervacijeMs, potezaBota, zavrsena }));
    const ocjena = ocijeniPopunuReda({
      mjerenja,
      planirano: { dva_igraca: postavke.brojPoModu, cetiri_igraca: postavke.brojPoModu },
      istekBotovaDelta: zavrsniHealth.botIsteci !== null && baseline.botIsteci !== null ? zavrsniHealth.botIsteci - baseline.botIsteci - ((zavrsniHealth.botNamjerniIsteci ?? 0) - (baseline.botNamjerniIsteci ?? 0)) : null,
      tehnickeGreskeBotovaDelta: zavrsniHealth.botTehnickeGreske !== null && baseline.botTehnickeGreske !== null ? zavrsniHealth.botTehnickeGreske - baseline.botTehnickeGreske : null,
      iscrpljenjaDelta: zavrsniHealth.fondIscrpljenja !== null && baseline.fondIscrpljenja !== null ? zavrsniHealth.fondIscrpljenja - baseline.fondIscrpljenja : null,
      tehnickeGreskeGeneratora: generator.brojTehnickihGresaka + generator.brojNeocekivanihPrekida,
    });
    const provjere = { ...ocjena.provjere, digestNepromijenjen: zavrsniHealth.digest === baseline.digest };
    const fondVracen = (zavrsniHealth.botoviUPartiji ?? 0) <= (baseline.botoviUPartiji ?? 0);
    if (!fondVracen) izvjestaj.upozorenja.push(`Po isteku roka ${zavrsniHealth.botoviUPartiji} botova još igra; ${mjerenja.length - ocjena.zavrsenePartije} partija nije završilo. Provjeriti kasnije da se fond vratio na ${baseline.fondSlobodni}.`);
    izvjestaj = {
      ...izvjestaj,
      verzija: baseline.verzija,
      rjecnik: { brojRijeci: rjecnik.brojRijeci, sha256: rjecnik.sha256 },
      trajanje: { ulasciMs: pocetakCekanjaKraja - pocetak, cekanjeKrajaMs: Date.now() - pocetakCekanjaKraja, ukupnoMs: Date.now() - pocetak },
      popuna: {
        brojPoModu: postavke.brojPoModu,
        mjerenja,
        pokrenutePartije: ocjena.pokrenutePartije,
        zavrsenePartije: ocjena.zavrsenePartije,
        cekanjeDvobojaMs: ocjena.cekanjeDvobojaMs,
        cekanjeCetverobojaMs: ocjena.cekanjeCetverobojaMs,
        fondSlobodniPocetak: baseline.fondSlobodni,
        fondSlobodniKraj: zavrsniHealth.fondSlobodni,
        botoviUPartijiKraj: zavrsniHealth.botoviUPartiji,
        iscrpljenjaDelta: (zavrsniHealth.fondIscrpljenja ?? 0) - (baseline.fondIscrpljenja ?? 0),
        istekBotovaDelta: (zavrsniHealth.botIsteci ?? 0) - (baseline.botIsteci ?? 0) - ((zavrsniHealth.botNamjerniIsteci ?? 0) - (baseline.botNamjerniIsteci ?? 0)),
        namjerniIsteciDelta: (zavrsniHealth.botNamjerniIsteci ?? 0) - (baseline.botNamjerniIsteci ?? 0),
        tehnickeGreskeBotovaDelta: (zavrsniHealth.botTehnickeGreske ?? 0) - (baseline.botTehnickeGreske ?? 0),
        greskeGeneratora: generator.greske.slice(0, 30),
      },
      provjere,
      ishod: Object.values(provjere).every(Boolean) ? 'PASS' : 'FAIL',
    };
  } catch (greska) {
    const poruka = greska instanceof Error ? greska.message : String(greska);
    if (!razlogPrekida) razlogPrekida = poruka;
    kontroler.abort();
    izvjestaj = { ...izvjestaj, ishod: rucniPrekid ? 'ABORTED' : 'FAIL', razlog: razlogPrekida, ukupnoMs: Date.now() - pocetak };
    zabiljezi(`Predtest nije uspio: ${poruka}`);
  } finally {
    clearInterval(nadzorTimer);
    clearTimeout(sigurnosniTimer);
    const greskeCiscenja: string[] = [];
    const ocisti = async (naziv: string, posao: () => Promise<unknown>) => {
      try { await posao(); }
      catch (greska) { greskeCiscenja.push(`${naziv}: ${greska instanceof Error ? greska.message : String(greska)}`); }
    };
    await ocisti('VU-ovi', async () => generator.zatvori());
    zaustaviObnavljanjeLeasea?.();
    if (stagingLeaseDrzan) await ocisti('Staging lease', () => azurirajStagingLease(postavke.adresa, runId, 'release'));
    await ocisti('Lokalna brava', oslobodiLokalnuBravu);
    if (kontroler.signal.aborted && izvjestaj.ishod === 'PASS') {
      izvjestaj.ishod = rucniPrekid ? 'ABORTED' : 'FAIL';
      izvjestaj.razlog = razlogPrekida;
    }
    try {
      izvjestaj = await finalizirajIzvjestaj(izvjestaj, {
        signal: rucniKontroler.signal,
        greskeCiscenja,
        spremi: async (rezultat) => {
          await writeFile(path.join(direktorijIzvjestaja, 'dnevnik.txt'), `${dnevnik.join('\n')}\n`, { mode: 0o600 });
          await spremiIzvjestaj(rezultat, direktorijIzvjestaja);
        },
        // Predtest ne zapisuje potvrde razina: ne otključava miješani staging test.
        potvrdi: async () => undefined,
      });
      console.log(formatirajSazetak(izvjestaj));
      process.exitCode = izvjestaj.ishod === 'PASS' ? 0 : izvjestaj.ishod === 'ABORTED' ? 130 : 1;
    } catch (greska) {
      process.exitCode = rucniPrekid ? 130 : 1;
      console.error(ocistiTerminalTekst(`PREDTEST ${rucniPrekid ? 'PREKINUT' : 'NIJE PROŠAO'}: završni zapis nije dovršen. ${greska instanceof Error ? greska.message : String(greska)}; artefakti: ${direktorijIzvjestaja}.`));
    } finally {
      process.off('SIGINT', prekini);
      process.off('SIGTERM', prekini);
    }
  }
}

void glavno().catch((greska: unknown) => {
  console.error(ocistiTerminalTekst(`PRIPREMA ${greska instanceof OtkazanoPokretanje ? 'OTKAZANA' : 'NIJE USPJELA'}: ${greska instanceof Error ? greska.message : String(greska)} Predtest nije pokrenut.`));
  process.exitCode = greska instanceof OtkazanoPokretanje ? 130 : 1;
});
