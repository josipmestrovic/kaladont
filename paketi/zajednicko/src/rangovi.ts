/**
 * Rangovi — isključivo prikazni status (ADR-008, bez utjecaja na uparivanje).
 * PR09: jedan univerzalni učinak iz svih javnih formata.
 * Vidi docs/02-pravila-igre/bodovanje-i-rangovi.md.
 */

export interface PragRanga {
  naziv: string;
  /** Minimalni univerzalni učinak (prosjek doprinosa 100×N×b/S). */
  minimalniProsjek: number;
}

/**
 * PR09: 2520 jedinica = 1 rang-bod prikaza.
 * Doprinos u jedinicama = 252000 × N × b / S (egzaktno za cijeli S=1…10).
 */
export const RANG_JEDINICA_PO_BODU = 2520;
export const RANG_IZRACUN_VERZIJA = 1;

/** Poredano rastuće po pragu — zadnji koji odgovara pobjeđuje. */
export const RANGOVI: readonly PragRanga[] = [
  { naziv: 'Prvopisac', minimalniProsjek: 0 },
  { naziv: 'Riječarac', minimalniProsjek: 60 },
  { naziv: 'Jezičar', minimalniProsjek: 80 },
  { naziv: 'Lektor', minimalniProsjek: 94 },
  { naziv: 'Književnik', minimalniProsjek: 108 },
  { naziv: 'Jezikoslovac', minimalniProsjek: 122 },
  { naziv: 'Doktor riječi', minimalniProsjek: 136 },
  { naziv: 'Jezični maestro', minimalniProsjek: 150 },
  { naziv: 'Gospodar rječnika', minimalniProsjek: 164 },
  { naziv: 'Kaladont', minimalniProsjek: 178 },
];

/**
 * Legacy pragovi Četveroboja (sirovi prosjek bodova) — samo za usporedbu/rollback report.
 * Ne koristiti za prikazni rang nakon PR09.
 */
export const RANGOVI_LEGACY_4P: readonly PragRanga[] = [
  { naziv: 'Prvopisac', minimalniProsjek: 0 },
  { naziv: 'Riječarac', minimalniProsjek: 1.5 },
  { naziv: 'Jezičar', minimalniProsjek: 2.1 },
  { naziv: 'Lektor', minimalniProsjek: 2.5 },
  { naziv: 'Književnik', minimalniProsjek: 2.9 },
  { naziv: 'Jezikoslovac', minimalniProsjek: 3.3 },
  { naziv: 'Doktor riječi', minimalniProsjek: 3.8 },
  { naziv: 'Jezični maestro', minimalniProsjek: 4.4 },
  { naziv: 'Gospodar rječnika', minimalniProsjek: 5.0 },
  { naziv: 'Kaladont', minimalniProsjek: 5.7 },
];

/**
 * Legacy pragovi Dvoboja (udio pobjeda) — samo za usporedbu/rollback report.
 * @deprecated PR09 univerzalni rang
 */
export const RANGOVI_1V1: readonly PragRanga[] = [
  { naziv: 'Prvopisac', minimalniProsjek: 0.0 },
  { naziv: 'Riječarac', minimalniProsjek: 0.3 },
  { naziv: 'Jezičar', minimalniProsjek: 0.4 },
  { naziv: 'Lektor', minimalniProsjek: 0.47 },
  { naziv: 'Književnik', minimalniProsjek: 0.54 },
  { naziv: 'Jezikoslovac', minimalniProsjek: 0.61 },
  { naziv: 'Doktor riječi', minimalniProsjek: 0.68 },
  { naziv: 'Jezični maestro', minimalniProsjek: 0.75 },
  { naziv: 'Gospodar rječnika', minimalniProsjek: 0.82 },
  { naziv: 'Kaladont', minimalniProsjek: 0.89 },
];

export const BROJ_PARTIJA_ZA_KALIBRACIJU = 10;

/**
 * Doprinos jedne javne partije u rang-jedinicama.
 * N = početni broj sudionika, b = sirovi bodovi igrača, S = zbroj sirovih bodova stola.
 * S=0 (sve nule) → 0. Nepoznat/nedovršen rezultat ne ulazi ovdje.
 */
export function izracunajDoprinosRangJedinice(n: number, b: number, s: number): number {
  if (n <= 0 || b < 0 || s < 0) {
    throw new Error(`Nevaljani ulazi za rang doprinos: N=${n} b=${b} S=${s}`);
  }
  if (s === 0) return 0;
  // 252000 × N × b / S — egzaktno za cijeli S=1…10 u javnim pravilima 0.2.0.
  return (252000 * n * b) / s;
}

/** Prikazni doprinos (100 × N × b / S), iz jedinica. */
export function doprinosIzJedinica(jedinice: number): number {
  return jedinice / RANG_JEDINICA_PO_BODU;
}

/**
 * Univerzalni učinak = zbroj doprinosa / broj valjanih javnih partija.
 * Račun iz agregata u jedinicama.
 */
export function izracunajUniverzalniUcinak(sumaJedinica: number, brojPartija: number): number {
  if (brojPartija <= 0) return 0;
  return sumaJedinica / (brojPartija * RANG_JEDINICA_PO_BODU);
}

/**
 * Rang iz broja javnih partija i univerzalnog učinka.
 * Treći argument (stari mod) zanemaruje se — zadržan radi kompatibilnosti potpisâ.
 */
export function izracunajRang(odigrane: number, ucinakIliProsjek: number, ..._zanemareniArgs: unknown[]): string {
  void _zanemareniArgs;
  if (odigrane < BROJ_PARTIJA_ZA_KALIBRACIJU) return 'Piskaralo';

  let rang = RANGOVI[0]!.naziv;
  for (const prag of RANGOVI) {
    if (ucinakIliProsjek >= prag.minimalniProsjek) rang = prag.naziv;
  }
  return rang;
}

/** Rang iz pohranjenog agregata (bigint-safe usporedba praga × broj × 2520). */
export function izracunajRangIzAgregata(sumaJedinica: number | bigint, brojPartija: number): string {
  if (brojPartija < BROJ_PARTIJA_ZA_KALIBRACIJU) return 'Piskaralo';

  const suma = typeof sumaJedinica === 'bigint' ? sumaJedinica : BigInt(Math.trunc(sumaJedinica));
  let rang = RANGOVI[0]!.naziv;
  for (const prag of RANGOVI) {
    // ucinak >= prag  <=>  suma >= prag × broj × 2520
    const pragJedinica = BigInt(prag.minimalniProsjek) * BigInt(brojPartija) * BigInt(RANG_JEDINICA_PO_BODU);
    if (suma >= pragJedinica) rang = prag.naziv;
  }
  return rang;
}

function hijerarhijaRanga(rang: string | null): number {
  if (!rang || rang === 'Piskaralo') return -1;
  const indeks = RANGOVI.findIndex((r) => r.naziv === rang);
  return indeks >= 0 ? indeks : -1;
}

/**
 * @deprecated PR09 — prikazni rang više nije max(2p,4p).
 * Zadržano za ops usporedbu (`backfill --usporedi`) i eventualni stari klijent:
 * vraća viši naziv po hijerarhiji rangova (isti poredak imena kao prije).
 */
export function vratiVeciRang(rang1: string | null, rang2: string | null): string | null {
  const h1 = hijerarhijaRanga(rang1);
  const h2 = hijerarhijaRanga(rang2);
  if (h1 < 0 && h2 < 0) return null;
  if (h1 >= h2) return rang1 === 'Piskaralo' ? null : rang1;
  return rang2 === 'Piskaralo' ? null : rang2;
}

/** True ako je poslije strogo viši na univerzalnoj ljestvici (uključujući izlazak iz Piskarala). */
export function jeNapredakUniverzalnogRanga(prije: string, poslije: string): boolean {
  if (prije === poslije) return false;
  if (poslije === 'Piskaralo') return false;
  if (prije === 'Piskaralo') return true;
  return hijerarhijaRanga(poslije) > hijerarhijaRanga(prije);
}
