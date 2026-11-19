/**
 * Obvezne brze poruke botova: fiksnim poolovima po događaju, bez vjerojatnosti izostanka.
 * Odgoda je baza (zadano 2 s) plus nasumično 0–1 s. Presentation RNG odvojen od odluke o riječi.
 */
import type { BrzaPoruka } from 'zajednicko';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import type { Rng } from './odabir-rijeci.js';

export const POOL_POZDRAV = ['pozdrav', 'cao', 'hej'] as const satisfies readonly BrzaPoruka[];
export const POOL_SORRY = ['sorry', 'oprosi'] as const satisfies readonly BrzaPoruka[];
export const POOL_BRAVO = ['dobro-odigrano', 'najjaci', 'svaka-cast'] as const satisfies readonly BrzaPoruka[];

export const MINIMALNA_ODGODA_REAKCIJE_MS = 2_000;
export const DODATNA_ODGODA_REAKCIJE_MS = 1_000;

function izaberiIzPoola(pool: readonly BrzaPoruka[], rng: Rng): BrzaPoruka {
  const indeks = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool[indeks]!;
}

export function odgodaReakcijeMs(rng: Rng, konfiguracija?: Pick<KonfiguracijaBota, 'odgodaReakcijeMinMs'>): number {
  const baza = konfiguracija?.odgodaReakcijeMinMs ?? MINIMALNA_ODGODA_REAKCIJE_MS;
  return baza + Math.floor(rng() * (DODATNA_ODGODA_REAKCIJE_MS + 1));
}

export function odaberiReakcijuNaPocetku(rng: Rng): BrzaPoruka {
  return izaberiIzPoola(POOL_POZDRAV, rng);
}

export function odaberiReakcijuPriEliminacijiProtivnika(rng: Rng): BrzaPoruka {
  return izaberiIzPoola(POOL_SORRY, rng);
}

export function odaberiReakcijuPriIspadanju(rng: Rng): BrzaPoruka {
  return izaberiIzPoola(POOL_BRAVO, rng);
}
