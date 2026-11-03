/**
 * Odabir brzih poruka botova: globalne vjerojatnosti iz KonfiguracijaBota, bez per-bot osobnosti.
 * Odgoda je uvijek ≥ 2 s, plus nasumično 0–3 s (ukupno 2–5 s).
 */
import type { BrzaPoruka } from 'zajednicko';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import type { Rng } from './odabir-rijeci.js';

export const MINIMALNA_ODGODA_REAKCIJE_MS = 2_000;
export const DODATNA_ODGODA_REAKCIJE_MS = 3_000;

export function odgodaReakcijeMs(rng: Rng): number {
  return MINIMALNA_ODGODA_REAKCIJE_MS + Math.floor(rng() * (DODATNA_ODGODA_REAKCIJE_MS + 1));
}

export function odaberiReakcijuNaPocetku(konfiguracija: KonfiguracijaBota, rng: Rng): BrzaPoruka | null {
  return rng() < konfiguracija.vjerojatnostReakcijePozdravNaPocetku ? 'pozdrav' : null;
}

export function odaberiReakcijuPriEliminacijiProtivnika(konfiguracija: KonfiguracijaBota, rng: Rng): BrzaPoruka | null {
  return rng() < konfiguracija.vjerojatnostReakcijeSorryPriEliminaciji ? 'sorry' : null;
}

/** Jedan roll: prvo bravo, zatim hvala u preostalom dijelu skale — nikad obje. */
export function odaberiReakcijuPriIspadanju(konfiguracija: KonfiguracijaBota, rng: Rng): BrzaPoruka | null {
  const roll = rng();
  if (roll < konfiguracija.vjerojatnostReakcijeBravoPriIspadanju) return 'dobro-odigrano';
  if (roll < konfiguracija.vjerojatnostReakcijeBravoPriIspadanju + konfiguracija.vjerojatnostReakcijeHvalaPriIspadanju) {
    return 'najjaci';
  }
  return null;
}
