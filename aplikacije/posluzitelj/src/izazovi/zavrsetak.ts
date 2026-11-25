/**
 * Terminalni CAS završetak pokušaja Izazova (PR03).
 * Nagrade / zavrseci / XP — PR04 settlement hook.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { ODGODA_PRIKAZA_REZULTATA_MS, type RazlogNeuspjehaIzazova, type StatusPokusajaIzazova } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { pokusajiIzazova } from '../baza/shema.js';
import { obracunajSettlementIzazova, type SettlementIzazova } from './obracun.js';
import type { MetrikePokusajaIzazova } from './evaluacija.js';
import type { RedakPokusajaIzazova } from './pohrana.js';

/** Rezultati vidljivi 5 s nakon terminalAt (klijent ne resetira na refresh). */
export const ODGODA_REZULTATA_IZAZOVA_MS = ODGODA_PRIKAZA_REZULTATA_MS;

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

export interface TerminalniIshodIzazova {
  redak: RedakPokusajaIzazova;
  settlement: SettlementIzazova;
}

/** PR04: XP, Izazivač, misije, sandučić. */
export async function nakonTerminalnogPokusaja(
  redak: RedakPokusajaIzazova,
): Promise<SettlementIzazova> {
  return obracunajSettlementIzazova(redak);
}

/**
 * Compare-and-set: samo iz rezerviran/u_tijeku.
 * Ponovljeni poziv (isti attemptId) vraća postojeći terminalni redak — idempotentno.
 */
export async function zavrsiPokusajIzazova(
  ulaz: UlazTerminalnogPokusaja,
): Promise<TerminalniIshodIzazova | null> {
  const terminalAt = ulaz.terminalAt ?? new Date();
  const resultsVisibleAt = new Date(terminalAt.getTime() + ODGODA_REZULTATA_IZAZOVA_MS);
  const trebaSettlement = ulaz.status === 'uspjeh' || ulaz.status === 'neuspjeh';

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
      settlementState: trebaSettlement ? 'spremanje_u_tijeku' : 'nije_potrebno',
    })
    .where(and(
      eq(pokusajiIzazova.id, ulaz.attemptId),
      inArray(pokusajiIzazova.status, ['rezerviran', 'u_tijeku']),
    ))
    .returning();

  if (azuriran) {
    const settlement = await nakonTerminalnogPokusaja(azuriran);
    const [svjez] = await baza
      .select()
      .from(pokusajiIzazova)
      .where(eq(pokusajiIzazova.id, azuriran.id))
      .limit(1);
    return { redak: svjez ?? azuriran, settlement };
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
    // Retry settlement ako je CAS prošao ali TX nije završio.
    if (
      (postojeci.status === 'uspjeh' || postojeci.status === 'neuspjeh')
      && postojeci.settlementState !== 'spremljeno'
    ) {
      const settlement = await nakonTerminalnogPokusaja(postojeci);
      const [svjez] = await baza
        .select()
        .from(pokusajiIzazova)
        .where(eq(pokusajiIzazova.id, postojeci.id))
        .limit(1);
      return { redak: svjez ?? postojeci, settlement };
    }
    const settlement = await nakonTerminalnogPokusaja(postojeci);
    return { redak: postojeci, settlement };
  }
  return null;
}
