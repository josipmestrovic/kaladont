/**
 * Live agregacija Izazova iz pokusaji_izazova / zavrseci_izazova (PR06).
 * Ne oslanja se na fire-and-forget analitika/red-upisa.
 */
import { and, eq, gte, inArray, isNotNull, lt, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { pokusajiIzazova, zavrseciIzazova } from '../baza/shema.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  pocetakDanaZagrebUtc,
  rasponOdDoZagreb,
} from '../analitika/otvaranja.js';

export const ROK_RETENCIJE_POKUSAJA_IZAZOVA_MS = 90 * 24 * 60 * 60 * 1000;
export const PRAG_MALI_UZORAK_IZAZOVA = 30;

export type VrstaRacunaIzazovAnalitike = 'gost' | 'registriran';

export interface FilterIzazovAnalitike {
  odDan: string;
  doDan: string;
  challengeId?: string;
  definitionVersion?: number;
  accountTypeAtStart?: VrstaRacunaIzazovAnalitike;
  botProfileVersion?: number;
  turnDurationMs?: number;
}

export interface WilsonInterval {
  low: number;
  high: number;
}

export interface RedakIzazovAnalitike {
  challengeId: string;
  definitionVersion: number;
  botProfileVersion: number | null;
  turnDurationMs: number | null;
  /** Motor pokrenut (partijaId != null). */
  started: number;
  aktivni: number;
  tehnicki: number;
  uspjesi: number;
  neuspjesi: number;
  igrackiZavrseni: number;
  attemptSuccessBrojnik: number;
  attemptSuccessNazivnik: number;
  /** 0–100 ili null. */
  attemptSuccessRate: number | null;
  gameWon: number;
  gameWonRate: number | null;
  uniqueStarted: number;
  uniqueSuccess: number;
  uniqueSuccessRate: number | null;
  uniqueSuccessWilson: WilsonInterval | null;
  maliUzorak: boolean;
  firstTrySuccess: number;
  firstTryPlayers: number;
  firstTryRate: number | null;
  attemptsToFirstSuccessMedian: number | null;
  trajanjeMedianMs: number | null;
  trajanjeP90Ms: number | null;
  reasons: Record<string, number>;
  startedGost: number;
  startedRegistriran: number;
  uspjesiGost: number;
  uspjesiRegistriran: number;
}

export interface OdgovorIzazovAnalitike {
  od: string;
  do: string;
  vremenskaZona: string;
  filter: {
    challengeId: string | null;
    definitionVersion: number | null;
    accountTypeAtStart: VrstaRacunaIzazovAnalitike | null;
    botProfileVersion: number | null;
    turnDurationMs: number | null;
  };
  ukupno: {
    started: number;
    aktivni: number;
    tehnicki: number;
    uspjesi: number;
    neuspjesi: number;
    uniqueStarted: number;
    uniqueSuccess: number;
    uniqueSuccessRate: number | null;
    uniqueSuccessWilson: WilsonInterval | null;
    maliUzorak: boolean;
  };
  redovi: RedakIzazovAnalitike[];
}

type SiroviPokusaj = {
  id: string;
  igracId: string;
  challengeId: string;
  definitionVersion: number;
  botProfileVersion: number | null;
  snapshot: unknown;
  partijaId: string | null;
  startedAt: Date;
  terminalAt: Date | null;
  status: string;
  reason: string | null;
  gameWon: boolean | null;
  accountTypeAtStart: VrstaRacunaIzazovAnalitike;
};

function omjerPostotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik <= 0) return null;
  return (brojnik / nazivnik) * 100;
}

/** Wilson score interval (95%) za udio uspjeha; vrijednosti 0–100. */
export function wilsonInterval95(uspjehi: number, pokusaji: number): WilsonInterval | null {
  if (pokusaji <= 0) return null;
  const z = 1.959963984540054;
  const p = uspjehi / pokusaji;
  const n = pokusaji;
  const denomin = 1 + (z * z) / n;
  const centar = p + (z * z) / (2 * n);
  const rub = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return {
    low: Math.max(0, ((centar - rub) / denomin) * 100),
    high: Math.min(100, ((centar + rub) / denomin) * 100),
  };
}

export function percentilSortiranih(sortirani: number[], p: number): number | null {
  if (sortirani.length === 0) return null;
  if (sortirani.length === 1) return sortirani[0]!;
  const indeks = (sortirani.length - 1) * p;
  const donji = Math.floor(indeks);
  const gornji = Math.ceil(indeks);
  if (donji === gornji) return sortirani[donji]!;
  const w = indeks - donji;
  return sortirani[donji]! * (1 - w) + sortirani[gornji]! * w;
}

function turnDurationIzSnapshot(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const ms = (snapshot as { turnDurationMs?: unknown }).turnDurationMs;
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
}

function kljucReda(
  challengeId: string,
  definitionVersion: number,
  botProfileVersion: number | null,
  turnDurationMs: number | null,
): string {
  return `${challengeId}\0${definitionVersion}\0${botProfileVersion ?? 'n'}\0${turnDurationMs ?? 'n'}`;
}

function uvjetiFiltera(filter: FilterIzazovAnalitike, raspon: { od: Date; do: Date }): SQL | undefined {
  const dijelovi: SQL[] = [
    gte(pokusajiIzazova.startedAt, raspon.od),
    lt(pokusajiIzazova.startedAt, raspon.do),
  ];
  if (filter.challengeId) dijelovi.push(eq(pokusajiIzazova.challengeId, filter.challengeId));
  if (filter.definitionVersion !== undefined) {
    dijelovi.push(eq(pokusajiIzazova.definitionVersion, filter.definitionVersion));
  }
  if (filter.accountTypeAtStart) {
    dijelovi.push(eq(pokusajiIzazova.accountTypeAtStart, filter.accountTypeAtStart));
  }
  if (filter.botProfileVersion !== undefined) {
    dijelovi.push(eq(pokusajiIzazova.botProfileVersion, filter.botProfileVersion));
  }
  return and(...dijelovi);
}

function prazanRedak(
  challengeId: string,
  definitionVersion: number,
  botProfileVersion: number | null,
  turnDurationMs: number | null,
): RedakIzazovAnalitike {
  return {
    challengeId,
    definitionVersion,
    botProfileVersion,
    turnDurationMs,
    started: 0,
    aktivni: 0,
    tehnicki: 0,
    uspjesi: 0,
    neuspjesi: 0,
    igrackiZavrseni: 0,
    attemptSuccessBrojnik: 0,
    attemptSuccessNazivnik: 0,
    attemptSuccessRate: null,
    gameWon: 0,
    gameWonRate: null,
    uniqueStarted: 0,
    uniqueSuccess: 0,
    uniqueSuccessRate: null,
    uniqueSuccessWilson: null,
    maliUzorak: true,
    firstTrySuccess: 0,
    firstTryPlayers: 0,
    firstTryRate: null,
    attemptsToFirstSuccessMedian: null,
    trajanjeMedianMs: null,
    trajanjeP90Ms: null,
    reasons: {},
    startedGost: 0,
    startedRegistriran: 0,
    uspjesiGost: 0,
    uspjesiRegistriran: 0,
  };
}

function agregirajSirove(pokusaji: SiroviPokusaj[], turnDurationFilter?: number): RedakIzazovAnalitike[] {
  type Akum = {
    meta: {
      challengeId: string;
      definitionVersion: number;
      botProfileVersion: number | null;
      turnDurationMs: number | null;
    };
    pokusaji: SiroviPokusaj[];
  };
  const grupe = new Map<string, Akum>();

  for (const p of pokusaji) {
    const turnMs = turnDurationIzSnapshot(p.snapshot);
    if (turnDurationFilter !== undefined && turnMs !== turnDurationFilter) continue;
    const k = kljucReda(p.challengeId, p.definitionVersion, p.botProfileVersion, turnMs);
    let g = grupe.get(k);
    if (!g) {
      g = {
        meta: {
          challengeId: p.challengeId,
          definitionVersion: p.definitionVersion,
          botProfileVersion: p.botProfileVersion,
          turnDurationMs: turnMs,
        },
        pokusaji: [],
      };
      grupe.set(k, g);
    }
    g.pokusaji.push(p);
  }

  const redovi: RedakIzazovAnalitike[] = [];
  for (const g of grupe.values()) {
    const red = prazanRedak(
      g.meta.challengeId,
      g.meta.definitionVersion,
      g.meta.botProfileVersion,
      g.meta.turnDurationMs,
    );

    const uniqueStarted = new Set<string>();
    const uniqueSuccess = new Set<string>();
    const trajanja: number[] = [];

    // First-try unutar (igrac, challenge, definitionVersion) — svi pokušaji grupe dijele challenge+verziju.
    const poIgracu = new Map<string, SiroviPokusaj[]>();
    for (const p of g.pokusaji) {
      const lista = poIgracu.get(p.igracId) ?? [];
      lista.push(p);
      poIgracu.set(p.igracId, lista);

      const pokrenut = p.partijaId !== null;
      if (pokrenut) {
        red.started += 1;
        uniqueStarted.add(p.igracId);
        if (p.accountTypeAtStart === 'gost') red.startedGost += 1;
        else red.startedRegistriran += 1;
      }
      if (p.status === 'rezerviran' || p.status === 'u_tijeku') red.aktivni += 1;
      if (p.status === 'tehnicki_prekinuto') red.tehnicki += 1;
      if (p.status === 'uspjeh') {
        red.uspjesi += 1;
        uniqueSuccess.add(p.igracId);
        if (p.accountTypeAtStart === 'gost') red.uspjesiGost += 1;
        else red.uspjesiRegistriran += 1;
      }
      if (p.status === 'neuspjeh') {
        red.neuspjesi += 1;
        if (p.reason) red.reasons[p.reason] = (red.reasons[p.reason] ?? 0) + 1;
      }
      if (p.status === 'uspjeh' || p.status === 'neuspjeh') {
        red.igrackiZavrseni += 1;
        if (p.gameWon === true) red.gameWon += 1;
        if (p.terminalAt && p.startedAt) {
          const ms = p.terminalAt.getTime() - p.startedAt.getTime();
          if (Number.isFinite(ms) && ms >= 0) trajanja.push(ms);
        }
      }
    }

    red.attemptSuccessBrojnik = red.uspjesi;
    red.attemptSuccessNazivnik = red.uspjesi + red.neuspjesi;
    red.attemptSuccessRate = omjerPostotak(red.attemptSuccessBrojnik, red.attemptSuccessNazivnik);
    red.gameWonRate = omjerPostotak(red.gameWon, red.igrackiZavrseni);
    red.uniqueStarted = uniqueStarted.size;
    red.uniqueSuccess = uniqueSuccess.size;
    red.uniqueSuccessRate = omjerPostotak(red.uniqueSuccess, red.uniqueStarted);
    red.uniqueSuccessWilson = wilsonInterval95(red.uniqueSuccess, red.uniqueStarted);
    red.maliUzorak = red.uniqueStarted < PRAG_MALI_UZORAK_IZAZOVA;

    const attemptsToSuccess: number[] = [];
    for (const [, lista] of poIgracu) {
      const netehnički = [...lista]
        .filter((p) => p.status === 'uspjeh' || p.status === 'neuspjeh')
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      if (netehnički.length === 0) continue;
      red.firstTryPlayers += 1;
      const prvi = netehnički[0]!;
      if (prvi.status === 'uspjeh') red.firstTrySuccess += 1;
      const idxUspjeh = netehnički.findIndex((p) => p.status === 'uspjeh');
      if (idxUspjeh >= 0) attemptsToSuccess.push(idxUspjeh + 1);
    }
    red.firstTryRate = omjerPostotak(red.firstTrySuccess, red.firstTryPlayers);
    attemptsToSuccess.sort((a, b) => a - b);
    red.attemptsToFirstSuccessMedian = percentilSortiranih(attemptsToSuccess, 0.5);
    trajanja.sort((a, b) => a - b);
    red.trajanjeMedianMs = percentilSortiranih(trajanja, 0.5);
    red.trajanjeP90Ms = percentilSortiranih(trajanja, 0.9);

    redovi.push(red);
  }

  redovi.sort((a, b) => {
    if (a.challengeId !== b.challengeId) return a.challengeId.localeCompare(b.challengeId);
    if (a.definitionVersion !== b.definitionVersion) return a.definitionVersion - b.definitionVersion;
    return (a.botProfileVersion ?? 0) - (b.botProfileVersion ?? 0);
  });
  return redovi;
}

export async function agregirajIzazove(filter: FilterIzazovAnalitike): Promise<OdgovorIzazovAnalitike> {
  const raspon = rasponOdDoZagreb(filter.odDan, filter.doDan);
  const where = uvjetiFiltera(filter, raspon);

  const redoviDb = await baza
    .select({
      id: pokusajiIzazova.id,
      igracId: pokusajiIzazova.igracId,
      challengeId: pokusajiIzazova.challengeId,
      definitionVersion: pokusajiIzazova.definitionVersion,
      botProfileVersion: pokusajiIzazova.botProfileVersion,
      snapshot: pokusajiIzazova.snapshot,
      partijaId: pokusajiIzazova.partijaId,
      startedAt: pokusajiIzazova.startedAt,
      terminalAt: pokusajiIzazova.terminalAt,
      status: pokusajiIzazova.status,
      reason: pokusajiIzazova.reason,
      gameWon: pokusajiIzazova.gameWon,
      accountTypeAtStart: pokusajiIzazova.accountTypeAtStart,
    })
    .from(pokusajiIzazova)
    .where(where);

  const sirovi: SiroviPokusaj[] = redoviDb.map((r) => ({
    ...r,
    botProfileVersion: r.botProfileVersion ?? null,
    accountTypeAtStart: r.accountTypeAtStart as VrstaRacunaIzazovAnalitike,
  }));

  const redovi = agregirajSirove(sirovi, filter.turnDurationMs);

  let started = 0;
  let aktivni = 0;
  let tehnicki = 0;
  let uspjesi = 0;
  let neuspjesi = 0;
  const uniqueStarted = new Set<string>();
  const uniqueSuccess = new Set<string>();
  for (const p of sirovi) {
    if (filter.turnDurationMs !== undefined) {
      const ms = turnDurationIzSnapshot(p.snapshot);
      if (ms !== filter.turnDurationMs) continue;
    }
    if (p.partijaId !== null) {
      started += 1;
      uniqueStarted.add(p.igracId);
    }
    if (p.status === 'rezerviran' || p.status === 'u_tijeku') aktivni += 1;
    if (p.status === 'tehnicki_prekinuto') tehnicki += 1;
    if (p.status === 'uspjeh') {
      uspjesi += 1;
      uniqueSuccess.add(p.igracId);
    }
    if (p.status === 'neuspjeh') neuspjesi += 1;
  }

  return {
    od: filter.odDan,
    do: filter.doDan,
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    filter: {
      challengeId: filter.challengeId ?? null,
      definitionVersion: filter.definitionVersion ?? null,
      accountTypeAtStart: filter.accountTypeAtStart ?? null,
      botProfileVersion: filter.botProfileVersion ?? null,
      turnDurationMs: filter.turnDurationMs ?? null,
    },
    ukupno: {
      started,
      aktivni,
      tehnicki,
      uspjesi,
      neuspjesi,
      uniqueStarted: uniqueStarted.size,
      uniqueSuccess: uniqueSuccess.size,
      uniqueSuccessRate: omjerPostotak(uniqueSuccess.size, uniqueStarted.size),
      uniqueSuccessWilson: wilsonInterval95(uniqueSuccess.size, uniqueStarted.size),
      maliUzorak: uniqueStarted.size < PRAG_MALI_UZORAK_IZAZOVA,
    },
    redovi,
  };
}

export function izazoviAgregatUCsv(odgovor: OdgovorIzazovAnalitike): string {
  const header = [
    'challengeId',
    'definitionVersion',
    'botProfileVersion',
    'turnDurationMs',
    'started',
    'aktivni',
    'tehnicki',
    'uspjesi',
    'neuspjesi',
    'igrackiZavrseni',
    'attemptSuccessRate',
    'attemptSuccessBrojnik',
    'attemptSuccessNazivnik',
    'gameWon',
    'gameWonRate',
    'uniqueStarted',
    'uniqueSuccess',
    'uniqueSuccessRate',
    'wilsonLow',
    'wilsonHigh',
    'maliUzorak',
    'firstTrySuccess',
    'firstTryPlayers',
    'firstTryRate',
    'attemptsToFirstSuccessMedian',
    'trajanjeMedianMs',
    'trajanjeP90Ms',
    'startedGost',
    'startedRegistriran',
    'uspjesiGost',
    'uspjesiRegistriran',
    'reasonsJson',
  ];
  const linije = [header.join(',')];
  for (const r of odgovor.redovi) {
    linije.push([
      r.challengeId,
      r.definitionVersion,
      r.botProfileVersion ?? '',
      r.turnDurationMs ?? '',
      r.started,
      r.aktivni,
      r.tehnicki,
      r.uspjesi,
      r.neuspjesi,
      r.igrackiZavrseni,
      r.attemptSuccessRate ?? '',
      r.attemptSuccessBrojnik,
      r.attemptSuccessNazivnik,
      r.gameWon,
      r.gameWonRate ?? '',
      r.uniqueStarted,
      r.uniqueSuccess,
      r.uniqueSuccessRate ?? '',
      r.uniqueSuccessWilson?.low ?? '',
      r.uniqueSuccessWilson?.high ?? '',
      r.maliUzorak ? '1' : '0',
      r.firstTrySuccess,
      r.firstTryPlayers,
      r.firstTryRate ?? '',
      r.attemptsToFirstSuccessMedian ?? '',
      r.trajanjeMedianMs ?? '',
      r.trajanjeP90Ms ?? '',
      r.startedGost,
      r.startedRegistriran,
      r.uspjesiGost,
      r.uspjesiRegistriran,
      JSON.stringify(r.reasons).replaceAll('"', '""'),
    ].map((v) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    }).join(','));
  }
  return `${linije.join('\n')}\n`;
}

/**
 * Briše terminalne pokušaje starije od 90 dana. Ne dira zavrseci_izazova.
 * Pokušaji referencirani iz završetaka (RESTRICT) ostaju.
 */
export async function ocistiStarePokusajeIzazova(
  sada = new Date(),
): Promise<{ obrisano: number; zadrzanoZbogZavrsaka: number }> {
  const granica = new Date(sada.getTime() - ROK_RETENCIJE_POKUSAJA_IZAZOVA_MS);

  const kandidati = await baza
    .select({ id: pokusajiIzazova.id })
    .from(pokusajiIzazova)
    .where(and(
      isNotNull(pokusajiIzazova.terminalAt),
      lt(pokusajiIzazova.terminalAt, granica),
      inArray(pokusajiIzazova.status, ['uspjeh', 'neuspjeh', 'tehnicki_prekinuto']),
    ));

  if (kandidati.length === 0) {
    return { obrisano: 0, zadrzanoZbogZavrsaka: 0 };
  }

  const ids = kandidati.map((k) => k.id);
  const zasticeni = await baza
    .select({ id: zavrseciIzazova.firstSuccessAttemptId })
    .from(zavrseciIzazova)
    .where(inArray(zavrseciIzazova.firstSuccessAttemptId, ids));
  const zasticenSet = new Set(zasticeni.map((z) => z.id));
  const zaBrisanje = ids.filter((id) => !zasticenSet.has(id));
  const zadrzanoZbogZavrsaka = ids.length - zaBrisanje.length;

  if (zaBrisanje.length === 0) {
    return { obrisano: 0, zadrzanoZbogZavrsaka };
  }

  const obrisani = await baza
    .delete(pokusajiIzazova)
    .where(inArray(pokusajiIzazova.id, zaBrisanje))
    .returning({ id: pokusajiIzazova.id });

  return { obrisano: obrisani.length, zadrzanoZbogZavrsaka };
}

/** Za testove / dijagnostiku: Zagreb raspon. */
export function rasponFilteraIzazova(odDan: string, doDan: string): { od: Date; do: Date } {
  return rasponOdDoZagreb(odDan, doDan);
}

export function pocetakDanaFiltera(odDan: string): Date {
  return pocetakDanaZagrebUtc(odDan);
}
