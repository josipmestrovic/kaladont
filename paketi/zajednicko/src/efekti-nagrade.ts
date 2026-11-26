import type { StavkaIskustva } from './iskustvo.js';
import type { NagradaZaRijec } from './protokol.js';
import { RIJECI_KALADONT } from './pravila.js';

export type IntenzitetKonfeta = 'mali' | 'srednji' | 'veliki';
export type VrstaNagradnogEfekta = 'duza_rijetka' | 'kaladont';

export type NagradniEfektPoteza = {
  vrsta: VrstaNagradnogEfekta;
  intenzitetKonfeta: IntenzitetKonfeta;
  zvuk: 'aplauz-kaladont' | null;
};

const REDOSLIJED_INTENZITETA: readonly IntenzitetKonfeta[] = ['mali', 'srednji', 'veliki'];

function jaciIntenzitet(prvi: IntenzitetKonfeta, drugi: IntenzitetKonfeta): IntenzitetKonfeta {
  return REDOSLIJED_INTENZITETA[
    Math.max(REDOSLIJED_INTENZITETA.indexOf(prvi), REDOSLIJED_INTENZITETA.indexOf(drugi))
  ]!;
}

function intenzitetIzXp(xp: number): IntenzitetKonfeta {
  if (xp >= 35) return 'veliki';
  if (xp >= 20) return 'srednji';
  return 'mali';
}

/** Normalizacija kao na serveru (NFC + hr lower). */
export function normalizirajRijecZaEfekt(rijec: string): string {
  return rijec.normalize('NFC').toLocaleLowerCase('hr-HR');
}

/**
 * Jedan nagradni efekt za potvrđeni potez lokalnog autora.
 * Kaladont ima prednost nad dugom/rijetkom (bez duplog okidanja).
 */
export function odrediEfektPrihvacenogPoteza(
  rijec: string,
  stavke: readonly StavkaIskustva[],
  nagrada: NagradaZaRijec | null,
): NagradniEfektPoteza | null {
  const normalizirana = normalizirajRijecZaEfekt(rijec);
  if (RIJECI_KALADONT.has(normalizirana)) {
    return { vrsta: 'kaladont', intenzitetKonfeta: 'veliki', zvuk: 'aplauz-kaladont' };
  }

  const najjacaXp = Math.max(
    0,
    ...stavke
      .filter((stavka) => stavka.vrsta === 'duge_rijeci' || stavka.vrsta === 'rijetke_rijeci')
      .map((stavka) => stavka.iskustvo),
  );
  let intenzitet: IntenzitetKonfeta | null = najjacaXp > 0 ? intenzitetIzXp(najjacaXp) : null;
  if (nagrada?.intenzitet) {
    intenzitet = intenzitet ? jaciIntenzitet(intenzitet, nagrada.intenzitet) : nagrada.intenzitet;
  }
  if (!intenzitet) return null;
  return { vrsta: 'duza_rijetka', intenzitetKonfeta: intenzitet, zvuk: null };
}

/** Pljesak pobjede samo kad je lokalni ljudski igrač prvi. */
export function trebaPljesakPobjede(mojIgracId: string | null | undefined, pobjednikId: string | null | undefined): boolean {
  return Boolean(mojIgracId && pobjednikId && mojIgracId === pobjednikId);
}
