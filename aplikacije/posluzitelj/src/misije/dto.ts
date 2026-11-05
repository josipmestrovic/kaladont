import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import type { MisijaDto, StanjeMisijaDto, VrstaMisije } from 'zajednicko';
import { ZONA_LJESTVICA } from 'zajednicko';
import {
  ciklusiTjednihMisija,
  dodjeleMisija,
  nagradeMisija,
  stanjeMisijaIgraca,
  zamjeneMisija,
} from '../baza/shema.js';
import { dnevneGranice, sljedecaPonocNakon, tjedneGranice, lokalniDatumIso } from './kalendar.js';
import { izracunajNovosti, osigurajStanjeMisija } from './stanje.js';
import type { MisijeSatRng, MisijeTx, PodstanjeMisije, SnapshotMisije } from './tipovi.js';
import { zadaniSatRng } from './tipovi.js';

function mapirajMisiju(
  red: typeof dodjeleMisija.$inferSelect,
  nagrada: typeof nagradeMisija.$inferSelect | null,
  zamjena: { dopustena: boolean; razlog: string | null },
): MisijaDto {
  const snapshot = red.snapshot as SnapshotMisije;
  const podstanje = (red.podstanje ?? {}) as PodstanjeMisije;
  const status = red.status === 'dovrsena' ? 'dovrsena' : 'aktivna';
  return {
    dodjelaId: red.id,
    slot: red.slot as 1 | 2 | 3,
    vrsta: red.vrsta,
    predlozakId: red.predlozakId,
    verzijaDefinicije: red.verzijaDefinicije,
    status,
    naziv: snapshot.naziv,
    opis: snapshot.opis,
    metrika: snapshot.metrika as MisijaDto['metrika'],
    kontekst: snapshot.kontekst,
    mod: snapshot.mod,
    napredak: red.napredak,
    cilj: red.cilj,
    podciljevi: snapshot.podciljevi?.map((p) => ({
      kljuc: p.kljuc,
      naziv: p.naziv,
      napredak: podstanje.podciljevi?.[p.kljuc] ?? 0,
      cilj: p.cilj,
    })),
    xpNagrada: snapshot.xp,
    dostupnaOdIso: red.dostupnaOd.toISOString(),
    istjeceU: red.istjeceU?.toISOString() ?? null,
    zavrsenaU: red.zavrsenaU?.toISOString() ?? null,
    nagrada: nagrada
      ? {
          xpNominalno: nagrada.xpNominalno,
          xpStvarnoDodijeljeno: nagrada.xpStvarno,
          dodijeljenaU: nagrada.dodijeljenaU.toISOString(),
        }
      : null,
    zamjena,
  };
}

async function kvotaZamjene(tx: MisijeTx, igracId: string, vrsta: VrstaMisije, sada: Date) {
  const dan = lokalniDatumIso(sada);
  const [red] = await tx.select({ id: zamjeneMisija.id }).from(zamjeneMisija).where(and(
    eq(zamjeneMisija.igracId, igracId),
    eq(zamjeneMisija.vrsta, vrsta),
    eq(zamjeneMisija.zagrebackiDatum, dan),
  )).limit(1);
  return {
    preostalo: (red ? 0 : 1) as 0 | 1,
    obnovaU: sljedecaPonocNakon(sada).toISOString(),
  };
}

export async function izgradiStanjeMisijaDto(
  tx: MisijeTx,
  igracId: string,
  satRng: MisijeSatRng = zadaniSatRng,
): Promise<StanjeMisijaDto> {
  const sada = satRng.sada();
  await osigurajStanjeMisija(tx, igracId, satRng);
  const [stanje] = await tx.select().from(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, igracId));
  if (!stanje) throw new Error('Stanje misija nedostaje.');

  const tjedan = tjedneGranice(sada);
  const [ciklus] = await tx.select().from(ciklusiTjednihMisija).where(and(
    eq(ciklusiTjednihMisija.igracId, igracId),
    eq(ciklusiTjednihMisija.periodOd, tjedan.od),
  ));

  const aktivneDnevne = await tx.select().from(dodjeleMisija).where(and(
    eq(dodjeleMisija.igracId, igracId),
    eq(dodjeleMisija.vrsta, 'dnevna'),
    eq(dodjeleMisija.status, 'aktivna'),
  )).orderBy(sql`${dodjeleMisija.slot} asc`);

  const danasOd = dnevneGranice(sada).od;
  const danasDovrseneRedovi = await tx.select().from(dodjeleMisija).where(and(
    eq(dodjeleMisija.igracId, igracId),
    eq(dodjeleMisija.vrsta, 'dnevna'),
    eq(dodjeleMisija.status, 'dovrsena'),
    gte(dodjeleMisija.zavrsenaU, danasOd),
  )).orderBy(sql`${dodjeleMisija.zavrsenaU} desc`);

  const tjedneRedovi = ciklus
    ? await tx.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.ciklusId, ciklus.id),
      inArray(dodjeleMisija.status, ['aktivna', 'dovrsena']),
    )).orderBy(sql`${dodjeleMisija.slot} asc`)
    : [];

  const nagradaIds = [...danasDovrseneRedovi, ...tjedneRedovi.filter((t) => t.status === 'dovrsena')].map((r) => r.id);
  const nagrade = nagradaIds.length
    ? await tx.select().from(nagradeMisija).where(inArray(nagradeMisija.dodjelaId, nagradaIds))
    : [];
  const nagradaPoId = new Map(nagrade.map((n) => [n.dodjelaId, n]));

  const kvotaDnevna = await kvotaZamjene(tx, igracId, 'dnevna', sada);
  const kvotaTjedna = await kvotaZamjene(tx, igracId, 'tjedna', sada);

  const zamjenaZa = (vrsta: VrstaMisije, status: string): MisijaDto['zamjena'] => {
    if (status !== 'aktivna') return { dopustena: false, razlog: 'Misija nije aktivna.' };
    const kvota = vrsta === 'dnevna' ? kvotaDnevna : kvotaTjedna;
    if (kvota.preostalo === 0) return { dopustena: false, razlog: 'Današnja zamjena je iskorištena.' };
    return { dopustena: true, razlog: null };
  };

  const novosti = izracunajNovosti({
    zadnjiPregledDnevnihU: stanje.zadnjiPregledDnevnihU,
    zadnjiPregledTjednihU: stanje.zadnjiPregledTjednihU,
    aktivneDnevneDostupneOd: aktivneDnevne.map((d) => d.dostupnaOd),
    tjedniPaketStvorenU: ciklus?.stvorenoU ?? null,
  });

  return {
    ok: true,
    stanjeVerzija: stanje.verzijaStanja,
    serverVrijemeIso: sada.toISOString(),
    vremenskaZona: ZONA_LJESTVICA,
    obracunUTijeku: false,
    novosti,
    dnevne: {
      kapacitet: 3,
      aktivne: aktivneDnevne.map((r) => mapirajMisiju(r, null, zamjenaZa('dnevna', r.status))),
      danasDovrsene: danasDovrseneRedovi.map((r) => mapirajMisiju(r, nagradaPoId.get(r.id) ?? null, { dopustena: false, razlog: 'Misija je završena.' })),
      sljedeciDotokU: sljedecaPonocNakon(sada).toISOString(),
    },
    tjedne: {
      pocetakIso: tjedan.od.toISOString(),
      krajIso: tjedan.do.toISOString(),
      misije: tjedneRedovi.map((r) => mapirajMisiju(
        r,
        r.status === 'dovrsena' ? (nagradaPoId.get(r.id) ?? null) : null,
        zamjenaZa('tjedna', r.status),
      )),
    },
    zamjene: {
      dnevna: kvotaDnevna,
      tjedna: kvotaTjedna,
    },
  };
}

export async function oznaciPregledMisija(
  tx: MisijeTx,
  igracId: string,
  skupina: 'dnevna' | 'tjedna',
  satRng: MisijeSatRng = zadaniSatRng,
): Promise<StanjeMisijaDto> {
  const sada = satRng.sada();
  await osigurajStanjeMisija(tx, igracId, satRng);
  await tx.update(stanjeMisijaIgraca).set(
    skupina === 'dnevna'
      ? { zadnjiPregledDnevnihU: sada }
      : { zadnjiPregledTjednihU: sada },
  ).where(eq(stanjeMisijaIgraca.igracId, igracId));
  return izgradiStanjeMisijaDto(tx, igracId, satRng);
}
