import { ZONA_LJESTVICA } from './ljestvice.js';
import { dohvatiDefinicijuDostignuca, ID_DOSTIGNUCA_STALNO_SI_TU, izracunajRazinuDostignuca } from './dostignuca.js';

const formatLokalniDatum = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_LJESTVICA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Kalendarski lokalni datum (`YYYY-MM-DD`) za poslovnu zonu igre. */
export function lokalniDatumIso(trenutak: Date): string {
  return formatLokalniDatum.format(trenutak);
}

export function pomakniKalendarskiDan(iso: string, deltaDana: number): string {
  const dijelovi = iso.split('-').map(Number);
  const y = dijelovi[0] ?? 0;
  const m = dijelovi[1] ?? 1;
  const d = dijelovi[2] ?? 1;
  const t = new Date(Date.UTC(y, m - 1, d + deltaDana));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function jeSljedeciKalendarskiDan(prethodni: string, novi: string): boolean {
  return pomakniKalendarskiDan(prethodni, 1) === novi;
}

export interface StanjeNizaAktivnosti {
  zadnjiAktivniDatum: string;
  trenutniNiz: number;
  najboljiNiz: number;
}

export interface IshodNovogAktivnogDana {
  trenutniNiz: number;
  najboljiNiz: number;
  razinaDostignuca: number;
  novootkljucanaRazina: number | null;
}

/** Čista logika niza nakon prvog uspješnog upisa današnjeg datuma. */
export function izracunajNizNakonNovogDana(
  prethodno: StanjeNizaAktivnosti | null,
  danas: string,
  staraRazinaDostignuca = 0,
): IshodNovogAktivnogDana {
  let trenutniNiz: number;
  let najboljiNiz: number;

  if (!prethodno) {
    trenutniNiz = 1;
    najboljiNiz = 1;
  } else if (prethodno.zadnjiAktivniDatum === danas) {
    trenutniNiz = prethodno.trenutniNiz;
    najboljiNiz = prethodno.najboljiNiz;
  } else if (jeSljedeciKalendarskiDan(prethodno.zadnjiAktivniDatum, danas)) {
    trenutniNiz = prethodno.trenutniNiz + 1;
    najboljiNiz = Math.max(prethodno.najboljiNiz, trenutniNiz);
  } else if (danas > prethodno.zadnjiAktivniDatum) {
    trenutniNiz = 1;
    najboljiNiz = Math.max(prethodno.najboljiNiz, 1);
  } else {
    trenutniNiz = prethodno.trenutniNiz;
    najboljiNiz = prethodno.najboljiNiz;
  }

  const definicija = dohvatiDefinicijuDostignuca(ID_DOSTIGNUCA_STALNO_SI_TU)!;
  const novaRazina = izracunajRazinuDostignuca(definicija, najboljiNiz);
  const razinaDostignuca = Math.max(staraRazinaDostignuca, novaRazina);
  const novootkljucanaRazina = novaRazina > staraRazinaDostignuca ? novaRazina : null;

  return { trenutniNiz, najboljiNiz, razinaDostignuca, novootkljucanaRazina };
}

/**
 * Trenutačni niz za prikaz na današnji datum:
 * otvoren ako je zadnji dan danas ili jučer; inače 0 do nove aktivnosti.
 */
export function trenutniNizZaPrikaz(
  agregat: StanjeNizaAktivnosti | null,
  danas: string,
): number {
  if (!agregat) return 0;
  if (agregat.zadnjiAktivniDatum === danas) return agregat.trenutniNiz;
  if (jeSljedeciKalendarskiDan(agregat.zadnjiAktivniDatum, danas)) return agregat.trenutniNiz;
  return 0;
}
