/** Plasman + eliminacije + bonus. Maksimalno 7 bodova po igraču (bodovanje-i-rangovi.md). */

import { odbijNepodrzaniMod, type ModPartije } from './katalog-partije.js';

export type { ModPartije } from './katalog-partije.js';
export {
  MODOVI_PARTIJE,
  PRAVILNICI_PARTIJE,
  ZADANI_PRAVILNIK,
  jePoznatiMod,
  jePoznatiPravilnik,
  zadaniPravilnik,
  javnaSjedalaZaMod,
  jePodrzaniJavniRed,
  odbijNepodrzaniMod,
  type PravilnikPartije,
} from './katalog-partije.js';

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

/** Bodovi jednog igrača u jednoj partiji: 4p mod = plasman + eliminacije + bonus; 1v1 mod = fiksno 1 bod za pobjedu, 0 za poraz. Troboj (PR03) još nije ovdje. */
export function izracunajBodove(rezultat: RezultatIgraca, mod: ModPartije = 'cetiri_igraca'): number {
  odbijNepodrzaniMod(mod, 'izracunajBodove');
  if (mod === 'dva_igraca') {
    return rezultat.plasman === 1 ? 1 : 0;
  }
  const bonus = rezultat.plasman === 1 ? BONUS_PRVO_MJESTO : 0;
  return BODOVI_PLASMANA[rezultat.plasman] + rezultat.eliminacije + bonus;
}
