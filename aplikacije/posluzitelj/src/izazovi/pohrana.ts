/**
 * Čitanje/pisanje pokušaja i završetaka Izazova.
 */
import { and, eq, inArray, lt } from 'drizzle-orm';
import {
  izgradiStavkuKataloga,
  izracunajZvjezdiceIzazivaca,
  KATALOG_IZAZOVA,
  VERZIJA_DEFINICIJE_IZAZOVA,
  type CiljeviIzazova,
  type DefinicijaIzazova,
  type IdIzazova,
  type NapredakIzazovaDto,
  type OdgovorKatalogaIzazova,
  type ProfilBotaIzazova,
  type StatusPokusajaIzazova,
  type TrajanjePotezaIzazovaMs,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { igraci, pokusajiIzazova, zavrseciIzazova } from '../baza/shema.js';

export const ROK_GOST_IZAZOV_MS = 30 * 24 * 60 * 60 * 1000;

export interface SnapshotPokusajaIzazova {
  challengeId: IdIzazova;
  definitionVersion: number;
  naziv: string;
  mod: DefinicijaIzazova['mod'];
  pravila: DefinicijaIzazova['pravila'];
  profileId: ProfilBotaIzazova;
  turnDurationMs: TrajanjePotezaIzazovaMs;
  brojIgraca: 2 | 3 | 4;
  ciljevi: CiljeviIzazova;
  xp: number;
}

export type RedakPokusajaIzazova = typeof pokusajiIzazova.$inferSelect;

export async function dohvatiZavrseneChallengeIds(igracId: string): Promise<Set<string>> {
  const redovi = await baza
    .select({ challengeId: zavrseciIzazova.challengeId })
    .from(zavrseciIzazova)
    .where(eq(zavrseciIzazova.igracId, igracId));
  return new Set(redovi.map((r) => r.challengeId));
}

export async function dohvatiAwardedXpMap(igracId: string): Promise<Map<string, number>> {
  const redovi = await baza
    .select({
      challengeId: zavrseciIzazova.challengeId,
      awardedXp: zavrseciIzazova.awardedXp,
    })
    .from(zavrseciIzazova)
    .where(eq(zavrseciIzazova.igracId, igracId));
  return new Map(redovi.map((r) => [r.challengeId, r.awardedXp]));
}

export async function dohvatiAktivniPokusaj(igracId: string): Promise<RedakPokusajaIzazova | null> {
  const [redak] = await baza
    .select()
    .from(pokusajiIzazova)
    .where(and(
      eq(pokusajiIzazova.igracId, igracId),
      inArray(pokusajiIzazova.status, ['rezerviran', 'u_tijeku']),
    ))
    .limit(1);
  return redak ?? null;
}

export async function dohvatiPokusajPoId(attemptId: string): Promise<RedakPokusajaIzazova | null> {
  const [redak] = await baza
    .select()
    .from(pokusajiIzazova)
    .where(eq(pokusajiIzazova.id, attemptId))
    .limit(1);
  return redak ?? null;
}

export async function dohvatiPokusajPoRequestId(
  igracId: string,
  requestId: string,
): Promise<RedakPokusajaIzazova | null> {
  const [redak] = await baza
    .select()
    .from(pokusajiIzazova)
    .where(and(
      eq(pokusajiIzazova.igracId, igracId),
      eq(pokusajiIzazova.requestId, requestId),
    ))
    .limit(1);
  return redak ?? null;
}

export async function izgradiOdgovorKataloga(
  igracId: string,
  omogucen: boolean,
): Promise<OdgovorKatalogaIzazova> {
  const [zavrseni, awardedXp, aktivni] = await Promise.all([
    dohvatiZavrseneChallengeIds(igracId),
    dohvatiAwardedXpMap(igracId),
    dohvatiAktivniPokusaj(igracId),
  ]);

  const katalog = KATALOG_IZAZOVA.map((d) =>
    izgradiStavkuKataloga(d, { zavrseni, awardedXpPoId: awardedXp }),
  );

  const napredak: NapredakIzazovaDto = {
    zavrseniChallengeIds: [...zavrseni].filter((id): id is IdIzazova =>
      KATALOG_IZAZOVA.some((d) => d.id === id),
    ),
    aktivniPokusaj: aktivni
      ? {
        attemptId: aktivni.id,
        challengeId: aktivni.challengeId as IdIzazova,
        status: aktivni.status as StatusPokusajaIzazova,
        partijaId: aktivni.partijaId,
      }
      : null,
    izazivacZvjezdice: izracunajZvjezdiceIzazivaca(zavrseni),
  };

  return {
    ok: true,
    omogucen,
    definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
    katalog,
    napredak,
  };
}

export function napraviSnapshot(definicija: DefinicijaIzazova): SnapshotPokusajaIzazova {
  return {
    challengeId: definicija.id,
    definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
    naziv: definicija.naziv,
    mod: definicija.mod,
    pravila: definicija.pravila,
    profileId: definicija.profileId,
    turnDurationMs: definicija.turnDurationMs,
    brojIgraca: definicija.brojIgraca,
    ciljevi: { ...definicija.ciljevi },
    xp: definicija.xp,
  };
}

export async function umetniRezerviraniPokusaj(ulaz: {
  igracId: string;
  requestId: string;
  definicija: DefinicijaIzazova;
  accountTypeAtStart: 'gost' | 'registriran';
  seed: string;
}): Promise<RedakPokusajaIzazova> {
  const snapshot = napraviSnapshot(ulaz.definicija);
  const [redak] = await baza
    .insert(pokusajiIzazova)
    .values({
      igracId: ulaz.igracId,
      challengeId: ulaz.definicija.id,
      requestId: ulaz.requestId,
      definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
      snapshot,
      status: 'rezerviran',
      settlementState: 'nije_potrebno',
      accountTypeAtStart: ulaz.accountTypeAtStart,
      seed: ulaz.seed,
      metrics: {},
    })
    .returning();
  if (!redak) throw new Error('Umetanje pokušaja Izazova nije vratilo redak');
  return redak;
}

/** Označi pokušaj tehničkim prekidom (npr. stub motora u PR01). */
export async function oznaciTehnickiPrekinuto(attemptId: string): Promise<RedakPokusajaIzazova | null> {
  const sada = new Date();
  const [redak] = await baza
    .update(pokusajiIzazova)
    .set({
      status: 'tehnicki_prekinuto',
      terminalAt: sada,
      resultsVisibleAt: sada,
      settlementState: 'nije_potrebno',
    })
    .where(and(
      eq(pokusajiIzazova.id, attemptId),
      inArray(pokusajiIzazova.status, ['rezerviran', 'u_tijeku']),
    ))
    .returning();
  return redak ?? null;
}

/**
 * Briše pokušaje i završetke gostiju neaktivnih ≥ 30 dana.
 * Ne briše shared `igraci` zapise.
 */
export async function ocistiStareGostIzazove(sada = new Date()): Promise<{ pokusaji: number; zavrseci: number }> {
  const granica = new Date(sada.getTime() - ROK_GOST_IZAZOV_MS);

  const neaktivniGosti = await baza
    .select({ id: igraci.id })
    .from(igraci)
    .where(and(eq(igraci.vrsta, 'gost'), lt(igraci.zadnjaAktivnost, granica)));
  const gostIds = neaktivniGosti.map((g) => g.id);

  let brojZavrsaka = 0;
  let brojPokusaja = 0;

  if (gostIds.length > 0) {
    const obrisaniZavrsaci = await baza
      .delete(zavrseciIzazova)
      .where(inArray(zavrseciIzazova.igracId, gostIds))
      .returning({ challengeId: zavrseciIzazova.challengeId });
    brojZavrsaka += obrisaniZavrsaci.length;

    const obrisaniPokusaji = await baza
      .delete(pokusajiIzazova)
      .where(and(
        inArray(pokusajiIzazova.igracId, gostIds),
        inArray(pokusajiIzazova.status, ['uspjeh', 'neuspjeh', 'tehnicki_prekinuto']),
      ))
      .returning({ id: pokusajiIzazova.id });
    brojPokusaja += obrisaniPokusaji.length;
  }

  // Stari terminalni gostovski pokušaji bez reference u završecima (uspjeh ostaje dok se gost ne očisti gore).
  const stariTerminalni = await baza
    .delete(pokusajiIzazova)
    .where(and(
      eq(pokusajiIzazova.accountTypeAtStart, 'gost'),
      lt(pokusajiIzazova.terminalAt, granica),
      inArray(pokusajiIzazova.status, ['neuspjeh', 'tehnicki_prekinuto']),
    ))
    .returning({ id: pokusajiIzazova.id });
  brojPokusaja += stariTerminalni.length;

  return { pokusaji: brojPokusaja, zavrseci: brojZavrsaka };
}
