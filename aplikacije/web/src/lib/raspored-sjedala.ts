import type { PocetakPartije } from 'zajednicko';

type Sjedalo = PocetakPartije['sjedala'][number];

/**
 * Izvodi red sjedala iz perspektive lokalnog igrača.
 * Kanonski red ostaje nepromijenjen; ovo je samo redoslijed prikaza.
 */
export function izvediLokalniRedSjedala(
  sjedala: readonly Sjedalo[],
  mojIgracId: string | null,
  naPotezuId: string | null,
): Sjedalo[] {
  if (sjedala.length === 0) return [];
  if (mojIgracId === null) return [...sjedala];

  const lokalniIndeks = sjedala.findIndex((sjedalo) => sjedalo.igracId === mojIgracId);
  if (lokalniIndeks === -1) return [...sjedala];

  const lokalni = sjedala[lokalniIndeks];
  const aktivniIndeks = sjedala.findIndex((sjedalo) => sjedalo.igracId === naPotezuId);
  const sidroIndeks = aktivniIndeks >= 0 && aktivniIndeks !== lokalniIndeks
    ? aktivniIndeks
    : (lokalniIndeks + 1) % sjedala.length;

  const red: Sjedalo[] = [lokalni];
  const dodani = new Set([lokalni.igracId]);

  for (let pomak = 0; pomak < sjedala.length; pomak += 1) {
    const indeks = (sidroIndeks + pomak) % sjedala.length;
    const sjedalo = sjedala[indeks];
    if (!dodani.has(sjedalo.igracId)) {
      red.push(sjedalo);
      dodani.add(sjedalo.igracId);
    }
  }

  return red;
}