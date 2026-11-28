/**
 * Jedan trajni INSERT po terminalnom pokušaju čekanja (idempotentan).
 */
import { baza } from '../baza/klijent.js';
import { analitikaCekanja } from '../baza/shema.js';
import { uRedAnalitike } from './red-upisa.js';
import type { IshodAnalitikeCekanja, SnimkaPokusajaCekanja } from './cekanje-zivotni-ciklus.js';

export async function upsertZapisCekanja(
  snimka: SnimkaPokusajaCekanja,
  ishod: IshodAnalitikeCekanja,
  krajU: Date,
): Promise<void> {
  await baza
    .insert(analitikaCekanja)
    .values({
      id: snimka.attemptId,
      kljucReda: snimka.kljucReda,
      mod: snimka.mod,
      pravila: snimka.pravila,
      vrstaRacunaNaPocetku: snimka.vrstaRacuna,
      pocetakU: snimka.pocetakU,
      krajU,
      ishod,
    })
    .onConflictDoNothing();
}

export function zabiljeziZapisCekanja(
  snimka: SnimkaPokusajaCekanja,
  ishod: IshodAnalitikeCekanja,
  krajU: Date = new Date(),
): void {
  uRedAnalitike(() => upsertZapisCekanja(snimka, ishod, krajU), 'cekanje');
}
