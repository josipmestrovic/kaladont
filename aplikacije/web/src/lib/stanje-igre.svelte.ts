/**
 * Globalno reaktivno stanje igre - slušatelji se registriraju jednom (u root layoutu)
 * jer partija:pocetak stiže dok je korisnik još na /red, prije nego /partija/[id] postoji.
 */
import type { Eliminacija, KrajPartije, PocetakPartije, StanjePartije } from 'zajednicko';
import { dohvatiSocket } from './socket.js';

interface StanjeIgre {
  partijaId: string | null;
  mojIgracId: string | null;
  sjedala: PocetakPartije['sjedala'];
  naPotezuId: string | null;
  trazenaSlova: string | null;
  istekPotezaIso: string | null;
  /** Kada partija kreće — čekaonica odbrojava do ovog trenutka; null kad nema najavljene partije. */
  pocetakPartijeIso: string | null;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  zadnjaEliminacija: Eliminacija | null;
  poruka: string | null;
  kraj: KrajPartije | null;
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
}

const stanje = $state<StanjeIgre>({
  partijaId: null,
  mojIgracId: null,
  sjedala: [],
  naPotezuId: null,
  trazenaSlova: null,
  istekPotezaIso: null,
  pocetakPartijeIso: null,
  runda: 0,
  brojIskoristenih: 0,
  eliminacije: [],
  zadnjaEliminacija: null,
  poruka: null,
  kraj: null,
  sustavBiraRijec: false,
  istekIzboraIso: null,
});

let pokrenuto = false;

function primijeniStanjePartije(p: StanjePartije): void {
  stanje.partijaId = p.partijaId;
  stanje.mojIgracId = p.mojIgracId;
  stanje.sjedala = p.sjedala;
  stanje.naPotezuId = p.naPotezuId;
  stanje.trazenaSlova = p.trazenaSlova;
  stanje.istekPotezaIso = p.istekPotezaIso;
  stanje.runda = p.runda;
  stanje.brojIskoristenih = p.brojIskoristenih;
  stanje.eliminacije = p.eliminacije;
  stanje.zadnjaEliminacija = p.eliminacije.at(-1) ?? null;
  stanje.sustavBiraRijec = p.sustavBiraRijec;
  stanje.istekIzboraIso = p.istekIzboraIso;
}

export function pokreniSlusateljeIgre(): void {
  if (pokrenuto) return;
  pokrenuto = true;
  const socket = dohvatiSocket();

  socket.on('partija:pocetak', (p) => {
    stanje.partijaId = p.partijaId;
    stanje.mojIgracId = p.mojIgracId;
    stanje.sjedala = p.sjedala;
    stanje.naPotezuId = null;
    stanje.istekPotezaIso = null;
    stanje.pocetakPartijeIso = p.pocetakIso;
    stanje.trazenaSlova = null;
    stanje.brojIskoristenih = 0;
    stanje.eliminacije = [];
    stanje.zadnjaEliminacija = null;
    stanje.kraj = null;
    stanje.poruka = null;
    stanje.sustavBiraRijec = false;
    stanje.istekIzboraIso = null;
  });

  socket.on('partija:stanje', primijeniStanjePartije);

  socket.on('potez:prihvacen', (p) => {
    stanje.zadnjaEliminacija = null;
    stanje.naPotezuId = p.sljedeciId;
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.istekPotezaIso = p.istekPotezaIso;
    stanje.brojIskoristenih = p.brojIskoristenih;
    stanje.poruka = null;
  });

  socket.on('potez:odbijen', (p) => {
    stanje.poruka = p.poruka;
  });

  socket.on('partija:eliminacija', (p) => {
    stanje.eliminacije = [...stanje.eliminacije, p];
    stanje.zadnjaEliminacija = p;
  });

  socket.on('partija:sustav-bira-rijec', (p) => {
    stanje.sustavBiraRijec = true;
    stanje.istekIzboraIso = p.istekIzboraIso;
  });

  socket.on('partija:runda-otvorena', (p) => {
    stanje.sustavBiraRijec = false;
    stanje.naPotezuId = p.naPotezuId;
    stanje.trazenaSlova = p.trazenaSlova;
    stanje.istekPotezaIso = p.istekPotezaIso;
    stanje.runda = p.runda;
  });

  socket.on('partija:kraj', (p) => {
    stanje.kraj = p;
    stanje.pocetakPartijeIso = null;
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
