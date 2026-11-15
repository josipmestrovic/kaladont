/**
 * PR09 — izračun i upis univerzalnog ranga (zajedničko za live završetak i backfill CLI).
 *
 * HINT: doprinos ide na sudionici_partije; agregat na igraci.rang_*.
 * Gosti i botovi ulaze u N/S stola, ali agregat se ne dira za njih.
 * Legacy odigrane/bodovi* i dalje se pišu (formatne statistike + rollback).
 */
import { and, eq, sql } from 'drizzle-orm';
import {
  izracunajDoprinosRangJedinice,
  izracunajRangIzAgregata,
  RANG_IZRACUN_VERZIJA,
  type ModPartije,
} from 'zajednicko';
import { igraci, sudioniciPartije } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';

export type RangSudionikUlaz = {
  igracId: string;
  bodovi: number;
  /** covjek | bot */
  upravljac: 'covjek' | 'bot';
  vrstaIgraca: 'gost' | 'registriran' | 'admin';
};

export type RangUpisRezultat = {
  igracId: string;
  doprinosJedinice: number;
  /** True ako je ovaj poziv prvi put upisao doprinos v1 i inkrementirao agregat. */
  novoUpisan: boolean;
  rangBrojPrije: number;
  rangSumaPrije: number;
  rangBrojPoslije: number;
  rangSumaPoslije: number;
  rangPrije: string;
  rangPoslije: string;
};

/** Smije li igrač dobiti trajni univerzalni agregat (ne gost, ne bot). */
export function primaUniverzalniRangAgregat(
  upravljac: 'covjek' | 'bot',
  vrstaIgraca: 'gost' | 'registriran' | 'admin',
): boolean {
  return upravljac === 'covjek' && (vrstaIgraca === 'registriran' || vrstaIgraca === 'admin');
}

/**
 * Izračunaj doprinose za stol. N = broj sjedala u ulazu, S = zbroj bodova.
 * HINT: nedovršen plasman/bodovi ne dolaze ovdje — pozivatelj filtrira.
 */
export function izracunajDoprinoseStola(
  sudionici: readonly RangSudionikUlaz[],
): { n: number; s: number; poIgracu: Map<string, number> } {
  const n = sudionici.length;
  const s = sudionici.reduce((acc, x) => acc + x.bodovi, 0);
  const poIgracu = new Map<string, number>();
  for (const sud of sudionici) {
    poIgracu.set(sud.igracId, izracunajDoprinosRangJedinice(n, sud.bodovi, s));
  }
  return { n, s, poIgracu };
}

/**
 * Upis doprinosa na sudionika + eventualni inkrement agregata.
 * Idempotentno: ako je rang_izracun_verzija već RANG_IZRACUN_VERZIJA, ne dira agregat.
 */
export async function upisiUniverzalniRangZaSudionika(
  tx: MisijeTx,
  partijaId: string,
  sud: RangSudionikUlaz,
  doprinosJedinice: number,
): Promise<RangUpisRezultat> {
  const [postojeci] = await tx
    .select({
      rangIzracunVerzija: sudioniciPartije.rangIzracunVerzija,
      rangDoprinosJedinice: sudioniciPartije.rangDoprinosJedinice,
    })
    .from(sudioniciPartije)
    .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, sud.igracId)))
    .limit(1);

  const vecUpisan = postojeci?.rangIzracunVerzija === RANG_IZRACUN_VERZIJA;

  // Čitaj vrstu/upravljača iz zaključanog retka (ne iz snapshot-a pozivatelja):
  // gost može postati registriran tijekom spremanja rezultata.
  const [agregatPrije] = await tx
    .select({
      rangBrojPartija: igraci.rangBrojPartija,
      rangSumaJedinica: igraci.rangSumaJedinica,
      upravljac: igraci.upravljac,
      vrsta: igraci.vrsta,
    })
    .from(igraci)
    .where(eq(igraci.id, sud.igracId))
    .limit(1);

  const rangBrojPrije = agregatPrije?.rangBrojPartija ?? 0;
  const rangSumaPrije = Number(agregatPrije?.rangSumaJedinica ?? 0);
  const rangPrije = izracunajRangIzAgregata(rangSumaPrije, rangBrojPrije);

  const upravljacDb = agregatPrije?.upravljac === 'bot' ? 'bot' : 'covjek';
  const vrstaDb: RangSudionikUlaz['vrstaIgraca'] =
    agregatPrije?.vrsta === 'admin' || agregatPrije?.vrsta === 'registriran' || agregatPrije?.vrsta === 'gost'
      ? agregatPrije.vrsta
      : sud.vrstaIgraca;

  // HINT (Bugbot): verziju stavi SAMO uz inkrement agregata. Gost/bot: doprinos bez
  // verzije — RS-20 `preuzmiGostovskeRangDoprinose` ih pokupi pri registraciji.
  const smijeAgregat = primaUniverzalniRangAgregat(upravljacDb, vrstaDb);
  const sadaUpisujemoAgregat = !vecUpisan && smijeAgregat;

  await tx
    .update(sudioniciPartije)
    .set({
      rangDoprinosJedinice: doprinosJedinice,
      // Ne stampaj verziju gostu/botu: inače backfill/registracija misle da je agregat već uzet.
      rangIzracunVerzija: sadaUpisujemoAgregat || vecUpisan
        ? RANG_IZRACUN_VERZIJA
        : (postojeci?.rangIzracunVerzija ?? null),
    })
    .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, sud.igracId)));

  let rangBrojPoslije = rangBrojPrije;
  let rangSumaPoslije = rangSumaPrije;
  let novoUpisan = false;

  if (sadaUpisujemoAgregat) {
    const [azurirani] = await tx
      .update(igraci)
      .set({
        rangSumaJedinica: sql`${igraci.rangSumaJedinica} + ${doprinosJedinice}`,
        rangBrojPartija: sql`${igraci.rangBrojPartija} + 1`,
      })
      .where(eq(igraci.id, sud.igracId))
      .returning({
        rangBrojPartija: igraci.rangBrojPartija,
        rangSumaJedinica: igraci.rangSumaJedinica,
      });
    rangBrojPoslije = azurirani?.rangBrojPartija ?? rangBrojPrije + 1;
    rangSumaPoslije = Number(azurirani?.rangSumaJedinica ?? rangSumaPrije + doprinosJedinice);
    novoUpisan = true;
  }

  const rangPoslije = izracunajRangIzAgregata(rangSumaPoslije, rangBrojPoslije);

  return {
    igracId: sud.igracId,
    doprinosJedinice,
    novoUpisan,
    rangBrojPrije,
    rangSumaPrije,
    rangBrojPoslije,
    rangSumaPoslije,
    rangPrije,
    rangPoslije,
  };
}

/**
 * RS-20: gost → registriran — pokupi javne doprinose koji još nemaju verziju
 * (odigrane kao gost) i dodaj ih u univerzalni agregat. Idempotentno.
 */
export async function preuzmiGostovskeRangDoprinose(
  tx: MisijeTx,
  igracId: string,
): Promise<{ preuzeto: number; sumaJedinica: number }> {
  await tx.execute(sql`select id from igraci where id = ${igracId} for update`);

  const redovi = await tx
    .select({
      partijaId: sudioniciPartije.partijaId,
      doprinos: sudioniciPartije.rangDoprinosJedinice,
    })
    .from(sudioniciPartije)
    .where(and(
      eq(sudioniciPartije.igracId, igracId),
      sql`${sudioniciPartije.rangDoprinosJedinice} is not null`,
      sql`${sudioniciPartije.rangIzracunVerzija} is null`,
    ));

  if (redovi.length === 0) return { preuzeto: 0, sumaJedinica: 0 };

  let suma = 0;
  for (const red of redovi) {
    const doprinos = Number(red.doprinos ?? 0);
    suma += doprinos;
    await tx
      .update(sudioniciPartije)
      .set({ rangIzracunVerzija: RANG_IZRACUN_VERZIJA })
      .where(and(
        eq(sudioniciPartije.partijaId, red.partijaId),
        eq(sudioniciPartije.igracId, igracId),
        sql`${sudioniciPartije.rangIzracunVerzija} is null`,
      ));
  }

  await tx
    .update(igraci)
    .set({
      rangSumaJedinica: sql`${igraci.rangSumaJedinica} + ${suma}`,
      rangBrojPartija: sql`${igraci.rangBrojPartija} + ${redovi.length}`,
    })
    .where(eq(igraci.id, igracId));

  return { preuzeto: redovi.length, sumaJedinica: suma };
}

/**
 * Upis ranga za cijeli javni stol nakon što su svi bodovi poznati.
 * HINT: zaključaj igrače stabilnim redoslijedom (sortirani ID) prije inkrementa.
 */
export async function upisiUniverzalniRangZaStol(
  tx: MisijeTx,
  partijaId: string,
  sudionici: readonly RangSudionikUlaz[],
  /** Zadržano zbog pozivatelja (format partije); doprinos ne ovisi o modu. */
  mod: ModPartije,
): Promise<Map<string, RangUpisRezultat>> {
  void mod;
  const { poIgracu } = izracunajDoprinoseStola(sudionici);
  const sortirani = [...sudionici].sort((a, b) => a.igracId.localeCompare(b.igracId));
  const rezultati = new Map<string, RangUpisRezultat>();

  // Stabilno zaključavanje redoslijedom SELECT … FOR UPDATE (Postgres).
  for (const sud of sortirani) {
    await tx.execute(sql`select id from igraci where id = ${sud.igracId} for update`);
  }

  for (const sud of sortirani) {
    const doprinos = poIgracu.get(sud.igracId) ?? 0;
    const rez = await upisiUniverzalniRangZaSudionika(tx, partijaId, sud, doprinos);
    rezultati.set(sud.igracId, rez);
  }
  return rezultati;
}
