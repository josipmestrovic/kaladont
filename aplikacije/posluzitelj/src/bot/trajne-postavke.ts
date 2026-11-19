import { and, eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { izmjenePostavkiBotova, postavkeBotova } from '../baza/shema.js';
import {
  ShemaKonfiguracijeBota,
  VERZIJA_BOT_POLITIKE,
  ZADANA_KONFIGURACIJA_BOTA,
  ZASTARJELA_POLJA_BOT_POLITIKE,
  type KonfiguracijaBota,
} from './konfiguracija-bota.js';

/**
 * Stare spremljene konfiguracije (v3/v4) moraju dobiti zadane vrijednosti v5
 * i odbaciti zastarjela polja tempa/izostanka/reakcija bez ručnog admin upisa.
 * `zadano` treba biti env-učitan snapshot (BOTOVI_*), ne samo hardkodirani default —
 * inače nedostajući `botoviTroboj` uvijek padne na false i env se zanemari.
 */
export function parsajSpremljenuKonfiguraciju(
  sirovo: unknown,
  zadano: KonfiguracijaBota = ZADANA_KONFIGURACIJA_BOTA,
): KonfiguracijaBota {
  const ulaz = sirovo && typeof sirovo === 'object' ? { ...(sirovo as Record<string, unknown>) } : {};
  for (const polje of ZASTARJELA_POLJA_BOT_POLITIKE) {
    delete ulaz[polje];
  }
  const pragoviUlaz = ulaz.pragoviPopuneMs && typeof ulaz.pragoviPopuneMs === 'object'
    ? (ulaz.pragoviPopuneMs as Record<string, unknown>)
    : {};
  const odstupanjaUlaz = ulaz.odstupanjaPopuneMs && typeof ulaz.odstupanjaPopuneMs === 'object'
    ? (ulaz.odstupanjaPopuneMs as Record<string, unknown>)
    : {};
  return ShemaKonfiguracijeBota.parse({
    ...zadano,
    ...ulaz,
    verzija: VERZIJA_BOT_POLITIKE,
    trajanjePotezaBotaMs: typeof ulaz.trajanjePotezaBotaMs === 'number' ? ulaz.trajanjePotezaBotaMs : zadano.trajanjePotezaBotaMs,
    jitterPotezaBotaMs: typeof ulaz.jitterPotezaBotaMs === 'number' ? ulaz.jitterPotezaBotaMs : zadano.jitterPotezaBotaMs,
    odgodaReakcijeMinMs: typeof ulaz.odgodaReakcijeMinMs === 'number' ? ulaz.odgodaReakcijeMinMs : zadano.odgodaReakcijeMinMs,
    pragoviPopuneMs: {
      ...zadano.pragoviPopuneMs,
      ...pragoviUlaz,
    },
    odstupanjaPopuneMs: {
      ...zadano.odstupanjaPopuneMs,
      ...odstupanjaUlaz,
    },
    botoviDvoboj: typeof ulaz.botoviDvoboj === 'boolean' ? ulaz.botoviDvoboj : zadano.botoviDvoboj,
    botoviTroboj: typeof ulaz.botoviTroboj === 'boolean' ? ulaz.botoviTroboj : zadano.botoviTroboj,
    botoviCetveroboj: typeof ulaz.botoviCetveroboj === 'boolean' ? ulaz.botoviCetveroboj : zadano.botoviCetveroboj,
  });
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
    konfiguracija: parsajSpremljenuKonfiguraciju(zapis.konfiguracija, zadano),
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
