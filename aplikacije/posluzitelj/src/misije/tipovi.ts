import type { baza } from '../baza/klijent.js';
import type { Rng } from './generator.js';

export type MisijeTx = Parameters<Parameters<typeof baza.transaction>[0]>[0];

export interface MisijeSatRng {
  sada: () => Date;
  rng: Rng;
}

export const zadaniSatRng: MisijeSatRng = {
  sada: () => new Date(),
  rng: Math.random,
};

export type SnapshotMisije = {
  predlozakId: string;
  verzijaDefinicije: number;
  naziv: string;
  opis: string;
  metrika: string;
  cilj: number;
  pragMetrike: number | null;
  podciljevi: { kljuc: string; naziv: string; cilj: number }[] | null;
  xp: number;
  obitelj: string;
  zahtjevnija: boolean;
  kontekst: 'javna' | 'trening';
  /** HINT PR12: uključuje tri_igraca; stari snapshoti mogu imati samo oba|dva|cetiri. */
  mod: 'oba' | 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca';
  /**
   * PR12: skup formata (npr. D23). Nedostaje na starim snapshotima → matcher koristi `mod`.
   */
  modovi?: ('dva_igraca' | 'tri_igraca' | 'cetiri_igraca')[] | null;
  /**
   * PR12: filter pravilnika. Nedostaje na starim snapshotima → nema filtera po pravilniku.
   */
  pravilnik?: 'klasicni' | 'ka_zna' | 'dokazi_nastavak' | null;
};

export type PodstanjeMisije = {
  podciljevi?: Record<string, number>;
  dani?: string[];
  poceci?: string[];
};
