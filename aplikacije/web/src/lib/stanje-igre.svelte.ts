/**
 * Globalno reaktivno stanje igre - slušatelji se registriraju jednom (u root layoutu)
 * jer partija:pocetak stiže dok je korisnik još na /red, prije nego /partija/[id] postoji.
 * HINT PR14: faza/dokaz/pravila dolaze sa snimke — UI ne sudi iz broja avatara.
 */
import type {
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
import { dohvatiSocket, oznaciPartijuDostupnom } from './socket.js';

interface StanjeIgre {
  partijaId: string | null;
  mojIgracId: string | null;
  sjedala: PocetakPartije['sjedala'];
  turnToken: string | null;
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
  kontekst: 'javna' | 'privatna' | 'trening' | null;
  treningNeaktivnost: Omit<TreningNeaktivnost, 'partijaId'> | null;
  jePrivatna: boolean;
  kodSobe: string | null;
  trajanjePotezaSek: number | null;
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

function prikaziKonfeteIskustva(stavke: readonly StavkaIskustva[]): void {
  if (stanje.jePrivatna || stanje.kontekst === 'trening') return;
  const najjaca = Math.max(...stavke.filter((stavka) => stavka.vrsta === 'duge_rijeci' || stavka.vrsta === 'rijetke_rijeci').map((stavka) => stavka.iskustvo), 0);
  if (najjaca === 0) return;
  pokreniKonfete(najjaca >= 35 ? 'veliki' : najjaca >= 20 ? 'srednji' : 'mali');
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
  oznaciPartijuDostupnom();
  // HINT PR14/Bugbot: uspješan dokaz kad je čekač već otišao dolazi samo kao
  // partija:stanje (zakrpljeni bodZa), bez nove partija:eliminacija — banner ovdje.
  const prethodniDokaz = stanje.dokaz;
  const stariBodZaCekatelja =
    prethodniDokaz?.cekateljVecIspao === true
      ? (stanje.eliminacije.find((e) => e.igracId === prethodniDokaz.cekateljId)?.bodZa ?? null)
      : undefined;
  stanje.partijaId = p.partijaId;
  stanje.pocetakPartijeIso = null;
  stanje.mojIgracId = p.mojIgracId;
  stanje.sjedala = p.sjedala;
  stanje.turnToken = p.turnToken ?? null;
  stanje.naPotezuId = p.naPotezuId;
  stanje.trazenaSlova = p.trazenaSlova;
  stanje.istekPotezaIso = p.istekPotezaIso;
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

  if (
    prethodniDokaz?.cekateljVecIspao === true &&
    stariBodZaCekatelja == null &&
    !p.dokaz
  ) {
    const elim = p.eliminacije.find(
      (e) => e.igracId === prethodniDokaz.cekateljId && e.bodZa === prethodniDokaz.autorId,
    );
    if (elim) {
      const porukaIshoda = `${nadimakIgraca(prethodniDokaz.autorId)} je dokazao nastavak.`;
      const sljedecaFaza = p.sustavBiraRijec ? ('sustav_bira' as const) : ('obican_potez' as const);
      const sustavBira = p.sustavBiraRijec;
      stanje.dokaz = prethodniDokaz;
      stanje.faza = 'dokaz_nastavka';
      stanje.sustavBiraRijec = false;
      zatvoriDokazNakonHold(() => {
        stanje.dokaz = null;
        stanje.faza = sljedecaFaza;
        stanje.sustavBiraRijec = sustavBira;
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

  socket.on('partija:pocetak', (p) => {
    napustioPartiju = false;
    odsviranPocetakZaPartijuId = null;
    zadnjiDokazIzazovId = null;
    oznaciPartijuDostupnom();
    brojOdbijenihNaPotezu = 0;
    stanje.partijaId = p.partijaId;
    stanje.mojIgracId = p.mojIgracId;
    stanje.sjedala = p.sjedala;
    stanje.turnToken = null;
    stanje.naPotezuId = null;
    stanje.istekPotezaIso = null;
    stanje.serverVrijemeIso = new Date().toISOString();
    stanje.pocetakPartijeIso = p.pocetakIso;
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
    stanje.sustavBiraRijec = false;
    stanje.istekIzboraIso = null;
    stanje.zadnjaRijec = null;
    stanje.zadnjaRijecIgracId = null;
    stanje.zadnjaRijecVrsta = null;
    stanje.mod = p.mod ?? null;
    stanje.pravila = p.pravila ?? null;
    stanje.spojeniDvoboj = Boolean(p.spojeniDvoboj);
    ocistiDokazHold();
    if (timerIshodDokaza) clearTimeout(timerIshodDokaza);
    timerIshodDokaza = null;
    stanje.faza = 'obican_potez';
    stanje.dokaz = null;
    stanje.ishodDokazaPoruka = null;
    stanje.kontekst = p.kontekst ?? (p.jePrivatna ? 'privatna' : 'javna');
    stanje.treningNeaktivnost = null;
    stanje.jePrivatna = Boolean(p.jePrivatna);
    stanje.kodSobe = p.kodSobe ?? null;
    // Mora stići prije prvog potez:prihvacen — inače prazan istek izgleda kao ubojita riječ.
    stanje.trajanjePotezaSek = p.trajanjePotezaSek ?? null;
  });

  socket.on('partija:stanje', primijeniStanjePartije);
  socket.on('dokaz:zatrazen', primijeniDokazZatrazen);

  // HINT PR14 e2e: Playwright može injektirati dokaz / stanje bez pravog server eventa.
  if (typeof window !== 'undefined') {
    const e2eEmit = (event: string, data: unknown) => {
      if (event === 'dokaz:zatrazen') primijeniDokazZatrazen(data as DokazZatrazen);
      if (event === 'partija:stanje') primijeniStanjePartije(data as StanjePartije);
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
    // Dok si na potezu, tuđi potez:prihvacen je zastario/strani — primjena ruši formu
    // (naPotezuId=null + krivi prefiks), a partija:stanje odmah vraća isti red.
    const tuđiDokSamNaPotezu =
      stanje.naPotezuId !== null &&
      stanje.naPotezuId === stanje.mojIgracId &&
      p.igracId !== stanje.mojIgracId;
    if (tuđiDokSamNaPotezu) return;

    stanje.oznakaPrihvacenogPoteza += 1;
    const mojPotez = p.igracId === stanje.mojIgracId;
    // Prazan istek = ubojita/prijelaz kad timer nije isključen.
    // null trajanje = javna partija (default timer) — prazan istek i dalje briše red.
    // 0 = privatna bez limitu / ONEMOGUCI_TIMER — prazan istek je normalan.
    const prijelazBezPoteza = !p.istekPotezaIso && stanje.trajanjePotezaSek !== 0;
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
      stanje.istekPotezaIso = p.istekPotezaIso;
    }
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    stanje.brojIskoristenih = p.brojIskoristenih;
    if (p.igracId === stanje.mojIgracId) stanje.trenutniStreak = p.streak;
    stanje.poruka = null;
    stanje.zadnjaRijec = p.rijec;
    stanje.zadnjaRijecIgracId = p.igracId;
    stanje.zadnjaRijecVrsta = 'rijec';
    stanje.zadnjaNagrada = mojPotez ? p.nagrada : null;
    if (mojPotez) {
      prikaziStavkeIskustva(p.iskustvo ?? []);
      prikaziKonfeteIskustva(p.iskustvo ?? []);
    }

    // State se mora primijeniti prije zvuka: nepostojeći ili blokirani audio
    // asset ne smije zaustaviti prijelaz reda ili ažuriranje streaka.
    // Autor: potvrda. Sljedeći: tvoj-red. Ostali: promjena-reda.
    // redDolaziNaMene + prijelazBezPoteza (ubojita) → tišina (slijedi eliminacija).
    // Vrijedi i u 1. rundi — jedini izuzetak je samo otvaranje partije (vidi runda-otvorena).
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
    pustiOdbijanje();
    stanje.trenutniStreak = 0;
    stanje.poruka = p.poruka;
  });

  socket.on('partija:eliminacija', (p) => {
    if (napustioPartiju) return;
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
    // HINT PR14/Bugbot: dok dokaz traje ne zaključuj partiju lokalno (čekač može biti već ispao).
    const dokazJosTraje = stanje.faza === 'dokaz_nastavka' && stanje.dokaz !== null;
    const aktivni = stanje.sjedala.filter(
      (s) => !stanje.eliminacije.some((e) => e.igracId === s.igracId),
    ).length;
    if (!dokazJosTraje && aktivni <= 1) {
      if (stanje.statusSpremanja === 'nije_zavrsena') stanje.statusSpremanja = 'spremanje_rezultata';
      stanje.sustavBiraRijec = false;
      stanje.faza = 'zavrsena';
      stanje.naPotezuId = null;
      stanje.istekPotezaIso = null;
    } else if (
      !dokazJosTraje &&
      p.razlog !== 'prekid' &&
      !stanje.kraj &&
      stanje.statusSpremanja === 'nije_zavrsena'
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
    stanje.turnToken = p.turnToken ?? null;
    stanje.naPotezuId = p.naPotezuId;
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.istekPotezaIso = p.istekPotezaIso;
    stanje.serverVrijemeIso = p.serverVrijemeIso;
    stanje.runda = p.runda;
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

  socket.on('connect', () => {
    socket.emit('partija:stanje');
  });
  if (socket.connected) socket.emit('partija:stanje');
}

export function dohvatiStanjeIgre(): StanjeIgre {
  return stanje;
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
  stanje.zadnjaNagrada = null;
  stanje.trenutniStreak = 0;
  stanje.stavkeIskustva = [];
  stanje.novaDostignucaTijekomPartije = [];
  stanje.otkljucavanjeRijeci = null;
  stanje.intenzitetKonfetaIskustva = null;
}
