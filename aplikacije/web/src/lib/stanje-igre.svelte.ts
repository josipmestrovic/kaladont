/**
 * Globalno reaktivno stanje igre - slušatelji se registriraju jednom (u root layoutu)
 * jer partija:pocetak stiže dok je korisnik još na /red, prije nego /partija/[id] postoji.
 */
import type { Eliminacija, KrajPartije, NagradaZaRijec, NovoDostignuceTijekomPartije, ObracunIskustvaTijekomPartije, OtkljucavanjeRijeci, PocetakPartije, StavkaIskustva, StanjePartije } from 'zajednicko';
import { pustiAudio, type AudioDogadaj } from './audio-manager.js';
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
  mod: 'cetiri_igraca' | 'dva_igraca' | null;
  jePrivatna: boolean;
  kodSobe: string | null;
  trajanjePotezaSek: number | null;
  zadnjaNagrada: NagradaZaRijec | null;
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
  jePrivatna: false,
  kodSobe: null,
  trajanjePotezaSek: null,
  zadnjaNagrada: null,
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
let brojOdbijenihNaPotezu = 0;
let timerStavkiIskustva: ReturnType<typeof setTimeout> | null = null;
let timerNagradePoteza: ReturnType<typeof setTimeout> | null = null;
let timerNovaDostignuca: ReturnType<typeof setTimeout> | null = null;
let timerKonfetaIskustva: ReturnType<typeof setTimeout> | null = null;

function prikaziKonfeteIskustva(stavke: readonly StavkaIskustva[]): void {
  const najjaca = Math.max(...stavke.filter((stavka) => stavka.vrsta === 'duge_rijeci' || stavka.vrsta === 'rijetke_rijeci').map((stavka) => stavka.iskustvo), 0);
  if (najjaca === 0) return;
  stanje.intenzitetKonfetaIskustva = najjaca >= 35 ? 'veliki' : najjaca >= 20 ? 'srednji' : 'mali';
  stanje.oznakaKonfetaIskustva += 1;
  if (timerKonfetaIskustva) clearTimeout(timerKonfetaIskustva);
  timerKonfetaIskustva = setTimeout(() => {
    stanje.intenzitetKonfetaIskustva = null;
    timerKonfetaIskustva = null;
  }, 3_200);
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

function primijeniStanjePartije(p: StanjePartije): void {
  oznaciPartijuDostupnom();
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
  stanje.zadnjaNagrada = null;
  stanje.mod = p.mod ?? null;
  stanje.jePrivatna = Boolean(p.jePrivatna);
  stanje.kodSobe = p.kodSobe ?? null;
  stanje.trajanjePotezaSek = p.trajanjePotezaSek ?? null;
}

export function pokreniSlusateljeIgre(): void {
  if (pokrenuto) return;
  pokrenuto = true;
  const socket = dohvatiSocket();

  socket.on('partija:pocetak', (p) => {
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
    stanje.jePrivatna = Boolean(p.jePrivatna);
    stanje.kodSobe = p.kodSobe ?? null;
  });

  socket.on('partija:stanje', primijeniStanjePartije);

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
  });

  socket.on('potez:prihvacen', (p) => {
    const mojPotez = p.igracId === stanje.mojIgracId;
    const mojSljedeciRed = p.sljedeciId === stanje.mojIgracId;
    stanje.zadnjaEliminacija = null;
    stanje.turnToken = p.turnToken ?? stanje.turnToken;
    stanje.naPotezuId = p.sljedeciId;
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.istekPotezaIso = p.istekPotezaIso;
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
    if (mojPotez) pustiAudio('potez-prihvacen');
    if (p.nagrada && mojPotez) pustiAudio(`nagrada-${p.nagrada.intenzitet}` as AudioDogadaj);
    if (mojSljedeciRed) {
      brojOdbijenihNaPotezu = 0;
      pustiAudio('tvoj-red');
    }
  });

  socket.on('potez:odbijen', (p) => {
    pustiOdbijanje();
    stanje.trenutniStreak = 0;
    stanje.poruka = p.poruka;
  });

  socket.on('partija:eliminacija', (p) => {
    pustiAudio('eliminacija');
    stanje.eliminacije = [...stanje.eliminacije, p];
    stanje.zadnjaEliminacija = p;
    if (p.bodZa === stanje.mojIgracId && p.iskustvo) prikaziStavkeIskustva([...stanje.stavkeIskustva, p.iskustvo]);
    if (p.rijecUzrok) {
      stanje.zadnjaRijec = p.rijecUzrok;
      stanje.zadnjaRijecIgracId = p.bodZa;
      stanje.zadnjaRijecVrsta = 'rijec';
    }
  });

  socket.on('partija:sustav-bira-rijec', (p) => {
    stanje.zadnjaNagrada = null;
    stanje.sustavBiraRijec = true;
    stanje.istekIzboraIso = p.istekIzboraIso;
  });

  socket.on('partija:runda-otvorena', (p) => {
    stanje.zadnjaNagrada = null;
    // 1. runda već ima pocetak-partije zvuk - nova-runda samo od 2. runde nadalje da se ne preklapaju.
    if (p.runda > 1) pustiAudio('nova-runda');
    if (p.naPotezuId === stanje.mojIgracId) {
      brojOdbijenihNaPotezu = 0;
      pustiAudio('tvoj-red');
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
    stanje.kraj = p;
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

  socket.on('connect', () => socket.emit('partija:stanje'));
  if (socket.connected) socket.emit('partija:stanje');
}

export function dohvatiStanjeIgre(): StanjeIgre {
  return stanje;
}
