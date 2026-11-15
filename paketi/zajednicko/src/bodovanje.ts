/** Plasman + eliminacije + bonus. Javni max: Dvoboj 1, Troboj 5, Četveroboj 7. */

import { javnaSjedalaZaMod, type ModPartije } from './katalog-partije.js';

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

/** Javni plasman Četveroboja; zadržano za postojeće tablice i testove. */
export type Plasman = 1 | 2 | 3 | 4;

/** Bodovi za plasman u Četveroboju (`n − plasman`). */
export const BODOVI_PLASMANA: Record<Plasman, number> = {
  1: 3,
  2: 2,
  3: 1,
  4: 0,
};

export const BONUS_PRVO_MJESTO = 1;
export const MAKSIMALNI_BODOVI = 7;
export const MAKSIMALNI_BODOVI_TROBOJ = 5;

export interface RezultatIgraca {
  /** Javni plasman 1..n za format; privatni 1–8 ne ide kroz ovu formulu. */
  plasman: number;
  eliminacije: number;
}

export function maksimalniBodoviZaMod(mod: ModPartije): number {
  switch (mod) {
    case 'dva_igraca':
      return 1;
    case 'tri_igraca':
      return MAKSIMALNI_BODOVI_TROBOJ;
    case 'cetiri_igraca':
      return MAKSIMALNI_BODOVI;
    default: {
      const _nevazeci: never = mod;
      throw new Error(`Nepoznat mod: ${String(_nevazeci)}`);
    }
  }
}

function odbijNevaljanJavniPlasman(mod: ModPartije, plasman: number): void {
  const n = javnaSjedalaZaMod(mod);
  if (!Number.isInteger(plasman) || plasman < 1 || plasman > n) {
    throw new Error(`izracunajBodove: nevaljan javni plasman ${plasman} za ${mod} (dozvoljeno 1–${n}).`);
  }
}

/**
 * Bodovi jednog igrača u jednoj javnoj partiji.
 * Dvoboj: 1/0. Troboj/Četveroboj: (n − plasman) + bonus pobjede + eliminacije.
 */
export function izracunajBodove(rezultat: RezultatIgraca, mod: ModPartije = 'cetiri_igraca'): number {
  odbijNevaljanJavniPlasman(mod, rezultat.plasman);
  const eliminacije = Math.max(0, Math.floor(rezultat.eliminacije));

  switch (mod) {
    case 'dva_igraca':
      return rezultat.plasman === 1 ? 1 : 0;
    case 'tri_igraca':
    case 'cetiri_igraca': {
      const n = javnaSjedalaZaMod(mod);
      const bodoviPlasmana = n - rezultat.plasman;
      const bonus = rezultat.plasman === 1 ? BONUS_PRVO_MJESTO : 0;
      return bodoviPlasmana + eliminacije + bonus;
    }
    default: {
      const _nevazeci: never = mod;
      throw new Error(`Nepoznat mod: ${String(_nevazeci)}`);
    }
  }
}
