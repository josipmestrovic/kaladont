/** Trenutna verzija Uvjeta korištenja — mora se poklapati s datumom na /uvjeti. */
export const AKTUALNA_VERZIJA_UVJETA = '2026-11-11';

export function jePrihvacenaAktualnaVerzijaUvjeta(
  potvrdaDob16: boolean,
  uvjetiVerzija: string | null | undefined,
): boolean {
  return potvrdaDob16 === true && uvjetiVerzija === AKTUALNA_VERZIJA_UVJETA;
}
