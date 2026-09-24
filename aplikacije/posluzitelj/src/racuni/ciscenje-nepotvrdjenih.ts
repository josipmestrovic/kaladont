import { and, eq, lt } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';

const ROK_NEPOTVRDENOG_RACUNA_MS = 7 * 24 * 60 * 60 * 1000;

/** Briše nepotvrđene, neaktivne račune kojima je rok za potvrdu istekao. */
export async function ocistiIstekleNepotvrdjeneRacune(): Promise<number> {
  const granica = new Date(Date.now() - ROK_NEPOTVRDENOG_RACUNA_MS);
  const obrisani = await baza
    .delete(igraci)
    .where(and(
      eq(igraci.vrsta, 'registriran'),
      eq(igraci.emailPotvrdjen, false),
      lt(igraci.emailPotvrdaZatrazenAt, granica),
      eq(igraci.odigrane, 0),
      eq(igraci.odigrane1v1, 0),
    ))
    .returning({ id: igraci.id });
  return obrisani.length;
}
