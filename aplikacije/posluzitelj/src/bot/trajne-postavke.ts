import { and, eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { izmjenePostavkiBotova, postavkeBotova } from '../baza/shema.js';
import { ShemaKonfiguracijeBota, ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from './konfiguracija-bota.js';

function parsajSpremljenuKonfiguraciju(sirovo: unknown): KonfiguracijaBota {
  return ShemaKonfiguracijeBota.parse({ ...ZADANA_KONFIGURACIJA_BOTA, ...(sirovo && typeof sirovo === 'object' ? sirovo : {}) });
}

export interface ZapisPostavkiBotova {
  revizija: number;
  konfiguracija: KonfiguracijaBota;
  azurirano: string | null;
  azuriraoId: string | null;
}

export class SukobRevizijeBotova extends Error {}

export async function ucitajTrajnePostavkeBotova(zadano: KonfiguracijaBota): Promise<ZapisPostavkiBotova> {
  const [zapis] = await baza.select().from(postavkeBotova).where(eq(postavkeBotova.id, 1));
  return zapis ? {
    revizija: zapis.revizija,
    konfiguracija: parsajSpremljenuKonfiguraciju(zapis.konfiguracija),
    azurirano: zapis.azurirano.toISOString(),
    azuriraoId: zapis.azuriraoId,
  } : { revizija: 0, konfiguracija: ShemaKonfiguracijeBota.parse(zadano), azurirano: null, azuriraoId: null };
}

export async function spremiTrajnePostavkeBotova(konfiguracija: KonfiguracijaBota, ocekivanaRevizija: number, adminId: string): Promise<ZapisPostavkiBotova> {
  if (!Number.isInteger(ocekivanaRevizija) || ocekivanaRevizija < 0 || ocekivanaRevizija >= 2_000_000_000) throw new SukobRevizijeBotova('Nevaljana revizija postavki.');
  const provjerena = ShemaKonfiguracijeBota.parse(konfiguracija);
  const revizija = ocekivanaRevizija + 1;
  const azurirano = new Date();
  return baza.transaction(async (transakcija) => {
    const podaci = { revizija, konfiguracija: provjerena, azuriraoId: adminId, azurirano };
    const zapisi = ocekivanaRevizija === 0
      ? await transakcija.insert(postavkeBotova).values({ id: 1, ...podaci }).onConflictDoNothing().returning()
      : await transakcija.update(postavkeBotova).set(podaci).where(and(eq(postavkeBotova.id, 1), eq(postavkeBotova.revizija, ocekivanaRevizija))).returning();
    if (!zapisi.length) throw new SukobRevizijeBotova('Postavke je u međuvremenu promijenio drugi administrator.');
    await transakcija.insert(izmjenePostavkiBotova).values({ revizija, konfiguracija: provjerena, adminId, vrijeme: azurirano });
    return { revizija, konfiguracija: provjerena, azurirano: azurirano.toISOString(), azuriraoId: adminId };
  });
}