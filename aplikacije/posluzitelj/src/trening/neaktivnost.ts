export const ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA = {
  upozorenjeMs: 4 * 60_000,
  zatvaranjeMs: 5 * 60_000,
} as const;

export interface RokoviNeaktivnostiTreninga {
  upozorenjeMs: number;
  zatvaranjeMs: number;
}

export type StanjeNeaktivnostiTreninga = 'aktivno' | 'upozorenje' | 'isteklo';

export function izracunajRokoveNeaktivnostiTreninga(zadnjaAktivnostMs: number, rokovi: RokoviNeaktivnostiTreninga) {
  if (!Number.isFinite(zadnjaAktivnostMs) || !Number.isSafeInteger(rokovi.upozorenjeMs) || !Number.isSafeInteger(rokovi.zatvaranjeMs) || rokovi.upozorenjeMs <= 0 || rokovi.upozorenjeMs >= rokovi.zatvaranjeMs) {
    throw new RangeError('Rokovi neaktivnosti treninga nisu valjani.');
  }
  return { upozorenjeMs: zadnjaAktivnostMs + rokovi.upozorenjeMs, zatvaranjeMs: zadnjaAktivnostMs + rokovi.zatvaranjeMs };
}

export function stanjeNeaktivnostiTreninga(zadnjaAktivnostMs: number, sadaMs: number, rokovi: RokoviNeaktivnostiTreninga): StanjeNeaktivnostiTreninga {
  const rok = izracunajRokoveNeaktivnostiTreninga(zadnjaAktivnostMs, rokovi);
  if (sadaMs >= rok.zatvaranjeMs) return 'isteklo';
  if (sadaMs >= rok.upozorenjeMs) return 'upozorenje';
  return 'aktivno';
}