/**
 * Trajno stanje taktičkih poolova u bazi (seed, članstvo, rješenje).
 */
import { eq, inArray } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { botPoolClanovi, operativnePrimjene, rijeci } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';
import type { KategorijaPoola } from './poolovi.js';
import { normalizirajPoolRijec, pripremiSeedClanove } from './poolovi.js';

export const KLJUC_SEEDA = 'bot-poolovi-v8-seed-r3';

type Izvrsitelj = MisijeTx | typeof baza;

export type PoolClanRed = {
  rijec: string;
  kategorija: KategorijaPoola;
  stanje: 'nerazrijeseno' | 'razrijeseno';
  ranijeAktivno: boolean;
};

export async function seedajPooloveAkoTreba(db: Izvrsitelj): Promise<
  { preskoceno: true } | { preskoceno: false; uneseno: number }
> {
  const [vecPrimijenjen] = await db
    .select({ kljuc: operativnePrimjene.kljuc })
    .from(operativnePrimjene)
    .where(eq(operativnePrimjene.kljuc, KLJUC_SEEDA))
    .limit(1);
  if (vecPrimijenjen) return { preskoceno: true };

  const { pool1, pool2 } = pripremiSeedClanove();
  const sveRijeci = [...pool1, ...pool2];
  const aktivneURjecniku = sveRijeci.length
    ? await db
      .select({ rijec: rijeci.rijec, aktivna: rijeci.aktivna })
      .from(rijeci)
      .where(inArray(rijeci.rijec, sveRijeci))
    : [];
  const aktivne = new Set(
    aktivneURjecniku.filter((red) => red.aktivna).map((red) => red.rijec),
  );

  const vrijednosti = [
    ...pool1.map((rijec) => ({
      rijec,
      kategorija: 'pool_1' as const,
      stanje: (aktivne.has(rijec) ? 'razrijeseno' : 'nerazrijeseno') as 'razrijeseno' | 'nerazrijeseno',
      ranijeAktivno: aktivne.has(rijec),
    })),
    ...pool2.map((rijec) => ({
      rijec,
      kategorija: 'pool_2' as const,
      stanje: (aktivne.has(rijec) ? 'razrijeseno' : 'nerazrijeseno') as 'razrijeseno' | 'nerazrijeseno',
      ranijeAktivno: aktivne.has(rijec),
    })),
  ];

  if (vrijednosti.length > 0) {
    await db.insert(botPoolClanovi).values(vrijednosti).onConflictDoNothing();
  }

  await db.insert(operativnePrimjene).values({
    kljuc: KLJUC_SEEDA,
    napomena: `pool1=${pool1.length};pool2=${pool2.length}`,
  }).onConflictDoNothing();

  return { preskoceno: false, uneseno: vrijednosti.length };
}

export async function ucitajPoolClanove(db: Izvrsitelj): Promise<PoolClanRed[]> {
  const redovi = await db
    .select({
      rijec: botPoolClanovi.rijec,
      kategorija: botPoolClanovi.kategorija,
      stanje: botPoolClanovi.stanje,
      ranijeAktivno: botPoolClanovi.ranijeAktivno,
    })
    .from(botPoolClanovi);
  return redovi.map((red) => ({
    rijec: red.rijec,
    kategorija: red.kategorija,
    stanje: red.stanje,
    ranijeAktivno: red.ranijeAktivno,
  }));
}

/**
 * Pri startu: seed ako treba; ukloni članstva koja su ranije bila razriješena,
 * a riječ više nije aktivna; zadrži nerazriješene.
 */
export async function uskladiPoolovePriPokretanju(db: Izvrsitelj = baza): Promise<PoolClanRed[]> {
  await seedajPooloveAkoTreba(db);
  const clanovi = await ucitajPoolClanove(db);
  const kandidatiZaProvjeru = clanovi
    .filter((c) => c.stanje === 'razrijeseno' || c.ranijeAktivno)
    .map((c) => c.rijec);
  if (kandidatiZaProvjeru.length === 0) return clanovi;

  const uRjecniku = await db
    .select({ rijec: rijeci.rijec, aktivna: rijeci.aktivna })
    .from(rijeci)
    .where(inArray(rijeci.rijec, kandidatiZaProvjeru));
  const aktivne = new Set(uRjecniku.filter((r) => r.aktivna).map((r) => r.rijec));
  const zaBrisanje = kandidatiZaProvjeru.filter((rijec) => !aktivne.has(rijec));
  if (zaBrisanje.length > 0) {
    await db.delete(botPoolClanovi).where(inArray(botPoolClanovi.rijec, zaBrisanje));
  }
  return ucitajPoolClanove(db);
}

/** Skupno brisanje članstva nakon grupne deaktivacije. */
export async function obrisiPoolClanstva(db: Izvrsitelj, popis: readonly string[]): Promise<void> {
  const normirane = [...new Set(popis.map(normalizirajPoolRijec))];
  if (normirane.length === 0) return;
  await db.delete(botPoolClanovi).where(inArray(botPoolClanovi.rijec, normirane));
}

/** Deaktivacija riječi u rječniku — briše članstvo (ne rekreira se automatski). */
export async function obrisiPoolClanstvo(db: Izvrsitelj, rijec: string): Promise<void> {
  const normirana = normalizirajPoolRijec(rijec);
  await db.delete(botPoolClanovi).where(eq(botPoolClanovi.rijec, normirana));
}

/**
 * Aktivacija / reaktivacija riječi — postavlja razriješeno samo ako članstvo već postoji.
 * Ne stvara novo članstvo nakon brisanja.
 */
export async function razrijesiPoolClan(db: Izvrsitelj, rijec: string): Promise<void> {
  const normirana = normalizirajPoolRijec(rijec);
  const [postoji] = await db
    .select({ rijec: botPoolClanovi.rijec })
    .from(botPoolClanovi)
    .where(eq(botPoolClanovi.rijec, normirana))
    .limit(1);
  if (!postoji) return;

  const [uRjecniku] = await db
    .select({ aktivna: rijeci.aktivna })
    .from(rijeci)
    .where(eq(rijeci.rijec, normirana))
    .limit(1);
  if (!uRjecniku?.aktivna) return;

  await db
    .update(botPoolClanovi)
    .set({ stanje: 'razrijeseno', ranijeAktivno: true, azuriran: new Date() })
    .where(eq(botPoolClanovi.rijec, normirana));
}

/** Ručno dodavanje članstva (admin); aktivna riječ odmah razriješena. */
export async function dodajPoolClan(db: Izvrsitelj, rijec: string, kategorija: KategorijaPoola): Promise<void> {
  const normirana = normalizirajPoolRijec(rijec);
  const [uRjecniku] = await db
    .select({ aktivna: rijeci.aktivna })
    .from(rijeci)
    .where(eq(rijeci.rijec, normirana))
    .limit(1);
  const aktivna = Boolean(uRjecniku?.aktivna);
  await db
    .insert(botPoolClanovi)
    .values({
      rijec: normirana,
      kategorija,
      stanje: aktivna ? 'razrijeseno' : 'nerazrijeseno',
      ranijeAktivno: aktivna,
    })
    .onConflictDoUpdate({
      target: botPoolClanovi.rijec,
      set: {
        kategorija,
        stanje: aktivna ? 'razrijeseno' : 'nerazrijeseno',
        ranijeAktivno: aktivna,
        azuriran: new Date(),
      },
    });
}