/**
 * Taktički poolovi riječi (Botovi V8 C09) — tipovi, normalizacija i priprema seeda.
 */
import { prvaDva } from 'zajednicko';
import { normalizirajRijecRjecnika } from '../rjecnik/administracija.js';
import {
  OCEKIVANI_BROJ_POOL1,
  OCEKIVANI_BROJ_POOL2,
  SEED_POOL1_RIJECI,
  SEED_POOL2_RIJECI,
} from './poolovi-seed.js';

export type KategorijaPoola = 'pool_1' | 'pool_2';
export type StanjePoolClana = 'nerazrijeseno' | 'razrijeseno';

export function normalizirajPoolRijec(rijec: string): string {
  return normalizirajRijecRjecnika(rijec);
}

/** Dva-grafemski ključ za indeks poolova (isti pravilo kao rječnik u memoriji). */
export function prefiksZaIndeksPoola(rijec: string): string {
  return prvaDva(normalizirajPoolRijec(rijec));
}

function deduplicirajNormirane(rijeci: readonly string[]): string[] {
  const videno = new Set<string>();
  const jedinstvene: string[] = [];
  for (const ulaz of rijeci) {
    const normirana = normalizirajPoolRijec(ulaz);
    if (videno.has(normirana)) continue;
    videno.add(normirana);
    jedinstvene.push(normirana);
  }
  return jedinstvene;
}

/** Baca ako ista normirana riječ pripada oba poola. */
export function validirajBezPreklapanjaPoolova(pool1: readonly string[], pool2: readonly string[]): void {
  const drugi = new Set(pool2);
  for (const rijec of pool1) {
    if (drugi.has(rijec)) {
      throw new Error(`Riječ "${rijec}" pripada i pool_1 i pool_2 nakon normalizacije.`);
    }
  }
}

/** Priprema uredničkog seeda: NFC, deduplikacija po poolu, provjera preklapanja i brojeva. */
export function pripremiSeedClanove(): { pool1: string[]; pool2: string[] } {
  const pool1 = deduplicirajNormirane(SEED_POOL1_RIJECI);
  const pool2 = deduplicirajNormirane(SEED_POOL2_RIJECI);
  validirajBezPreklapanjaPoolova(pool1, pool2);

  if (pool1.length !== OCEKIVANI_BROJ_POOL1) {
    throw new Error(`pool_1 mora imati ${OCEKIVANI_BROJ_POOL1} jedinstvenih riječi, dobiveno ${pool1.length}.`);
  }
  if (pool2.length !== OCEKIVANI_BROJ_POOL2) {
    throw new Error(`pool_2 mora imati ${OCEKIVANI_BROJ_POOL2} jedinstvenih riječi, dobiveno ${pool2.length}.`);
  }

  return { pool1, pool2 };
}