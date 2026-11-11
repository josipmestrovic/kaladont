import { eq } from 'drizzle-orm';
import { AKTUALNA_VERZIJA_UVJETA } from 'zajednicko';
import { baza } from '../../src/baza/klijent.js';
import { igraci } from '../../src/baza/shema.js';

/** Polja za insert/update u testovima koji ulaze u igru bez UI dijaloga. */
export const PRIHVAT_UVJETA_ZA_TEST = {
  potvrdaDob16: true as const,
  uvjetiVerzija: AKTUALNA_VERZIJA_UVJETA,
  uvjetiPrihvaceniAt: new Date(),
};

export async function oznaciPrihvatUvjeta(igracId: string): Promise<void> {
  await baza.update(igraci).set(PRIHVAT_UVJETA_ZA_TEST).where(eq(igraci.id, igracId));
}
