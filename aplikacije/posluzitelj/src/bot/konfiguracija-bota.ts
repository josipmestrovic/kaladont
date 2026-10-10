/**
 * Verzionirani parametri ponašanja bota (ADR-017, docs/02-pravila-igre/botovi.md).
 * Postoci se mijenjaju ovdje ili env varijablama, ne skrivenim konstantama u logici.
 */
export const VERZIJA_BOT_POLITIKE = 2;

export type KategorijaRijeci = 'uobicajena' | 'srednja' | 'rijetka';

export interface KonfiguracijaBota {
  verzija: typeof VERZIJA_BOT_POLITIKE;
  /** Korpusna frekvencija: >= uobicajena je uobičajena, >= srednja je srednja, ostalo (uključujući 0) rijetko. */
  pragFrekvencije: { uobicajena: number; srednja: number };
  marginaRokaMs: number;
  /** Vjerojatnost da bot ostavi riječ na „ka” kad takva postoji među kandidatima. */
  vjerojatnostOstavljanjaKa: number;
  vjerojatnostPropusta: number;
  vjerojatnostIsteka: number;
  treningRazmisljanjeMs: number;
  javnoRazmisljanjeMinMs: number;
  javnoRazmisljanjeMaksMs: number;
}

export const ZADANA_KONFIGURACIJA_BOTA: KonfiguracijaBota = {
  verzija: VERZIJA_BOT_POLITIKE,
  pragFrekvencije: { uobicajena: 100, srednja: 10 },
  marginaRokaMs: 1_500,
  vjerojatnostOstavljanjaKa: 0.05,
  vjerojatnostPropusta: 0.1,
  vjerojatnostIsteka: 0.005,
  treningRazmisljanjeMs: 3_000,
  javnoRazmisljanjeMinMs: 5_000,
  javnoRazmisljanjeMaksMs: 14_000,
};

function postotak(vrijednost: string | undefined, zadano: number): number {
  const broj = Number(vrijednost);
  return vrijednost !== undefined && Number.isFinite(broj) && broj >= 0 && broj <= 1 ? broj : zadano;
}

export function ucitajKonfiguracijuBota(env: NodeJS.ProcessEnv = process.env): KonfiguracijaBota {
  return {
    ...ZADANA_KONFIGURACIJA_BOTA,
    vjerojatnostOstavljanjaKa: postotak(env.BOT_VJEROJATNOST_KA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostOstavljanjaKa),
    vjerojatnostPropusta: postotak(env.BOT_VJEROJATNOST_NE_ZNAM, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostPropusta),
    vjerojatnostIsteka: postotak(env.BOT_VJEROJATNOST_ISTEKA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostIsteka),
  };
}
