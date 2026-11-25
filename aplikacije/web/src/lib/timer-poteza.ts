/** Čista logika roka poteza (#142 F). */

export function normalizirajIstekPotezaIso(vrijednost: string | null | undefined): string | null {
  if (vrijednost == null) return null;
  if (vrijednost === '') return null;
  return vrijednost;
}

export function timerAktivanIzSnimke(ulaz: {
  timerAktivan?: boolean;
  istekPotezaIso: string | null | undefined;
  trajanjePotezaSek?: number | null;
  faza?: string | null;
}): boolean {
  if (typeof ulaz.timerAktivan === 'boolean') return ulaz.timerAktivan;
  if (ulaz.faza === 'sustav_bira' || ulaz.faza === 'zavrsena') return false;
  if (ulaz.trajanjePotezaSek === 0) return false;
  return normalizirajIstekPotezaIso(ulaz.istekPotezaIso) !== null;
}

/** Preostalo ms iz apsolutnog roka i pomaka sata; 0 ne znači eliminaciju. */
export function preostaloMsPoteza(ulaz: {
  istekIso: string;
  pomakSataMs: number;
  sadaMonotonicMs: number;
  bazaMonotonicMs: number;
  bazaWallMs: number;
}): number {
  const istek = Date.parse(ulaz.istekIso);
  if (!Number.isFinite(istek)) return 0;
  const protekloWall = ulaz.sadaMonotonicMs - ulaz.bazaMonotonicMs;
  const sadaWall = ulaz.bazaWallMs + protekloWall;
  const serverSada = sadaWall + ulaz.pomakSataMs;
  return Math.max(0, istek - serverSada);
}
