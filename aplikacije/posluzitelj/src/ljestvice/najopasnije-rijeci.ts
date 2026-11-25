/**
 * Agregat najopasnijih riječi: potvrđene eliminacije, prag 3, samo aktivne riječi u rječniku.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { OdgovorNajopasnijihRijeci, StavkaNajopasnijeRijeci } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { eliminacijePoRijeci, rijeci } from '../baza/shema.js';

export const TRAJANJE_PRIVREMENE_MEMORIJE_NAJOPASNIJIH_MS = 30_000;
export const PRAG_ELIMINACIJA_NAJOPASNIJIH = 3;
export const MAKSIMALNO_NAJOPASNIJIH_RIJECI = 100;

interface ZapisMemorije {
  generacija: number;
  istice: number;
  rezultat: Promise<StavkaNajopasnijeRijeci[]>;
}

let generacijaCachea = 0;
let privremenaMemorija: ZapisMemorije | null = null;

export function ocistiMemorijuNajopasnijihRijeci(): void {
  generacijaCachea += 1;
  privremenaMemorija = null;
}

async function izracunajNajopasnijeRijeci(): Promise<StavkaNajopasnijeRijeci[]> {
  const retci = await baza
    .select({
      rijec: eliminacijePoRijeci.rijec,
      brojEliminacija: sql<number>`count(*)::int`,
    })
    .from(eliminacijePoRijeci)
    .innerJoin(rijeci, and(eq(rijeci.rijec, eliminacijePoRijeci.rijec), eq(rijeci.aktivna, true)))
    .groupBy(eliminacijePoRijeci.rijec)
    .having(sql`count(*) >= ${PRAG_ELIMINACIJA_NAJOPASNIJIH}`)
    .orderBy(desc(sql`count(*)`), asc(eliminacijePoRijeci.rijec))
    .limit(MAKSIMALNO_NAJOPASNIJIH_RIJECI);

  return retci.map((redak, indeks) => ({
    mjesto: indeks + 1,
    rijec: redak.rijec,
    brojEliminacija: Number(redak.brojEliminacija),
  }));
}

export function dohvatiNajopasnijeRijeci(sada = Date.now()): Promise<StavkaNajopasnijeRijeci[]> {
  if (privremenaMemorija && privremenaMemorija.istice > sada && privremenaMemorija.generacija === generacijaCachea) {
    return privremenaMemorija.rezultat;
  }

  const generacija = generacijaCachea;
  const rezultat = izracunajNajopasnijeRijeci().then((retci) => {
    // In-flight izračun nakon invalidacije ne smije napuniti cache starim podacima.
    if (generacija !== generacijaCachea) return retci;
    return retci;
  });

  privremenaMemorija = {
    generacija,
    istice: sada + TRAJANJE_PRIVREMENE_MEMORIJE_NAJOPASNIJIH_MS,
    rezultat: rezultat.then((retci) => {
      if (generacija !== generacijaCachea) {
        // Ne zadržavaj zastarjeli rezultat u memoriji.
        if (privremenaMemorija?.generacija === generacija) privremenaMemorija = null;
      }
      return retci;
    }),
  };
  rezultat.catch(() => {
    if (privremenaMemorija?.generacija === generacija) privremenaMemorija = null;
  });
  return rezultat;
}

export async function odgovorNajopasnijihRijeci(limit: 10 | 100): Promise<OdgovorNajopasnijihRijeci> {
  const sve = await dohvatiNajopasnijeRijeci();
  const rijeciOdgovor = sve.slice(0, limit);
  return {
    ok: true,
    rijeci: rijeciOdgovor,
    imaJos: sve.length > rijeciOdgovor.length,
  };
}
