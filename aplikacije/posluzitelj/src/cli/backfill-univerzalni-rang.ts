/**
 * PR09 — backfill univerzalnog ranga iz završenih javnih partija.
 *
 * OPS (obavezno nakon deploya migracije 0065):
 *   1) pnpm --filter posluzitelj migracije
 *   2) pnpm --filter posluzitelj backfill-univerzalni-rang -- --usporedi
 *      → report staro vs novo (bez PII), broj nepotpunih partija
 *   3) pnpm --filter posluzitelj backfill-univerzalni-rang -- --primijeni=DA
 *      → upis doprinosa + inkrement agregata (gostovi se NE agregiraju)
 *   4) ponovno --usporedi za potvrdu; drugi prolaz mora biti no-op
 *
 * Lokalno / staging / produkcija: ista naredba uz DATABASE_URL okoline.
 * U produkciji dodaj --odrzavanje-produkcije=DA. Poslužitelj smije raditi
 * (idempotentno; live završetci zaključavaju igrače). Restart mid-run je OK —
 * nastavlja od --od=UUID kursora.
 *
 * HINT: ne šalje sandučić obavijesti. Ne dira XP/misije/dostignuća.
 * Legacy odigrane/bodovi* se NE zbrajaju ponovo.
 */
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import {
  izracunajRangIzAgregata,
  RANG_IZRACUN_VERZIJA,
  RANGOVI_1V1,
  RANGOVI_LEGACY_4P,
  vratiVeciRang,
} from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { igraci, obracuniPartija, partije, sudioniciPartije } from '../baza/shema.js';
import {
  primaUniverzalniRangAgregat,
  upisiUniverzalniRangZaStol,
  type RangSudionikUlaz,
} from '../igra/univerzalni-rang.js';

const VELICINA_SERIJE = 100;

type IzvjesceNepotpuno = { partijaId: string; razlog: string };

function imaZastavicu(ime: string): boolean {
  return process.argv.includes(ime);
}

function vrijednostZastavice(prefiks: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefiks));
  if (!arg) return undefined;
  return arg.slice(prefiks.length) || undefined;
}

function legacyRangIzBrojaca(odigrane: number, bodovi: number, lista: typeof RANGOVI_LEGACY_4P): string {
  if (odigrane < 10) return 'Piskaralo';
  const prosjek = odigrane > 0 ? bodovi / odigrane : 0;
  let rang = lista[0]!.naziv;
  for (const prag of lista) {
    if (prosjek >= prag.minimalniProsjek) rang = prag.naziv;
  }
  return rang;
}

async function usporediUzorke(limit: number): Promise<void> {
  const uzorak = await baza
    .select({
      id: igraci.id,
      odigrane: igraci.odigrane,
      bodoviUkupno: igraci.bodoviUkupno,
      odigrane1v1: igraci.odigrane1v1,
      bodovi1v1: igraci.bodovi1v1,
      rangBrojPartija: igraci.rangBrojPartija,
      rangSumaJedinica: igraci.rangSumaJedinica,
    })
    .from(igraci)
    .where(and(
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['registriran', 'admin']),
      isNull(igraci.obrisanAt),
      sql`(${igraci.odigrane} + ${igraci.odigrane1v1} + ${igraci.rangBrojPartija}) > 0`,
    ))
    .orderBy(asc(igraci.id))
    .limit(limit);

  const distStari = new Map<string, number>();
  const distNovi = new Map<string, number>();
  let isti = 0;
  let razliciti = 0;

  for (const red of uzorak) {
    const r4 = legacyRangIzBrojaca(red.odigrane, red.bodoviUkupno, RANGOVI_LEGACY_4P);
    const r2 = legacyRangIzBrojaca(red.odigrane1v1, red.bodovi1v1, RANGOVI_1V1);
    const stari = vratiVeciRang(r4 === 'Piskaralo' ? null : r4, r2 === 'Piskaralo' ? null : r2) ?? 'Piskaralo';
    const novi = izracunajRangIzAgregata(Number(red.rangSumaJedinica), red.rangBrojPartija);
    distStari.set(stari, (distStari.get(stari) ?? 0) + 1);
    distNovi.set(novi, (distNovi.get(novi) ?? 0) + 1);
    if (stari === novi) isti += 1;
    else razliciti += 1;
  }

  console.log(JSON.stringify({
    usporedba: {
      uzorak: uzorak.length,
      istiNaziv: isti,
      razlicitiNaziv: razliciti,
      raspodjelaStariMax2p4p: Object.fromEntries(distStari),
      raspodjelaUniverzalni: Object.fromEntries(distNovi),
      napomena: 'Bez osobnih podataka. Stari = max(2p,4p) legacy; novi = univerzalni agregat (0 dok backfill ne popuni).',
    },
  }, null, 2));
}

async function obnoviAgregateIzDoprinosa(): Promise<{ igraca: number }> {
  // HINT: deterministički rebuild — ne zbrajaj legacy brojače.
  await baza.execute(sql`
    update igraci i
    set
      rang_suma_jedinica = coalesce(a.suma, 0),
      rang_broj_partija = coalesce(a.broj, 0)
    from (
      select
        s.igrac_id,
        sum(s.rang_doprinos_jedinice)::bigint as suma,
        count(*)::int as broj
      from sudionici_partije s
      inner join igraci g on g.id = s.igrac_id
      where s.rang_izracun_verzija = ${RANG_IZRACUN_VERZIJA}
        and g.upravljac = 'covjek'
        and g.vrsta in ('registriran', 'admin')
      group by s.igrac_id
    ) a
    where i.id = a.igrac_id
  `);
  // Igrači bez doprinosa → 0
  await baza.execute(sql`
    update igraci
    set rang_suma_jedinica = 0, rang_broj_partija = 0
    where upravljac = 'covjek'
      and vrsta in ('registriran', 'admin')
      and id not in (
        select distinct igrac_id from sudionici_partije
        where rang_izracun_verzija = ${RANG_IZRACUN_VERZIJA}
      )
  `);
  const [broj] = await baza.select({ n: sql<number>`count(*)::int` }).from(igraci).where(and(
    eq(igraci.upravljac, 'covjek'),
    inArray(igraci.vrsta, ['registriran', 'admin']),
    sql`${igraci.rangBrojPartija} > 0`,
  ));
  return { igraca: broj?.n ?? 0 };
}

async function obradiSeriju(odId: string | null, primijeni: boolean): Promise<{
  obradjeno: number;
  upisano: number;
  preskoceno: number;
  nepotpuno: IzvjesceNepotpuno[];
  sljedeciOd: string | null;
}> {
  const uvjeti = [
    eq(partije.status, 'zavrsena'),
    eq(obracuniPartija.vrsta, 'javna_partija'),
  ];
  if (odId) uvjeti.push(gt(partije.id, odId));

  const partijeSerije = await baza
    .select({ id: partije.id, mod: partije.mod })
    .from(partije)
    .innerJoin(obracuniPartija, eq(obracuniPartija.partijaId, partije.id))
    .where(and(...uvjeti))
    .orderBy(asc(partije.id))
    .limit(VELICINA_SERIJE);

  const nepotpuno: IzvjesceNepotpuno[] = [];
  let upisano = 0;
  let preskoceno = 0;

  for (const partija of partijeSerije) {
    const sudionici = await baza
      .select({
        igracId: sudioniciPartije.igracId,
        bodovi: sudioniciPartije.bodovi,
        plasman: sudioniciPartije.plasman,
        rangIzracunVerzija: sudioniciPartije.rangIzracunVerzija,
        rangDoprinosJedinice: sudioniciPartije.rangDoprinosJedinice,
        upravljac: igraci.upravljac,
        vrsta: igraci.vrsta,
      })
      .from(sudioniciPartije)
      .innerJoin(igraci, eq(igraci.id, sudioniciPartije.igracId))
      .where(eq(sudioniciPartije.partijaId, partija.id));

    if (sudionici.length === 0) {
      nepotpuno.push({ partijaId: partija.id, razlog: 'nema_sudionika' });
      continue;
    }
    if (sudionici.some((s) => s.plasman == null)) {
      nepotpuno.push({ partijaId: partija.id, razlog: 'nepotpuni_plasman' });
      continue;
    }

    // Gost/bot namjerno nemaju verziju — gotovo = doprinos upisan;
    // registrirani/admin gotovo = verzija stamped (agregat uzet).
    const sviGotovi = sudionici.every((s) => {
      const upravljac = s.upravljac === 'bot' ? 'bot' : 'covjek';
      const vrsta = s.vrsta === 'admin' || s.vrsta === 'registriran' || s.vrsta === 'gost' ? s.vrsta : 'gost';
      if (primaUniverzalniRangAgregat(upravljac, vrsta)) {
        return s.rangIzracunVerzija === RANG_IZRACUN_VERZIJA;
      }
      return s.rangDoprinosJedinice != null;
    });
    if (sviGotovi) {
      preskoceno += 1;
      continue;
    }

    if (!primijeni) {
      upisano += 1;
      continue;
    }

    const ulaz: RangSudionikUlaz[] = sudionici.map((s) => ({
      igracId: s.igracId,
      bodovi: s.bodovi,
      upravljac: s.upravljac === 'bot' ? 'bot' : 'covjek',
      vrstaIgraca: s.vrsta === 'admin' || s.vrsta === 'registriran' || s.vrsta === 'gost' ? s.vrsta : 'gost',
    }));

    await baza.transaction(async (tx) => {
      await upisiUniverzalniRangZaStol(tx, partija.id, ulaz, partija.mod);
    });
    upisano += 1;
  }

  const sljedeciOd = partijeSerije.length > 0 ? partijeSerije[partijeSerije.length - 1]!.id : null;
  return {
    obradjeno: partijeSerije.length,
    upisano,
    preskoceno,
    nepotpuno,
    sljedeciOd: partijeSerije.length === VELICINA_SERIJE ? sljedeciOd : null,
  };
}

async function glavno(): Promise<void> {
  const primijeni = imaZastavicu('--primijeni=DA');
  const usporedi = imaZastavicu('--usporedi');
  const obnovi = imaZastavicu('--obnovi-agregate=DA');
  const odrzavanjeProdukcije = imaZastavicu('--odrzavanje-produkcije=DA');
  let odId = vrijednostZastavice('--od=') ?? null;

  if (konfiguracija.NODE_ENV === 'production' && (primijeni || obnovi) && !odrzavanjeProdukcije) {
    throw new Error('U produkciji backfill traži --odrzavanje-produkcije=DA.');
  }

  if (usporedi) {
    const limit = Number(vrijednostZastavice('--limit=') ?? '200');
    await usporediUzorke(Number.isFinite(limit) ? limit : 200);
  }

  if (obnovi) {
    const rez = await obnoviAgregateIzDoprinosa();
    console.log(JSON.stringify({ obnoviAgregate: rez }, null, 2));
  }

  if (!primijeni && !usporedi && !obnovi) {
    console.log('Samo pregled serija. Za upis: --primijeni=DA. Za usporedbu: --usporedi. Za rebuild agregata: --obnovi-agregate=DA.');
  }

  let ukupnoObradeno = 0;
  let ukupnoUpisano = 0;
  let ukupnoPreskoceno = 0;
  const svaNepotpuna: IzvjesceNepotpuno[] = [];

  // Dry-run ili apply: prolaz kroz partije.
  if (primijeni || !usporedi || imaZastavicu('--pregled-serija')) {
    for (;;) {
      const serija = await obradiSeriju(odId, primijeni);
      ukupnoObradeno += serija.obradjeno;
      ukupnoUpisano += serija.upisano;
      ukupnoPreskoceno += serija.preskoceno;
      svaNepotpuna.push(...serija.nepotpuno);
      console.log(JSON.stringify({
        serija: {
          od: odId,
          obradjeno: serija.obradjeno,
          upisanoIliKandidati: serija.upisano,
          vecUpisano: serija.preskoceno,
          nepotpunoUSeriji: serija.nepotpuno.length,
          primijeni,
        },
      }));
      if (!serija.sljedeciOd) break;
      odId = serija.sljedeciOd;
    }
  }

  console.log(JSON.stringify({
    sazetak: {
      primijeni,
      ukupnoObradeno,
      ukupnoUpisanoIliKandidati: ukupnoUpisano,
      ukupnoVecUpisano: ukupnoPreskoceno,
      brojNepotpunihPartija: svaNepotpuna.length,
      // HINT: samo report — ne failaj CI. Identifikatori za ručni uvid.
      nepotpunoPrimjer: svaNepotpuna.slice(0, 20),
    },
  }, null, 2));

}

const pokrenutIzravno = process.argv[1]?.replace(/\\/g, '/').endsWith('/cli/backfill-univerzalni-rang.ts');
if (pokrenutIzravno) {
  glavno().catch((pogreska: unknown) => {
    console.error(pogreska instanceof Error ? pogreska.message : String(pogreska));
    process.exitCode = 1;
  }).finally(() => zatvoriBazu());
}
