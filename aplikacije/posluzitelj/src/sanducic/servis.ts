import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import {
  renderirajSanducicPoruku,
  type SanducicPorukaDetalj,
  type SanducicPorukaSazetak,
  type SanducicPromjena,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { sanducicPoruke } from '../baza/shema.js';
import { granicaZadrzavanjaSanducica } from './ciscenje.js';

type SocketZaSanducic = {
  emit(dogadaj: 'sanducic:promjena', payload: SanducicPromjena): void;
};

export interface VezeZaSanducic {
  dohvatiSocket(igracId: string): SocketZaSanducic | undefined;
}

let veze: VezeZaSanducic | null = null;

export function postaviVezeZaSanducic(aktivneVeze: VezeZaSanducic): void {
  veze = aktivneVeze;
}

export function emitirajPromjenuSanducica(igracId: string, razlog: SanducicPromjena['razlog'] = 'nova'): void {
  veze?.dohvatiSocket(igracId)?.emit('sanducic:promjena', { razlog });
}

export interface UlazStvaranjaPoruke {
  igracId: string;
  tip: string;
  deduplikacijskiKljuc: string;
  podaci?: Record<string, unknown>;
  izvorTip?: string | null;
  izvorId?: string | null;
  mod?: string | null;
  stvorenaAt?: Date;
}

type RedPoruke = typeof sanducicPoruke.$inferSelect;

function uSazetak(red: RedPoruke): SanducicPorukaSazetak {
  const render = renderirajSanducicPoruku(red.tip, red.podaci ?? {});
  return {
    id: red.id,
    tip: red.tip,
    naslov: render.naslov,
    stvorenaAt: red.stvorenaAt.toISOString(),
    procitano: red.procitanoAt != null,
  };
}

function uDetalj(red: RedPoruke): SanducicPorukaDetalj {
  const render = renderirajSanducicPoruku(red.tip, red.podaci ?? {});
  return {
    ...uSazetak(red),
    tekst: render.tekst,
    podaci: red.podaci ?? {},
    poveznica: render.poveznica,
  };
}

function uvjetSvjeze(igracId: string, sada = new Date()) {
  return and(
    eq(sanducicPoruke.igracId, igracId),
    gte(sanducicPoruke.stvorenaAt, granicaZadrzavanjaSanducica(sada)),
  );
}

/** Idempotentan insert; null ako je dedup već postojao. */
export async function stvoriPoruku(ulaz: UlazStvaranjaPoruke): Promise<RedPoruke | null> {
  const [red] = await baza
    .insert(sanducicPoruke)
    .values({
      igracId: ulaz.igracId,
      tip: ulaz.tip,
      deduplikacijskiKljuc: ulaz.deduplikacijskiKljuc,
      podaci: ulaz.podaci ?? {},
      izvorTip: ulaz.izvorTip ?? null,
      izvorId: ulaz.izvorId ?? null,
      mod: ulaz.mod ?? null,
      stvorenaAt: ulaz.stvorenaAt ?? new Date(),
    })
    .onConflictDoNothing({
      target: [sanducicPoruke.igracId, sanducicPoruke.deduplikacijskiKljuc],
    })
    .returning();

  if (red) emitirajPromjenuSanducica(ulaz.igracId, 'nova');
  return red ?? null;
}

export async function dohvatiSazetak(igracId: string): Promise<{
  brojNeprocitanih: number;
  zaNajavu: SanducicPorukaSazetak[];
}> {
  const svjeze = uvjetSvjeze(igracId);
  const [neprocitano] = await baza
    .select({ broj: count() })
    .from(sanducicPoruke)
    .where(and(svjeze, isNull(sanducicPoruke.procitanoAt)));

  const zaNajavuRedovi = await baza
    .select()
    .from(sanducicPoruke)
    .where(and(
      svjeze,
      isNull(sanducicPoruke.najavljenoAt),
      isNull(sanducicPoruke.procitanoAt),
    ))
    .orderBy(asc(sanducicPoruke.stvorenaAt))
    .limit(50);

  return {
    brojNeprocitanih: Number(neprocitano?.broj ?? 0),
    zaNajavu: zaNajavuRedovi.map(uSazetak),
  };
}

export async function dohvatiListu(
  igracId: string,
  opcije: { samoNeprocitane?: boolean; limit?: number; cursor?: string | null } = {},
): Promise<{ poruke: SanducicPorukaDetalj[]; sljedeciCursor: string | null }> {
  const limit = Math.min(Math.max(opcije.limit ?? 30, 1), 50);
  const uvjeti = [uvjetSvjeze(igracId)];
  if (opcije.samoNeprocitane) uvjeti.push(isNull(sanducicPoruke.procitanoAt));

  if (opcije.cursor) {
    const [cursorId, cursorAt] = opcije.cursor.split('|');
    const cursorDatum = cursorAt ? new Date(cursorAt) : null;
    if (cursorId && cursorDatum && !Number.isNaN(cursorDatum.getTime())) {
      uvjeti.push(or(
        lt(sanducicPoruke.stvorenaAt, cursorDatum),
        and(eq(sanducicPoruke.stvorenaAt, cursorDatum), lt(sanducicPoruke.id, cursorId)),
      )!);
    }
  }

  const redovi = await baza
    .select()
    .from(sanducicPoruke)
    .where(and(...uvjeti))
    .orderBy(desc(sanducicPoruke.stvorenaAt), desc(sanducicPoruke.id))
    .limit(limit + 1);

  const imaJos = redovi.length > limit;
  const stranica = imaJos ? redovi.slice(0, limit) : redovi;
  const zadnja = stranica.at(-1);
  return {
    poruke: stranica.map(uDetalj),
    sljedeciCursor: imaJos && zadnja
      ? `${zadnja.id}|${zadnja.stvorenaAt.toISOString()}`
      : null,
  };
}

export async function dohvatiJednu(igracId: string, id: string): Promise<SanducicPorukaDetalj | null> {
  const [red] = await baza
    .select()
    .from(sanducicPoruke)
    .where(and(uvjetSvjeze(igracId), eq(sanducicPoruke.id, id)))
    .limit(1);
  return red ? uDetalj(red) : null;
}

export async function oznaciProcitane(igracId: string, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const sada = new Date();
  const azurirane = await baza
    .update(sanducicPoruke)
    .set({ procitanoAt: sada })
    .where(and(
      eq(sanducicPoruke.igracId, igracId),
      inArray(sanducicPoruke.id, [...ids]),
      isNull(sanducicPoruke.procitanoAt),
      gte(sanducicPoruke.stvorenaAt, granicaZadrzavanjaSanducica(sada)),
    ))
    .returning({ id: sanducicPoruke.id });
  if (azurirane.length > 0) emitirajPromjenuSanducica(igracId, 'stanje');
  return azurirane.map((red) => red.id);
}

/** Označava pročitanima sve nepročitane stvorene do granice (uključivo). */
export async function oznaciSveProcitane(igracId: string, doAt = new Date()): Promise<number> {
  const sada = new Date();
  const azurirane = await baza
    .update(sanducicPoruke)
    .set({ procitanoAt: sada })
    .where(and(
      eq(sanducicPoruke.igracId, igracId),
      isNull(sanducicPoruke.procitanoAt),
      gte(sanducicPoruke.stvorenaAt, granicaZadrzavanjaSanducica(sada)),
      lte(sanducicPoruke.stvorenaAt, doAt),
    ))
    .returning({ id: sanducicPoruke.id });
  if (azurirane.length > 0) emitirajPromjenuSanducica(igracId, 'stanje');
  return azurirane.length;
}

export async function potvrdiNajavu(igracId: string, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const sada = new Date();
  const azurirane = await baza
    .update(sanducicPoruke)
    .set({ najavljenoAt: sada })
    .where(and(
      eq(sanducicPoruke.igracId, igracId),
      inArray(sanducicPoruke.id, [...ids]),
      isNull(sanducicPoruke.najavljenoAt),
      gte(sanducicPoruke.stvorenaAt, granicaZadrzavanjaSanducica(sada)),
    ))
    .returning({ id: sanducicPoruke.id });
  return azurirane.map((red) => red.id);
}
