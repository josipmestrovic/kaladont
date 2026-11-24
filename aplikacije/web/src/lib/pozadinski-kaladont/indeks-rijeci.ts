import { grafemi, jeDopustenOblikRijeci, prvaDva, zadnjaDva } from 'zajednicko';
import { POZADINSKI_FOND, type PozadinskaRijec } from './rjecnik.js';

export interface IndeksiranaRijec extends PozadinskaRijec {
  pocetak: string;
  nastavak: string;
  brojGrafema: number;
}

export interface IndeksPozadinskihRijeci {
  sve: readonly IndeksiranaRijec[];
  poPocetku: ReadonlyMap<string, readonly IndeksiranaRijec[]>;
}

function indeksiraj(stavka: PozadinskaRijec): IndeksiranaRijec | null {
  const rijec = stavka.rijec.normalize('NFC').toLowerCase();
  if (!jeDopustenOblikRijeci(rijec)) return null;
  const dijelovi = grafemi(rijec);
  if (dijelovi.length < 2) return null;
  return {
    rijec,
    grupe: stavka.grupe,
    pocetak: prvaDva(rijec),
    nastavak: zadnjaDva(rijec),
    brojGrafema: dijelovi.length,
  };
}

export function izgradiIndeks(
  fond: readonly PozadinskaRijec[] = POZADINSKI_FOND,
): IndeksPozadinskihRijeci {
  const sve: IndeksiranaRijec[] = [];
  const privremeno = new Map<string, IndeksiranaRijec[]>();

  for (const stavka of fond) {
    const indeksirana = indeksiraj(stavka);
    if (!indeksirana) continue;
    sve.push(indeksirana);
    const lista = privremeno.get(indeksirana.pocetak);
    if (lista) lista.push(indeksirana);
    else privremeno.set(indeksirana.pocetak, [indeksirana]);
  }

  const poPocetku = new Map<string, readonly IndeksiranaRijec[]>();
  for (const [kljuc, lista] of privremeno) {
    poPocetku.set(kljuc, lista);
  }

  return { sve, poPocetku };
}

/** Dijeljeni indeks — gradi se jednom pri prvom dohvatu. */
let dijeljeniIndeks: IndeksPozadinskihRijeci | null = null;

export function dohvatiIndeks(): IndeksPozadinskihRijeci {
  if (!dijeljeniIndeks) dijeljeniIndeks = izgradiIndeks();
  return dijeljeniIndeks;
}

/** Samo za testove — resetira dijeljeni indeks. */
export function resetirajDijeljeniIndeksZaTestove(): void {
  dijeljeniIndeks = null;
}
