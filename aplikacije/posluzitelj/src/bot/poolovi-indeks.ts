/**
 * In-memory snimka aktivnih članova taktičkih poolova, indeksirana po prvaDva.
 */
import type { KategorijaPoola } from './poolovi.js';
import { normalizirajPoolRijec, prefiksZaIndeksPoola } from './poolovi.js';

export interface SnimkaPoolova {
  readonly generacija: number;
  readonly verzijaRjecnika: number;
  readonly poPrefiksu: ReadonlyMap<string, { readonly pool1: readonly string[]; readonly pool2: readonly string[] }>;
  /** Svi aktivni razriješeni članovi (bilo koji pool). */
  readonly clanovi: ReadonlySet<string>;
  readonly pool1Clanovi: ReadonlySet<string>;
  readonly pool2Clanovi: ReadonlySet<string>;
}

type UlazClana = {
  rijec: string;
  kategorija: KategorijaPoola;
  stanje: 'nerazrijeseno' | 'razrijeseno';
};

function dodajUPrefiks(
  mapa: Map<string, { pool1: string[]; pool2: string[] }>,
  prefiks: string,
  rijec: string,
  kategorija: KategorijaPoola,
): void {
  let stupac = mapa.get(prefiks);
  if (!stupac) {
    stupac = { pool1: [], pool2: [] };
    mapa.set(prefiks, stupac);
  }
  if (kategorija === 'pool_1') stupac.pool1.push(rijec);
  else stupac.pool2.push(rijec);
}

export function izgradiSnimkuPoolova(ulaz: {
  clanovi: readonly UlazClana[];
  jeAktivnaURjecnika: (rijec: string) => boolean;
  verzijaRjecnika: number;
  generacija: number;
}): SnimkaPoolova {
  const poPrefiksuInterno = new Map<string, { pool1: string[]; pool2: string[] }>();
  const clanovi = new Set<string>();
  const pool1Clanovi = new Set<string>();
  const pool2Clanovi = new Set<string>();

  for (const clan of ulaz.clanovi) {
    if (clan.stanje !== 'razrijeseno') continue;
    const rijec = normalizirajPoolRijec(clan.rijec);
    if (!ulaz.jeAktivnaURjecnika(rijec)) continue;

    clanovi.add(rijec);
    if (clan.kategorija === 'pool_1') pool1Clanovi.add(rijec);
    else pool2Clanovi.add(rijec);

    const prefiks = prefiksZaIndeksPoola(rijec);
    dodajUPrefiks(poPrefiksuInterno, prefiks, rijec, clan.kategorija);
  }

  const poPrefiksu: SnimkaPoolova['poPrefiksu'] = new Map(
    [...poPrefiksuInterno.entries()].map(([kljuc, vrijednost]) => [
      kljuc,
      { pool1: [...vrijednost.pool1], pool2: [...vrijednost.pool2] },
    ]),
  );

  return {
    generacija: ulaz.generacija,
    verzijaRjecnika: ulaz.verzijaRjecnika,
    poPrefiksu,
    clanovi,
    pool1Clanovi,
    pool2Clanovi,
  };
}

export function kandidatiPoola(
  snimka: SnimkaPoolova,
  prefiks: string,
  pool: KategorijaPoola,
): readonly string[] {
  const normiraniPrefiks = prefiks.normalize('NFC').trim().toLowerCase();
  const stupac = snimka.poPrefiksu.get(normiraniPrefiks);
  if (!stupac) return [];
  return pool === 'pool_1' ? stupac.pool1 : stupac.pool2;
}

export function jeClanPoola(snimka: SnimkaPoolova, rijec: string, pool: KategorijaPoola): boolean {
  const normirana = normalizirajPoolRijec(rijec);
  return pool === 'pool_1' ? snimka.pool1Clanovi.has(normirana) : snimka.pool2Clanovi.has(normirana);
}

export function jeClanBiloKojegPoola(snimka: SnimkaPoolova, rijec: string): boolean {
  return snimka.clanovi.has(normalizirajPoolRijec(rijec));
}

const PRAZNA_SNIMKA: SnimkaPoolova = {
  generacija: 0,
  verzijaRjecnika: 0,
  poPrefiksu: new Map(),
  clanovi: new Set(),
  pool1Clanovi: new Set(),
  pool2Clanovi: new Set(),
};

/** Jedna zajednička snimka poolova (kao UpraviteljRepertoara). */
export class UpraviteljPoolova {
  private snimka: SnimkaPoolova = PRAZNA_SNIMKA;

  dohvati(): SnimkaPoolova {
    return this.snimka;
  }

  verzija(): number {
    return this.snimka.generacija;
  }

  objavi(nova: SnimkaPoolova): void {
    this.snimka = nova;
  }
}