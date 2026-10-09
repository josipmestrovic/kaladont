/**
 * Verzionirani parametri ponašanja bota (ADR-017, docs/02-pravila-igre/botovi.md).
 * Postoci se mijenjaju ovdje ili env varijablama, ne skrivenim konstantama u logici.
 */
export const VERZIJA_BOT_POLITIKE = 1;

export type KategorijaRijeci = 'uobicajena' | 'srednja' | 'rijetka';
export type RitamPoteza = 'brz' | 'srednji' | 'spor';

export interface KonfiguracijaBota {
  verzija: typeof VERZIJA_BOT_POLITIKE;
  /** Udjeli kategorija riječi u vrećici (zbroj 100). */
  udioKategorija: Record<KategorijaRijeci, number>;
  /** Korpusna frekvencija: >= uobicajena je uobičajena, >= srednja je srednja, ostalo (uključujući 0) rijetko. */
  pragFrekvencije: { uobicajena: number; srednja: number };
  /** Udjeli ritmova u vrećici (zbroj 100). */
  udioRitma: Record<RitamPoteza, number>;
  /** Raspon udjela roka poteza za svaki ritam. */
  rasponRitma: Record<RitamPoteza, readonly [number, number]>;
  dodatakPoGrafemuMs: number;
  maksDodatakMs: number;
  najmanjeRazmisljanjeMs: number;
  marginaRokaMs: number;
  /** Odgoda kad partija nema timer (testovi, privatna soba bez tajmera). */
  odgodaBezTimeraMs: number;
  /** Udio partija u kojima bot dobije najviše jedan namjerni propust. */
  udioPartijaSPropustom: number;
  /** Prefiks je težak kad ima manje od ovoliko nepotrošenih uobičajenih leksemskih grupa. */
  pragTeskogPrefiksa: number;
  /** Vjerojatnost da bot ostavi riječ na „ka” kad takva postoji među kandidatima. */
  vjerojatnostOstavljanjaKa: number;
}

export const ZADANA_KONFIGURACIJA_BOTA: KonfiguracijaBota = {
  verzija: VERZIJA_BOT_POLITIKE,
  udioKategorija: { uobicajena: 80, srednja: 17, rijetka: 3 },
  pragFrekvencije: { uobicajena: 100, srednja: 10 },
  udioRitma: { brz: 20, srednji: 65, spor: 15 },
  rasponRitma: { brz: [0.08, 0.2], srednji: [0.2, 0.5], spor: [0.5, 0.78] },
  dodatakPoGrafemuMs: 120,
  maksDodatakMs: 2_500,
  najmanjeRazmisljanjeMs: 800,
  marginaRokaMs: 1_500,
  odgodaBezTimeraMs: 300,
  udioPartijaSPropustom: 0.1,
  pragTeskogPrefiksa: 3,
  vjerojatnostOstavljanjaKa: 0.05,
};

function postotak(vrijednost: string | undefined, zadano: number): number {
  const broj = Number(vrijednost);
  return vrijednost !== undefined && Number.isFinite(broj) && broj >= 0 && broj <= 1 ? broj : zadano;
}

export function ucitajKonfiguracijuBota(env: NodeJS.ProcessEnv = process.env): KonfiguracijaBota {
  const prag = Number(env.BOT_PRAG_TESKOG_PREFIKSA);
  return {
    ...ZADANA_KONFIGURACIJA_BOTA,
    udioPartijaSPropustom: postotak(env.BOT_UDIO_PARTIJA_S_PROPUSTOM, ZADANA_KONFIGURACIJA_BOTA.udioPartijaSPropustom),
    vjerojatnostOstavljanjaKa: postotak(env.BOT_VJEROJATNOST_KA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostOstavljanjaKa),
    pragTeskogPrefiksa: Number.isInteger(prag) && prag >= 0 ? prag : ZADANA_KONFIGURACIJA_BOTA.pragTeskogPrefiksa,
  };
}
