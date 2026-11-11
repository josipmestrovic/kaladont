/**
 * Admin CRUD za skup sigurnih početnih riječi (tablica sigurne_pocetne_rijeci).
 */
import { asc, eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { rijeci, sigurnePocetneRijeci } from '../baza/shema.js';
import { NevaljanaRijecError, normalizirajRijecRjecnika } from './administracija.js';
import { jeDopustenOblikRijeci } from 'zajednicko';

export type PromjenaSigurnogSkupa =
  | { promjena: 'nema'; rijec: string }
  | { promjena: 'dodana' | 'uklonjena'; rijec: string };

export async function ucitajSigurnePocetneRijeciIzBaze(): Promise<string[]> {
  const retci = await baza
    .select({ rijec: sigurnePocetneRijeci.rijec })
    .from(sigurnePocetneRijeci)
    .orderBy(asc(sigurnePocetneRijeci.rijec));
  return retci.map((r) => r.rijec);
}

export async function popisSigurnihPocetnihRijeci(): Promise<
  Array<{ rijec: string; dodanaU: string; dodaoAdminId: string | null }>
> {
  const retci = await baza
    .select({
      rijec: sigurnePocetneRijeci.rijec,
      dodanaU: sigurnePocetneRijeci.dodanaU,
      dodaoAdminId: sigurnePocetneRijeci.dodaoAdminId,
    })
    .from(sigurnePocetneRijeci)
    .orderBy(asc(sigurnePocetneRijeci.rijec));
  return retci.map((r) => ({
    rijec: r.rijec,
    dodanaU: r.dodanaU.toISOString(),
    dodaoAdminId: r.dodaoAdminId,
  }));
}

export async function dodajUSigurniSkup(
  rijecUlaz: string,
  adminId: string | null,
): Promise<PromjenaSigurnogSkupa> {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  if (rijec.length < 2 || !jeDopustenOblikRijeci(rijec)) {
    throw new NevaljanaRijecError(`Neispravan oblik riječi: "${rijecUlaz}"`);
  }

  const [uRjecniku] = await baza.select({ rijec: rijeci.rijec }).from(rijeci).where(eq(rijeci.rijec, rijec)).limit(1);
  if (!uRjecniku) {
    throw new NevaljanaRijecError(`Riječ „${rijec}” ne postoji u rječniku.`);
  }

  const [postojeca] = await baza
    .select({ rijec: sigurnePocetneRijeci.rijec })
    .from(sigurnePocetneRijeci)
    .where(eq(sigurnePocetneRijeci.rijec, rijec))
    .limit(1);
  if (postojeca) return { promjena: 'nema', rijec };

  await baza.insert(sigurnePocetneRijeci).values({
    rijec,
    dodaoAdminId: adminId,
  });
  return { promjena: 'dodana', rijec };
}

export async function ukloniIzSigurnogSkupa(rijecUlaz: string): Promise<PromjenaSigurnogSkupa> {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  const obrisano = await baza
    .delete(sigurnePocetneRijeci)
    .where(eq(sigurnePocetneRijeci.rijec, rijec))
    .returning({ rijec: sigurnePocetneRijeci.rijec });
  if (obrisano.length === 0) return { promjena: 'nema', rijec };
  return { promjena: 'uklonjena', rijec };
}

export async function jeUSigurnomSkupu(rijecUlaz: string): Promise<boolean> {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  const [red] = await baza
    .select({ rijec: sigurnePocetneRijeci.rijec })
    .from(sigurnePocetneRijeci)
    .where(eq(sigurnePocetneRijeci.rijec, rijec))
    .limit(1);
  return Boolean(red);
}
