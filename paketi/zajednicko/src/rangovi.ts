/**
 * Rangovi - iskljucivo prikazni status (ADR-008, bez utjecaja na uparivanje).
 * Vidi docs/02-pravila-igre/bodovanje-i-rangovi.md.
 */

export interface PragRanga {
  naziv: string;
  minimalniProsjek: number;
}

/** Poredano rastuce po pragu - zadnji koji odgovara pobjeduje. */
export const RANGOVI: readonly PragRanga[] = [
  { naziv: 'Prvopisac', minimalniProsjek: 0 },
  { naziv: 'Riječarac', minimalniProsjek: 1.5 },
  { naziv: 'Jezičar', minimalniProsjek: 2.1 },
  { naziv: 'Lektor', minimalniProsjek: 2.5 },
  { naziv: 'Književnik', minimalniProsjek: 2.9 },
  { naziv: 'Jezikoslovac', minimalniProsjek: 3.3 },
  { naziv: 'Doktor riječi', minimalniProsjek: 3.8 },
  { naziv: 'Jezični maestro', minimalniProsjek: 4.4 },
  { naziv: 'Gospodar riječnika', minimalniProsjek: 5.0 },
  { naziv: 'Kaladont', minimalniProsjek: 5.7 },
];

export const BROJ_PARTIJA_ZA_KALIBRACIJU = 10;

/** Prvih 10 partija igrač je "Piskaralo" (bez ranga); poslije se rang računa iz prosjeka bodova. */
export function izracunajRang(odigrane: number, prosjekBodova: number): string {
  if (odigrane < BROJ_PARTIJA_ZA_KALIBRACIJU) return 'Piskaralo';

  let rang = RANGOVI[0]!.naziv;
  for (const prag of RANGOVI) {
    if (prosjekBodova >= prag.minimalniProsjek) rang = prag.naziv;
  }
  return rang;
}
