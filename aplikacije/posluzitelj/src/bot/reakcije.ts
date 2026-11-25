/**
 * Obvezne brze poruke botova: fiksnim poolovima po događaju, bez vjerojatnosti izostanka.
 * Eliminacijske reakcije: baza (zadano 2 s) + nasumično 0–1 s.
 * Početni pozdravi: kontekstualni ukupni odmak (bez dodatnog jittera povrh rasporeda).
 */
import type { BrzaPoruka, KontekstPartije } from 'zajednicko';
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

function izmeduMs(minMs: number, maxMs: number, rng: Rng): number {
  if (maxMs <= minMs) return minMs;
  return minMs + Math.floor(rng() * (maxMs - minMs + 1));
}

export function odgodaReakcijeMs(rng: Rng, konfiguracija?: Pick<KonfiguracijaBota, 'odgodaReakcijeMinMs'>): number {
  const baza = konfiguracija?.odgodaReakcijeMinMs ?? MINIMALNA_ODGODA_REAKCIJE_MS;
  return baza + Math.floor(rng() * (DODATNA_ODGODA_REAKCIJE_MS + 1));
}

/**
 * Ukupni odmak početnog pozdrava od sidra (najava stola ili otvaranje 1. runde).
 * `indeksBota` je 0-bazirani redoslijed u ovoj partiji — ne dodavati još jedan jitter povrh.
 */
export function odgodaPocetnogPozdravaMs(
  kontekst: KontekstPartije,
  indeksBota: number,
  rng: Rng,
): number {
  if (kontekst === 'javna') {
    // Od otvaranja prve runde: 1–1,5 s pa 2–3 s.
    if (indeksBota <= 0) return izmeduMs(1_000, 1_500, rng);
    return izmeduMs(2_000, 3_000, rng) + indeksBota * 150;
  }
  // Stol već vidljiv: ~0,5–1 s, zatim postupno kroz 1–3 s (može kratko u 1. rundu).
  if (indeksBota <= 0) return izmeduMs(500, 1_000, rng);
  return izmeduMs(1_000, 3_000, rng) + indeksBota * 200;
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
