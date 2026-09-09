/** Plasman + eliminacije + bonus. Maksimalno 7 bodova po igraču (bodovanje-i-rangovi.md). */

export type Plasman = 1 | 2 | 3 | 4;

export const BODOVI_PLASMANA: Record<Plasman, number> = {
  1: 3,
  2: 2,
  3: 1,
  4: 0,
};

export const BONUS_PRVO_MJESTO = 1;
export const MAKSIMALNI_BODOVI = 7;

export interface RezultatIgraca {
  plasman: Plasman;
  eliminacije: number;
}

/** Bodovi jednog igrača u jednoj partiji: plasman + eliminacije + bonus za 1. mjesto. */
export function izracunajBodove(rezultat: RezultatIgraca): number {
  const bonus = rezultat.plasman === 1 ? BONUS_PRVO_MJESTO : 0;
  return BODOVI_PLASMANA[rezultat.plasman] + rezultat.eliminacije + bonus;
}
