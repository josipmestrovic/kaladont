/**
 * Reproducibilni Socket.IO baseline za veze, red čekanja i reconnect churn.
 * Pokreće se isključivo protiv kontroliranog lokalnog ili staging okruženja.
 */
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { and, eq } from 'drizzle-orm';
import type { Eliminacija, KrajPartije, PrihvacenPotez, PocetakPartije, RundaOtvorena, SpremanjeRezultataPartije } from 'zajednicko';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';
import {
  MAKS_TRAJANJE_STAGING_TESTA_MS,
  ocijeniOdrzaneVeze,
  provjeriPrethodnuRazinuStagingTesta,
  zakljucajStagingTest,
  validirajCiljPokretanja,
  validirajUlazStagingTesta,
  zabiljeziRezultatStagingTesta,
} from './opterecenje-postavke.js';

type Scenarij = 'veze' | 'red' | 'reconnect' | 'igra';

interface Postavke {
  scenarij: Scenarij;
  adresa: string;
  stagingTest: boolean;
  brojKlijenata: number;
  velicinaVala: number;
  razmakValaMs: number;
  trajanjeMs: number;
  brojCiklusa: number;
  timeoutMs: number;
  brojIdleKlijenata: number;
  cekanjeCiscenjaMs: number;
  brojPartija: number;
  maksStopaGresaka: number;
  p95PotezMs: number;
  p95SpremanjeMs: number;
  maksAktivnihPartijaNakonCiscenja: number;
  maksRssDeltaMb: number;
  timerTest: boolean;
}

interface Klijent {
  token: string;
  socket: Socket;
}

interface RezultatSpajanja {
  klijenti: Klijent[];
  trajanja: number[];
  greske: string[];
}

const otvoreniSocketi = new Set<Socket>();
const ODGODA_BOT_POTEZA_MS = 400;
const MAKS_POTEZA_KONTROLIRANE_PARTIJE = 24;
let signalPrekida: AbortSignal | undefined;
let rokStagingTestaMs: number | undefined;

const argumenti = new Map(
  process.argv.slice(2).map((argument) => {
    const [naziv, ...ostatak] = argument.replace(/^--/, '').split('=');
    return [naziv, ostatak.join('=')] as const;
  }),
);

function brojArgumenta(naziv: string, zadano: number, najmanje = 0): number {
  const sirovo = argumenti.get(naziv);
  const vrijednost = sirovo === undefined ? zadano : Number(sirovo);
  if (!Number.isInteger(vrijednost) || vrijednost < najmanje) {
    throw new Error(`--${naziv} mora biti cijeli broj >= ${najmanje}.`);
  }
  return vrijednost;
}

function decimalniArgument(naziv: string, zadano: number, najmanje = 0): number {
  const sirovo = argumenti.get(naziv);
  const vrijednost = sirovo === undefined ? zadano : Number(sirovo);
  if (!Number.isFinite(vrijednost) || vrijednost < najmanje) {
    throw new Error(`--${naziv} mora biti broj >= ${najmanje}.`);
  }
  return vrijednost;
}

function ucitajPostavke(): Postavke {
  const stagingTest = argumenti.has('staging');
  const adresaArgumenta = argumenti.get('adresa');
  const klijentiArgument = argumenti.get('klijenti');
  const trajanjeArgument = argumenti.get('trajanje-ms');

  const scenarij = (argumenti.get('scenarij') ?? 'veze') as Scenarij;
  if (!['veze', 'red', 'reconnect', 'igra'].includes(scenarij)) {
    throw new Error('--scenarij mora biti veze, red, reconnect ili igra.');
  }

  const postavke: Postavke = {
    scenarij,
    adresa: adresaArgumenta ?? process.env.SIMULACIJA_ADRESA ?? 'http://localhost:3000',
    stagingTest,
    brojKlijenata: brojArgumenta('klijenti', 100, 1),
    velicinaVala: brojArgumenta('val', stagingTest ? 10 : 20, 1),
    razmakValaMs: brojArgumenta('razmak-vala-ms', stagingTest ? 1_000 : 50),
    trajanjeMs: brojArgumenta('trajanje-ms', 5_000),
    brojCiklusa: brojArgumenta('ciklusi', 3, 1),
    timeoutMs: brojArgumenta('timeout-ms', 30_000, 1),
    brojIdleKlijenata: brojArgumenta('idle', 0),
    cekanjeCiscenjaMs: brojArgumenta('cekaj-ciscenje-ms', 16_000),
    brojPartija: brojArgumenta('partije', 1, 1),
    maksStopaGresaka: decimalniArgument('maks-stopa-gresaka', 0.005),
    p95PotezMs: brojArgumenta('p95-potez-ms', 250, 1),
    p95SpremanjeMs: brojArgumenta('p95-spremanje-ms', 1_000, 1),
    maksAktivnihPartijaNakonCiscenja: brojArgumenta('maks-aktivnih-partija-nakon-ciscenja', 0),
    maksRssDeltaMb: brojArgumenta('maks-rss-delta-mb', 256, 0),
    timerTest: argumenti.get('timer-test') === 'true',
  };

  if (stagingTest) {
    const stagingAdresa = validirajUlazStagingTesta({
      adresa: adresaArgumenta,
      brojKorisnika: klijentiArgument === undefined ? undefined : postavke.brojKlijenata,
      trajanjeMs: trajanjeArgument === undefined ? undefined : postavke.trajanjeMs,
      scenarij: postavke.scenarij,
      velicinaVala: postavke.velicinaVala,
      razmakValaMs: postavke.razmakValaMs,
      potvrdaDesetTisuca: argumenti.get('potvrdi-10000'),
    });
    postavke.adresa = stagingAdresa.origin;
  } else {
    validirajCiljPokretanja(postavke.adresa, false);
  }

  if (postavke.scenarij === 'igra') postavke.brojKlijenata = postavke.brojPartija * 4;

  if ((postavke.scenarij === 'red' || postavke.scenarij === 'igra') && postavke.brojKlijenata % 4 !== 0) {
    throw new Error('--klijenti za scenarij red mora biti djeljiv s 4.');
  }
  return postavke;
}

function odgodi(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (signalPrekida?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signalPrekida?.removeEventListener('abort', prekid);
      resolve();
    }, ms);
    const prekid = () => {
      clearTimeout(timer);
      signalPrekida?.removeEventListener('abort', prekid);
      resolve();
    };
    signalPrekida?.addEventListener('abort', prekid, { once: true });
  });
}

function sOgranicenjem<T>(obecanje: Promise<T>, timeoutMs: number, opis: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const prekid = () => zavrsi(() => reject(new Error('Test je prekinut.')));
    const timer = setTimeout(
      () => zavrsi(() => reject(new Error(`${opis}: isteklo ${timeoutMs} ms.`))),
      timeoutMs,
    );
    function zavrsi(dovrsi: () => void): void {
      clearTimeout(timer);
      signalPrekida?.removeEventListener('abort', prekid);
      dovrsi();
    }
    signalPrekida?.addEventListener('abort', prekid, { once: true });
    obecanje.then(
      (vrijednost) => {
        zavrsi(() => resolve(vrijednost));
      },
      (greska: unknown) => {
        zavrsi(() => reject(greska));
      },
    );
  });
}

function percentil(vrijednosti: readonly number[], udio: number): number {
  if (vrijednosti.length === 0) return 0;
  const sortirano = [...vrijednosti].sort((a, b) => a - b);
  const indeks = Math.min(sortirano.length - 1, Math.ceil(sortirano.length * udio) - 1);
  return sortirano[indeks]!;
}

function statistika(vrijednosti: readonly number[]) {
  return {
    broj: vrijednosti.length,
    p50Ms: percentil(vrijednosti, 0.5),
    p95Ms: percentil(vrijednosti, 0.95),
    maksimumMs: vrijednosti.length > 0 ? Math.max(...vrijednosti) : 0,
  };
}

interface HealthSnapshot {
  aktivnePartije: number;
  aktivneVeze: number;
  rssBajtovi: number;
  heapUsedBajtovi: number;
}

async function dohvatiHealth(adresa: string): Promise<HealthSnapshot> {
  const odgovor = await fetch(`${adresa}/zdravlje`, { redirect: 'manual' });
  if (!odgovor.ok) throw new Error(`Health zahtjev nije uspio: HTTP ${odgovor.status}.`);
  if (new URL(odgovor.url).hostname !== new URL(adresa).hostname) {
    throw new Error('Health zahtjev preusmjeren je na drugi host.');
  }
  const tijelo = (await odgovor.json()) as Partial<HealthSnapshot>;
  if (!Number.isFinite(tijelo.aktivnePartije) || !Number.isFinite(tijelo.aktivneVeze) || !Number.isFinite(tijelo.rssBajtovi) || !Number.isFinite(tijelo.heapUsedBajtovi)) {
    throw new Error('Health odgovor nema očekivane load-test metrike.');
  }
  return {
    aktivnePartije: tijelo.aktivnePartije!,
    aktivneVeze: tijelo.aktivneVeze!,
    rssBajtovi: tijelo.rssBajtovi!,
    heapUsedBajtovi: tijelo.heapUsedBajtovi!,
  };
}

async function spojiKlijenta(
  adresa: string,
  token: string,
  timeoutMs: number,
): Promise<{ klijent: Klijent; trajanjeMs: number }> {
  const pocetak = performance.now();
  const socket = io(adresa, {
    auth: { token },
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });
  otvoreniSocketi.add(socket);

  await sOgranicenjem(
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    }),
    timeoutMs,
    `Spajanje klijenta ${token.slice(0, 8)}`,
  ).catch((greska) => {
    socket.disconnect();
    otvoreniSocketi.delete(socket);
    throw greska;
  });

  return { klijent: { token, socket }, trajanjeMs: Math.round(performance.now() - pocetak) };
}

async function spojiUValovima(
  postavke: Postavke,
  tokeni: readonly string[],
): Promise<RezultatSpajanja> {
  const klijenti: Klijent[] = [];
  const trajanja: number[] = [];
  const greske: string[] = [];

  for (let pocetak = 0; pocetak < tokeni.length; pocetak += postavke.velicinaVala) {
    if (signalPrekida?.aborted) break;
    if (rokStagingTestaMs !== undefined && Date.now() >= rokStagingTestaMs) break;
    const val = tokeni.slice(pocetak, pocetak + postavke.velicinaVala);
    const ishodi = await Promise.allSettled(
      val.map((token) => {
        const preostaloMs = rokStagingTestaMs === undefined
          ? postavke.timeoutMs
          : Math.max(1, Math.min(postavke.timeoutMs, rokStagingTestaMs - Date.now()));
        return spojiKlijenta(postavke.adresa, token, preostaloMs);
      }),
    );
    for (const ishod of ishodi) {
      if (ishod.status === 'fulfilled') {
        klijenti.push(ishod.value.klijent);
        trajanja.push(ishod.value.trajanjeMs);
      } else {
        greske.push(ishod.reason instanceof Error ? ishod.reason.message : String(ishod.reason));
      }
    }
    if (
      postavke.stagingTest &&
      greske.length / Math.max(1, klijenti.length + greske.length) > postavke.maksStopaGresaka
    ) break;
    if (pocetak + postavke.velicinaVala < tokeni.length) await odgodi(postavke.razmakValaMs);
  }

  return { klijenti, trajanja, greske };
}

function odspojiSve(klijenti: readonly Klijent[]): void {
  for (const klijent of klijenti) {
    klijent.socket.removeAllListeners();
    klijent.socket.disconnect();
    otvoreniSocketi.delete(klijent.socket);
  }
}

function odspojiSveOtvorene(): void {
  for (const socket of otvoreniSocketi) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  otvoreniSocketi.clear();
}

async function scenarijVeze(postavke: Postavke, tokeni: readonly string[]) {
  const pocetak = Date.now();
  const { klijenti, trajanja, greske } = await spojiUValovima(postavke, tokeni);
  const brojObradenihPokusaja = klijenti.length + greske.length;
  const brojNeostvarenih = Math.max(0, tokeni.length - brojObradenihPokusaja);
  if (brojNeostvarenih > 0) greske.push(`${brojNeostvarenih} pokušaja nije pokrenuto prije isteka roka.`);

  const neocekivanoOdspojeni = new Set<Socket>();
  let planiranoZatvaranje = false;
  for (const klijent of klijenti) {
    if (!klijent.socket.connected) neocekivanoOdspojeni.add(klijent.socket);
    klijent.socket.on('disconnect', () => {
      if (!planiranoZatvaranje && !signalPrekida?.aborted) neocekivanoOdspojeni.add(klijent.socket);
    });
  }

  const pocetakDrzanjaMs = Date.now();
  const ciljanoDrzanjeMs = postavke.trajanjeMs;
  const krajnjiRokMs = postavke.stagingTest
    ? rokStagingTestaMs ?? pocetakDrzanjaMs
    : pocetakDrzanjaMs + ciljanoDrzanjeMs;
  const ciljaniKrajMs = Math.min(pocetakDrzanjaMs + ciljanoDrzanjeMs, krajnjiRokMs);
  const aktivnePoUzorku = [klijenti.filter((klijent) => klijent.socket.connected).length];
  const najmanjePotrebnoAktivnih = Math.ceil(tokeni.length * (1 - postavke.maksStopaGresaka));

  while (Date.now() < ciljaniKrajMs && !signalPrekida?.aborted) {
    const aktivnih = klijenti.filter((klijent) => klijent.socket.connected).length;
    aktivnePoUzorku.push(aktivnih);
    if (aktivnih < najmanjePotrebnoAktivnih) break;
    await odgodi(Math.min(1_000, ciljaniKrajMs - Date.now()));
  }

  const trajanjeDrzanjaMs = Date.now() - pocetakDrzanjaMs;
  const najmanjeAktivnihVeza = Math.min(...aktivnePoUzorku);
  const brojGresaka = greske.length + neocekivanoOdspojeni.size;
  const ocjena = ocijeniOdrzaneVeze({
    brojCiljanihKlijenata: tokeni.length,
    brojObradenihPokusaja,
    brojUspjesnihSpajanja: klijenti.length,
    brojGresaka,
    najmanjeAktivnihVeza,
    trajanjeDrzanjaMs,
    ciljanoDrzanjeMs,
    maksStopaGresaka: postavke.maksStopaGresaka,
  });
  planiranoZatvaranje = true;
  odspojiSve(klijenti);
  return {
    spajanje: statistika(trajanja),
    brojGresaka,
    brojPokusaja: tokeni.length,
    brojNeocekivanihPrekida: neocekivanoOdspojeni.size,
    najmanjeAktivnihVeza,
    trajanjeRampeMs: Math.max(0, pocetakDrzanjaMs - pocetak),
    ciljanoDrzanjeMs,
    trajanjeDrzanjaMs,
    stopaGresaka: ocjena.stopaGresaka,
    provjere: ocjena.provjere,
    greske: [...greske, ...[...neocekivanoOdspojeni].map(() => 'Veza je neočekivano prekinuta tijekom mjerenja.')].slice(0, 20),
  };
}

async function scenarijReconnect(postavke: Postavke, tokeni: readonly string[]) {
  let spojeni = await spojiUValovima(postavke, tokeni);
  const pocetnoSpajanje = {
    ...statistika(spojeni.trajanja),
    brojGresaka: spojeni.greske.length,
    greske: spojeni.greske,
  };
  const ciklusi: Array<ReturnType<typeof statistika> & { brojGresaka: number; greske: string[] }> =
    [];

  for (let ciklus = 1; ciklus <= postavke.brojCiklusa; ciklus += 1) {
    if (signalPrekida?.aborted) break;
    odspojiSve(spojeni.klijenti);
    await odgodi(postavke.razmakValaMs);
    spojeni = await spojiUValovima(postavke, tokeni);
    ciklusi.push({
      ...statistika(spojeni.trajanja),
      brojGresaka: spojeni.greske.length,
      greske: spojeni.greske,
    });
  }

  odspojiSve(spojeni.klijenti);
  const brojGresaka = pocetnoSpajanje.brojGresaka + ciklusi.reduce((zbroj, ciklus) => zbroj + ciklus.brojGresaka, 0);
  return {
    pocetnoSpajanje,
    ciklusi,
    brojGresaka,
    brojPokusaja: tokeni.length * (postavke.brojCiklusa + 1),
  };
}

async function scenarijRed(postavke: Postavke, tokeni: readonly string[]) {
  const idleTokeni = Array.from(
    { length: postavke.brojIdleKlijenata },
    () => `gost.${randomUUID().replaceAll('-', '')}`,
  );
  const idle = await spojiUValovima(postavke, idleTokeni);
  const { klijenti, trajanja, greske } = await spojiUValovima(postavke, tokeni);
  const ulazakPoTokenu = new Map<string, number>();
  const cekanja: number[] = [];
  const brojZaStolove = klijenti.length - (klijenti.length % 4);

  try {
    const pocetci = klijenti.slice(0, brojZaStolove).map(
      (klijent) =>
        new Promise<void>((resolve) => {
          klijent.socket.once('partija:pocetak', () => {
            cekanja.push(
              Math.round(
                performance.now() - (ulazakPoTokenu.get(klijent.token) ?? performance.now()),
              ),
            );
            resolve();
          });
        }),
    );

    for (let pocetak = 0; pocetak < klijenti.length; pocetak += postavke.velicinaVala) {
      if (signalPrekida?.aborted) break;
      const val = klijenti.slice(pocetak, pocetak + postavke.velicinaVala);
      for (const klijent of val) {
        ulazakPoTokenu.set(klijent.token, performance.now());
        klijent.socket.emit('red:udji');
      }
      if (pocetak + postavke.velicinaVala < klijenti.length) await odgodi(postavke.razmakValaMs);
    }

    if (pocetci.length > 0) {
      await sOgranicenjem(
        Promise.all(pocetci).then(() => undefined),
        postavke.timeoutMs,
        'Sastavljanje svih stolova',
      );
    }

    return {
      spajanje: statistika(trajanja),
      idleSpajanje: statistika(idle.trajanja),
      cekanjeNaStol: statistika(cekanja),
      brojGresaka: greske.length + idle.greske.length,
      brojPokusaja: tokeni.length + idleTokeni.length,
      greske: [...idle.greske, ...greske],
      neupareni: klijenti.length - brojZaStolove,
    };
  } finally {
    for (const klijent of klijenti.slice(0, brojZaStolove)) klijent.socket.emit('partija:izadji');
    if (brojZaStolove > 0) await odgodi(postavke.cekanjeCiscenjaMs);
    odspojiSve(klijenti);
    odspojiSve(idle.klijenti);
  }
}

interface MjerenaPartija {
  partijaId: string;
  igraci: Set<string>;
  iskoristene: Set<string>;
  pokusane: Set<string>;
  naPotezuId: string | null;
  trazenaSlova: string | null;
  pocetakMs: number;
  poslanPotezMs: Map<string, number>;
  poteziMs: number[];
  spremanjeMs: number | null;
  krajMs: number | null;
  greske: string[];
  odigraniPotezi: number;
  zakazanPotez: boolean;
  potezUObradi: boolean;
  generacijaRunde: number;
  timerCekaMs: number | null;
  timerDriftMs: number[];
  timerTestirano: boolean;
}

async function pronadjiRijec(prefiks: string, iskoristene: Set<string>, pokusane: Set<string>): Promise<string | null> {
  const kandidati = await baza
    .select({ rijec: rijeci.rijec })
    .from(rijeci)
    .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, prefiks)))
    .limit(500);
  const slobodne = kandidati
    .map((kandidat) => kandidat.rijec)
    .filter((rijec) => !iskoristene.has(rijec) && !pokusane.has(rijec));
  return slobodne[Math.floor(Math.random() * slobodne.length)] ?? null;
}

async function scenarijIgra(postavke: Postavke, tokeni: readonly string[]) {
  const baseline = await dohvatiHealth(postavke.adresa);
  const klijenti = await spojiUValovima(postavke, tokeni);
  const botPoIgracu = new Map<string, Klijent>();
  const igracPoSocketu = new Map<string, string>();
  const partijaPoIgracu = new Map<string, MjerenaPartija>();
  const partije = new Map<string, MjerenaPartija>();
  const greske: string[] = [...klijenti.greske];
  const pocetniBrojPartija = postavke.brojPartija;
  let zavrsenePartije = 0;

  const pronadjiPartiju = (partijaId: string): MjerenaPartija | undefined => partije.get(partijaId);
  const zakaziPotez = (partija: MjerenaPartija): void => {
    if (partija.zakazanPotez || partija.potezUObradi || !partija.naPotezuId || !partija.trazenaSlova || partija.krajMs !== null) return;
    const bot = botPoIgracu.get(partija.naPotezuId);
    if (!bot) return;
    const generacijaRunde = partija.generacijaRunde;
    const igracIdNaPotezu = partija.naPotezuId;
    partija.zakazanPotez = true;
    setTimeout(() => {
      if (partija.generacijaRunde !== generacijaRunde || partija.naPotezuId !== igracIdNaPotezu) return;
      partija.zakazanPotez = false;
      partija.potezUObradi = true;
      void (async () => {
        if (partija.generacijaRunde !== generacijaRunde || partija.naPotezuId !== igracIdNaPotezu) return;
        if (partija.odigraniPotezi >= MAKS_POTEZA_KONTROLIRANE_PARTIJE) {
          bot.socket.emit('potez:ne-znam');
          return;
        }
        const rijec = await pronadjiRijec(partija.trazenaSlova!, partija.iskoristene, partija.pokusane);
        if (!rijec) {
          bot.socket.emit('potez:ne-znam');
          return;
        }
        if (partija.generacijaRunde !== generacijaRunde || partija.naPotezuId !== igracIdNaPotezu) return;
        partija.pokusane.add(rijec);
        partija.poslanPotezMs.set(igracIdNaPotezu, performance.now());
        bot.socket.emit('potez:rijec', { rijec });
      })().catch((greska: unknown) => {
        const poruka = greska instanceof Error ? greska.message : String(greska);
        partija.greske.push(poruka);
        greske.push(poruka);
      });
    }, ODGODA_BOT_POTEZA_MS).unref();
  };

  for (const bot of klijenti.klijenti) {
    bot.socket.on('partija:pocetak', (poruka: PocetakPartije) => {
      botPoIgracu.set(poruka.mojIgracId, bot);
      igracPoSocketu.set(bot.socket.id ?? bot.token, poruka.mojIgracId);
      let partija = partije.get(poruka.partijaId);
      if (!partija) {
        partija = {
          partijaId: poruka.partijaId,
          igraci: new Set(poruka.sjedala.map((sjedalo) => sjedalo.igracId)),
          iskoristene: new Set(),
          pokusane: new Set(),
          naPotezuId: null,
          trazenaSlova: null,
          pocetakMs: performance.now(),
          poslanPotezMs: new Map(),
          poteziMs: [],
          spremanjeMs: null,
          krajMs: null,
          greske: [],
          odigraniPotezi: 0,
          zakazanPotez: false,
          potezUObradi: false,
          generacijaRunde: 0,
          timerCekaMs: null,
          timerDriftMs: [],
          timerTestirano: false,
        };
        partije.set(poruka.partijaId, partija);
      }
      for (const igracId of partija.igraci) partijaPoIgracu.set(igracId, partija);
    });

    bot.socket.on('partija:runda-otvorena', (poruka: RundaOtvorena) => {
      const igracId = igracPoSocketu.get(bot.socket.id ?? bot.token);
      const partija = igracId ? partijaPoIgracu.get(igracId) : undefined;
      if (!partija) return;
      partija.generacijaRunde += 1;
      partija.zakazanPotez = false;
      partija.potezUObradi = false;
      partija.naPotezuId = poruka.naPotezuId;
      partija.trazenaSlova = poruka.trazenaSlova;
      partija.pokusane.clear();
      if (
        postavke.timerTest &&
        !partija.timerTestirano &&
        partija.naPotezuId === igracId
      ) {
        partija.timerTestirano = true;
        partija.timerCekaMs = performance.now() + Math.max(0, Date.parse(poruka.istekPotezaIso) - Date.now());
        return;
      }
      if (partija.naPotezuId === igracId) zakaziPotez(partija);
    });

    bot.socket.on('partija:eliminacija', (poruka: Eliminacija) => {
      const igracId = igracPoSocketu.get(bot.socket.id ?? bot.token);
      const partija = igracId ? partijaPoIgracu.get(igracId) : undefined;
      if (partija && partija.timerCekaMs !== null && poruka.razlog === 'istek') {
        partija.timerDriftMs.push(Math.abs(performance.now() - partija.timerCekaMs));
        partija.timerCekaMs = null;
      }
    });

    bot.socket.on('potez:prihvacen', (poruka: PrihvacenPotez) => {
      const partija = [...partije.values()].find((kandidat) => kandidat.igraci.has(poruka.igracId));
      if (!partija) return;
      partija.potezUObradi = false;
      const poslano = partija.poslanPotezMs.get(poruka.igracId);
      if (poslano !== undefined) {
        partija.poteziMs.push(performance.now() - poslano);
        partija.poslanPotezMs.delete(poruka.igracId);
      }
      partija.iskoristene.add(poruka.rijec);
      partija.odigraniPotezi += 1;
      partija.naPotezuId = poruka.sljedeciId;
      partija.trazenaSlova = poruka.trazenaSlova;
      partija.pokusane.clear();
      zakaziPotez(partija);
    });

    bot.socket.on('potez:odbijen', (poruka) => {
      const igracId = igracPoSocketu.get(bot.socket.id ?? bot.token);
      const partija = igracId ? partijaPoIgracu.get(igracId) : undefined;
      if (partija) {
        partija.potezUObradi = false;
        if (poruka.kod === 'RIJEC_ISKORISTENA') {
          zakaziPotez(partija);
          return;
        }
        const greska = `potez odbijen: ${poruka.kod}`;
        partija.greske.push(greska);
        greske.push(greska);
        zakaziPotez(partija);
      }
    });

    bot.socket.on('greska', (poruka) => {
      greske.push(`${poruka.kod}: ${poruka.poruka}`);
    });

    bot.socket.on('partija:spremanje-rezultata', (poruka: SpremanjeRezultataPartije) => {
      const partija = pronadjiPartiju(poruka.partijaId);
      if (partija && partija.spremanjeMs === null) partija.spremanjeMs = performance.now();
    });

    bot.socket.on('partija:kraj', (poruka: KrajPartije) => {
      const partija = pronadjiPartiju(poruka.partijaId);
      if (!partija || partija.krajMs !== null) return;
      partija.krajMs = performance.now();
      zavrsenePartije += 1;
    });
  }

  for (const bot of klijenti.klijenti) bot.socket.emit('red:udji');

  const cekanje = Date.now() + postavke.timeoutMs;
  let peak = baseline;
  let brojHealthUzoraka = 0;
  let sljedeciHealthUzorak = Date.now();
  while (zavrsenePartije < pocetniBrojPartija && Date.now() < cekanje && !signalPrekida?.aborted) {
    await odgodi(100);
    if (Date.now() < sljedeciHealthUzorak) continue;
    sljedeciHealthUzorak = Date.now() + 1_000;
    try {
      const uzorak = await dohvatiHealth(postavke.adresa);
      peak = {
        aktivnePartije: Math.max(peak.aktivnePartije, uzorak.aktivnePartije),
        aktivneVeze: Math.max(peak.aktivneVeze, uzorak.aktivneVeze),
        rssBajtovi: Math.max(peak.rssBajtovi, uzorak.rssBajtovi),
        heapUsedBajtovi: Math.max(peak.heapUsedBajtovi, uzorak.heapUsedBajtovi),
      };
      brojHealthUzoraka += 1;
    } catch (greska) {
      greske.push(greska instanceof Error ? greska.message : String(greska));
      break;
    }
  }

  if (brojHealthUzoraka === 0 && !signalPrekida?.aborted) {
    peak = await dohvatiHealth(postavke.adresa);
    brojHealthUzoraka = 1;
  }
  odspojiSve(klijenti.klijenti);
  await odgodi(postavke.cekanjeCiscenjaMs);
  const finalno = await dohvatiHealth(postavke.adresa);
  const svePartije = [...partije.values()];
  const svaVremenaSpremanja = svePartije.flatMap((partija) => partija.spremanjeMs !== null && partija.krajMs !== null ? [partija.krajMs - partija.spremanjeMs] : []);
  const svaVremenaPoteza = svePartije.flatMap((partija) => partija.poteziMs);
  const ukupnoPoteza = svePartije.reduce((ukupno, partija) => ukupno + partija.odigraniPotezi, 0);
  const timerUzorci = svePartije.flatMap((partija) => partija.timerDriftMs);
  const stopaGresaka = greske.length / Math.max(1, ukupnoPoteza + klijenti.trajanja.length);
  const provjere = {
    svePartijeZavrsile: zavrsenePartije === pocetniBrojPartija && svePartije.length === pocetniBrojPartija,
    stopaGresaka: stopaGresaka <= postavke.maksStopaGresaka,
    imaPrihvacenihPoteza: ukupnoPoteza > 0 && svaVremenaPoteza.length > 0,
    p95Potez: svaVremenaPoteza.length > 0 && percentil(svaVremenaPoteza, 0.95) <= postavke.p95PotezMs,
    p95Spremanje: svaVremenaSpremanja.length === zavrsenePartije && svaVremenaSpremanja.length > 0 && percentil(svaVremenaSpremanja, 0.95) <= postavke.p95SpremanjeMs,
    nemaAktivnihPartija: finalno.aktivnePartije <= postavke.maksAktivnihPartijaNakonCiscenja,
    memorija: (finalno.rssBajtovi - baseline.rssBajtovi) / 1024 / 1024 <= postavke.maksRssDeltaMb,
    timer: !postavke.timerTest || (
      svePartije.length === pocetniBrojPartija &&
      svePartije.every((partija) => partija.timerDriftMs.length > 0 && percentil(partija.timerDriftMs, 0.95) <= 250)
    ),
    imaHealthUzorke: brojHealthUzoraka > 0,
  };
  return {
    baseline,
    peak,
    finalno,
    planiranePartije: pocetniBrojPartija,
    zavrsenePartije,
    igraciUPartijama: pocetniBrojPartija * 4,
    ukupnoPoteza,
    brojGresaka: greske.length,
    stopaGresaka,
    p95PotezMs: percentil(svaVremenaPoteza, 0.95),
    p95SpremanjeMs: percentil(svaVremenaSpremanja, 0.95),
    p95TimerDriftMs: percentil(svePartije.flatMap((partija) => partija.timerDriftMs), 0.95),
    timerTestirano: svePartije.some((partija) => partija.timerDriftMs.length > 0),
    brojTimerUzoraka: timerUzorci.length,
    brojHealthUzoraka,
    provjere,
    greske: greske.slice(0, 20),
  };
}

async function glavno(): Promise<void> {
  const postavke = ucitajPostavke();
  if (postavke.stagingTest) {
    await provjeriPrethodnuRazinuStagingTesta(postavke.adresa, postavke.brojKlijenata);
  }
  const oslobodiZakljucavanje = postavke.stagingTest
    ? await zakljucajStagingTest(postavke.adresa)
    : undefined;
  const kontrolerPrekida = postavke.stagingTest ? new AbortController() : undefined;
  const prekini = () => {
    if (!kontrolerPrekida || kontrolerPrekida.signal.aborted) return;
    kontrolerPrekida.abort();
    odspojiSveOtvorene();
    console.error('Prekidam test i zatvaram sve otvorene veze...');
  };
  const pocetak = performance.now();
  let stagingTestIshod: 'PASS' | 'FAIL' | 'ABORTED' = 'FAIL';
  rokStagingTestaMs = postavke.stagingTest
    ? Date.now() + MAKS_TRAJANJE_STAGING_TESTA_MS
    : undefined;

  signalPrekida = kontrolerPrekida?.signal;
  if (kontrolerPrekida) {
    process.once('SIGINT', prekini);
    process.once('SIGTERM', prekini);
  }
  try {
    const tokeni = Array.from(
      { length: postavke.brojKlijenata },
      () => `gost.${randomUUID().replaceAll('-', '')}`,
    );
    console.log(
      `Scenarij=${postavke.scenarij} adresa=${postavke.adresa} klijenti=${postavke.brojKlijenata} idle=${postavke.brojIdleKlijenata}`,
    );
    const rezultat =
      postavke.scenarij === 'veze'
        ? await scenarijVeze(postavke, tokeni)
        : postavke.scenarij === 'red'
          ? await scenarijRed(postavke, tokeni)
          : postavke.scenarij === 'reconnect'
            ? await scenarijReconnect(postavke, tokeni)
            : await scenarijIgra(postavke, tokeni);

    console.log(
      JSON.stringify(
        {
          vrijeme: new Date().toISOString(),
          ukupnoTrajanjeMs: Math.round(performance.now() - pocetak),
          postavke,
          rezultat,
        },
        null,
        2,
      ),
    );

    if (postavke.scenarij === 'veze') {
      const rezultatVeza = rezultat as {
        brojGresaka: number;
        brojPokusaja: number;
        stopaGresaka: number;
        provjere: Record<string, boolean>;
      };
      for (const [naziv, prolaz] of Object.entries(rezultatVeza.provjere)) {
        console.log(`${prolaz ? 'PASS' : 'FAIL'} ${naziv}`);
      }
      const prosao = Object.values(rezultatVeza.provjere).every(Boolean);
      if (postavke.stagingTest) stagingTestIshod = prosao ? 'PASS' : 'FAIL';
      if (!prosao) {
        console.error('Load test nije održao zadani broj aktivnih veza ili trajanje.');
        process.exitCode = 1;
      }
    } else if (postavke.scenarij === 'igra') {
      const provjere = (rezultat as { provjere: Record<string, boolean> }).provjere;
      const neuspjesne = Object.entries(provjere).filter(([, prolaz]) => !prolaz).map(([naziv]) => naziv);
      for (const [naziv, prolaz] of Object.entries(provjere)) {
        console.log(`${prolaz ? 'PASS' : 'FAIL'} ${naziv}`);
      }
      if (neuspjesne.length > 0) {
        console.error(`Load test nije prošao: ${neuspjesne.join(', ')}`);
        process.exitCode = 1;
      }
    } else {
      const brojGresaka = (rezultat as { brojGresaka?: number }).brojGresaka ?? 0;
      const brojPokusaja = (rezultat as { brojPokusaja?: number }).brojPokusaja ?? postavke.brojKlijenata;
      const stopaGresaka = brojGresaka / Math.max(1, brojPokusaja);
      const prosao = stopaGresaka <= postavke.maksStopaGresaka;
      console.log(`${prosao ? 'PASS' : 'FAIL'} stopaGresaka (${stopaGresaka.toFixed(4)} <= ${postavke.maksStopaGresaka})`);
      if (!prosao) {
        console.error('Load test nije prošao prag stope grešaka.');
        process.exitCode = 1;
      }
    }
    if (kontrolerPrekida?.signal.aborted) {
      stagingTestIshod = 'ABORTED';
      process.exitCode = 130;
    }
  } catch (greska) {
    if (!kontrolerPrekida?.signal.aborted) {
      stagingTestIshod = 'FAIL';
      throw greska;
    }
    stagingTestIshod = 'ABORTED';
    process.exitCode = 130;
  } finally {
    process.off('SIGINT', prekini);
    process.off('SIGTERM', prekini);
    signalPrekida = undefined;
    rokStagingTestaMs = undefined;
    odspojiSveOtvorene();
    try {
      if (postavke.stagingTest) {
        await zabiljeziRezultatStagingTesta(
          postavke.adresa,
          postavke.brojKlijenata,
          stagingTestIshod,
        );
      }
    } finally {
      await oslobodiZakljucavanje?.();
    }
  }
}

glavno()
  .catch((greska) => {
    console.error(greska instanceof Error ? greska.message : greska);
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());
