/**
 * Cache i sigurno razrješavanje putanja za neverzionirane statičke asete.
 * Generirani avatari (/avatari/g/:hash) ostaju na zasebnoj ruti s immutable cacheom.
 */
import path from 'node:path';

/** Neverzionirani URL-ovi (ikone, fontovi, zvukovi, …) — kratki cache + revalidacija nakon deploya. */
export const CACHE_NEVERZIONIRANIH_ASETA = 'public, max-age=3600, must-revalidate';

/** Sadržajno hashirani URL-ovi (npr. /avatari/g/:hash/:velicina.webp). */
export const CACHE_HASHIRANIH_ASETA = 'public, max-age=31536000, immutable';

/**
 * Vraća apsolutnu putanju unutar korijena ili null ako je izvan (path traversal).
 * Ne koristi startsWith — koristi path.relative kao u /avatari/g rutama.
 */
export function razrijesiPutanjuUnutarKorijena(korijenDir: string, relativna: string): string | null {
  if (!relativna || relativna.includes('\0')) return null;
  const korijen = path.resolve(korijenDir);
  const puni = path.resolve(korijen, relativna);
  const relativno = path.relative(korijen, puni);
  if (relativno === '' || relativno.startsWith('..') || path.isAbsolute(relativno)) {
    return null;
  }
  return puni;
}
