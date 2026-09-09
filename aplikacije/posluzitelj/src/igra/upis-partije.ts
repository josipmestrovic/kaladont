/**
 * Upis partije u bazu (model-podataka.md): partije, sudionici_partije, potezi, agregati u igraci.
 * DB pozivi iz motora partije su "fire and forget" (ne blokiraju tijek igre) osim zaključka partije,
 * koji je transakcijski jer mijenja više tablica odjednom.
 */
import { and, eq, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci, partije, potezi, sudioniciPartije } from '../baza/shema.js';
import type { SudionikPartije } from './motor-partije.js';

export function zapisiPocetakPartije(
  partijaId: string,
  sudionici: SudionikPartije[],
  cekanjeMsPoIgracu: Map<string, number>,
): Promise<void> {
  return baza
    .insert(partije)
    .values({ id: partijaId, status: 'u_tijeku' })
    .then(() =>
      baza.insert(sudioniciPartije).values(
        sudionici.map((s) => ({
          partijaId,
          igracId: s.igracId,
          sjedalo: s.sjedalo,
          cekanjeMs: cekanjeMsPoIgracu.get(s.igracId) ?? 0,
        })),
      ),
    )
    .then(() => undefined)
    .catch((greska) => console.error('Neuspio upis početka partije:', greska));
}

export interface ZapisPoteza {
  partijaId: string;
  runda: number;
  redniBroj: number;
  igracId: string | null;
  vrsta: 'rijec' | 'ne_znam' | 'istek' | 'prekid' | 'auto_kraj' | 'kaladont' | 'sustav_rijec';
  rijec: string | null;
  trazenaSlova: string | null;
  trajanjeMs: number;
}

export function zapisiPotez(zapis: ZapisPoteza): void {
  void baza.insert(potezi).values(zapis).catch((greska) => console.error('Neuspio upis poteza:', greska));
}

export interface ZapisSudionika {
  igracId: string;
  plasman: 1 | 2 | 3 | 4;
  bodovi: number;
  eliminacije: number;
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'pobjednik' | 'kaladont';
}

/** Zaključuje partiju transakcijski i vraća ažurirane agregate (bodovi_ukupno, odigrane) po igraču. */
export async function zakljuciPartijuUBazi(
  partijaId: string,
  pobjednikId: string,
  rezultati: ZapisSudionika[],
): Promise<Map<string, { bodoviUkupno: number; odigrane: number }>> {
  const agregati = new Map<string, { bodoviUkupno: number; odigrane: number }>();

  await baza.transaction(async (tx) => {
    await tx
      .update(partije)
      .set({ status: 'zavrsena', kraj: new Date(), pobjednikId })
      .where(eq(partije.id, partijaId));

    for (const r of rezultati) {
      await tx
        .update(sudioniciPartije)
        .set({
          plasman: r.plasman,
          bodovi: r.bodovi,
          eliminacije: r.eliminacije,
          nacinIspadanja: r.nacinIspadanja,
        })
        .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, r.igracId)));

      const [azurirani] = await tx
        .update(igraci)
        .set({
          odigrane: sql`${igraci.odigrane} + 1`,
          pobjede: sql`${igraci.pobjede} + ${r.plasman === 1 ? 1 : 0}`,
          eliminacijeUkupno: sql`${igraci.eliminacijeUkupno} + ${r.eliminacije}`,
          bodoviUkupno: sql`${igraci.bodoviUkupno} + ${r.bodovi}`,
        })
        .where(eq(igraci.id, r.igracId))
        .returning({ bodoviUkupno: igraci.bodoviUkupno, odigrane: igraci.odigrane });

      if (azurirani) {
        agregati.set(r.igracId, azurirani);
      }
    }
  });

  return agregati;
}
