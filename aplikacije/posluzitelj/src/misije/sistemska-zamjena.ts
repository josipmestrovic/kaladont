/**
 * Automatska zamjena aktivnih neostvarivih misija (katalog aktivna:false).
 * Ne troši dnevnu ručnu kvotu (ne upisuje zamjeneMisija).
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { definicijaMisije, type DefinicijaMisije } from 'zajednicko';
import { dodjeleMisija, stanjeMisijaIgraca } from '../baza/shema.js';
import { odaberiZamjenu, snapshotIzDefinicije } from './generator.js';
import type { MisijeSatRng, MisijeTx, SnapshotMisije } from './tipovi.js';
import { zadaniSatRng } from './tipovi.js';

function predlozakNeostvariv(predlozakId: string): boolean {
  const def = definicijaMisije(predlozakId);
  return !def || def.aktivna === false;
}

/**
 * Zamijeni sve aktivne dodjele čiji je predložak deaktiviran.
 * Pozivati unutar TX nakon osigurajStanjeMisija / uz zaključano stanje igrača.
 */
export async function sistemskiZamijeniNeostvariveMisije(
  tx: MisijeTx,
  igracId: string,
  satRng: MisijeSatRng = zadaniSatRng,
): Promise<number> {
  const sada = satRng.sada();
  const aktivne = await tx.select().from(dodjeleMisija).where(and(
    eq(dodjeleMisija.igracId, igracId),
    eq(dodjeleMisija.status, 'aktivna'),
  )).for('update');

  const neostvarive = aktivne.filter((d) => predlozakNeostvariv(d.predlozakId));
  if (neostvarive.length === 0) return 0;

  let zamijenjeno = 0;
  for (const dodjela of neostvarive) {
    // Ponovno učitaj — paralelni request možda već zamijenio.
    const [svjeza] = await tx.select().from(dodjeleMisija).where(eq(dodjeleMisija.id, dodjela.id)).for('update');
    if (!svjeza || svjeza.status !== 'aktivna' || !predlozakNeostvariv(svjeza.predlozakId)) continue;

    const zabranjeni = new Set<string>([svjeza.predlozakId]);
    let ostaleDef: DefinicijaMisije[] = [];

    if (svjeza.vrsta === 'dnevna') {
      const ostale = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'dnevna'),
        eq(dodjeleMisija.status, 'aktivna'),
        ne(dodjeleMisija.id, svjeza.id),
      ));
      ostaleDef = ostale.map((o) => definicijaMisije(o.predlozakId)!).filter(Boolean);
      for (const o of ostale) zabranjeni.add(o.predlozakId);
    } else {
      const ostale = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.ciklusId, svjeza.ciklusId!),
        inArray(dodjeleMisija.status, ['aktivna', 'dovrsena', 'zamijenjena']),
        ne(dodjeleMisija.id, svjeza.id),
      ));
      for (const o of ostale) zabranjeni.add(o.predlozakId);
      ostaleDef = ostale
        .filter((o) => o.status === 'aktivna' || o.status === 'dovrsena')
        .map((o) => definicijaMisije(o.predlozakId)!)
        .filter(Boolean);
    }

    const novaDef = odaberiZamjenu(svjeza.vrsta, ostaleDef, sada, satRng.rng, zabranjeni);
    if (!novaDef) {
      // Nema alternative — ostavi zapis; UI ne smije zaglaviti (katalog mora imati dovoljno).
      continue;
    }

    await tx.update(dodjeleMisija).set({ status: 'zamijenjena' }).where(eq(dodjeleMisija.id, svjeza.id));
    const snapshot = snapshotIzDefinicije(novaDef) as SnapshotMisije;
    await tx.insert(dodjeleMisija).values({
      igracId,
      vrsta: svjeza.vrsta,
      slot: svjeza.slot,
      ciklusId: svjeza.ciklusId,
      predlozakId: novaDef.predlozakId,
      verzijaDefinicije: novaDef.verzijaDefinicije,
      snapshot,
      napredak: 0,
      cilj: novaDef.cilj,
      podstanje: {},
      status: 'aktivna',
      dostupnaOd: sada,
      istjeceU: svjeza.istjeceU,
    });
    zamijenjeno += 1;
  }

  if (zamijenjeno > 0) {
    await tx.update(stanjeMisijaIgraca).set({
      verzijaStanja: sql`${stanjeMisijaIgraca.verzijaStanja} + 1`,
    }).where(eq(stanjeMisijaIgraca.igracId, igracId));
  }
  return zamijenjeno;
}
