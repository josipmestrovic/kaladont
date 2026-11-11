/**
 * Ručna administracija rječnika - reusable primitiva (koristi je admin ruta iz Faze 7,
 * vidi PLAN-IMPLEMENTACIJE.md).
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  DOPUSTENA_SLOVA_RIJECI_SQL,
  grafemi,
  jeDopustenOblikRijeci,
  kljucGrupe,
  type VrstaRijeci,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { jeJedinstvenostPrekrsena } from '../baza/greske.js';
import { izmjeneRjecnika, rijeci } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';

type Izvrsitelj = MisijeTx | typeof baza;

export class NevaljanaRijecError extends Error {}

export type PromjenaRjecnika =
  | { promjena: 'nema'; rijec: string }
  | { promjena: 'dodana' | 'reaktivirana' | 'deaktivirana' | 'vracena'; rijec: string; izmjenaId: number };

/** Fiksni razlog za masovno čišćenje nstandardnih oblika. */
export const RAZLOG_CISCENJA_NSTANDARDNIH = 'automatsko čišćenje: nstandardna slova';

export function normalizirajRijecRjecnika(ulaz: string): string {
  return ulaz.normalize('NFC').trim().toLowerCase();
}

async function zabiljeziIzmjenu(
  db: Izvrsitelj,
  vrijednosti: {
    rijec: string;
    akcija: 'dodana' | 'uklonjena' | 'vracena';
    razlog: string;
    adminId: string | null;
    prijavaId?: number | null;
  },
): Promise<number> {
  const [red] = await db.insert(izmjeneRjecnika).values({
    rijec: vrijednosti.rijec,
    akcija: vrijednosti.akcija,
    razlog: vrijednosti.razlog,
    adminId: vrijednosti.adminId,
    prijavaId: vrijednosti.prijavaId ?? null,
  }).returning({ id: izmjeneRjecnika.id });
  if (!red) throw new Error('Izmjena rječnika nije zapisana.');
  return red.id;
}

function provjeriOblik(rijecUlaz: string): { rijec: string; prvaDva: string; zadnjaDva: string } {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  if (rijec.length < 2 || !jeDopustenOblikRijeci(rijec)) {
    throw new NevaljanaRijecError(`Neispravan oblik riječi: "${rijecUlaz}"`);
  }
  const svi = grafemi(rijec);
  if (svi.length < 2) {
    throw new NevaljanaRijecError(`Riječ mora imati barem 2 slova: "${rijecUlaz}"`);
  }
  return { rijec, prvaDva: svi.slice(0, 2).join(''), zadnjaDva: svi.slice(-2).join('') };
}

/** Dodaje riječ u rječnik i bilježi izmjenu. Već aktivna riječ je no-op bez zapisa izmjene.
 * Ne osvježava memoriju — pozovi `rjecnik.primijeniUbaci` / `uskladiRjecnikNakonUbaci`. */
export async function dodajRijec(
  rijecUlaz: string,
  razlog: string,
  adminId: string | null,
  vrsta: VrstaRijeci,
  lemaUlaz?: string,
  prijavaId?: number | null,
  db: Izvrsitelj = baza,
): Promise<PromjenaRjecnika> {
  const { rijec, prvaDva, zadnjaDva } = provjeriOblik(rijecUlaz);
  const lema = normalizirajRijecRjecnika(lemaUlaz ?? rijec);
  const grupa = kljucGrupe(vrsta, lema);

  const [postojeca] = await db.select({ aktivna: rijeci.aktivna }).from(rijeci).where(eq(rijeci.rijec, rijec)).for('update').limit(1);
  if (postojeca?.aktivna) return { promjena: 'nema', rijec };

  if (!postojeca) {
    try {
      await db.insert(rijeci).values({
        rijec,
        prvaDva,
        zadnjaDva,
        vrste: [vrsta],
        grupe: [grupa],
        aktivna: true,
        napomena: 'ručno dodano',
      });
    } catch (greska) {
      if (!jeJedinstvenostPrekrsena(greska)) throw greska;
      const [ponovo] = await db.select({ aktivna: rijeci.aktivna }).from(rijeci).where(eq(rijeci.rijec, rijec)).for('update').limit(1);
      if (!ponovo || ponovo.aktivna) return { promjena: 'nema', rijec };
      await db.update(rijeci).set({ aktivna: true }).where(eq(rijeci.rijec, rijec));
      const izmjenaId = await zabiljeziIzmjenu(db, { rijec, akcija: 'vracena', razlog, adminId, prijavaId });
      return { promjena: 'reaktivirana', rijec, izmjenaId };
    }
    const izmjenaId = await zabiljeziIzmjenu(db, { rijec, akcija: 'dodana', razlog, adminId, prijavaId });
    return { promjena: 'dodana', rijec, izmjenaId };
  }

  await db.update(rijeci).set({ aktivna: true }).where(eq(rijeci.rijec, rijec));
  const izmjenaId = await zabiljeziIzmjenu(db, { rijec, akcija: 'vracena', razlog, adminId, prijavaId });
  return { promjena: 'reaktivirana', rijec, izmjenaId };
}

/** Soft-delete (aktivna=false). Već neaktivna ili nepostojeća riječ je no-op. */
export async function deaktivirajRijec(
  rijecUlaz: string,
  razlog: string,
  adminId: string | null = null,
  prijavaId?: number | null,
  db: Izvrsitelj = baza,
): Promise<PromjenaRjecnika> {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  const [postojeca] = await db.select({ aktivna: rijeci.aktivna }).from(rijeci).where(eq(rijeci.rijec, rijec)).for('update').limit(1);
  if (!postojeca?.aktivna) return { promjena: 'nema', rijec };
  await db.update(rijeci).set({ aktivna: false }).where(eq(rijeci.rijec, rijec));
  const izmjenaId = await zabiljeziIzmjenu(db, { rijec, akcija: 'uklonjena', razlog, adminId, prijavaId });
  return { promjena: 'deaktivirana', rijec, izmjenaId };
}

/** Vraća prethodno deaktiviranu riječ. Već aktivna ili nepostojeća riječ je no-op. */
export async function vratiRijec(
  rijecUlaz: string,
  razlog: string,
  adminId: string | null = null,
  db: Izvrsitelj = baza,
): Promise<PromjenaRjecnika> {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  if (!jeDopustenOblikRijeci(rijec)) {
    throw new NevaljanaRijecError(`Neispravan oblik riječi: "${rijecUlaz}"`);
  }
  const [postojeca] = await db.select({ aktivna: rijeci.aktivna }).from(rijeci).where(eq(rijeci.rijec, rijec)).for('update').limit(1);
  if (!postojeca || postojeca.aktivna) return { promjena: 'nema', rijec };
  await db.update(rijeci).set({ aktivna: true }).where(eq(rijeci.rijec, rijec));
  const izmjenaId = await zabiljeziIzmjenu(db, { rijec, akcija: 'vracena', razlog, adminId });
  return { promjena: 'vracena', rijec, izmjenaId };
}

const uvjetNstandardneAktivne = and(
  eq(rijeci.aktivna, true),
  sql`${rijeci.rijec} !~ ${DOPUSTENA_SLOVA_RIJECI_SQL}`,
);

/** Aktivne riječi s nstandardnim znakovima (bez vlastita_imena tablice). */
export async function popisNstandardnihAktivnihRijeci(): Promise<Array<{ rijec: string; frekvencija: number }>> {
  return baza
    .select({ rijec: rijeci.rijec, frekvencija: rijeci.frekvencija })
    .from(rijeci)
    .where(uvjetNstandardneAktivne)
    .orderBy(asc(rijeci.rijec));
}

/** Soft-delete svih aktivnih nstandardnih riječi + audit u jednoj transakciji. */
export async function deaktivirajNstandardneRijeci(adminId: string): Promise<{ deaktivirano: number }> {
  return baza.transaction(async (tx) => {
    const deaktivirane = await tx
      .update(rijeci)
      .set({ aktivna: false })
      .where(uvjetNstandardneAktivne)
      .returning({ rijec: rijeci.rijec });

    if (deaktivirane.length === 0) return { deaktivirano: 0 };

    await tx.insert(izmjeneRjecnika).values(
      deaktivirane.map((red) => ({
        rijec: red.rijec,
        akcija: 'uklonjena' as const,
        razlog: RAZLOG_CISCENJA_NSTANDARDNIH,
        adminId,
      })),
    );

    return { deaktivirano: deaktivirane.length };
  });
}
