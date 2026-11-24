/** Sažetak zvjezdica dostignuća za badge na naslovnici. */
import { DEFINICIJE_DOSTIGNUCA, jeDostignuceVidljivo } from 'zajednicko';

export const MAKSIMALNO_ZVJEZDICA_NASLOVNICA = DEFINICIJE_DOSTIGNUCA.filter((definicija) =>
  jeDostignuceVidljivo(definicija.id),
).reduce((zbroj, definicija) => zbroj + definicija.pragovi.length, 0);

export type PrikazZvjezdicaDostignuca = {
  ukupno: number;
  maksimalno: number;
};

export function normalizirajZvjezdiceDostignuca(ulaz: {
  ukupnoZvjezdica?: unknown;
  maksimalnoZvjezdica?: unknown;
}): PrikazZvjezdicaDostignuca {
  const ukupnoRaw = ulaz.ukupnoZvjezdica;
  const maksRaw = ulaz.maksimalnoZvjezdica;
  const ukupno =
    typeof ukupnoRaw === 'number' && Number.isFinite(ukupnoRaw) && ukupnoRaw >= 0
      ? Math.floor(ukupnoRaw)
      : 0;
  const maksimalno =
    typeof maksRaw === 'number' && Number.isFinite(maksRaw) && maksRaw > 0
      ? Math.floor(maksRaw)
      : MAKSIMALNO_ZVJEZDICA_NASLOVNICA;
  return {
    ukupno: Math.min(ukupno, maksimalno),
    maksimalno,
  };
}

export function natpisBadgaDostignuca(prikaz: PrikazZvjezdicaDostignuca): string {
  return `${prikaz.ukupno}/${prikaz.maksimalno}`;
}

export function labelaZvjezdicaDostignuca(prikaz: PrikazZvjezdicaDostignuca): string {
  return `${prikaz.ukupno}/${prikaz.maksimalno} zvjezdica`;
}

export function ariaBadgaDostignuca(prikaz: PrikazZvjezdicaDostignuca): string {
  return `${prikaz.ukupno} od ${prikaz.maksimalno} zvjezdica`;
}
