import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { definicijaMisije, type DefinicijaMisije, type StanjeMisijaDto } from 'zajednicko';
import {
  dodjeleMisija,
  stanjeMisijaIgraca,
  zamjeneMisija,
} from '../baza/shema.js';
import { izgradiStanjeMisijaDto } from './dto.js';
import { odaberiZamjenu, snapshotIzDefinicije } from './generator.js';
import { osigurajStanjeMisija } from './stanje.js';
import { lokalniDatumIso } from './kalendar.js';
import type { MisijeSatRng, MisijeTx, SnapshotMisije } from './tipovi.js';
import { zadaniSatRng } from './tipovi.js';

export type GreskaZamjene =
  | { kod: 'MISIJA_NIJE_PRONADENA' }
  | { kod: 'MISIJA_DOVRSENA' }
  | { kod: 'MISIJA_NIJE_AKTIVNA' }
  | { kod: 'ZAMJENA_ISKORISTENA' }
  | { kod: 'NEMA_ALTERNATIVE' }
  | { kod: 'IDEMPOTENCY_KONFLIKT' }
  | { kod: 'NEVALJAN_ZAHTJEV' };

export type RezultatZamjene =
  | { ok: true; stanje: StanjeMisijaDto }
  | { ok: false; greska: GreskaZamjene };

export async function zamijeniMisiju(
  tx: MisijeTx,
  igracId: string,
  dodjelaId: string,
  idempotencyKey: string,
  satRng: MisijeSatRng = zadaniSatRng,
): Promise<RezultatZamjene> {
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return { ok: false, greska: { kod: 'NEVALJAN_ZAHTJEV' } };
  }

  const sada = satRng.sada();
  await osigurajStanjeMisija(tx, igracId, satRng);
  await tx.select().from(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, igracId)).for('update');

  const [postojećaZamjena] = await tx.select().from(zamjeneMisija).where(and(
    eq(zamjeneMisija.igracId, igracId),
    eq(zamjeneMisija.idempotencyKey, idempotencyKey),
  )).limit(1);

  if (postojećaZamjena) {
    if (postojećaZamjena.staraDodjelaId !== dodjelaId) {
      return { ok: false, greska: { kod: 'IDEMPOTENCY_KONFLIKT' } };
    }
    return { ok: true, stanje: await izgradiStanjeMisijaDto(tx, igracId, satRng) };
  }

  const [dodjela] = await tx.select().from(dodjeleMisija).where(eq(dodjeleMisija.id, dodjelaId)).for('update');
  if (!dodjela || dodjela.igracId !== igracId) {
    return { ok: false, greska: { kod: 'MISIJA_NIJE_PRONADENA' } };
  }
  if (dodjela.status === 'dovrsena') return { ok: false, greska: { kod: 'MISIJA_DOVRSENA' } };
  if (dodjela.status !== 'aktivna') return { ok: false, greska: { kod: 'MISIJA_NIJE_AKTIVNA' } };

  const dan = lokalniDatumIso(sada);
  const [kvota] = await tx.select().from(zamjeneMisija).where(and(
    eq(zamjeneMisija.igracId, igracId),
    eq(zamjeneMisija.vrsta, dodjela.vrsta),
    eq(zamjeneMisija.zagrebackiDatum, dan),
  )).limit(1);
  if (kvota) return { ok: false, greska: { kod: 'ZAMJENA_ISKORISTENA' } };

  let ostaleDef: DefinicijaMisije[] = [];
  const zabranjeni = new Set<string>([dodjela.predlozakId]);

  if (dodjela.vrsta === 'dnevna') {
    const ostale = await tx.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
      ne(dodjeleMisija.id, dodjela.id),
    ));
    ostaleDef = ostale.map((o) => definicijaMisije(o.predlozakId)!).filter(Boolean);
  } else {
    const ostale = await tx.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.ciklusId, dodjela.ciklusId!),
      inArray(dodjeleMisija.status, ['aktivna', 'dovrsena', 'zamijenjena']),
      ne(dodjeleMisija.id, dodjela.id),
    ));
    for (const o of ostale) zabranjeni.add(o.predlozakId);
    ostaleDef = ostale
      .filter((o) => o.status === 'aktivna' || o.status === 'dovrsena')
      .map((o) => definicijaMisije(o.predlozakId)!)
      .filter(Boolean);
  }

  const novaDef = odaberiZamjenu(dodjela.vrsta, ostaleDef, sada, satRng.rng, zabranjeni);
  if (!novaDef) return { ok: false, greska: { kod: 'NEMA_ALTERNATIVE' } };

  await tx.update(dodjeleMisija).set({ status: 'zamijenjena' }).where(eq(dodjeleMisija.id, dodjela.id));

  const snapshot = snapshotIzDefinicije(novaDef) as SnapshotMisije;
  const [nova] = await tx.insert(dodjeleMisija).values({
    igracId,
    vrsta: dodjela.vrsta,
    slot: dodjela.slot,
    ciklusId: dodjela.ciklusId,
    predlozakId: novaDef.predlozakId,
    verzijaDefinicije: novaDef.verzijaDefinicije,
    snapshot,
    napredak: 0,
    cilj: novaDef.cilj,
    podstanje: {},
    status: 'aktivna',
    dostupnaOd: sada,
    istjeceU: dodjela.istjeceU,
  }).returning();

  await tx.insert(zamjeneMisija).values({
    igracId,
    vrsta: dodjela.vrsta,
    zagrebackiDatum: dan,
    staraDodjelaId: dodjela.id,
    novaDodjelaId: nova!.id,
    idempotencyKey,
  });

  await tx.update(stanjeMisijaIgraca).set({
    verzijaStanja: sql`${stanjeMisijaIgraca.verzijaStanja} + 1`,
  }).where(eq(stanjeMisijaIgraca.igracId, igracId));

  return { ok: true, stanje: await izgradiStanjeMisijaDto(tx, igracId, satRng) };
}
