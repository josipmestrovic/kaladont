import type { ModPartije } from './bodovanje.js';

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
  { naziv: 'Gospodar rječnika', minimalniProsjek: 5.0 },
  { naziv: 'Kaladont', minimalniProsjek: 5.7 },
];

export const RANGOVI_1V1: readonly PragRanga[] = [
  { naziv: 'Prvopisac', minimalniProsjek: 0.0 },
  { naziv: 'Riječarac', minimalniProsjek: 0.3 },
  { naziv: 'Jezičar', minimalniProsjek: 0.4 },
  { naziv: 'Lektor', minimalniProsjek: 0.47 },
  { naziv: 'Književnik', minimalniProsjek: 0.54 },
  { naziv: 'Jezikoslovac', minimalniProsjek: 0.61 },
  { naziv: 'Doktor riječi', minimalniProsjek: 0.68 },
  { naziv: 'Jezični maestro', minimalniProsjek: 0.75 },
  { naziv: 'Gospodar rječnika', minimalniProsjek: 0.82 },
  { naziv: 'Kaladont', minimalniProsjek: 0.89 },
];

export const BROJ_PARTIJA_ZA_KALIBRACIJU = 10;

function rangoviPoModu(mod: ModPartije): readonly PragRanga[] {
  return mod === 'dva_igraca' ? RANGOVI_1V1 : RANGOVI;
}

/** Dok ima manje od 10 partija igrač je "Piskaralo"; dovršena 10. partija dodjeljuje rang. */
export function izracunajRang(odigrane: number, prosjekBodova: number, mod: ModPartije = 'cetiri_igraca'): string {
  if (odigrane < BROJ_PARTIJA_ZA_KALIBRACIJU) return 'Piskaralo';

  const rangovi = rangoviPoModu(mod);
  let rang = rangovi[0]!.naziv;
  for (const prag of rangovi) {
    if (prosjekBodova >= prag.minimalniProsjek) rang = prag.naziv;
  }
  return rang;
}

function hijerarhijaRanga(rang: string | null): number {
  if (!rang || rang === 'Piskaralo') return -1;
  const indeks = RANGOVI.findIndex((r) => r.naziv === rang);
  return indeks >= 0 ? indeks : -1;
}

/** Vraća viši od dva ranga (koristi se za prikaz ranga u privatnoj sobi). */
export function vratiVeciRang(rang1: string | null, rang2: string | null): string | null {
  const h1 = hijerarhijaRanga(rang1);
  const h2 = hijerarhijaRanga(rang2);
  if (h1 < 0 && h2 < 0) return null;
  if (h1 >= h2) return rang1 === 'Piskaralo' ? null : rang1;
  return rang2 === 'Piskaralo' ? null : rang2;
}
