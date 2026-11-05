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
  mod: 'oba' | 'dva_igraca' | 'cetiri_igraca';
};

export type PodstanjeMisije = {
  podciljevi?: Record<string, number>;
  dani?: string[];
  poceci?: string[];
};
