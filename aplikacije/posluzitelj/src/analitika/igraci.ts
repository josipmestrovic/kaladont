/**
 * Agregati aktivnosti, retencije i konverzije igrača — samo čitanje postojećih podataka.
 * Nema novih upisa tijekom igranja.
 */
import { and, eq, gte, isNotNull, lt, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaIgre, analitikaSudjelovanja, igraci } from '../baza/shema.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';

export function pomakniKalendarskiDan(lokalniDanIso: string, dana: number): string {
  const bazaDatuma = new Date(`${lokalniDanIso}T12:00:00.000Z`);
  bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() + dana);
  return bazaDatuma.toISOString().slice(0, 10);
}

function popisDana(odDan: string, doDanUkljucivo: string): string[] {
  const dani: string[] = [];
  let trenutni = odDan;
  while (trenutni <= doDanUkljucivo) {
    dani.push(trenutni);
    trenutni = pomakniKalendarskiDan(trenutni, 1);
  }
  return dani;
}

function izrazDanaKraja() {
  return sql<string>`to_char((${analitikaIgre.krajU} at time zone ${sql.raw(`'${ANALITIKA_VREMENSKA_ZONA}'`)}), 'YYYY-MM-DD')`;
}

function izrazDanaRegistracije() {
  return sql<string>`to_char((${igraci.registriranAt} at time zone ${sql.raw(`'${ANALITIKA_VREMENSKA_ZONA}'`)}), 'YYYY-MM-DD')`;
}

function uvjetKonteksta(kontekst?: KontekstOtvaranjaAnalitike): SQL | undefined {
  return kontekst ? eq(analitikaIgre.kontekst, kontekst) : undefined;
}

function postotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik === 0) return null;
  return (brojnik / nazivnik) * 100;
}

export interface DanAktivnostiIgraca {
  dan: string;
  dau: number;
  novi: number;
  povratni: number;
  registracije: number;
}

export interface RetencijaKohorte {
  kohortaDan: string;
  noviIgraci: number;
  d1Povratnici: number | null;
  d1Postotak: number | null;
  d7Povratnici: number | null;
  d7Postotak: number | null;
  d30Povratnici: number | null;
  d30Postotak: number | null;
  d1Zrela: boolean;
  d7Zrela: boolean;
  d30Zrela: boolean;
}

export interface AgregatAktivnostiIgraca {
  vremenskaZona: string;
  od: string;
  do: string;
  kontekst: KontekstOtvaranjaAnalitike | null;
  danas: string;
  referentniDan: string;
  referentniDanNezavrsen: boolean;
  mjerenjeOd: string | null;
  kpi: {
    dau: number;
    wau: number;
    mau: number;
    dauMau: number | null;
    registracijeRaspon: number;
      konverzija30d: {
        gosti: number;
        konvertirani: number;
        postotak: number | null;
      };
    konverzijaDosadNezrele: {
      gosti: number;
      konvertirani: number;
      postotak: number | null;
    };
  };
  retencijaUkupno: {
    d1: { povratnici: number; kohorta: number; postotak: number | null };
    d7: { povratnici: number; kohorta: number; postotak: number | null };
    d30: { povratnici: number; kohorta: number; postotak: number | null };
  };
  dani: DanAktivnostiIgraca[];
  retencijaKohorte: RetencijaKohorte[];
  napomena:
    | 'Aktivnost = završene igre (ishod zavrsena) po kraju u Europe/Zagreb. Registracije su globalne (ne filtriraju se kontekstom igre).';
}

export async function agregirajAktivnostIgraca(opcije: {
  odDan: string;
  doDan: string;
  kontekst?: KontekstOtvaranjaAnalitike;
}): Promise<AgregatAktivnostiIgraca> {
  const danas = danasZagrebIso();
  const referentniDan = opcije.doDan;
  const referentniDanNezavrsen = referentniDan >= danas;
  // Za zrelost kohorte: ciljni dan mora biti strogo prije "danas" (završen).
  const zadnjiZavrseniDan = pomakniKalendarskiDan(danas, -1);

  const wauOd = pomakniKalendarskiDan(referentniDan, -6);
  const mauOd = pomakniKalendarskiDan(referentniDan, -29);

  // Za retenciju D30 trebamo aktivnosti do doDan+30; prvi dan ide preko cijele povijesti.
  const aktivnostDo = pomakniKalendarskiDan(opcije.doDan, 30);
  const aktivnostDoUtc = pocetakDanaZagrebUtc(pomakniKalendarskiDan(aktivnostDo, 1));

  const kontekstUvjet = uvjetKonteksta(opcije.kontekst);
  const danKraja = izrazDanaKraja();

  const uvjetZavrsene = and(
    eq(analitikaIgre.ishod, 'zavrsena'),
    isNotNull(analitikaIgre.krajU),
    lt(analitikaIgre.krajU, aktivnostDoUtc),
    kontekstUvjet,
  );

  // Sve završene igre (povijest) za prvi dan — bez donje granice.
  const prviDanRedovi = await baza
    .select({
      igracId: analitikaSudjelovanja.igracId,
      prviDan: sql<string>`min(${danKraja})`,
    })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .where(and(eq(analitikaIgre.ishod, 'zavrsena'), isNotNull(analitikaIgre.krajU), kontekstUvjet))
    .groupBy(analitikaSudjelovanja.igracId);

  const prviDanPoIgracu = new Map(prviDanRedovi.map((r) => [r.igracId, r.prviDan]));

  // Dnevna aktivnost u proširenom rasponu (za WAU/MAU/retenciju)
  const dnevnaAktivnost = await baza
    .select({
      dan: danKraja,
      igracId: analitikaSudjelovanja.igracId,
    })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .where(uvjetZavrsene)
    .groupBy(danKraja, analitikaSudjelovanja.igracId);

  const aktivniPoDanu = new Map<string, Set<string>>();
  for (const red of dnevnaAktivnost) {
    let skup = aktivniPoDanu.get(red.dan);
    if (!skup) {
      skup = new Set();
      aktivniPoDanu.set(red.dan, skup);
    }
    skup.add(red.igracId);
  }

  function distinctURasponu(od: string, doUklj: string): number {
    const s = new Set<string>();
    for (const [dan, igraciSkup] of aktivniPoDanu) {
      if (dan >= od && dan <= doUklj) {
        for (const id of igraciSkup) s.add(id);
      }
    }
    return s.size;
  }

  const dau = aktivniPoDanu.get(referentniDan)?.size ?? 0;
  const wau = distinctURasponu(wauOd, referentniDan);
  const mau = distinctURasponu(mauOd, referentniDan);

  // Registracije — globalne, bez filtera konteksta
  const regOd = pocetakDanaZagrebUtc(opcije.odDan);
  const regDo = pocetakDanaZagrebUtc(pomakniKalendarskiDan(opcije.doDan, 1));
  const danReg = izrazDanaRegistracije();
  const registracijeRedovi = await baza
    .select({
      dan: danReg,
      broj: sql<number>`count(*)::int`,
    })
    .from(igraci)
    .where(
      and(
        eq(igraci.upravljac, 'covjek'),
        isNotNull(igraci.registriranAt),
        gte(igraci.registriranAt, regOd),
        lt(igraci.registriranAt, regDo),
      ),
    )
    .groupBy(danReg);

  const registracijePoDanu = new Map(registracijeRedovi.map((r) => [r.dan, Number(r.broj)]));
  let registracijeRaspon = 0;
  for (const broj of registracijePoDanu.values()) registracijeRaspon += broj;

  const daniRaspona = popisDana(opcije.odDan, opcije.doDan);
  const dani: DanAktivnostiIgraca[] = daniRaspona.map((dan) => {
    const aktivni = aktivniPoDanu.get(dan) ?? new Set();
    let novi = 0;
    let povratni = 0;
    for (const id of aktivni) {
      const prvi = prviDanPoIgracu.get(id);
      if (prvi === dan) novi += 1;
      else if (prvi != null && prvi < dan) povratni += 1;
    }
    return {
      dan,
      dau: aktivni.size,
      novi,
      povratni,
      registracije: registracijePoDanu.get(dan) ?? 0,
    };
  });

  // Retencija: kohorte = novi igrači po prvom danu unutar [od, do]
  function igracAktivanNaDanu(igracId: string, dan: string): boolean {
    return aktivniPoDanu.get(dan)?.has(igracId) ?? false;
  }

  const kohortePoDanu = new Map<string, string[]>();
  for (const [igracId, prvi] of prviDanPoIgracu) {
    if (prvi < opcije.odDan || prvi > opcije.doDan) continue;
    const lista = kohortePoDanu.get(prvi) ?? [];
    lista.push(igracId);
    kohortePoDanu.set(prvi, lista);
  }

  function zrelost(ciljniDan: string): boolean {
    return ciljniDan <= zadnjiZavrseniDan;
  }

  const retencijaKohorte: RetencijaKohorte[] = [];
  const ukupno = {
    d1: { povratnici: 0, kohorta: 0 },
    d7: { povratnici: 0, kohorta: 0 },
    d30: { povratnici: 0, kohorta: 0 },
  };

  for (const dan of daniRaspona) {
    const clanovi = kohortePoDanu.get(dan) ?? [];
    const noviIgraci = clanovi.length;
    const d1Dan = pomakniKalendarskiDan(dan, 1);
    const d7Dan = pomakniKalendarskiDan(dan, 7);
    const d30Dan = pomakniKalendarskiDan(dan, 30);
    const d1Zrela = zrelost(d1Dan);
    const d7Zrela = zrelost(d7Dan);
    const d30Zrela = zrelost(d30Dan);

    let d1Povratnici: number | null = null;
    let d7Povratnici: number | null = null;
    let d30Povratnici: number | null = null;

    if (d1Zrela) {
      d1Povratnici = clanovi.filter((id) => igracAktivanNaDanu(id, d1Dan)).length;
      ukupno.d1.kohorta += noviIgraci;
      ukupno.d1.povratnici += d1Povratnici;
    }
    if (d7Zrela) {
      d7Povratnici = clanovi.filter((id) => igracAktivanNaDanu(id, d7Dan)).length;
      ukupno.d7.kohorta += noviIgraci;
      ukupno.d7.povratnici += d7Povratnici;
    }
    if (d30Zrela) {
      d30Povratnici = clanovi.filter((id) => igracAktivanNaDanu(id, d30Dan)).length;
      ukupno.d30.kohorta += noviIgraci;
      ukupno.d30.povratnici += d30Povratnici;
    }

    retencijaKohorte.push({
      kohortaDan: dan,
      noviIgraci,
      d1Povratnici,
      d1Postotak: d1Povratnici == null ? null : postotak(d1Povratnici, noviIgraci),
      d7Povratnici,
      d7Postotak: d7Povratnici == null ? null : postotak(d7Povratnici, noviIgraci),
      d30Povratnici,
      d30Postotak: d30Povratnici == null ? null : postotak(d30Povratnici, noviIgraci),
      d1Zrela,
      d7Zrela,
      d30Zrela,
    });
  }

  // Konverzija gostiju (30d) — nazivnik: prvi dan s gost sudjelovanjem
  const prviDanGostRedovi = await baza
    .select({
      igracId: analitikaSudjelovanja.igracId,
      prviDan: sql<string>`min(${danKraja})`,
    })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .where(
      and(
        eq(analitikaIgre.ishod, 'zavrsena'),
        isNotNull(analitikaIgre.krajU),
        eq(analitikaSudjelovanja.vrstaRacunaNaPocetku, 'gost'),
        kontekstUvjet,
      ),
    )
    .groupBy(analitikaSudjelovanja.igracId);

  // Samo igrači čiji je UKUPNI prvi dan (bilo koja vrsta) == prvi dan kao gost
  // Spec: na prvom zabilježenom danu igranja sudjelovali kao gosti.
  const gostKohorta = new Map<string, string>(); // igracId -> prviDan
  for (const red of prviDanGostRedovi) {
    const ukupniPrvi = prviDanPoIgracu.get(red.igracId);
    if (ukupniPrvi != null && ukupniPrvi === red.prviDan) {
      gostKohorta.set(red.igracId, red.prviDan);
    }
  }

  const registracijeIgraca = await baza
    .select({
      id: igraci.id,
      registriranAt: igraci.registriranAt,
    })
    .from(igraci)
    .where(and(eq(igraci.upravljac, 'covjek'), isNotNull(igraci.registriranAt)));

  const regPoIgracu = new Map(
    registracijeIgraca
      .filter((r) => r.registriranAt != null)
      .map((r) => [r.id, r.registriranAt as Date]),
  );

  let konverzijaZreliGosti = 0;
  let konverzijaZreliKonvertirani = 0;
  let konverzijaNezreliGosti = 0;
  let konverzijaNezreliKonvertirani = 0;

  for (const [igracId, prviDan] of gostKohorta) {
    if (prviDan < opcije.odDan || prviDan > opcije.doDan) continue;
    // Prozor [prviDan, prviDan+30): 30 kalendarskih dana; zrelost kad je dan prviDan+29 završen.
    const krajProzoraIskljucivo = pomakniKalendarskiDan(prviDan, 30);
    const zadnjiDanProzora = pomakniKalendarskiDan(prviDan, 29);
    const zrela = zrelost(zadnjiDanProzora);
    const regAt = regPoIgracu.get(igracId);
    const prvaIgraUtc = pocetakDanaZagrebUtc(prviDan);
    const krajProzoraUtc = pocetakDanaZagrebUtc(krajProzoraIskljucivo);
    const konvertiran =
      regAt != null && regAt.getTime() >= prvaIgraUtc.getTime() && regAt.getTime() < krajProzoraUtc.getTime();

    if (zrela) {
      konverzijaZreliGosti += 1;
      if (konvertiran) konverzijaZreliKonvertirani += 1;
    } else {
      konverzijaNezreliGosti += 1;
      if (konvertiran) konverzijaNezreliKonvertirani += 1;
    }
  }

  // mjerenjeOd — prvi zabilježeni dan završene igre (bez filtera konteksta)
  const [najstariji] = await baza
    .select({
      dan: sql<string>`min(${danKraja})`,
    })
    .from(analitikaIgre)
    .where(and(eq(analitikaIgre.ishod, 'zavrsena'), isNotNull(analitikaIgre.krajU)));

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    od: opcije.odDan,
    do: opcije.doDan,
    kontekst: opcije.kontekst ?? null,
    danas,
    referentniDan,
    referentniDanNezavrsen,
    mjerenjeOd: najstariji?.dan ?? null,
    kpi: {
      dau,
      wau,
      mau,
      dauMau: postotak(dau, mau),
      registracijeRaspon,
      konverzija30d: {
        gosti: konverzijaZreliGosti,
        konvertirani: konverzijaZreliKonvertirani,
        postotak: postotak(konverzijaZreliKonvertirani, konverzijaZreliGosti),
      },
      konverzijaDosadNezrele: {
        gosti: konverzijaNezreliGosti,
        konvertirani: konverzijaNezreliKonvertirani,
        postotak: postotak(konverzijaNezreliKonvertirani, konverzijaNezreliGosti),
      },
    },
    retencijaUkupno: {
      d1: {
        povratnici: ukupno.d1.povratnici,
        kohorta: ukupno.d1.kohorta,
        postotak: postotak(ukupno.d1.povratnici, ukupno.d1.kohorta),
      },
      d7: {
        povratnici: ukupno.d7.povratnici,
        kohorta: ukupno.d7.kohorta,
        postotak: postotak(ukupno.d7.povratnici, ukupno.d7.kohorta),
      },
      d30: {
        povratnici: ukupno.d30.povratnici,
        kohorta: ukupno.d30.kohorta,
        postotak: postotak(ukupno.d30.povratnici, ukupno.d30.kohorta),
      },
    },
    dani,
    retencijaKohorte,
    napomena:
      'Aktivnost = završene igre (ishod zavrsena) po kraju u Europe/Zagreb. Registracije su globalne (ne filtriraju se kontekstom igre).',
  };
}
