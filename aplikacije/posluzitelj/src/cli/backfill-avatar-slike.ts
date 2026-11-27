/**
 * Backfill generiranih WebP avatara za registrirane igrače.
 *
 *   pnpm --filter posluzitelj backfill-avatar-slike -- --usporedi
 *     → broj jedinstvenih konfiguracija i datoteka koje nedostaju (bez osobnih podataka)
 *   pnpm --filter posluzitelj backfill-avatar-slike -- --primijeni=DA
 *     → upis nedostajućih 64/128/320; drugi prolaz je no-op
 *
 * U produkciji upis traži --odrzavanje-produkcije=DA.
 * Gosti i botovi se ne diraju. Isti hash se generira jednom.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { validirajAvatarConfig, type AvatarConfigV1 } from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { hashAvataraConfig } from '../avatar/hash.js';
import { osigurajGeneriraneAvatare } from '../avatar/generator.js';

const VELICINA_SERIJE = 100;
const PARALELNO = 3;
const VELICINE = [64, 128, 320] as const;

function imaZastavicu(ime: string): boolean {
  return process.argv.includes(ime);
}

async function datotekePostoje(hash: string): Promise<boolean> {
  const provjere = await Promise.all(VELICINE.map(async (velicina) => {
    try {
      await access(path.join(konfiguracija.AVATARI_GENERIRANI_DIR, hash, `${velicina}.webp`));
      return true;
    } catch {
      return false;
    }
  }));
  return provjere.every(Boolean);
}

async function skupiJedinstvene(): Promise<Map<string, AvatarConfigV1>> {
  const jedinstvene = new Map<string, AvatarConfigV1>();
  let odId: string | null = null;
  for (;;) {
    const uvjeti = [
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['registriran', 'admin']),
      isNull(igraci.obrisanAt),
      sql`${igraci.avatarConfig} is not null`,
    ];
    if (odId) uvjeti.push(gt(igraci.id, odId));
    const serija = await baza
      .select({ id: igraci.id, avatarConfig: igraci.avatarConfig })
      .from(igraci)
      .where(and(...uvjeti))
      .orderBy(asc(igraci.id))
      .limit(VELICINA_SERIJE);
    for (const red of serija) {
      if (!validirajAvatarConfig(red.avatarConfig)) continue;
      const hash = hashAvataraConfig(red.avatarConfig);
      if (!jedinstvene.has(hash)) jedinstvene.set(hash, red.avatarConfig);
    }
    if (serija.length < VELICINA_SERIJE) break;
    odId = serija[serija.length - 1]!.id;
  }
  return jedinstvene;
}

async function obradi(stavke: [string, AvatarConfigV1][], primijeni: boolean): Promise<{
  vecPostoji: number;
  generirano: number;
  greske: number;
}> {
  let vecPostoji = 0;
  let generirano = 0;
  let greske = 0;
  let indeks = 0;

  async function radnik(): Promise<void> {
    for (;;) {
      const trenutni = indeks;
      indeks += 1;
      const stavka = stavke[trenutni];
      if (!stavka) return;
      const [hash, config] = stavka;
      try {
        if (await datotekePostoje(hash)) {
          vecPostoji += 1;
          continue;
        }
        if (!primijeni) continue;
        await osigurajGeneriraneAvatare(config);
        generirano += 1;
      } catch (greska) {
        greske += 1;
        console.error(JSON.stringify({ hash, greska: greska instanceof Error ? greska.message : String(greska) }));
      }
    }
  }

  const radnici = Array.from({ length: Math.min(PARALELNO, Math.max(stavke.length, 1)) }, () => radnik());
  await Promise.all(radnici);
  return { vecPostoji, generirano, greske };
}

async function glavno(): Promise<void> {
  const usporedi = imaZastavicu('--usporedi');
  const primijeni = imaZastavicu('--primijeni=DA');
  const odrzavanjeProdukcije = imaZastavicu('--odrzavanje-produkcije=DA');

  if (!usporedi && !primijeni) {
    console.log('Za pregled: --usporedi. Za upis nedostajućih slika: --primijeni=DA.');
    return;
  }
  if (konfiguracija.NODE_ENV === 'production' && primijeni && !odrzavanjeProdukcije) {
    throw new Error('U produkciji backfill traži --odrzavanje-produkcije=DA.');
  }

  const jedinstvene = await skupiJedinstvene();
  const stavke = [...jedinstvene.entries()];
  if (usporedi) {
    let postoji = 0;
    let nedostaje = 0;
    for (const [hash] of stavke) {
      if (await datotekePostoje(hash)) postoji += 1;
      else nedostaje += 1;
    }
    console.log(JSON.stringify({
      usporedba: {
        jedinstvenihKonfiguracija: stavke.length,
        datotekePostoje: postoji,
        datotekeNedostaju: nedostaje,
        napomena: 'Bez osobnih podataka. Gosti i botovi nisu u skupu.',
      },
    }, null, 2));
  }

  if (primijeni) {
    const rezultat = await obradi(stavke, true);
    console.log(JSON.stringify({ primijeni: rezultat }, null, 2));
  }
}

const putanjaUlaza = process.argv[1]?.replace(/\\/g, '/') ?? '';
const pokrenutIzravno = putanjaUlaza.endsWith('/cli/backfill-avatar-slike.ts')
  || putanjaUlaza.endsWith('/cli/backfill-avatar-slike.js');
if (pokrenutIzravno) {
  glavno().catch((pogreska: unknown) => {
    console.error(pogreska instanceof Error ? pogreska.message : String(pogreska));
    process.exitCode = 1;
  }).finally(() => zatvoriBazu());
}
