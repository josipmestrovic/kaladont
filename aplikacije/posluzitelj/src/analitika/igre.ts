/**
 * Trajni zapisi početka/kraja igara i ljudskih sudjelovanja za dnevne KPI-jeve.
 */
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaIgre, analitikaSudjelovanja } from '../baza/shema.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';
import { uRedAnalitike } from './red-upisa.js';

export type IshodAnalitikeIgre = 'zavrsena' | 'prekinuta' | 'nepotpuno';
export type VrstaRacunaAnalitike = 'gost' | 'registriran';

export interface SudionikAnalitike {
  igracId: string;
  vrstaRacunaNaPocetku: VrstaRacunaAnalitike;
}

export interface ZapisPocetkaIgre {
  igraId: string;
  kontekst: KontekstOtvaranjaAnalitike;
  mod: 'cetiri_igraca' | 'dva_igraca';
  pocetakU: Date;
  sudionici: readonly SudionikAnalitike[];
}

export function mapirajVrstuRacuna(vrsta: 'gost' | 'registriran' | 'admin'): VrstaRacunaAnalitike {
  return vrsta === 'gost' ? 'gost' : 'registriran';
}

export async function upsertPocetakIgre(zapis: ZapisPocetkaIgre): Promise<void> {
  await baza.transaction(async (tx) => {
    await tx
      .insert(analitikaIgre)
      .values({
        igraId: zapis.igraId,
        kontekst: zapis.kontekst,
        mod: zapis.mod,
        pocetakU: zapis.pocetakU,
        krajU: null,
        ishod: null,
      })
      .onConflictDoUpdate({
        target: analitikaIgre.igraId,
        set: {
          kontekst: zapis.kontekst,
          mod: zapis.mod,
          pocetakU: zapis.pocetakU,
        },
      });

    if (zapis.sudionici.length === 0) return;
    await tx
      .insert(analitikaSudjelovanja)
      .values(
        zapis.sudionici.map((s) => ({
          igraId: zapis.igraId,
          igracId: s.igracId,
          vrstaRacunaNaPocetku: s.vrstaRacunaNaPocetku,
        })),
      )
      .onConflictDoNothing();
  });
}

export interface MetaKrajaIgre {
  kontekst: KontekstOtvaranjaAnalitike;
  mod: 'cetiri_igraca' | 'dva_igraca';
  pocetakU: Date;
}

/** Atomarni upsert: nema select+insert utrke, bez hardkodiranog 1v1 konteksta. */
export async function upsertKrajIgre(
  igraId: string,
  krajU: Date,
  ishod: IshodAnalitikeIgre,
  meta: MetaKrajaIgre,
): Promise<void> {
  await baza
    .insert(analitikaIgre)
    .values({
      igraId,
      kontekst: meta.kontekst,
      mod: meta.mod,
      pocetakU: meta.pocetakU,
      krajU,
      ishod,
    })
    .onConflictDoUpdate({
      target: analitikaIgre.igraId,
      set: {
        krajU,
        // Ne degradiraj završenu igru u prekinutu / nepotpuno.
        ishod: sql`case when ${analitikaIgre.ishod} = 'zavrsena' then ${analitikaIgre.ishod} else ${ishod} end`,
      },
    });
}

export function zabiljeziPocetakIgre(zapis: ZapisPocetkaIgre): void {
  uRedAnalitike(() => upsertPocetakIgre(zapis), 'pocetak');
}

export function zabiljeziKrajIgre(
  igraId: string,
  krajU: Date,
  ishod: IshodAnalitikeIgre,
  meta: MetaKrajaIgre,
): void {
  uRedAnalitike(() => upsertKrajIgre(igraId, krajU, ishod, meta), 'kraj');
}

function uvjetiKonteksta(kontekst?: KontekstOtvaranjaAnalitike): SQL | undefined {
  return kontekst ? eq(analitikaIgre.kontekst, kontekst) : undefined;
}

function popisDana(odDan: string, doDanUkljucivo: string): string[] {
  const dani: string[] = [];
  const trenutni = new Date(`${odDan}T12:00:00.000Z`);
  const kraj = new Date(`${doDanUkljucivo}T12:00:00.000Z`);
  while (trenutni.getTime() <= kraj.getTime()) {
    dani.push(trenutni.toISOString().slice(0, 10));
    trenutni.setUTCDate(trenutni.getUTCDate() + 1);
  }
  return dani;
}

export async function agregirajDnevneIgre(opcije: {
  odDan: string;
  doDan: string;
  kontekst?: KontekstOtvaranjaAnalitike;
}) {
  const od = pocetakDanaZagrebUtc(opcije.odDan);
  const doGranica = pocetakDanaZagrebUtc(
    (() => {
      const bazaDatuma = new Date(`${opcije.doDan}T12:00:00.000Z`);
      bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() + 1);
      return bazaDatuma.toISOString().slice(0, 10);
    })(),
  );

  const uvjetKonteksta = uvjetiKonteksta(opcije.kontekst);
  const uvjetPocetka = and(gte(analitikaIgre.pocetakU, od), lt(analitikaIgre.pocetakU, doGranica), uvjetKonteksta);
  const uvjetKraja = and(
    eq(analitikaIgre.ishod, 'zavrsena'),
    gte(analitikaIgre.krajU, od),
    lt(analitikaIgre.krajU, doGranica),
    uvjetKonteksta,
  );

  const izrazDanaPocetka = sql<string>`to_char((${analitikaIgre.pocetakU} at time zone ${sql.raw(`'${ANALITIKA_VREMENSKA_ZONA}'`)}), 'YYYY-MM-DD')`;
  const izrazDanaKraja = sql<string>`to_char((${analitikaIgre.krajU} at time zone ${sql.raw(`'${ANALITIKA_VREMENSKA_ZONA}'`)}), 'YYYY-MM-DD')`;

  const zapocete = await baza
    .select({
      dan: izrazDanaPocetka,
      broj: sql<number>`count(*)::int`,
    })
    .from(analitikaIgre)
    .where(uvjetPocetka)
    .groupBy(izrazDanaPocetka);

  const zavrsene = await baza
    .select({
      dan: izrazDanaKraja,
      broj: sql<number>`count(*)::int`,
    })
    .from(analitikaIgre)
    .where(uvjetKraja)
    .groupBy(izrazDanaKraja);

  const mapZapocete = new Map(zapocete.map((r) => [r.dan, r.broj]));
  const mapZavrsene = new Map(zavrsene.map((r) => [r.dan, r.broj]));
  const dani = popisDana(opcije.odDan, opcije.doDan).map((dan) => ({
    dan,
    zapocete: mapZapocete.get(dan) ?? 0,
    zavrsene: mapZavrsene.get(dan) ?? 0,
  }));

  const sudjelovanja = await baza
    .select({
      igracId: analitikaSudjelovanja.igracId,
      vrsta: analitikaSudjelovanja.vrstaRacunaNaPocetku,
      brojIgara: sql<number>`count(*)::int`,
    })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .where(uvjetKraja)
    .groupBy(analitikaSudjelovanja.igracId, analitikaSudjelovanja.vrstaRacunaNaPocetku);

  // Isti igrač može imati više vrsta ako se registrirao između igara — brojimo sudjelovanja po vrsti,
  // a jedinstvene igrače i 2+ po igrac_id.
  const poIgracu = new Map<string, { brojIgara: number; gost: number; registriran: number }>();
  for (const red of sudjelovanja) {
    const postojeci = poIgracu.get(red.igracId) ?? { brojIgara: 0, gost: 0, registriran: 0 };
    postojeci.brojIgara += red.brojIgara;
    if (red.vrsta === 'gost') postojeci.gost += red.brojIgara;
    else postojeci.registriran += red.brojIgara;
    poIgracu.set(red.igracId, postojeci);
  }

  let sudjelovanjaGost = 0;
  let sudjelovanjaRegistriran = 0;
  let igraciUkupno = 0;
  let igraciS2Plus = 0;
  for (const podatak of poIgracu.values()) {
    igraciUkupno += 1;
    if (podatak.brojIgara >= 2) igraciS2Plus += 1;
    sudjelovanjaGost += podatak.gost;
    sudjelovanjaRegistriran += podatak.registriran;
  }
  const sudjelovanjaUkupno = sudjelovanjaGost + sudjelovanjaRegistriran;

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    dani,
    ljudi: {
      igraci: igraciUkupno,
      igraciS2Plus,
      postotakS2Plus: igraciUkupno === 0 ? null : (igraciS2Plus / igraciUkupno) * 100,
      sudjelovanjaGost,
      sudjelovanjaRegistriran,
      postotakGost: sudjelovanjaUkupno === 0 ? null : (sudjelovanjaGost / sudjelovanjaUkupno) * 100,
      postotakRegistriran: sudjelovanjaUkupno === 0 ? null : (sudjelovanjaRegistriran / sudjelovanjaUkupno) * 100,
    },
    danas: danasZagrebIso(),
  };
}
