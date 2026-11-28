/**
 * Trajni zapisi početka/kraja igara i ljudskih sudjelovanja za dnevne KPI-jeve.
 */
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import {
  analitikaIgre,
  analitikaSudjelovanja,
  type BrojaciEliminacijaAnalitike,
} from '../baza/shema.js';
import type { ProfilAnalitikeBotova } from '../bot/profili-bota.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';
import { uRedAnalitike } from './red-upisa.js';

export type IshodAnalitikeIgre = 'zavrsena' | 'prekinuta' | 'nepotpuno';
export type VrstaRacunaAnalitike = 'gost' | 'registriran';
export type VrstaPobjednikaAnalitike = 'covjek' | 'bot';
export type { BrojaciEliminacijaAnalitike };

export interface SudionikAnalitike {
  igracId: string;
  vrstaRacunaNaPocetku: VrstaRacunaAnalitike;
}

export interface SnimkaBotovaPocetka {
  brojLjudi: number;
  brojBotova: number;
  profilBotova: ProfilAnalitikeBotova | null;
  verzijaBotPolitike: number | null;
  verzijaProfilaBota: number | null;
}

export interface ZapisPocetkaIgre {
  igraId: string;
  kontekst: KontekstOtvaranjaAnalitike;
  mod: import('zajednicko').ModPartije;
  pravila?: import('zajednicko').PravilnikPartije | null;
  pocetakU: Date;
  sudionici: readonly SudionikAnalitike[];
  botovi?: SnimkaBotovaPocetka | null;
}

export function mapirajVrstuRacuna(vrsta: 'gost' | 'registriran' | 'admin'): VrstaRacunaAnalitike {
  return vrsta === 'gost' ? 'gost' : 'registriran';
}

export function prazniBrojaciEliminacija(): BrojaciEliminacijaAnalitike {
  return {
    ne_znam: 0,
    istek: 0,
    mrtva_slova: 0,
    prekid: 0,
    kaladont: 0,
    nepoznato: 0,
  };
}

export async function upsertPocetakIgre(zapis: ZapisPocetkaIgre): Promise<void> {
  const pravila = zapis.pravila ?? null;
  const botovi = zapis.botovi ?? null;
  await baza.transaction(async (tx) => {
    await tx
      .insert(analitikaIgre)
      .values({
        igraId: zapis.igraId,
        kontekst: zapis.kontekst,
        mod: zapis.mod,
        pravila,
        pocetakU: zapis.pocetakU,
        krajU: null,
        ishod: null,
        brojLjudi: botovi?.brojLjudi ?? null,
        brojBotova: botovi?.brojBotova ?? null,
        profilBotova: botovi?.profilBotova ?? null,
        verzijaBotPolitike: botovi?.verzijaBotPolitike ?? null,
        verzijaProfilaBota: botovi?.verzijaProfilaBota ?? null,
      })
      .onConflictDoUpdate({
        target: analitikaIgre.igraId,
        set: {
          kontekst: zapis.kontekst,
          mod: zapis.mod,
          pocetakU: zapis.pocetakU,
          // Ne pregazi poznati pravilnik / bot snimku s nullom.
          ...(pravila != null ? { pravila } : {}),
          ...(botovi != null
            ? {
              brojLjudi: botovi.brojLjudi,
              brojBotova: botovi.brojBotova,
              profilBotova: botovi.profilBotova,
              verzijaBotPolitike: botovi.verzijaBotPolitike,
              verzijaProfilaBota: botovi.verzijaProfilaBota,
            }
            : {}),
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
  mod: import('zajednicko').ModPartije;
  pravila?: import('zajednicko').PravilnikPartije | null;
  pocetakU: Date;
  /** Start snimka — popunjava se ako kraj stigne prije početka. */
  botovi?: SnimkaBotovaPocetka | null;
  vrstaPobjednika?: VrstaPobjednikaAnalitike | null;
  eliminacijeLjudi?: BrojaciEliminacijaAnalitike | null;
  eliminacijeBotova?: BrojaciEliminacijaAnalitike | null;
}

/** Atomarni upsert: nema select+insert utrke, bez hardkodiranog 1v1 konteksta. */
export async function upsertKrajIgre(
  igraId: string,
  krajU: Date,
  ishod: IshodAnalitikeIgre,
  meta: MetaKrajaIgre,
): Promise<void> {
  const pravila = meta.pravila ?? null;
  const botovi = meta.botovi ?? null;
  const vrstaPobjednika = meta.vrstaPobjednika ?? null;
  const eliminacijeLjudi = meta.eliminacijeLjudi ?? null;
  const eliminacijeBotova = meta.eliminacijeBotova ?? null;
  await baza
    .insert(analitikaIgre)
    .values({
      igraId,
      kontekst: meta.kontekst,
      mod: meta.mod,
      pravila,
      pocetakU: meta.pocetakU,
      krajU,
      ishod,
      brojLjudi: botovi?.brojLjudi ?? null,
      brojBotova: botovi?.brojBotova ?? null,
      profilBotova: botovi?.profilBotova ?? null,
      verzijaBotPolitike: botovi?.verzijaBotPolitike ?? null,
      verzijaProfilaBota: botovi?.verzijaProfilaBota ?? null,
      vrstaPobjednika,
      eliminacijeLjudi,
      eliminacijeBotova,
    })
    .onConflictDoUpdate({
      target: analitikaIgre.igraId,
      set: {
        krajU,
        ishod,
        ...(pravila != null ? { pravila } : {}),
        ...(botovi != null
          ? {
            brojLjudi: botovi.brojLjudi,
            brojBotova: botovi.brojBotova,
            profilBotova: botovi.profilBotova,
            verzijaBotPolitike: botovi.verzijaBotPolitike,
            verzijaProfilaBota: botovi.verzijaProfilaBota,
          }
          : {}),
        vrstaPobjednika,
        eliminacijeLjudi,
        eliminacijeBotova,
      },
      // Ne degradiraj završenu igru u prekinutu / nepotpuno; krajU se i dalje osvježava samo kad smijemo dirati ishod.
      setWhere: sql`${analitikaIgre.ishod} is distinct from 'zavrsena'`,
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

/** Pragovi broja igara po igraču za KPI ponavljanja (2+, 3+, …). */
const PRAGOVI_PONAVLJANJA = [2, 3, 4, 5, 10, 20] as const;

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
  // a jedinstvene igrače i pragove ponavljanja po igrac_id.
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
  const brojeviPoPragu = Object.fromEntries(PRAGOVI_PONAVLJANJA.map((prag) => [prag, 0])) as Record<
    (typeof PRAGOVI_PONAVLJANJA)[number],
    number
  >;
  for (const podatak of poIgracu.values()) {
    igraciUkupno += 1;
    for (const prag of PRAGOVI_PONAVLJANJA) {
      if (podatak.brojIgara >= prag) brojeviPoPragu[prag] += 1;
    }
    sudjelovanjaGost += podatak.gost;
    sudjelovanjaRegistriran += podatak.registriran;
  }
  const sudjelovanjaUkupno = sudjelovanjaGost + sudjelovanjaRegistriran;
  const ponavljanja = PRAGOVI_PONAVLJANJA.map((prag) => ({
    prag,
    broj: brojeviPoPragu[prag],
    postotak: igraciUkupno === 0 ? null : (brojeviPoPragu[prag] / igraciUkupno) * 100,
  }));

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    dani,
    ljudi: {
      igraci: igraciUkupno,
      ponavljanja,
      sudjelovanjaGost,
      sudjelovanjaRegistriran,
      postotakGost: sudjelovanjaUkupno === 0 ? null : (sudjelovanjaGost / sudjelovanjaUkupno) * 100,
      postotakRegistriran: sudjelovanjaUkupno === 0 ? null : (sudjelovanjaRegistriran / sudjelovanjaUkupno) * 100,
    },
    danas: danasZagrebIso(),
  };
}
