/**
 * Agregati javne čekaonice — terminalni pokušaji iz analitika_cekanja.
 * Raspon po kraj_u (Europe/Zagreb). Čekanje igrača ≠ čekanje po stolu.
 */
import { and, eq, gte, lt, min, sql, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaCekanja } from '../baza/shema.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
} from './otvaranja.js';
import type { IshodAnalitikeCekanja, VrstaRacunaCekanja } from './cekanje-zivotni-ciklus.js';

export const INTERVALI_NAPUSTANJA = [
  { id: '0-5', odSek: 0, doSek: 5 },
  { id: '5-10', odSek: 5, doSek: 10 },
  { id: '10-15', odSek: 10, doSek: 15 },
  { id: '15-20', odSek: 15, doSek: 20 },
  { id: '20-25', odSek: 20, doSek: 25 },
  { id: '25-30', odSek: 25, doSek: 30 },
  { id: '30-45', odSek: 30, doSek: 45 },
  { id: '45-60', odSek: 45, doSek: 60 },
  { id: '60+', odSek: 60, doSek: null },
] as const;

function postotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik === 0) return null;
  return (brojnik / nazivnik) * 100;
}

function sortiraj(sekunde: number[]): number[] {
  return [...sekunde].sort((a, b) => a - b);
}

export function prosjekTrajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  return sekunde.reduce((s, v) => s + v, 0) / sekunde.length;
}

export function medijanTrajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const s = sortiraj(sekunde);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

export function p90Trajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const s = sortiraj(sekunde);
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1))]!;
}

export function p95Trajanja(sekunde: number[]): number | null {
  if (sekunde.length === 0) return null;
  const s = sortiraj(sekunde);
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1))]!;
}

function statistika(sekunde: number[]) {
  return {
    prosjekSekundi: prosjekTrajanja(sekunde),
    medijanSekundi: medijanTrajanja(sekunde),
    p90Sekundi: p90Trajanja(sekunde),
    p95Sekundi: p95Trajanja(sekunde),
    uzorak: sekunde.length,
  };
}

const ISHODI: IshodAnalitikeCekanja[] = [
  'uparivanje',
  'napustanje',
  'prekid_veze',
  'promjena_reda',
  'uklonjen',
];

function prazniIshodi(): Record<IshodAnalitikeCekanja, number> {
  return {
    uparivanje: 0,
    napustanje: 0,
    prekid_veze: 0,
    promjena_reda: 0,
    uklonjen: 0,
  };
}

function segmentIz(
  redovi: Array<{ ishod: IshodAnalitikeCekanja; trajanjeSekundi: number }>,
) {
  const brojevi = prazniIshodi();
  const doUparivanja: number[] = [];
  const doNapustanja: number[] = [];
  const napustanjaPoIntervalu = INTERVALI_NAPUSTANJA.map((i) => ({
    interval: i.id,
    broj: 0,
    postotak: null as number | null,
  }));

  for (const red of redovi) {
    brojevi[red.ishod] += 1;
    if (red.ishod === 'uparivanje') doUparivanja.push(red.trajanjeSekundi);
    if (red.ishod === 'napustanje') {
      doNapustanja.push(red.trajanjeSekundi);
      const indeks = INTERVALI_NAPUSTANJA.findIndex((i) =>
        red.trajanjeSekundi >= i.odSek && (i.doSek == null || red.trajanjeSekundi < i.doSek),
      );
      if (indeks >= 0) napustanjaPoIntervalu[indeks]!.broj += 1;
    }
  }

  const ukupno = redovi.length;
  const napustanjaUkupno = brojevi.napustanje;
  for (const red of napustanjaPoIntervalu) {
    red.postotak = postotak(red.broj, napustanjaUkupno);
  }

  return {
    terminalniPokusaji: ukupno,
    ishodi: ISHODI.map((ishod) => ({
      ishod,
      broj: brojevi[ishod],
      postotak: postotak(brojevi[ishod], ukupno),
    })),
    trajanjeDoUparivanja: statistika(doUparivanja),
    trajanjeDoNapustanja: statistika(doNapustanja),
    distribucijaNapustanja: napustanjaPoIntervalu,
  };
}

export interface AgregatCekanja {
  vremenskaZona: string;
  od: string;
  do: string;
  danas: string;
  mjerenjeOd: string | null;
  napomena: string;
  ukupno: ReturnType<typeof segmentIz>;
  gosti: ReturnType<typeof segmentIz>;
  registrirani: ReturnType<typeof segmentIz>;
}

export async function agregirajCekanje(opcije: {
  odDan: string;
  doDan: string;
  vrstaRacuna?: VrstaRacunaCekanja;
}): Promise<AgregatCekanja> {
  const od = pocetakDanaZagrebUtc(opcije.odDan);
  const doGranica = pocetakDanaZagrebUtc(
    (() => {
      const d = new Date(`${opcije.doDan}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })(),
  );

  const uvjetVrste: SQL | undefined = opcije.vrstaRacuna
    ? eq(analitikaCekanja.vrstaRacunaNaPocetku, opcije.vrstaRacuna)
    : undefined;
  const uvjetKohorte = and(
    gte(analitikaCekanja.krajU, od),
    lt(analitikaCekanja.krajU, doGranica),
    uvjetVrste,
  );

  const redovi = await baza
    .select({
      ishod: analitikaCekanja.ishod,
      vrsta: analitikaCekanja.vrstaRacunaNaPocetku,
      trajanjeSekundi: sql<number>`extract(epoch from (${analitikaCekanja.krajU} - ${analitikaCekanja.pocetakU}))`,
    })
    .from(analitikaCekanja)
    .where(uvjetKohorte);

  const normalizirani = redovi.map((r) => ({
    ishod: r.ishod as IshodAnalitikeCekanja,
    vrsta: r.vrsta as VrstaRacunaCekanja,
    trajanjeSekundi: Number(r.trajanjeSekundi),
  }));

  const [najstariji] = await baza
    .select({ kraj: min(analitikaCekanja.krajU) })
    .from(analitikaCekanja);

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    od: opcije.odDan,
    do: opcije.doDan,
    danas: danasZagrebIso(),
    mjerenjeOd: najstariji?.kraj?.toISOString() ?? null,
    napomena:
      'Samo javna čekaonica. Broj terminalnih pokušaja nije egzaktan broj svih ikad započetih čekanja (npr. pad procesa). Napuštanje ≠ nužno klik Odustani. Čekanje igrača ≠ max čekanje po stolu.',
    ukupno: segmentIz(normalizirani),
    gosti: segmentIz(normalizirani.filter((r) => r.vrsta === 'gost')),
    registrirani: segmentIz(normalizirani.filter((r) => r.vrsta === 'registriran')),
  };
}
