/**
 * Trajni zapisi prozora prva tri odgovora nakon sustavske početne riječi.
 * Upisi su asinkroni i ne smiju blokirati hot-path igre.
 */
import { and, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaOtvaranja } from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';
import { uRedAnalitike } from './red-upisa.js';

export const ANALITIKA_VREMENSKA_ZONA = 'Europe/Zagreb';

export type IzvorOtvaranjaAnalitike = 'sigurni_skup' | 'rezervni_odabir' | 'nema_kandidata';
export type StatusOtvaranjaAnalitike =
  | 'otvoren'
  | 'dva_odgovora_ok'
  | 'tri_odgovora_ok'
  | 'rani_incident'
  | 'zatvoren_drugim'
  | 'nepotpuno';
export type KontekstOtvaranjaAnalitike = 'javna' | 'privatna' | 'trening';
export type UpravljacOtvaranjaAnalitike = 'covjek' | 'bot';

export interface ZapisOtvaranjaAnalitike {
  igraId: string;
  redniBrojOtvaranja: number;
  kontekst: KontekstOtvaranjaAnalitike;
  mod: 'cetiri_igraca' | 'dva_igraca';
  brojSudionika: number;
  sustavskaRijec: string | null;
  izvor: IzvorOtvaranjaAnalitike;
  brojOdgovora?: number;
  odgovor1?: string | null;
  odgovor2?: string | null;
  odgovor3?: string | null;
  status?: StatusOtvaranjaAnalitike;
  incidentPozicija?: 1 | 2 | 3 | null;
  incidentRijecUzrok?: string | null;
  incidentRazlog?: string | null;
  incidentAutorUpravljac?: UpravljacOtvaranjaAnalitike | null;
  incidentZrtvaUpravljac?: UpravljacOtvaranjaAnalitike | null;
  dodijeljenoU: Date;
  zatvorenoU?: Date | null;
}

function verzijaAplikacije(): string | null {
  return konfiguracija.VERZIJA || null;
}

/** Idempotentni upsert po (igra_id, redni_broj_otvaranja). */
export async function upsertOtvaranjaAnalitike(zapis: ZapisOtvaranjaAnalitike): Promise<void> {
  const vrijednosti = {
    igraId: zapis.igraId,
    redniBrojOtvaranja: zapis.redniBrojOtvaranja,
    kontekst: zapis.kontekst,
    mod: zapis.mod,
    brojSudionika: zapis.brojSudionika,
    sustavskaRijec: zapis.sustavskaRijec,
    izvor: zapis.izvor,
    brojOdgovora: zapis.brojOdgovora ?? 0,
    odgovor1: zapis.odgovor1 ?? null,
    odgovor2: zapis.odgovor2 ?? null,
    odgovor3: zapis.odgovor3 ?? null,
    status: zapis.status ?? 'otvoren',
    incidentPozicija: zapis.incidentPozicija ?? null,
    incidentRijecUzrok: zapis.incidentRijecUzrok ?? null,
    incidentRazlog: zapis.incidentRazlog ?? null,
    incidentAutorUpravljac: zapis.incidentAutorUpravljac ?? null,
    incidentZrtvaUpravljac: zapis.incidentZrtvaUpravljac ?? null,
    dodijeljenoU: zapis.dodijeljenoU,
    zatvorenoU: zapis.zatvorenoU ?? null,
    verzijaAplikacije: verzijaAplikacije(),
  };

  // Kasniji fire-and-forget upis (npr. rani_incident) ne smije biti pregazen sporijim/starijim stanjem.
  await baza
    .insert(analitikaOtvaranja)
    .values(vrijednosti)
    .onConflictDoUpdate({
      target: [analitikaOtvaranja.igraId, analitikaOtvaranja.redniBrojOtvaranja],
      set: {
        kontekst: vrijednosti.kontekst,
        mod: vrijednosti.mod,
        brojSudionika: vrijednosti.brojSudionika,
        sustavskaRijec: vrijednosti.sustavskaRijec,
        izvor: vrijednosti.izvor,
        brojOdgovora: vrijednosti.brojOdgovora,
        odgovor1: vrijednosti.odgovor1,
        odgovor2: vrijednosti.odgovor2,
        odgovor3: vrijednosti.odgovor3,
        status: vrijednosti.status,
        incidentPozicija: vrijednosti.incidentPozicija,
        incidentRijecUzrok: vrijednosti.incidentRijecUzrok,
        incidentRazlog: vrijednosti.incidentRazlog,
        incidentAutorUpravljac: vrijednosti.incidentAutorUpravljac,
        incidentZrtvaUpravljac: vrijednosti.incidentZrtvaUpravljac,
        zatvorenoU: vrijednosti.zatvorenoU,
        verzijaAplikacije: vrijednosti.verzijaAplikacije,
      },
      setWhere: sql`(
        ${analitikaOtvaranja.status} = 'otvoren'
        or ${vrijednosti.status} <> 'otvoren'
      ) and ${analitikaOtvaranja.brojOdgovora} <= ${vrijednosti.brojOdgovora}`,
    });
}

export function zabiljeziOtvaranjeAnalitike(zapis: ZapisOtvaranjaAnalitike): void {
  uRedAnalitike(() => upsertOtvaranjaAnalitike(zapis), 'otvaranje');
}

export interface FilterRazdobljaAnalitike {
  od: Date;
  do: Date;
  kontekst?: KontekstOtvaranjaAnalitike;
}

function uvjetiRazdoblja(filter: FilterRazdobljaAnalitike): SQL {
  const dijelovi: SQL[] = [
    gte(analitikaOtvaranja.dodijeljenoU, filter.od),
    lt(analitikaOtvaranja.dodijeljenoU, filter.do),
  ];
  if (filter.kontekst) dijelovi.push(eq(analitikaOtvaranja.kontekst, filter.kontekst));
  return and(...dijelovi)!;
}

export async function agregirajPocetneRijeci(filter: FilterRazdobljaAnalitike) {
  const [red] = await baza
    .select({
      dodijeljene: sql<number>`count(*) filter (where ${analitikaOtvaranja.izvor} <> 'nema_kandidata')::int`,
      rezervni: sql<number>`count(*) filter (where ${analitikaOtvaranja.izvor} = 'rezervni_odabir')::int`,
      nemaKandidata: sql<number>`count(*) filter (where ${analitikaOtvaranja.izvor} = 'nema_kandidata')::int`,
      raniIncidenti: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'rani_incident')::int`,
      incidentiNa1: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'rani_incident' and ${analitikaOtvaranja.incidentPozicija} = 1)::int`,
      incidentiNa2: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'rani_incident' and ${analitikaOtvaranja.incidentPozicija} = 2)::int`,
      incidentiNa3: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'rani_incident' and ${analitikaOtvaranja.incidentPozicija} = 3)::int`,
      dvaOdgovoraOk: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'dva_odgovora_ok')::int`,
      triOdgovoraOk: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'tri_odgovora_ok')::int`,
      nepotpuna: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} in ('otvoren', 'nepotpuno'))::int`,
      zatvorenaDrugim: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'zatvoren_drugim')::int`,
    })
    .from(analitikaOtvaranja)
    .where(uvjetiRazdoblja(filter));

  const dodijeljene = red?.dodijeljene ?? 0;
  const rezervni = red?.rezervni ?? 0;
  const raniIncidenti = red?.raniIncidenti ?? 0;
  const dvaOdgovoraOk = red?.dvaOdgovoraOk ?? 0;
  const triOdgovoraOk = red?.triOdgovoraOk ?? 0;
  return {
    dodijeljene,
    rezervni,
    udioRezervnog: dodijeljene === 0 ? null : (rezervni / dodijeljene) * 100,
    nemaKandidata: red?.nemaKandidata ?? 0,
    raniIncidenti,
    udioRanihIncidenata: dodijeljene === 0 ? null : (raniIncidenti / dodijeljene) * 100,
    incidentiNa1: red?.incidentiNa1 ?? 0,
    incidentiNa2: red?.incidentiNa2 ?? 0,
    incidentiNa3: red?.incidentiNa3 ?? 0,
    dvaOdgovoraOk,
    triOdgovoraOk,
    /** Uspješno zatvoreni prozori (legacy 2 + novi 3). */
    prozorOk: dvaOdgovoraOk + triOdgovoraOk,
    nepotpuna: red?.nepotpuna ?? 0,
    zatvorenaDrugim: red?.zatvorenaDrugim ?? 0,
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
  };
}

export async function listajRaneIncidente(filter: FilterRazdobljaAnalitike & { stranica: number; poStranici: number }) {
  const pomak = Math.max(0, (filter.stranica - 1) * filter.poStranici);
  const uvjet = and(uvjetiRazdoblja(filter), eq(analitikaOtvaranja.status, 'rani_incident'))!;
  const [ukupnoRed] = await baza
    .select({ ukupno: sql<number>`count(*)::int` })
    .from(analitikaOtvaranja)
    .where(uvjet);
  const retci = await baza
    .select({
      id: analitikaOtvaranja.id,
      igraId: analitikaOtvaranja.igraId,
      redniBrojOtvaranja: analitikaOtvaranja.redniBrojOtvaranja,
      kontekst: analitikaOtvaranja.kontekst,
      mod: analitikaOtvaranja.mod,
      sustavskaRijec: analitikaOtvaranja.sustavskaRijec,
      izvor: analitikaOtvaranja.izvor,
      odgovor1: analitikaOtvaranja.odgovor1,
      odgovor2: analitikaOtvaranja.odgovor2,
      odgovor3: analitikaOtvaranja.odgovor3,
      incidentPozicija: analitikaOtvaranja.incidentPozicija,
      incidentRijecUzrok: analitikaOtvaranja.incidentRijecUzrok,
      incidentRazlog: analitikaOtvaranja.incidentRazlog,
      dodijeljenoU: analitikaOtvaranja.dodijeljenoU,
      zatvorenoU: analitikaOtvaranja.zatvorenoU,
    })
    .from(analitikaOtvaranja)
    .where(uvjet)
    .orderBy(desc(analitikaOtvaranja.dodijeljenoU))
    .limit(filter.poStranici)
    .offset(pomak);

  return {
    ukupno: ukupnoRed?.ukupno ?? 0,
    stranica: filter.stranica,
    poStranici: filter.poStranici,
    incidenti: retci.map((red) => ({
      ...red,
      dodijeljenoU: red.dodijeljenoU.toISOString(),
      zatvorenoU: red.zatvorenoU?.toISOString() ?? null,
    })),
  };
}

export async function dohvatiIncidentPoId(id: string) {
  const [red] = await baza.select().from(analitikaOtvaranja).where(eq(analitikaOtvaranja.id, id)).limit(1);
  if (!red || red.status !== 'rani_incident') return null;
  return {
    ...red,
    dodijeljenoU: red.dodijeljenoU.toISOString(),
    zatvorenoU: red.zatvorenoU?.toISOString() ?? null,
  };
}

function dijeloviZagreba(instant: Date): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  const dijelovi = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ANALITIKA_VREMENSKA_ZONA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .filter((dio) => dio.type !== 'literal')
      .map((dio) => [dio.type, dio.value]),
  );
  return dijelovi as { year: string; month: string; day: string; hour: string; minute: string; second: string };
}

/** UTC instant lokalne ponoći (Europe/Zagreb) za YYYY-MM-DD. */
export function pocetakDanaZagrebUtc(lokalniDanIso: string): Date {
  let t = Date.parse(`${lokalniDanIso}T00:00:00.000Z`);
  const cilj = Date.UTC(
    Number(lokalniDanIso.slice(0, 4)),
    Number(lokalniDanIso.slice(5, 7)) - 1,
    Number(lokalniDanIso.slice(8, 10)),
    0,
    0,
    0,
  );
  for (let i = 0; i < 48; i += 1) {
    const lokalno = dijeloviZagreba(new Date(t));
    const kaoUtc = Date.UTC(
      Number(lokalno.year),
      Number(lokalno.month) - 1,
      Number(lokalno.day),
      Number(lokalno.hour),
      Number(lokalno.minute),
      Number(lokalno.second),
    );
    const razlika = kaoUtc - cilj;
    if (razlika === 0) return new Date(t);
    t -= razlika;
  }
  return new Date(t);
}

function sljedeciKalendarskiDan(lokalniDanIso: string): string {
  const baza = new Date(`${lokalniDanIso}T12:00:00.000Z`);
  baza.setUTCDate(baza.getUTCDate() + 1);
  return baza.toISOString().slice(0, 10);
}

/** Granice kalendarskog dana u Europe/Zagreb → UTC instantima [od, do). */
export function graniceDanaZagreb(lokalniDanIso: string): { od: Date; do: Date } {
  return {
    od: pocetakDanaZagrebUtc(lokalniDanIso),
    do: pocetakDanaZagrebUtc(sljedeciKalendarskiDan(lokalniDanIso)),
  };
}

export function rasponOdDoZagreb(odDan: string, doDanUkljucivo: string): { od: Date; do: Date } {
  return {
    od: pocetakDanaZagrebUtc(odDan),
    do: pocetakDanaZagrebUtc(sljedeciKalendarskiDan(doDanUkljucivo)),
  };
}

export function danasZagrebIso(sada = new Date()): string {
  const lokalno = dijeloviZagreba(sada);
  return `${lokalno.year}-${lokalno.month}-${lokalno.day}`;
}
