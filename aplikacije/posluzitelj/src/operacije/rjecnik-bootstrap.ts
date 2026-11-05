import { count } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';

/** Prag punog hrLex uvoza (~1,21M oblika); CI fixture namjerno ostaje ispod. */
export const PRAG_PUNOG_RJECNIKA = 1_000_000;

export async function prebrojiRijeci(): Promise<number> {
  const [red] = await baza.select({ broj: count() }).from(rijeci);
  return Number(red?.broj ?? 0);
}

export type StanjeRjecnika = {
  broj: number;
  dovoljan: boolean;
  prag: number;
};

export async function stanjeRjecnika(prag = PRAG_PUNOG_RJECNIKA): Promise<StanjeRjecnika> {
  const broj = await prebrojiRijeci();
  return { broj, dovoljan: broj >= prag, prag };
}
