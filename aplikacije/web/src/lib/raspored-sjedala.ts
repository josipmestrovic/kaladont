import type { PocetakPartije } from 'zajednicko';

type Sjedalo = PocetakPartije['sjedala'][number];

/**
 * Izvodi red sjedala iz perspektive lokalnog igrača.
 * Kanonski red ostaje nepromijenjen; ovo je samo redoslijed prikaza.
 */
export function izvediLokalniRedSjedala(
  sjedala: readonly Sjedalo[],
  mojIgracId: string | null,
): Sjedalo[] {
  if (sjedala.length === 0 || mojIgracId === null) return [];

  const lokalniIndeks = sjedala.findIndex((sjedalo) => sjedalo.igracId === mojIgracId);
  if (lokalniIndeks === -1) return [];

  return [...sjedala.slice(lokalniIndeks), ...sjedala.slice(0, lokalniIndeks)];
}
