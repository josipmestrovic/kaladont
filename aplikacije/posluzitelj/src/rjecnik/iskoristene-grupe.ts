/**
 * Nadopuna potrošenih leksičkih grupa nakon inkrementalnog osvježenja rječnika (#89).
 */
import type { RjecnikUMemoriji } from './ucitaj.js';

export function nadopuniIskoristeneGrupe(
  rjecnik: Pick<RjecnikUMemoriji, 'grupeZa'>,
  iskoristeneGrupe: Set<string>,
  odigraniOblici: Iterable<string>,
): number {
  let dodano = 0;
  const vidjeno = new Set<string>();
  for (const rijec of odigraniOblici) {
    const normalizirano = rijec.normalize('NFC').trim().toLowerCase();
    if (!normalizirano || vidjeno.has(normalizirano)) continue;
    vidjeno.add(normalizirano);
    for (const grupa of rjecnik.grupeZa(normalizirano)) {
      if (!iskoristeneGrupe.has(grupa)) {
        iskoristeneGrupe.add(grupa);
        dodano += 1;
      }
    }
  }
  return dodano;
}