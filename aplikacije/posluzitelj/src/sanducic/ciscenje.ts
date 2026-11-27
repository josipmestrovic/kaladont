import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { MAKS_SANDUCIC_PORUKA_PO_IGRACU } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { sanducicPoruke } from '../baza/shema.js';
import type { TxSanducic } from './prekretnice.js';

/** Poruke sandučica žive najviše 3 dana od stvaranja. */
export const ROK_SANDUCIC_PORUKE_MS = 3 * 24 * 60 * 60 * 1000;

type DbZaCiscenje = typeof baza | TxSanducic;

export function granicaZadrzavanjaSanducica(sada = new Date()): Date {
  return new Date(sada.getTime() - ROK_SANDUCIC_PORUKE_MS);
}

/**
 * Zadrži samo najnovijih `maks` poruka jednog igrača.
 * Redoslijed: stvorena_at DESC, id DESC.
 */
export async function ograniciPorukeIgraca(
  igracId: string,
  db: DbZaCiscenje = baza,
  maks = MAKS_SANDUCIC_PORUKA_PO_IGRACU,
): Promise<number> {
  const visak = await db
    .select({ id: sanducicPoruke.id })
    .from(sanducicPoruke)
    .where(eq(sanducicPoruke.igracId, igracId))
    .orderBy(desc(sanducicPoruke.stvorenaAt), desc(sanducicPoruke.id))
    .offset(maks);
  if (visak.length === 0) return 0;
  const obrisane = await db
    .delete(sanducicPoruke)
    .where(and(
      eq(sanducicPoruke.igracId, igracId),
      inArray(sanducicPoruke.id, visak.map((red) => red.id)),
    ))
    .returning({ id: sanducicPoruke.id });
  return obrisane.length;
}

/** Jednokratni / periodički backfill: skratiti sve sandučiće iznad limita. */
export async function ograniciSveSanduciceNaLimit(
  maks = MAKS_SANDUCIC_PORUKA_PO_IGRACU,
): Promise<number> {
  const redci = await baza.execute(sql`
    WITH rangirani AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY igrac_id
          ORDER BY stvorena_at DESC, id DESC
        ) AS redni
      FROM sanducic_poruke
    ),
    obrisani AS (
      DELETE FROM sanducic_poruke sp
      USING rangirani r
      WHERE sp.id = r.id AND r.redni > ${maks}
      RETURNING sp.id
    )
    SELECT count(*)::int AS broj FROM obrisani
  `);
  const prvi = [...redci as Iterable<{ broj?: number }> ][0];
  return Number(prvi?.broj ?? 0);
}

/** Briše poruke starije od 3 dana, zatim skraćuje sandučiće na limit po igraču. */
export async function ocistiStareSanducicPoruke(sada = new Date()): Promise<number> {
  const granica = granicaZadrzavanjaSanducica(sada);
  const obrisane = await baza
    .delete(sanducicPoruke)
    .where(lt(sanducicPoruke.stvorenaAt, granica))
    .returning({ id: sanducicPoruke.id });
  const trimano = await ograniciSveSanduciceNaLimit();
  return obrisane.length + trimano;
}
