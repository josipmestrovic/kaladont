/**
 * Terminalni CAS završetak pokušaja Izazova (PR03).
 * Nagrade / zavrseci / XP — stub hook za PR04.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { RazlogNeuspjehaIzazova, StatusPokusajaIzazova } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { pokusajiIzazova } from '../baza/shema.js';
import type { MetrikePokusajaIzazova } from './evaluacija.js';
import type { RedakPokusajaIzazova } from './pohrana.js';

/** Rezultati vidljivi 8 s nakon terminalAt (klijent ne resetira na refresh). */
export const ODGODA_REZULTATA_IZAZOVA_MS = 8_000;

export type TerminalniStatusIzazova = Extract<
  StatusPokusajaIzazova,
  'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto'
>;

export interface UlazTerminalnogPokusaja {
  attemptId: string;
  status: TerminalniStatusIzazova;
  razlog?: RazlogNeuspjehaIzazova | null;
  metrics: MetrikePokusajaIzazova | Record<string, unknown>;
  gameWon: boolean | null;
  terminalAt?: Date;
  partijaId?: string | null;
}

/** PR04: XP, Izazivač, misije, sandučić — no-op do settlement PR-a. */
export async function nakonTerminalnogPokusaja(
  _redak: RedakPokusajaIzazova,
): Promise<void> {
  /* stub PR04 */
}

/**
 * Compare-and-set: samo iz rezerviran/u_tijeku.
 * Ponovljeni poziv (isti attemptId) vraća postojeći terminalni redak — idempotentno.
 */
export async function zavrsiPokusajIzazova(
  ulaz: UlazTerminalnogPokusaja,
): Promise<RedakPokusajaIzazova | null> {
  const terminalAt = ulaz.terminalAt ?? new Date();
  const resultsVisibleAt = new Date(terminalAt.getTime() + ODGODA_REZULTATA_IZAZOVA_MS);

  const [azuriran] = await baza
    .update(pokusajiIzazova)
    .set({
      status: ulaz.status,
      reason: ulaz.status === 'neuspjeh' ? (ulaz.razlog ?? null) : null,
      metrics: ulaz.metrics,
      gameWon: ulaz.gameWon,
      terminalAt,
      resultsVisibleAt,
      ...(ulaz.partijaId !== undefined ? { partijaId: ulaz.partijaId } : {}),
      settlementState: 'nije_potrebno',
    })
    .where(and(
      eq(pokusajiIzazova.id, ulaz.attemptId),
      inArray(pokusajiIzazova.status, ['rezerviran', 'u_tijeku']),
    ))
    .returning();

  if (azuriran) {
    await nakonTerminalnogPokusaja(azuriran);
    return azuriran;
  }

  const [postojeci] = await baza
    .select()
    .from(pokusajiIzazova)
    .where(eq(pokusajiIzazova.id, ulaz.attemptId))
    .limit(1);
  if (
    postojeci
    && (postojeci.status === 'uspjeh'
      || postojeci.status === 'neuspjeh'
      || postojeci.status === 'tehnicki_prekinuto')
  ) {
    return postojeci;
  }
  return null;
}
