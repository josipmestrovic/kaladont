import { lt } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { sanducicPoruke } from '../baza/shema.js';

/** Poruke sandučica žive najviše 3 dana od stvaranja. */
export const ROK_SANDUCIC_PORUKE_MS = 3 * 24 * 60 * 60 * 1000;

export function granicaZadrzavanjaSanducica(sada = new Date()): Date {
  return new Date(sada.getTime() - ROK_SANDUCIC_PORUKE_MS);
}

/** Briše sve sandučic poruke starije od 3 dana. */
export async function ocistiStareSanducicPoruke(sada = new Date()): Promise<number> {
  const granica = granicaZadrzavanjaSanducica(sada);
  const obrisane = await baza
    .delete(sanducicPoruke)
    .where(lt(sanducicPoruke.stvorenaAt, granica))
    .returning({ id: sanducicPoruke.id });
  return obrisane.length;
}
