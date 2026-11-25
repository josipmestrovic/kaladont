/**
 * Globalno reaktivno stanje igre - slušatelji se registriraju jednom (u root layoutu)
 * jer partija:pocetak stiže dok je korisnik još na /red, prije nego /partija/[id] postoji.
 * HINT PR14: faza/dokaz/pravila dolaze sa snimke — UI ne sudi iz broja avatara.
 */
import type {
  BrzaPoruka,
  DokazZatrazen,
  Eliminacija,
  FazaPoteza,
  KrajPartije,
  NagradaZaRijec,
  NovoDostignuceTijekomPartije,
  ObracunIskustvaTijekomPartije,
  OtkljucavanjeRijeci,
  PocetakPartije,
  PravilnikPartije,
  SnimkaDokaza,
  StavkaIskustva,
  StanjePartije,
  TreningNeaktivnost,
} from 'zajednicko';
import { pustiAudio, zaustaviSveZvukove, type AudioDogadaj } from './audio-manager.js';
import { pocetniGoalProgressIzazova } from './izazovi-klijent.js';
import { dohvatiSocket, oznaciPartijuDostupnom } from './socket.js';
import { biljeziPasivniServerVrijeme, sinkronizirajPartiju } from './sinkronizacija-partije.js';
import { normalizirajIstekPotezaIso, timerAktivanIzSnimke } from './timer-poteza.js';
import {
  dogadajPripadaAktivnojPartiji,
  trebamJednokratniEfekt,
  trebaPrimijenitiSnimku,
} from './verzija-stanja-partije.js';

interface StanjeIgre {
  partijaId: string | null;
  mojIgracId: string | null;
  sjedala: PocetakPartije['sjedala'];
  turnToken: string | null;
  verzijaStanja: number;
  naPotezuId: string | null;
  trazenaSlova: string | null;
  istekPotezaIso: string | null;
  serverVrijemeIso: string;
  /** Kada partija kreće — čekaonica odbrojava do ovog trenutka; null kad nema najavljene partije. */
  pocetakPartijeIso: string | null;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  zadnjaEliminacija: Eliminacija | null;
  poruka: string | null;
  kraj: KrajPartije | null;
  ponistenaPoruka: string | null;
  statusSpremanja: 'nije_zavrsena' | 'spremanje_rezultata' | 'rezultati_spremljeni';
  rezultatiPrikazaniPartijaId: string | null;
  obracunIskustva: ObracunIskustvaTijekomPartije | null;
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
  zadnjaRijec: string | null;
  zadnjaRijecIgracId: string | null;
  zadnjaRijecVrsta: 'rijec' | 'sustav_rijec' | null;
  mod: import('zajednicko').ModPartije | null;
  /** Izvršni pravilnik stola; null dok nije poznat. */
  pravila: PravilnikPartije | null;
  spojeniDvoboj: boolean;
  /** PR14: obican_potez | dokaz_nastavka | sustav_bira | zavrsena */
  faza: FazaPoteza | null;
  /** Aktivni dokaz; null izvan faze dokaz_nastavka. */
  dokaz: SnimkaDokaza | null;
  /** Kratka banner poruka nakon ishoda dokaza (uspjeh/neuspjeh). */
  ishodDokazaPoruka: string | null;
  kontekst: 'javna' | 'privatna' | 'trening' | 'izazov' | null;
  treningNeaktivnost: Omit<TreningNeaktivnost, 'partijaId'> | null;
  jePrivatna: boolean;
  kodSobe: string | null;
  trajanjePotezaSek: number | null;
  /** PR05: serverski napredak ciljeva (samo kontekst izazov). */
  goalProgress: import('zajednicko').GoalProgressIzazova | null;
  /** PR05: terminalni ishod pokušaja (reconnect / nakon kraja). */
  izazovTerminal: NonNullable<import('zajednicko').StanjePartije['izazovTerminal']> | null;
  /** Zadnji challengeId za CTA na rezultatu. */
  izazovChallengeId: import('zajednicko').IdIzazova | null;
  /** Autoritativni metadata kampanje (panel uvjeta). */
  izazovMeta: import('zajednicko').IzazovPartijaMeta | null;
  zadnjaNagrada: NagradaZaRijec | null;
  oznakaPrihvacenogPoteza: number;
  trenutniStreak: number;
  stavkeIskustva: StavkaIskustva[];
  oznakaStavkiIskustva: number;
  novaDostignucaTijekomPartije: NovoDostignuceTijekomPartije['dostignuca'];
  oznakaNovaDostignuca: number;
  otkljucavanjeRijeci: OtkljucavanjeRijeci | null;
  oznakaOtkljucavanjaRijeci: number;
  intenzitetKonfetaIskustva: 'mali' | 'srednji' | 'veliki' | null;
  oznakaKonfetaIskustva: number;
}

const stanje = $state<StanjeIgre>({
  partijaId: null,
  mojIgracId: null,
  sjedala: [],
  turnToken: null,
  verzijaStanja: 0,
  naPotezuId: null,
  trazenaSlova: null,
  istekPotezaIso: null,
  serverVrijemeIso: new Date().toISOString(),
  pocetakPartijeIso: null,
  runda: 0,
  brojIskoristenih: 0,
  eliminacije: [],
  zadnjaEliminacija: null,
  poruka: null,
  kraj: null,
  ponistenaPoruka: null,
  statusSpremanja: 'nije_zavrsena',
  rezultatiPrikazaniPartijaId: null,
  obracunIskustva: null,
  sustavBiraRijec: false,
  istekIzboraIso: null,
  zadnjaRijec: null,
  zadnjaRijecIgracId: null,
  zadnjaRijecVrsta: null,
  mod: null,
  pravila: null,
  spojeniDvoboj: false,
  faza: null,
  dokaz: null,
  ishodDokazaPoruka: null,
  kontekst: null,
  treningNeaktivnost: null,
  jePrivatna: false,
  kodSobe: null,
  trajanjePotezaSek: null,
  goalProgress: null,
  izazovTerminal: null,
  izazovChallengeId: null,
  izazovMeta: null,
  zadnjaNagrada: null,
  oznakaPrihvacenogPoteza: 0,
  trenutniStreak: 0,
  stavkeIskustva: [],
  oznakaStavkiIskustva: 0,
  novaDostignucaTijekomPartije: [],
  oznakaNovaDostignuca: 0,
  otkljucavanjeRijeci: null,
  oznakaOtkljucavanjaRijeci: 0,
  intenzitetKonfetaIskustva: null,
  oznakaKonfetaIskustva: 0,
});

let pokrenuto = false;
/** True nakon dobrovoljnog izlaska dok ne stigne nova partija:pocetak — blokira SFX i stale socket evente. */
let napustioPartiju = false;
/** Dedupe: runda-otvorena (runda 1) može stići više puta; pocetak-partije samo jednom po partiji. */
let odsviranPocetakZaPartijuId: string | null = null;
/** HINT PR14 reconnect: ne sviraj elim SFX ponovo za isti izazovId. */
let zadnjiDokazIzazovId: string | null = null;
let brojOdbijenihNaPotezu = 0;
let timerIshodDokaza: ReturnType<typeof setTimeout> | null = null;
let timerZadrziDokaz: ReturnType<typeof setTimeout> | null = null;
/** Klijentski hold: min. prikaz „dokazuje…” prije ishoda (brzi botovi). */
let dokazPrikazanOdMs: number | null = null;
const MIN_PRIKAZ_DOKAZA_MS = 2_500;
const MIN_PRIKAZ_ISHODA_MS = 2_000;
let timerStavkiIskustva: ReturnType<typeof setTimeout> | null = null;
let timerNagradePoteza: ReturnType<typeof setTimeout> | null = null;
let timerNovaDostignuca: ReturnType<typeof setTimeout> | null = null;
let timerKonfetaIskustva: ReturnType<typeof setTimeout> | null = null;
/** #142 C: dedup jednokratnih efekata (zvuk/XP/konfete) po dogadajId. */
const vidjeniDogadajiEfekata = new Set<string>();

function ocistiDokazHold(): void {
  if (timerZadrziDokaz) clearTimeout(timerZadrziDokaz);
  timerZadrziDokaz = null;
  dokazPrikazanOdMs = null;
}

/** Zadrži UI dokazivanja min. MIN_PRIKAZ_DOKAZA_MS, zatim izvrši zatvaranje + ishod. */
function zatvoriDokazNakonHold(zatvori: () => void): void {
  const otvorenMs = dokazPrikazanOdMs ?? Date.now();
  const preostalo = Math.max(0, MIN_PRIKAZ_DOKAZA_MS - (Date.now() - otvorenMs));
  if (timerZadrziDokaz) clearTimeout(timerZadrziDokaz);
  if (preostalo === 0) {
    dokazPrikazanOdMs = null;
    zatvori();
    return;
  }
  timerZadrziDokaz = setTimeout(() => {
    timerZadrziDokaz = null;
    dokazPrikazanOdMs = null;
    zatvori();
  }, preostalo);
}

function pokreniKonfete(intenzitet: 'mali' | 'srednji' | 'veliki', trajanjeMs = 3_200): void {
  stanje.intenzitetKonfetaIskustva = intenzitet;
  stanje.oznakaKonfetaIskustva += 1;
  if (timerKonfetaIskustva) clearTimeout(timerKonfetaIskustva);
  timerKonfetaIskustva = setTimeout(() => {
    stanje.intenzitetKonfetaIskustva = null;
    timerKonfetaIskustva = null;
  }, trajanjeMs);
}

/** Konfeti za duge/rijetke: XP stavke ili nagrada ovog poteza (bez stale otkljucavanjeRijeci). */
function prikaziKonfeteZaPotez(
  stavke: readonly StavkaIskustva[],
  nagrada: NagradaZaRijec | null,
): void {
  const najjaca = Math.max(
    ...stavke
      .filter((stavka) => stavka.vrsta === 'duge_rijeci' || stavka.vrsta === 'rijetke_rijeci')
      .map((stavka) => stavka.iskustvo),
    0,
  );
  if (najjaca > 0) {
    pokreniKonfete(najjaca >= 35 ? 'veliki' : najjaca >= 20 ? 'srednji' : 'mali');
    return;
  }
  if (nagrada?.intenzitet) {
    pokreniKonfete(nagrada.intenzitet);
  }
}

function prikaziKonfeteKaladont(): void {
  pokreniKonfete('veliki', 4_000);
}

function prikaziStavkeIskustva(stavke: readonly StavkaIskustva[]): void {
  stanje.stavkeIskustva = [...stavke];
  stanje.oznakaStavkiIskustva += 1;
  if (timerStavkiIskustva) clearTimeout(timerStavkiIskustva);
  if (stavke.length === 0) {
    timerStavkiIskustva = null;
    return;
  }
  if (timerNagradePoteza) clearTimeout(timerNagradePoteza);
  timerNagradePoteza = setTimeout(() => {
    stanje.stavkeIskustva = [];
    stanje.otkljucavanjeRijeci = null;
    timerStavkiIskustva = null;
    timerNagradePoteza = null;
  }, 5_000);
  timerStavkiIskustva = timerNagradePoteza;
}

function prikaziNovaDostignuca(dostignuca: NovoDostignuceTijekomPartije['dostignuca']): void {
  stanje.novaDostignucaTijekomPartije = [...dostignuca];
  stanje.oznakaNovaDostignuca += 1;
  if (timerNovaDostignuca) clearTimeout(timerNovaDostignuca);
  timerNovaDostignuca = setTimeout(() => {
    stanje.novaDostignucaTijekomPartije = [];
    timerNovaDostignuca = null;
  }, 5_000);
}

function pustiOdbijanje(): void {
  brojOdbijenihNaPotezu += 1;
  const redniBroj = brojOdbijenihNaPotezu <= 2 ? 1 : brojOdbijenihNaPotezu <= 4 ? 2 : 3;
  pustiAudio(`potez-odbijen-${redniBroj}` as AudioDogadaj);
}

function primijeniFazuIzSnimke(p: Pick<StanjePartije, 'faza' | 'dokaz' | 'sustavBiraRijec' | 'zavrsena'>): void {
  if (p.faza) {
    stanje.faza = p.faza;
  } else if (p.zavrsena) {
    stanje.faza = 'zavrsena';
  } else if (p.sustavBiraRijec) {
    stanje.faza = 'sustav_bira';
  } else if (p.dokaz) {
    stanje.faza = 'dokaz_nastavka';
  } else {
    stanje.faza = 'obican_potez';
  }
  const noviDokaz = p.dokaz ?? null;
  if (noviDokaz?.izazovId && noviDokaz.izazovId !== zadnjiDokazIzazovId) {
    dokazPrikazanOdMs = Date.now();
  }
  stanje.dokaz = noviDokaz;
  if (noviDokaz?.izazovId) zadnjiDokazIzazovId = noviDokaz.izazovId;
}

function primijeniStanjePartije(p: StanjePartije): void {
  if (napustioPartiju) return;
  const odluka = trebaPrimijenitiSnimku({
    aktivnaPartijaId: stanje.partijaId,
    snimkaPartijaId: p.partijaId,
    lokalnaVerzija: stanje.verzijaStanja,
    snimkaVerzija: p.verzijaStanja,
  });
  if (odluka === 'odbaci_stranu') return;
  const novaVerzija = p.verzijaStanja ?? 0;
  if (odluka === 'odbaci_staru') {
    // Starija snimka ne pregazi noviju (C01); sat se smije osvježiti.
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    return;
  }
  if (odluka === 'ista_verzija') {
    // C05: ista verzija ne smije dirati turnToken/prefiks (unos); osvježi sat i terminal.
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    biljeziPasivniServerVrijeme(p.serverVrijemeIso);
    stanje.statusSpremanja = p.statusSpremanja;
    if (p.zavrsena) primijeniFazuIzSnimke(p);
    if (p.goalProgress) stanje.goalProgress = p.goalProgress;
    if (p.izazovTerminal) stanje.izazovTerminal = p.izazovTerminal;
    if (p.treningNeaktivnost !== undefined) stanje.treningNeaktivnost = p.treningNeaktivnost ?? null;
    oznaciPartijuDostupnom();
    return;
  }
  oznaciPartijuDostupnom();
  biljeziPasivniServerVrijeme(p.serverVrijemeIso);
  // HINT PR14/Bugbot: uspješan dokaz kad je čekač već otišao dolazi samo kao
  // partija:stanje (zakrpljeni bodZa), bez nove partija:eliminacija — banner ovdje.
  const prethodniDokaz = stanje.dokaz;
  const stariBodZaCekatelja =
    prethodniDokaz?.cekateljVecIspao === true
      ? (stanje.eliminacije.find((e) => e.igracId === prethodniDokaz.cekateljId)?.bodZa ?? null)
      : undefined;
  stanje.partijaId = p.partijaId;
  // Ne briši početni rok preuranjenim snapshotom runde 0 — reconnect mora obnoviti odbrojavanje.
  if (p.runda === 0 && p.istekIzboraIso) {
    stanje.pocetakPartijeIso = p.istekIzboraIso;
  } else if (p.runda > 0) {
    stanje.pocetakPartijeIso = null;
  }
  stanje.mojIgracId = p.mojIgracId;
  stanje.sjedala = p.sjedala;
  stanje.turnToken = p.turnToken ?? null;
  if (novaVerzija > 0) stanje.verzijaStanja = novaVerzija;
  stanje.naPotezuId = p.naPotezuId;
  stanje.trazenaSlova = p.trazenaSlova;
  stanje.istekPotezaIso = normalizirajIstekPotezaIso(p.istekPotezaIso);
  stanje.serverVrijemeIso = p.serverVrijemeIso;
  stanje.runda = p.runda;
  stanje.brojIskoristenih = p.brojIskoristenih;
  stanje.eliminacije = p.eliminacije;
  stanje.zadnjaEliminacija = p.eliminacije.at(-1) ?? null;
  stanje.sustavBiraRijec = p.sustavBiraRijec;
  stanje.istekIzboraIso = p.istekIzboraIso;
  stanje.zadnjaRijec = p.zadnjaRijec;
  stanje.zadnjaRijecIgracId = p.zadnjaRijecIgracId;
  stanje.zadnjaRijecVrsta = p.zadnjaRijecVrsta;
  stanje.statusSpremanja = p.statusSpremanja;
  stanje.treningNeaktivnost = p.treningNeaktivnost ?? null;
  stanje.zadnjaNagrada = null;
  stanje.mod = p.mod ?? null;
  stanje.pravila = p.pravila ?? null;
  stanje.spojeniDvoboj = Boolean(p.spojeniDvoboj);
  primijeniFazuIzSnimke(p);
  stanje.kontekst = p.kontekst ?? (p.jePrivatna ? 'privatna' : 'javna');
  stanje.jePrivatna = Boolean(p.jePrivatna);
  stanje.kodSobe = p.kodSobe ?? null;
  stanje.trajanjePotezaSek = p.trajanjePotezaSek ?? null;
  // Ako timer nije aktivan, rok mora biti null (ne prazan string / lažni prijelaz).
  if (!timerAktivanIzSnimke({
    timerAktivan: p.timerAktivan,
    istekPotezaIso: stanje.istekPotezaIso,
    trajanjePotezaSek: stanje.trajanjePotezaSek,
    faza: stanje.faza,
  })) {
    stanje.istekPotezaIso = null;
  }
  if (stanje.kontekst === 'izazov') {
    if (p.izazov) {
      stanje.izazovMeta = p.izazov;
      stanje.izazovChallengeId = p.izazov.challengeId;
    }
    if (p.goalProgress !== undefined) {
      const challengeId = p.izazov?.challengeId ?? stanje.izazovMeta?.challengeId;
      stanje.goalProgress =
        p.goalProgress ??
        (challengeId ? pocetniGoalProgressIzazova(challengeId) : null);
    }
    if (p.izazovTerminal !== undefined) stanje.izazovTerminal = p.izazovTerminal ?? null;
  } else {
    stanje.goalProgress = null;
    stanje.izazovTerminal = null;
    stanje.izazovMeta = null;
  }

  if (
    prethodniDokaz?.cekateljVecIspao === true &&
    stariBodZaCekatelja == null &&
    !p.dokaz
  ) {
    const elim = p.eliminacije.find(
      (e) => e.igracId === prethodniDokaz.cekateljId && e.bodZa === prethodniDokaz.autorId,
    );
    if (elim) {
      // Kredit-snimka je PRIJE sustav-bira ili zakljuciPartiju (ako ≤1 aktivan).
      const porukaIshoda = `${nadimakIgraca(prethodniDokaz.autorId)} je dokazao nastavak.`;
      // #142 E: ne zaključuj lokalno iz broja sjedala.
      const zavrsavaSe = p.zavrsena === true;
      stanje.dokaz = prethodniDokaz;
      stanje.faza = 'dokaz_nastavka';
      stanje.sustavBiraRijec = false;
      zatvoriDokazNakonHold(() => {
        stanje.dokaz = null;
        if (zavrsavaSe) {
          stanje.faza = 'zavrsena';
          stanje.sustavBiraRijec = false;
          if (stanje.statusSpremanja === 'nije_zavrsena') {
            stanje.statusSpremanja = 'spremanje_rezultata';
          }
        } else {
          stanje.faza = 'sustav_bira';
          stanje.sustavBiraRijec = true;
        }
        zapisiIshodDokaza(porukaIshoda);
      });
      if (elim.bodZa === stanje.mojIgracId && elim.iskustvo) {
        prikaziStavkeIskustva([elim.iskustvo]);
      }
    }
  } else if (prethodniDokaz && !p.dokaz && dokazPrikazanOdMs !== null && !p.zavrsena) {
    // Brzi bot / reconnect: zadrži snimku za hold. Ne poništavaj postojeći timer
    // (eliminacija već zakazala zatvaranje s ishod porukom).
    stanje.dokaz = prethodniDokaz;
    stanje.faza = 'dokaz_nastavka';
    stanje.sustavBiraRijec = false;
    if (!timerZadrziDokaz) {
      const sljedecaFaza = p.sustavBiraRijec ? ('sustav_bira' as const) : ('obican_potez' as const);
      const sustavBira = p.sustavBiraRijec;
      zatvoriDokazNakonHold(() => {
        stanje.dokaz = null;
        stanje.faza = sljedecaFaza;
        stanje.sustavBiraRijec = sustavBira;
      });
    }
  }
}

function primijeniDokazZatrazen(p: DokazZatrazen): void {
  if (napustioPartiju) return;
  if (p.partijaId !== stanje.partijaId) return;
  // HINT: reconnect može ponoviti isti izazov — bez dvostrukog SFX/poruke.
  if (zadnjiDokazIzazovId === p.izazovId && stanje.faza === 'dokaz_nastavka') {
  stanje.turnToken = p.turnToken;
  stanje.naPotezuId = p.naPotezuId;
  stanje.istekPotezaIso = p.istekPotezaIso;
  stanje.serverVrijemeIso = p.serverVrijemeIso;
  stanje.trazenaSlova = p.trazenaSlova;
  if (p.trajanjePotezaSek !== undefined) stanje.trajanjePotezaSek = p.trajanjePotezaSek;
  return;
  }
  zadnjiDokazIzazovId = p.izazovId;
  ocistiDokazHold();
  dokazPrikazanOdMs = Date.now();
  stanje.faza = 'dokaz_nastavka';
  stanje.sustavBiraRijec = false;
  stanje.ishodDokazaPoruka = null;
  stanje.dokaz = {
    izazovId: p.izazovId,
    izvornaRijec: p.izvornaRijec,
    trazenaSlova: p.trazenaSlova,
    autorId: p.autorId,
    cekateljId: p.cekateljId,
    razlogOtvaranja: p.razlogOtvaranja,
    cekateljVecIspao: p.cekateljVecIspao,
    pocetakIso: p.serverVrijemeIso,
    istekPotezaIso: p.istekPotezaIso,
  };
  stanje.turnToken = p.turnToken;
  stanje.naPotezuId = p.naPotezuId;
  stanje.istekPotezaIso = p.istekPotezaIso;
  stanje.serverVrijemeIso = p.serverVrijemeIso;
  stanje.trazenaSlova = p.trazenaSlova;
  if (p.trajanjePotezaSek !== undefined) stanje.trajanjePotezaSek = p.trajanjePotezaSek;
  if (p.naPotezuId === stanje.mojIgracId) {
    brojOdbijenihNaPotezu = 0;
    pustiAudio('tvoj-red');
  }
}

function zapisiIshodDokaza(poruka: string): void {
  stanje.ishodDokazaPoruka = poruka;
  if (timerIshodDokaza) clearTimeout(timerIshodDokaza);
  timerIshodDokaza = setTimeout(() => {
    stanje.ishodDokazaPoruka = null;
    timerIshodDokaza = null;
  }, MIN_PRIKAZ_ISHODA_MS);
}

function nadimakIgraca(igracId: string | null | undefined): string {
  if (!igracId) return 'Igrač';
  return stanje.sjedala.find((s) => s.igracId === igracId)?.nadimak ?? 'Igrač';
}

export function pokreniSlusateljeIgre(): void {
  if (pokrenuto) return;
  pokrenuto = true;
  const socket = dohvatiSocket();

  socket.on('reakcija:nova', (p: { partijaId?: string; igracId: string; poruka: BrzaPoruka }) => {
    if (napustioPartiju) return;
    const partijaId = p.partijaId ?? stanje.partijaId;
    if (!partijaId) return;
    // Buffer dok stol nije mountan — partija page potroši preuzmiPendingReakcije.
    if (typeof window !== 'undefined' && !window.location.pathname.includes(`/partija/${partijaId}`)) {
      spremiPendingReakciju(partijaId, p.igracId, p.poruka);
    }
  });

  socket.on('partija:pocetak', (p) => {
    napustioPartiju = false;
    odsviranPocetakZaPartijuId = null;
    zadnjiDokazIzazovId = null;
    pendingReakcije = pendingReakcije.filter((r) => r.partijaId === p.partijaId);
    oznaciPartijuDostupnom();
    brojOdbijenihNaPotezu = 0;
    stanje.partijaId = p.partijaId;
    stanje.mojIgracId = p.mojIgracId;
    stanje.sjedala = p.sjedala;
    stanje.turnToken = null;
    stanje.verzijaStanja = 0;
    vidjeniDogadajiEfekata.clear();
    stanje.naPotezuId = null;
    stanje.istekPotezaIso = null;
    stanje.serverVrijemeIso = new Date().toISOString();
    stanje.pocetakPartijeIso = p.pocetakIso;
    stanje.runda = 0;
    stanje.trazenaSlova = null;
    stanje.brojIskoristenih = 0;
    stanje.eliminacije = [];
    stanje.zadnjaEliminacija = null;
    stanje.kraj = null;
    stanje.ponistenaPoruka = null;
    stanje.statusSpremanja = 'nije_zavrsena';
    stanje.rezultatiPrikazaniPartijaId = null;
    stanje.obracunIskustva = null;
    stanje.zadnjaNagrada = null;
    stanje.trenutniStreak = 0;
    prikaziStavkeIskustva([]);
    prikaziNovaDostignuca([]);
    stanje.intenzitetKonfetaIskustva = null;
    if (timerKonfetaIskustva) clearTimeout(timerKonfetaIskustva);
    timerKonfetaIskustva = null;
    stanje.poruka = null;
    // Pre-start: blokiraj unos; UI razlikuje početni overlay od međurundi preko runda === 0.
    stanje.sustavBiraRijec = true;
    stanje.istekIzboraIso = p.pocetakIso;
    stanje.faza = 'sustav_bira';
    stanje.zadnjaRijec = null;
    stanje.zadnjaRijecIgracId = null;
    stanje.zadnjaRijecVrsta = null;
    stanje.mod = p.mod ?? null;
    stanje.pravila = p.pravila ?? null;
    stanje.spojeniDvoboj = Boolean(p.spojeniDvoboj);
    ocistiDokazHold();
    if (timerIshodDokaza) clearTimeout(timerIshodDokaza);
    timerIshodDokaza = null;
    stanje.dokaz = null;
    stanje.ishodDokazaPoruka = null;
    stanje.kontekst = p.kontekst ?? (p.jePrivatna ? 'privatna' : 'javna');
    stanje.treningNeaktivnost = null;
    stanje.jePrivatna = Boolean(p.jePrivatna);
    stanje.kodSobe = p.kodSobe ?? null;
    // Mora stići prije prvog potez:prihvacen — inače prazan istek izgleda kao ubojita riječ.
    stanje.trajanjePotezaSek = p.trajanjePotezaSek ?? null;
    stanje.izazovTerminal = null;
    if (p.izazov) {
      stanje.izazovMeta = p.izazov;
      stanje.izazovChallengeId = p.izazov.challengeId;
      // Odmah katalogski uvjeti — ne čekaj prvi potez / partija:stanje.
      stanje.goalProgress =
        p.goalProgress ?? pocetniGoalProgressIzazova(p.izazov.challengeId);
    } else if (stanje.kontekst !== 'izazov') {
      stanje.izazovMeta = null;
      stanje.goalProgress = null;
    } else {
      stanje.goalProgress = p.goalProgress ?? null;
    }
  });

  socket.on('partija:stanje', primijeniStanjePartije);
  socket.on('dokaz:zatrazen', primijeniDokazZatrazen);

  // HINT PR14/PR05 e2e: Playwright može injektirati dokaz / stanje / kraj bez pravog server eventa.
  if (typeof window !== 'undefined') {
    const e2eEmit = (event: string, data: unknown) => {
      if (event === 'dokaz:zatrazen') primijeniDokazZatrazen(data as DokazZatrazen);
      if (event === 'partija:stanje') primijeniStanjePartije(data as StanjePartije);
      if (event === 'partija:kraj') {
        const p = data as import('zajednicko').KrajPartije;
        stanje.partijaId = p.partijaId;
        stanje.kraj = p;
        stanje.kontekst = p.kontekst ?? stanje.kontekst;
        stanje.statusSpremanja = 'rezultati_spremljeni';
        stanje.rezultatiPrikazaniPartijaId = p.partijaId;
        if (p.kontekst === 'izazov' && p.izazovSettlement) {
          /* terminal može doći posebnim partija:stanje emitom */
        }
      }
    };
    (window as unknown as { __KALADONT_E2E_EMIT__?: typeof e2eEmit }).__KALADONT_E2E_EMIT__ = e2eEmit;
    window.addEventListener('kaladont:dokaz-zatrazen', ((ev: CustomEvent<DokazZatrazen>) => {
      primijeniDokazZatrazen(ev.detail);
    }) as EventListener);
  }

  socket.on('trening:neaktivnost', (p) => {
    if (p.partijaId !== stanje.partijaId) return;
    stanje.treningNeaktivnost = { upozorenjeIso: p.upozorenjeIso, zatvaraIso: p.zatvaraIso, upozorenje: p.upozorenje };
  });

  socket.on('partija:spremanje-rezultata', (p) => {
    if (p.partijaId !== stanje.partijaId) return;
    stanje.statusSpremanja = 'spremanje_rezultata';
    stanje.poruka = p.poruka;
  });

  socket.on('partija:ponistena', (p) => {
    if (p.partijaId !== stanje.partijaId) return;
    stanje.ponistenaPoruka = p.poruka;
    stanje.poruka = p.poruka;
    stanje.naPotezuId = null;
    stanje.istekPotezaIso = null;
    stanje.sustavBiraRijec = false;
    stanje.treningNeaktivnost = null;
  });

  socket.on('potez:prihvacen', (p) => {
    if (napustioPartiju) return;
    if (!dogadajPripadaAktivnojPartiji(stanje.partijaId, p.partijaId)) return;
    // #142 C: starija verzija ne smije pregaziti noviji red/token.
    if (p.verzijaStanja != null && p.verzijaStanja > 0 && p.verzijaStanja < stanje.verzijaStanja) {
      return;
    }
    const dozvvoliEfekt = trebamJednokratniEfekt(vidjeniDogadajiEfekata, p.dogadajId);
    if (p.verzijaStanja != null && p.verzijaStanja > stanje.verzijaStanja) {
      stanje.verzijaStanja = p.verzijaStanja;
    }
    stanje.oznakaPrihvacenogPoteza += 1;
    const mojPotez = p.igracId === stanje.mojIgracId;
    // #142 F: null rok + timerAktivan false nije „ubojita” — samo nema limitu / prijelaz faze.
    const rok = normalizirajIstekPotezaIso(p.istekPotezaIso);
    const timerAktivan = timerAktivanIzSnimke({
      timerAktivan: p.timerAktivan,
      istekPotezaIso: rok,
      trajanjePotezaSek: p.trajanjePotezaSek ?? stanje.trajanjePotezaSek,
      faza: stanje.faza,
    });
    const prijelazBezPoteza = !timerAktivan && stanje.trajanjePotezaSek !== 0 && rok === null;
    // Red na mene = id match; prijelazBezPoteza samo sprečava lažni tvoj-red na ubojitoj riječi.
    const redDolaziNaMene = p.sljedeciId === stanje.mojIgracId;
    const mojSljedeciRed = redDolaziNaMene && !prijelazBezPoteza;
    stanje.zadnjaEliminacija = null;
    stanje.turnToken = p.turnToken ?? stanje.turnToken;
    // Prazan istek = ubojita riječ / prijelaz runde: nemoj ostaviti lažni aktivan potez.
    if (prijelazBezPoteza) {
      stanje.naPotezuId = null;
      stanje.istekPotezaIso = null;
    } else {
      stanje.naPotezuId = p.sljedeciId;
      stanje.istekPotezaIso = timerAktivan ? rok : null;
    }
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    stanje.brojIskoristenih = p.brojIskoristenih;
    if (p.trajanjePotezaSek !== undefined) stanje.trajanjePotezaSek = p.trajanjePotezaSek;
    if (p.igracId === stanje.mojIgracId) stanje.trenutniStreak = p.streak;
    stanje.poruka = null;
    stanje.zadnjaRijec = p.rijec;
    stanje.zadnjaRijecIgracId = p.igracId;
    stanje.zadnjaRijecVrsta = 'rijec';
    stanje.zadnjaNagrada = mojPotez ? p.nagrada : null;
    if (mojPotez && dozvvoliEfekt) {
      prikaziStavkeIskustva(p.iskustvo ?? []);
      prikaziKonfeteZaPotez(p.iskustvo ?? [], mojPotez ? p.nagrada : null);
      // Osvježi serverski goalProgress nakon vlastite riječi.
      if (stanje.kontekst === 'izazov') socket.emit('partija:stanje');
    }

    // State se mora primijeniti prije zvuka: nepostojeći ili blokirani audio
    // asset ne smije zaustaviti prijelaz reda ili ažuriranje streaka.
    // Autor: potvrda. Sljedeći: tvoj-red. Ostali: promjena-reda.
    // redDolaziNaMene + prijelazBezPoteza (ubojita) → tišina (slijedi eliminacija).
    // Vrijedi i u 1. rundi — jedini izuzetak je samo otvaranje partije (vidi runda-otvorena).
    if (!dozvvoliEfekt) return;
    if (mojPotez) pustiAudio('potez-prihvacen');
    else if (mojSljedeciRed) {
      brojOdbijenihNaPotezu = 0;
      pustiAudio('tvoj-red');
    } else if (!redDolaziNaMene) {
      pustiAudio('promjena-reda');
    }
  });

  socket.on('potez:odbijen', (p) => {
    if (napustioPartiju) return;
    // Odbijanje ide samo autoru poteza — osvježi bezPogreske / terminal hint.
    if (stanje.kontekst === 'izazov') socket.emit('partija:stanje');
    pustiOdbijanje();
    stanje.trenutniStreak = 0;
    stanje.poruka = p.poruka;
  });

  socket.on('partija:eliminacija', (p) => {
    if (napustioPartiju) return;
    if (!dogadajPripadaAktivnojPartiji(stanje.partijaId, p.partijaId)) return;
    if (p.verzijaStanja != null && p.verzijaStanja > stanje.verzijaStanja) {
      stanje.verzijaStanja = p.verzijaStanja;
    }
    // C03: duplikat dogadajId — bez duple eliminacije, XP-a ni zvuka.
    if (!trebamJednokratniEfekt(vidjeniDogadajiEfekata, p.dogadajId)) return;
    const bioDokaz = stanje.faza === 'dokaz_nastavka' && stanje.dokaz;
    const dokazSnimka = stanje.dokaz;
    // Kaladont: samo tiši aplauz (high moment). Ostali razlozi: tiša eliminacija.
    pustiAudio(p.razlog === 'kaladont' ? 'aplauz-kaladont' : 'eliminacija');
    if (p.razlog === 'kaladont') prikaziKonfeteKaladont();
    stanje.eliminacije = [...stanje.eliminacije, p];
    stanje.zadnjaEliminacija = p;
    // Samo XP eliminacije — ne šalji ponovo XP poteza (kaladont/mrtva), inače obavijest
    // dobije duplikat ključa i Svelte each_key_duplicate zamrzne UI točno eliminatoru.
    if (p.bodZa === stanje.mojIgracId && p.iskustvo) prikaziStavkeIskustva([p.iskustvo]);
    if (p.rijecUzrok) {
      stanje.zadnjaRijec = p.rijecUzrok;
      stanje.zadnjaRijecIgracId = p.bodZa;
      stanje.zadnjaRijecVrsta = 'rijec';
    }
    // HINT Bugbot: napuštanje čekača (prekid) dok traje dokaz → cekateljVecIspao, dokaz ostaje otvoren.
    if (bioDokaz && dokazSnimka) {
      const autor = nadimakIgraca(dokazSnimka.autorId);
      const cekatelj = nadimakIgraca(dokazSnimka.cekateljId);
      if (p.igracId === dokazSnimka.cekateljId && p.razlog === 'prekid') {
        stanje.dokaz = { ...dokazSnimka, cekateljVecIspao: true };
      } else if (p.igracId === dokazSnimka.cekateljId) {
        const poruka = `${autor} je dokazao nastavak. ${cekatelj} ispada.`;
        zatvoriDokazNakonHold(() => {
          stanje.dokaz = null;
          stanje.faza = 'sustav_bira';
          stanje.sustavBiraRijec = true;
          zapisiIshodDokaza(poruka);
        });
      } else if (p.igracId === dokazSnimka.autorId) {
        const poruka = p.razlog.startsWith('mrtva_slova')
          ? `Na ‘${(p.slova ?? dokazSnimka.trazenaSlova).toUpperCase()}’ nema dostupnog nastavka. ${autor} ispada.`
          : `${autor} nije dokazao nastavak. ${autor} ispada.`;
        zatvoriDokazNakonHold(() => {
          stanje.dokaz = null;
          stanje.faza = 'sustav_bira';
          stanje.sustavBiraRijec = true;
          zapisiIshodDokaza(poruka);
        });
      }
      // Treća osoba ispala tijekom dokaza: ne diraj snimku dokaza.
    }
    // #142 E: kraj i statusSpremanja određuje samo server (snimka / terminalni eventi).
    // Vizualni prijelaz na sustav_bira ostaje prezentacijski dok ne stigne snimka —
    // ali ne kad je ovo završna eliminacija (plasman 2 = ostaje jedan pobjednik → kraj),
    // inače bljesne „Nova runda” / promatrač prije partija:kraj.
    const dokazJosTraje = stanje.faza === 'dokaz_nastavka' && stanje.dokaz !== null;
    const zavrsnaEliminacija = p.plasman === 2;
    if (
      !dokazJosTraje &&
      !zavrsnaEliminacija &&
      p.razlog !== 'prekid' &&
      !stanje.kraj &&
      stanje.statusSpremanja === 'nije_zavrsena' &&
      stanje.faza !== 'zavrsena'
    ) {
      stanje.sustavBiraRijec = true;
      stanje.faza = 'sustav_bira';
      stanje.naPotezuId = null;
      stanje.istekPotezaIso = null;
      if (!stanje.istekIzboraIso) {
        stanje.istekIzboraIso = new Date(Date.now() + 8_000).toISOString();
      }
    }
  });

  socket.on('partija:sustav-bira-rijec', (p) => {
    if (napustioPartiju) return;
    stanje.zadnjaNagrada = null;
    stanje.istekIzboraIso = p.istekIzboraIso;
    if (dokazPrikazanOdMs !== null && stanje.dokaz) {
      // Ne skidaj dokaz-zonu dok traje hold; faza/sustav se primijene nakon holda.
      zatvoriDokazNakonHold(() => {
        stanje.sustavBiraRijec = true;
        stanje.faza = 'sustav_bira';
        stanje.dokaz = null;
      });
      return;
    }
    ocistiDokazHold();
    stanje.sustavBiraRijec = true;
    stanje.faza = 'sustav_bira';
    stanje.dokaz = null;
  });

  socket.on('partija:runda-otvorena', (p) => {
    if (napustioPartiju) return;
    if (p.partijaId && !dogadajPripadaAktivnojPartiji(stanje.partijaId, p.partijaId)) return;
    if (p.verzijaStanja != null && p.verzijaStanja > 0 && p.verzijaStanja < stanje.verzijaStanja) {
      return;
    }
    if (p.verzijaStanja != null && p.verzijaStanja > stanje.verzijaStanja) {
      stanje.verzijaStanja = p.verzijaStanja;
    }
    ocistiDokazHold();
    stanje.zadnjaNagrada = null;
    stanje.dokaz = null;
    stanje.faza = 'obican_potez';
    // Jedini izvor pocetak-partije (red/zagrijavanje/soba) — ne ovisi o countdown goto raceu.
    // Na rundi 1 ne sviraj tvoj-red/promjena-reda da se ne preklopi s početkom.
    if (p.runda === 1) {
      const partijaId = stanje.partijaId;
      if (partijaId && odsviranPocetakZaPartijuId !== partijaId) {
        odsviranPocetakZaPartijuId = partijaId;
        pustiAudio('pocetak-partije');
      }
      if (p.naPotezuId === stanje.mojIgracId) brojOdbijenihNaPotezu = 0;
    } else if (p.naPotezuId === stanje.mojIgracId) {
      brojOdbijenihNaPotezu = 0;
      pustiAudio('tvoj-red');
    } else if (p.naPotezuId) {
      pustiAudio('promjena-reda');
    }
    stanje.sustavBiraRijec = false;
    stanje.pocetakPartijeIso = null;
    stanje.istekIzboraIso = null;
    stanje.turnToken = p.turnToken ?? null;
    stanje.naPotezuId = p.naPotezuId;
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.istekPotezaIso = normalizirajIstekPotezaIso(p.istekPotezaIso);
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    stanje.runda = p.runda;
    if (p.trajanjePotezaSek !== undefined) stanje.trajanjePotezaSek = p.trajanjePotezaSek;
    stanje.zadnjaRijec = p.rijec;
    stanje.zadnjaRijecIgracId = null;
    stanje.zadnjaRijecVrsta = 'sustav_rijec';
  });

  socket.on('partija:kraj', (p) => {
    if (p.partijaId !== stanje.partijaId) return;
    // partija-kraj zvuk pušta se tek kad se prikažu konačni rezultati (partija/[id]/+page.svelte),
    // ne ovdje - inače se preklapa sa zvukom zadnje eliminacije.
    ocistiDokazHold();
    if (timerIshodDokaza) clearTimeout(timerIshodDokaza);
    timerIshodDokaza = null;
    stanje.dokaz = null;
    stanje.ishodDokazaPoruka = null;
    stanje.kraj = p;
    stanje.treningNeaktivnost = null;
    stanje.ponistenaPoruka = null;
    stanje.statusSpremanja = 'rezultati_spremljeni';
    stanje.pocetakPartijeIso = null;
    // Dohvati izazovTerminal / konačni goalProgress za rezultatski ekran.
    if (p.kontekst === 'izazov') socket.emit('partija:stanje');
  });

  socket.on('dostignuce:otkljucano', (p) => {
    if (p.partijaId === stanje.partijaId) prikaziNovaDostignuca(p.dostignuca);
  });

  socket.on('rijec:otkljucana', (p) => {
    if (p.partijaId !== stanje.partijaId) return;
    stanje.otkljucavanjeRijeci = p;
    stanje.oznakaOtkljucavanjaRijeci += 1;
    if (timerNagradePoteza) clearTimeout(timerNagradePoteza);
    timerNagradePoteza = setTimeout(() => {
      stanje.otkljucavanjeRijeci = null;
      stanje.stavkeIskustva = [];
      timerNagradePoteza = null;
    }, 5_000);
  });

  socket.on('iskustvo:obracun', (p) => {
    if (p.partijaId === stanje.partijaId) stanje.obracunIskustva = p;
  });

  socket.on('greska', (g) => {
    stanje.poruka = g.poruka;
  });

  function pokreniSinkronizacijuPartije(requestId?: string): void {
    if (!stanje.partijaId || napustioPartiju) return;
    void sinkronizirajPartiju({
      socket,
      partijaId: stanje.partijaId,
      requestId,
      aktivniTurnToken: stanje.turnToken,
      naSnimku: (snimka) => primijeniStanjePartije(snimka),
    });
  }

  socket.on('connect', () => {
    // Korelirani sync umjesto golog emita (#142 D); stari put ostaje na serveru.
    if (stanje.partijaId) pokreniSinkronizacijuPartije();
    else socket.emit('partija:stanje');
  });
  if (socket.connected) {
    if (stanje.partijaId) pokreniSinkronizacijuPartije();
    else socket.emit('partija:stanje');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (!stanje.partijaId || napustioPartiju) return;
      if (!socket.connected) return; // ne ubijaj zdravu vezu; čekaj connect
      pokreniSinkronizacijuPartije();
    });
  }
}

/** Javni ulaz za sync nakon nepoznatog ishoda poteza (#142 D). */
export function zatraziSinkronizacijuPartije(opcije?: {
  requestId?: string;
  naPotvrdu?: (potvrda: import('zajednicko').PotvrdaNaredbePoteza) => void;
  naOcistiNaredbu?: () => void;
}): void {
  const socket = dohvatiSocket();
  if (!stanje.partijaId || napustioPartiju) return;
  void sinkronizirajPartiju({
    socket,
    partijaId: stanje.partijaId,
    requestId: opcije?.requestId,
    aktivniTurnToken: stanje.turnToken,
    naSnimku: (snimka) => primijeniStanjePartije(snimka),
    naPotvrdu: opcije?.naPotvrdu,
    naOcistiNaredbu: opcije?.naOcistiNaredbu,
  });
}

export function dohvatiStanjeIgre(): StanjeIgre {
  return stanje;
}

const TTL_PENDING_REAKCIJE_MS = 4_000;
type PendingReakcija = { partijaId: string; igracId: string; poruka: BrzaPoruka; expiresAt: number };
let pendingReakcije: PendingReakcija[] = [];

function ocistiIsteklePendingReakcije(sada = Date.now()): void {
  pendingReakcije = pendingReakcije.filter((r) => r.expiresAt > sada);
}

/** Reakcije koje su stigle prije mounta stola — potroši jednom po partiji. */
export function preuzmiPendingReakcije(partijaId: string): { igracId: string; poruka: BrzaPoruka }[] {
  const sada = Date.now();
  ocistiIsteklePendingReakcije(sada);
  const trenutne = pendingReakcije.filter((r) => r.partijaId === partijaId);
  pendingReakcije = pendingReakcije.filter((r) => r.partijaId !== partijaId);
  return trenutne.map(({ igracId, poruka }) => ({ igracId, poruka }));
}

function spremiPendingReakciju(partijaId: string, igracId: string, poruka: BrzaPoruka): void {
  const sada = Date.now();
  ocistiIsteklePendingReakcije(sada);
  pendingReakcije.push({ partijaId, igracId, poruka, expiresAt: sada + TTL_PENDING_REAKCIJE_MS });
}

/**
 * Lokalno napuštanje partije: gasi SFX i ignorira kasne socket evente stare partije
 * dok ne stigne nova partija:pocetak. Pozvati prije emit('partija:izadji').
 */
export function napustiLokalnuPartiju(): void {
  napustioPartiju = true;
  odsviranPocetakZaPartijuId = null;
  zaustaviSveZvukove();
  brojOdbijenihNaPotezu = 0;
  ocistiDokazHold();
  if (timerIshodDokaza) clearTimeout(timerIshodDokaza);
  timerIshodDokaza = null;
  if (timerStavkiIskustva) clearTimeout(timerStavkiIskustva);
  if (timerNagradePoteza) clearTimeout(timerNagradePoteza);
  if (timerNovaDostignuca) clearTimeout(timerNovaDostignuca);
  if (timerKonfetaIskustva) clearTimeout(timerKonfetaIskustva);
  timerStavkiIskustva = null;
  timerNagradePoteza = null;
  timerNovaDostignuca = null;
  timerKonfetaIskustva = null;
  pendingReakcije = [];
  stanje.partijaId = null;
  stanje.mojIgracId = null;
  stanje.sjedala = [];
  stanje.turnToken = null;
  stanje.naPotezuId = null;
  stanje.trazenaSlova = null;
  stanje.istekPotezaIso = null;
  stanje.pocetakPartijeIso = null;
  stanje.runda = 0;
  stanje.brojIskoristenih = 0;
  stanje.eliminacije = [];
  stanje.zadnjaEliminacija = null;
  stanje.poruka = null;
  stanje.kraj = null;
  stanje.ponistenaPoruka = null;
  stanje.statusSpremanja = 'nije_zavrsena';
  stanje.rezultatiPrikazaniPartijaId = null;
  stanje.obracunIskustva = null;
  stanje.sustavBiraRijec = false;
  stanje.istekIzboraIso = null;
  stanje.zadnjaRijec = null;
  stanje.zadnjaRijecIgracId = null;
  stanje.zadnjaRijecVrsta = null;
  stanje.mod = null;
  stanje.kontekst = null;
  stanje.treningNeaktivnost = null;
  stanje.jePrivatna = false;
  stanje.kodSobe = null;
  stanje.trajanjePotezaSek = null;
  stanje.izazovMeta = null;
  stanje.goalProgress = null;
  stanje.izazovTerminal = null;
  stanje.zadnjaNagrada = null;
  stanje.trenutniStreak = 0;
  stanje.stavkeIskustva = [];
  stanje.novaDostignucaTijekomPartije = [];
  stanje.otkljucavanjeRijeci = null;
  stanje.intenzitetKonfetaIskustva = null;
}
