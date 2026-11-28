/**
 * Agregati partija po načinu igranja, formatu, pravilima, trajanju i ishodima.
 * Kohorta = igre započete u odabranom rasponu (Europe/Zagreb); ishodi su trenutačno poznati.
 * Samo čitanje — bez novih upisa tijekom igranja.
 */
import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaIgre, analitikaSudjelovanja, partije } from '../baza/shema.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';

export const KONTEKSTI_PARTIJA = ['javna', 'privatna', 'trening', 'izazov'] as const;
export const MODOVI_PARTIJA = ['dva_igraca', 'tri_igraca', 'cetiri_igraca'] as const;
export const PRAVILA_PARTIJA = ['klasicni', 'ka_zna', 'dokazi_nastavak'] as const;
export type KantaPravilaPartije = (typeof PRAVILA_PARTIJA)[number] | 'nepoznato';

function postotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik === 0) return null;
  return (brojnik / nazivnik) * 100;
}

function sortirajTrajanja(sekunde: number[]): number[] {
  return [...sekunde].sort((a, b) => a - b);
}

/** Prosjek u sekundama; prazan uzorak → null. */
export function prosjekTrajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const zbroj = sekunde.reduce((s, v) => s + v, 0);
  return zbroj / sekunde.length;
}

/** Medijan u sekundama; prazan uzorak → null. */
export function medijanTrajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const s = sortirajTrajanja(sekunde);
  const sredina = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[sredina - 1]! + s[sredina]!) / 2;
  return s[sredina]!;
}

/** P90 (nearest-rank) u sekundama; prazan uzorak → null. */
export function p90Trajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const s = sortirajTrajanja(sekunde);
  const indeks = Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1);
  return s[Math.max(0, indeks)]!;
}

function statistikaTrajanja(sekunde: number[]) {
  return {
    prosjekSekundi: prosjekTrajanja(sekunde),
    medijanSekundi: medijanTrajanja(sekunde),
    p90Sekundi: p90Trajanja(sekunde),
    uzorak: sekunde.length,
  };
}

function stopaZavrsavanja(zavrsene: number, prekinute: number, nepotpuno: number): number | null {
  const terminalni = zavrsene + prekinute + nepotpuno;
  return postotak(zavrsene, terminalni);
}

interface BrojacIshoda {
  zapocete: number;
  zavrsene: number;
  prekinute: number;
  nepotpuno: number;
  bezIshoda: number;
  trajanjaSekundi: number[];
  igraci: Set<string>;
}

function prazanBrojac(): BrojacIshoda {
  return {
    zapocete: 0,
    zavrsene: 0,
    prekinute: 0,
    nepotpuno: 0,
    bezIshoda: 0,
    trajanjaSekundi: [],
    igraci: new Set(),
  };
}

function zapisiIshod(b: BrojacIshoda, ishod: string | null, trajanjeSekundi: number | null) {
  b.zapocete += 1;
  if (ishod === 'zavrsena') {
    b.zavrsene += 1;
    if (trajanjeSekundi != null && Number.isFinite(trajanjeSekundi) && trajanjeSekundi >= 0) {
      b.trajanjaSekundi.push(trajanjeSekundi);
    }
  } else if (ishod === 'prekinuta') b.prekinute += 1;
  else if (ishod === 'nepotpuno') b.nepotpuno += 1;
  else b.bezIshoda += 1;
}

function sazetakBrojaca(b: BrojacIshoda, ukupnoZapocete: number) {
  const terminalni = b.zavrsene + b.prekinute + b.nepotpuno;
  const trajanje = statistikaTrajanja(b.trajanjaSekundi);
  return {
    zapocete: b.zapocete,
    zavrsene: b.zavrsene,
    prekinute: b.prekinute,
    nepotpuno: b.nepotpuno,
    bezIshoda: b.bezIshoda,
    jedinstveniIgraci: b.igraci.size,
    udioZapocetih: postotak(b.zapocete, ukupnoZapocete),
    stopaZavrsavanja: stopaZavrsavanja(b.zavrsene, b.prekinute, b.nepotpuno),
    pokrivenostTerminalnih: postotak(terminalni, b.zapocete),
    trajanje,
  };
}

export interface AgregatPartija {
  vremenskaZona: string;
  od: string;
  do: string;
  kontekst: KontekstOtvaranjaAnalitike | null;
  danas: string;
  napomena: string;
  sazetak: {
    zapocete: number;
    zavrsene: number;
    prekinute: number;
    nepotpuno: number;
    bezIshoda: number;
    jedinstveniIgraci: number;
    stopaZavrsavanja: number | null;
    pokrivenostTerminalnih: number | null;
    trajanje: ReturnType<typeof statistikaTrajanja>;
    pokrivenostPravila: number | null;
  };
  nacini: Array<{
    kontekst: KontekstOtvaranjaAnalitike;
    zapocete: number;
    zavrsene: number;
    prekinute: number;
    nepotpuno: number;
    bezIshoda: number;
    jedinstveniIgraci: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    pokrivenostTerminalnih: number | null;
    trajanje: ReturnType<typeof statistikaTrajanja>;
  }>;
  formati: Array<{
    kontekst: KontekstOtvaranjaAnalitike | null;
    mod: (typeof MODOVI_PARTIJA)[number];
    zapocete: number;
    zavrsene: number;
    prekinute: number;
    nepotpuno: number;
    bezIshoda: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    trajanje: ReturnType<typeof statistikaTrajanja>;
  }>;
  pravila: Array<{
    pravila: KantaPravilaPartije;
    zapocete: number;
    zavrsene: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    trajanje: ReturnType<typeof statistikaTrajanja>;
  }>;
}

export async function agregirajPartije(opcije: {
  odDan: string;
  doDan: string;
  kontekst?: KontekstOtvaranjaAnalitike;
}): Promise<AgregatPartija> {
  const od = pocetakDanaZagrebUtc(opcije.odDan);
  const doGranica = pocetakDanaZagrebUtc(
    (() => {
      const bazaDatuma = new Date(`${opcije.doDan}T12:00:00.000Z`);
      bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() + 1);
      return bazaDatuma.toISOString().slice(0, 10);
    })(),
  );

  const uvjetKonteksta: SQL | undefined = opcije.kontekst
    ? eq(analitikaIgre.kontekst, opcije.kontekst)
    : undefined;
  const uvjetKohorte = and(
    gte(analitikaIgre.pocetakU, od),
    lt(analitikaIgre.pocetakU, doGranica),
    uvjetKonteksta,
  );

  const poznataPravila = sql<string | null>`coalesce(${analitikaIgre.pravila}::text, ${partije.pravila}::text)`;

  const igre = await baza
    .select({
      igraId: analitikaIgre.igraId,
      kontekst: analitikaIgre.kontekst,
      mod: analitikaIgre.mod,
      pravila: poznataPravila,
      pocetakU: analitikaIgre.pocetakU,
      krajU: analitikaIgre.krajU,
      ishod: analitikaIgre.ishod,
    })
    .from(analitikaIgre)
    .leftJoin(partije, eq(analitikaIgre.igraId, partije.id))
    .where(uvjetKohorte);

  const sudjelovanja = await baza
    .select({
      igraId: analitikaSudjelovanja.igraId,
      igracId: analitikaSudjelovanja.igracId,
    })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .where(and(uvjetKohorte, eq(analitikaIgre.ishod, 'zavrsena')));

  const igraciPoIgri = new Map<string, string[]>();
  for (const red of sudjelovanja) {
    const lista = igraciPoIgri.get(red.igraId) ?? [];
    lista.push(red.igracId);
    igraciPoIgri.set(red.igraId, lista);
  }

  const ukupno = prazanBrojac();
  const poKontekstu = new Map<KontekstOtvaranjaAnalitike, BrojacIshoda>();
  for (const k of KONTEKSTI_PARTIJA) poKontekstu.set(k, prazanBrojac());

  const poFormatu = new Map<string, BrojacIshoda>();
  const poPravilima = new Map<KantaPravilaPartije, BrojacIshoda>();
  for (const p of [...PRAVILA_PARTIJA, 'nepoznato'] as KantaPravilaPartije[]) {
    poPravilima.set(p, prazanBrojac());
  }

  let igreSPoznatimPravilima = 0;

  for (const igra of igre) {
    const trajanjeSekundi =
      igra.krajU != null && igra.pocetakU != null
        ? (igra.krajU.getTime() - igra.pocetakU.getTime()) / 1000
        : null;

    zapisiIshod(ukupno, igra.ishod, trajanjeSekundi);

    const kontekstBrojac = poKontekstu.get(igra.kontekst) ?? prazanBrojac();
    zapisiIshod(kontekstBrojac, igra.ishod, trajanjeSekundi);
    poKontekstu.set(igra.kontekst, kontekstBrojac);

    const formatKljuc = `${igra.kontekst}::${igra.mod}`;
    const formatBrojac = poFormatu.get(formatKljuc) ?? prazanBrojac();
    zapisiIshod(formatBrojac, igra.ishod, trajanjeSekundi);
    poFormatu.set(formatKljuc, formatBrojac);

    const kantaPravila: KantaPravilaPartije =
      igra.pravila === 'klasicni' || igra.pravila === 'ka_zna' || igra.pravila === 'dokazi_nastavak'
        ? igra.pravila
        : 'nepoznato';
    if (kantaPravila !== 'nepoznato') igreSPoznatimPravilima += 1;
    const pravilaBrojac = poPravilima.get(kantaPravila) ?? prazanBrojac();
    zapisiIshod(pravilaBrojac, igra.ishod, trajanjeSekundi);
    poPravilima.set(kantaPravila, pravilaBrojac);

    if (igra.ishod === 'zavrsena') {
      for (const igracId of igraciPoIgri.get(igra.igraId) ?? []) {
        ukupno.igraci.add(igracId);
        kontekstBrojac.igraci.add(igracId);
      }
    }
  }

  const ukupnoZapocete = ukupno.zapocete;
  const terminalniUkupno = ukupno.zavrsene + ukupno.prekinute + ukupno.nepotpuno;

  const nacini = KONTEKSTI_PARTIJA.filter((k) => !opcije.kontekst || k === opcije.kontekst).map((k) => {
    const b = poKontekstu.get(k)!;
    return { kontekst: k, ...sazetakBrojaca(b, ukupnoZapocete) };
  });

  const formati: AgregatPartija['formati'] = [];
  for (const k of KONTEKSTI_PARTIJA) {
    if (opcije.kontekst && k !== opcije.kontekst) continue;
    for (const mod of MODOVI_PARTIJA) {
      const b = poFormatu.get(`${k}::${mod}`) ?? prazanBrojac();
      if (b.zapocete === 0) continue;
      const s = sazetakBrojaca(b, ukupnoZapocete);
      formati.push({
        kontekst: k,
        mod,
        zapocete: s.zapocete,
        zavrsene: s.zavrsene,
        prekinute: s.prekinute,
        nepotpuno: s.nepotpuno,
        bezIshoda: s.bezIshoda,
        udioZapocetih: s.udioZapocetih,
        stopaZavrsavanja: s.stopaZavrsavanja,
        trajanje: s.trajanje,
      });
    }
  }

  const pravila = ([...PRAVILA_PARTIJA, 'nepoznato'] as KantaPravilaPartije[]).map((p) => {
    const b = poPravilima.get(p)!;
    const s = sazetakBrojaca(b, ukupnoZapocete);
    return {
      pravila: p,
      zapocete: s.zapocete,
      zavrsene: s.zavrsene,
      udioZapocetih: s.udioZapocetih,
      stopaZavrsavanja: s.stopaZavrsavanja,
      trajanje: s.trajanje,
    };
  });

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    od: opcije.odDan,
    do: opcije.doDan,
    kontekst: opcije.kontekst ?? null,
    danas: danasZagrebIso(),
    napomena:
      'Kohorta po početku igre (Europe/Zagreb). Ishodi su trenutačno poznati (uključuju završetak nakon ponoći). Trajanje samo za završene igre. Unique igrači nisu zbroj po kontekstima. Privatne sobe trenutačno bilježe mod cetiri_igraca.',
    sazetak: {
      zapocete: ukupno.zapocete,
      zavrsene: ukupno.zavrsene,
      prekinute: ukupno.prekinute,
      nepotpuno: ukupno.nepotpuno,
      bezIshoda: ukupno.bezIshoda,
      jedinstveniIgraci: ukupno.igraci.size,
      stopaZavrsavanja: stopaZavrsavanja(ukupno.zavrsene, ukupno.prekinute, ukupno.nepotpuno),
      pokrivenostTerminalnih: postotak(terminalniUkupno, ukupno.zapocete),
      trajanje: statistikaTrajanja(ukupno.trajanjaSekundi),
      pokrivenostPravila: postotak(igreSPoznatimPravilima, ukupno.zapocete),
    },
    nacini,
    formati,
    pravila,
  };
}
