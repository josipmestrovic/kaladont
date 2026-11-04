import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { definicijaMisije, type DefinicijaMisije } from 'zajednicko';
import {
  ciklusiTjednihMisija,
  dodjeleMisija,
  dotokDnevnihMisija,
  stanjeMisijaIgraca,
} from '../baza/shema.js';
import {
  daniIzmedu,
  ponocZaDatumIso,
  sljedecaPonocNakon,
  tjedneGranice,
  zagrebackiDatumIso,
} from './kalendar.js';

function pomakniDatumIso(iso: string, deltaDana: number): string {
  const dijelovi = iso.split('-').map(Number);
  const y = dijelovi[0] ?? 0;
  const m = dijelovi[1] ?? 1;
  const d = dijelovi[2] ?? 1;
  const t = new Date(Date.UTC(y, m - 1, d + deltaDana));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}
import { odaberiDnevnuMisiju, odaberiTjedniPaket, snapshotIzDefinicije } from './generator.js';
import type { MisijeSatRng, MisijeTx, SnapshotMisije } from './tipovi.js';
import { zadaniSatRng } from './tipovi.js';

async function zakljucajStanje(tx: MisijeTx, igracId: string) {
  const [red] = await tx
    .select()
    .from(stanjeMisijaIgraca)
    .where(eq(stanjeMisijaIgraca.igracId, igracId))
    .for('update');
  return red ?? null;
}

async function aktivneDnevne(tx: MisijeTx, igracId: string) {
  return tx
    .select()
    .from(dodjeleMisija)
    .where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
}

async function nedavniDnevniPredlosci(tx: MisijeTx, igracId: string): Promise<string[]> {
  const redovi = await tx
    .select({ predlozakId: dodjeleMisija.predlozakId })
    .from(dodjeleMisija)
    .where(and(eq(dodjeleMisija.igracId, igracId), eq(dodjeleMisija.vrsta, 'dnevna')))
    .orderBy(desc(dodjeleMisija.stvorenoU))
    .limit(7);
  return redovi.map((r) => r.predlozakId);
}

async function umetniDodjelu(
  tx: MisijeTx,
  ulaz: {
    igracId: string;
    vrsta: 'dnevna' | 'tjedna';
    slot: number;
    ciklusId: string | null;
    definicija: DefinicijaMisije;
    dostupnaOd: Date;
    istjeceU: Date | null;
  },
) {
  const snapshot = snapshotIzDefinicije(ulaz.definicija) as SnapshotMisije;
  const [red] = await tx.insert(dodjeleMisija).values({
    igracId: ulaz.igracId,
    vrsta: ulaz.vrsta,
    slot: ulaz.slot,
    ciklusId: ulaz.ciklusId,
    predlozakId: ulaz.definicija.predlozakId,
    verzijaDefinicije: ulaz.definicija.verzijaDefinicije,
    snapshot,
    napredak: 0,
    cilj: ulaz.definicija.cilj,
    podstanje: {},
    status: 'aktivna',
    dostupnaOd: ulaz.dostupnaOd,
    istjeceU: ulaz.istjeceU,
  }).returning();
  return red!;
}

async function kreirajTjedniPaket(tx: MisijeTx, igracId: string, sada: Date, rng: () => number) {
  const granice = tjedneGranice(sada);
  const [postojeci] = await tx
    .select()
    .from(ciklusiTjednihMisija)
    .where(and(
      eq(ciklusiTjednihMisija.igracId, igracId),
      eq(ciklusiTjednihMisija.periodOd, granice.od),
    ))
    .for('update');
  if (postojeci) return postojeci;

  const paket = odaberiTjedniPaket(sada, rng);
  if (!paket) throw new Error('Nije moguće sastaviti tjedni paket misija.');

  const [ciklus] = await tx.insert(ciklusiTjednihMisija).values({
    igracId,
    periodOd: granice.od,
    periodDo: granice.do,
  }).onConflictDoNothing().returning();

  if (!ciklus) {
    const [ponovo] = await tx.select().from(ciklusiTjednihMisija).where(and(
      eq(ciklusiTjednihMisija.igracId, igracId),
      eq(ciklusiTjednihMisija.periodOd, granice.od),
    ));
    return ponovo!;
  }

  for (let i = 0; i < 3; i += 1) {
    await umetniDodjelu(tx, {
      igracId,
      vrsta: 'tjedna',
      slot: i + 1,
      ciklusId: ciklus.id,
      definicija: paket[i]!,
      dostupnaOd: sada,
      istjeceU: granice.do,
    });
  }
  return ciklus;
}

async function isteciStariTjedni(tx: MisijeTx, igracId: string, trenutniPeriodOd: Date) {
  const stari = await tx.select().from(ciklusiTjednihMisija).where(and(
    eq(ciklusiTjednihMisija.igracId, igracId),
    lt(ciklusiTjednihMisija.periodOd, trenutniPeriodOd),
  ));
  if (stari.length === 0) return;
  const idovi = stari.map((c) => c.id);
  await tx.update(dodjeleMisija).set({ status: 'istekla' }).where(and(
    eq(dodjeleMisija.igracId, igracId),
    eq(dodjeleMisija.vrsta, 'tjedna'),
    eq(dodjeleMisija.status, 'aktivna'),
    inArray(dodjeleMisija.ciklusId, idovi),
  ));
}

async function dodijeliJednuDnevnu(
  tx: MisijeTx,
  igracId: string,
  sada: Date,
  dostupnaOd: Date,
  rng: () => number,
) {
  const aktivne = await aktivneDnevne(tx, igracId);
  if (aktivne.length >= 3) return null;

  const zauzetiPredlosci = new Set(aktivne.map((a) => a.predlozakId));
  const zauzeteObitelji = new Set(
    aktivne.map((a) => (a.snapshot as SnapshotMisije).obitelj),
  );
  const imaZahtjevniju = aktivne.some((a) => (a.snapshot as SnapshotMisije).zahtjevnija);
  const nedavni = await nedavniDnevniPredlosci(tx, igracId);
  const definicija = odaberiDnevnuMisiju({
    vrsta: 'dnevna',
    zauzetiPredlosci,
    zauzeteObitelji,
    imaZahtjevniju,
    trebaPristupacnu: false,
    sada,
    nedavniPredlosci: nedavni,
  }, rng);
  if (!definicija) return null;

  const zauzetiSlotovi = new Set(aktivne.map((a) => a.slot));
  const slot = ([1, 2, 3] as const).find((s) => !zauzetiSlotovi.has(s));
  if (!slot) return null;

  return umetniDodjelu(tx, {
    igracId,
    vrsta: 'dnevna',
    slot,
    ciklusId: null,
    definicija,
    dostupnaOd,
    istjeceU: null,
  });
}

/**
 * Osigurava inicijalizaciju, dnevni catch-up i tekući tjedni paket.
 * Mora se zvati unutar transakcije s većim kontekstom zaključavanja igrača.
 */
export async function osigurajStanjeMisija(
  tx: MisijeTx,
  igracId: string,
  satRng: MisijeSatRng = zadaniSatRng,
) {
  const sada = satRng.sada();
  const danasIso = zagrebackiDatumIso(sada);
  let stanje = await zakljucajStanje(tx, igracId);

  if (!stanje) {
    await tx.insert(stanjeMisijaIgraca).values({
      igracId,
      inicijaliziranoU: sada,
      zadnjiObradjeniDnevniDatum: danasIso,
      verzijaStanja: 1,
    }).onConflictDoNothing();
    stanje = await zakljucajStanje(tx, igracId);
    if (!stanje) throw new Error('Nije moguće inicijalizirati stanje misija.');

    // Prva dnevna + tjedni paket.
    const prva = await dodijeliJednuDnevnu(tx, igracId, sada, sada, satRng.rng);
    await tx.insert(dotokDnevnihMisija).values({
      igracId,
      lokalniDatum: danasIso,
      status: prva ? 'dodijeljeno' : 'preskoceno',
    }).onConflictDoNothing();

    const granice = tjedneGranice(sada);
    await isteciStariTjedni(tx, igracId, granice.od);
    await kreirajTjedniPaket(tx, igracId, sada, satRng.rng);
    return stanje;
  }

  // Tjedni rollover prije dnevnog catch-upa.
  const tjedan = tjedneGranice(sada);
  await isteciStariTjedni(tx, igracId, tjedan.od);
  await kreirajTjedniPaket(tx, igracId, sada, satRng.rng);

  // Dnevni catch-up: dani nakon watermarka do danas uključivo.
  const watermark = stanje.zadnjiObradjeniDnevniDatum;
  const neobradeni = daniIzmedu(
    pomakniDatumIso(watermark, 1),
    pomakniDatumIso(danasIso, 1),
  );

  for (const datumIso of neobradeni) {
    const aktivne = await aktivneDnevne(tx, igracId);
    const ponoc = ponocZaDatumIso(datumIso);
    let status: 'dodijeljeno' | 'preskoceno' = 'preskoceno';
    if (aktivne.length < 3) {
      const dodjela = await dodijeliJednuDnevnu(tx, igracId, sada, ponoc, satRng.rng);
      if (dodjela) status = 'dodijeljeno';
    }
    await tx.insert(dotokDnevnihMisija).values({
      igracId,
      lokalniDatum: datumIso,
      status,
    }).onConflictDoNothing();
  }

  if (neobradeni.length > 0) {
    await tx.update(stanjeMisijaIgraca).set({
      zadnjiObradjeniDnevniDatum: danasIso,
      verzijaStanja: sql`${stanjeMisijaIgraca.verzijaStanja} + 1`,
    }).where(eq(stanjeMisijaIgraca.igracId, igracId));
  }

  return (await zakljucajStanje(tx, igracId))!;
}

export function izracunajNovosti(ulaz: {
  zadnjiPregledDnevnihU: Date | null;
  zadnjiPregledTjednihU: Date | null;
  aktivneDnevneDostupneOd: Date[];
  tjedniPaketStvorenU: Date | null;
}): { dnevne: boolean; tjedne: boolean } {
  const dnevne = ulaz.aktivneDnevneDostupneOd.some((d) =>
    ulaz.zadnjiPregledDnevnihU === null || d.getTime() > ulaz.zadnjiPregledDnevnihU.getTime(),
  );
  const tjedne = ulaz.tjedniPaketStvorenU !== null && (
    ulaz.zadnjiPregledTjednihU === null
    || ulaz.tjedniPaketStvorenU.getTime() > ulaz.zadnjiPregledTjednihU.getTime()
  );
  return { dnevne, tjedne };
}

export { sljedecaPonocNakon, definicijaMisije };
