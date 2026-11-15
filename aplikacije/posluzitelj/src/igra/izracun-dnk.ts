/**
 * Server adapter za zajednički Kaladont DNK (PR10).
 * HINT: zbroji dnk_statistike po svim modovima prije poziva; N2/N3/N4 iz formatnih agregata.
 * Ne koristiti igraci.dovrseneIgre (uključuje trening/privatno).
 */
import { izracunajKaladontDnk, type DnkOs, type DnkProfil } from 'zajednicko';

export interface DnkPodaciZajednicki {
  n2: number;
  n3: number;
  n4: number;
  eliminacijeUkupno: number;
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  dugeRijeci: number;
  srednjeDugeRijeci: number;
  jakoDugeRijeci: number;
  rijetkeRijeci: number;
  srednjeRijetkeRijeci: number;
  jakoRijetkeRijeci: number;
  univerzalniUcinak: number;
}

/** @deprecated Koristi DnkPodaciZajednicki (PR10). */
export type DnkPodaci = DnkPodaciZajednicki;

export type DnkRedakBrojaca = {
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  dugeRijeci: number;
  srednjeDugeRijeci: number;
  jakoDugeRijeci: number;
  rijetkeRijeci: number;
  srednjeRijetkeRijeci: number;
  jakoRijetkeRijeci: number;
  zbrojOcjenaIgre?: number;
  brojOcjenaIgre?: number;
};

export function prazniDnkBrojaci(): DnkRedakBrojaca {
  return {
    prihvaceniPotezi: 0,
    ukupnoTrajanjePrihvaceniPoteziMs: 0,
    najduziStreak: 0,
    dugeRijeci: 0,
    srednjeDugeRijeci: 0,
    jakoDugeRijeci: 0,
    rijetkeRijeci: 0,
    srednjeRijetkeRijeci: 0,
    jakoRijetkeRijeci: 0,
    zbrojOcjenaIgre: 0,
    brojOcjenaIgre: 0,
  };
}

/** Runtime zbroj do 3 reda dnk_statistike_igraca (PR10). */
export function zbrojiDnkRedove(redovi: readonly DnkRedakBrojaca[]): DnkRedakBrojaca {
  const zbroj = prazniDnkBrojaci();
  for (const red of redovi) {
    zbroj.prihvaceniPotezi += red.prihvaceniPotezi;
    zbroj.ukupnoTrajanjePrihvaceniPoteziMs += red.ukupnoTrajanjePrihvaceniPoteziMs;
    zbroj.najduziStreak = Math.max(zbroj.najduziStreak, red.najduziStreak);
    zbroj.dugeRijeci += red.dugeRijeci;
    zbroj.srednjeDugeRijeci += red.srednjeDugeRijeci;
    zbroj.jakoDugeRijeci += red.jakoDugeRijeci;
    zbroj.rijetkeRijeci += red.rijetkeRijeci;
    zbroj.srednjeRijetkeRijeci += red.srednjeRijetkeRijeci;
    zbroj.jakoRijetkeRijeci += red.jakoRijetkeRijeci;
    zbroj.zbrojOcjenaIgre = (zbroj.zbrojOcjenaIgre ?? 0) + (red.zbrojOcjenaIgre ?? 0);
    zbroj.brojOcjenaIgre = (zbroj.brojOcjenaIgre ?? 0) + (red.brojOcjenaIgre ?? 0);
  }
  return zbroj;
}

export function ponderiraneDugeIzBrojaca(podaci: Pick<DnkPodaciZajednicki, 'dugeRijeci' | 'srednjeDugeRijeci' | 'jakoDugeRijeci'>): number {
  return podaci.dugeRijeci + podaci.srednjeDugeRijeci * 1.5 + podaci.jakoDugeRijeci * 2;
}

export function ponderiraneRijetkeIzBrojaca(podaci: Pick<DnkPodaciZajednicki, 'rijetkeRijeci' | 'srednjeRijetkeRijeci' | 'jakoRijetkeRijeci'>): number {
  return podaci.rijetkeRijeci + podaci.srednjeRijetkeRijeci * 1.5 + podaci.jakoRijetkeRijeci * 2;
}

export function sastaviDnkProfil(podaci: DnkPodaciZajednicki): DnkProfil {
  return izracunajKaladontDnk({
    n2: podaci.n2,
    n3: podaci.n3,
    n4: podaci.n4,
    eliminacijeUkupno: podaci.eliminacijeUkupno,
    najduziStreak: podaci.najduziStreak,
    prihvaceniPotezi: podaci.prihvaceniPotezi,
    ukupnoTrajanjePrihvaceniPoteziMs: podaci.ukupnoTrajanjePrihvaceniPoteziMs,
    ponderiraneDuge: ponderiraneDugeIzBrojaca(podaci),
    ponderiraneRijetke: ponderiraneRijetkeIzBrojaca(podaci),
    univerzalniUcinak: podaci.univerzalniUcinak,
  });
}

/** Osi za mojDnk prije/poslije (KaladontDnkPromjena). */
export function izracunajDnk(podaci: DnkPodaciZajednicki): DnkOs[] {
  return sastaviDnkProfil(podaci).osi;
}

export type DnkMetrikeProfila = {
  eliminacijePoPartiji: number;
  nizPrihvacenihRijeci: number;
  prosjekPrihvacenogPotezaMs: number;
  dugeRijeciPoPartiji: number;
  rijetkeRijeciPoPartiji: number;
};

export function metrikeIzDnkPodataka(podaci: DnkPodaciZajednicki): DnkMetrikeProfila {
  const odigrano = podaci.n2 + podaci.n3 + podaci.n4;
  const prosjekPrihvacenogPotezaMs = podaci.prihvaceniPotezi > 0
    ? podaci.ukupnoTrajanjePrihvaceniPoteziMs / podaci.prihvaceniPotezi
    : 0;
  const dugeUkupno = podaci.dugeRijeci + podaci.srednjeDugeRijeci + podaci.jakoDugeRijeci;
  const rijetkeUkupno = podaci.rijetkeRijeci + podaci.srednjeRijetkeRijeci + podaci.jakoRijetkeRijeci;
  return {
    eliminacijePoPartiji: odigrano > 0 ? podaci.eliminacijeUkupno / odigrano : 0,
    nizPrihvacenihRijeci: podaci.najduziStreak,
    prosjekPrihvacenogPotezaMs,
    dugeRijeciPoPartiji: odigrano > 0 ? dugeUkupno / odigrano : 0,
    rijetkeRijeciPoPartiji: odigrano > 0 ? rijetkeUkupno / odigrano : 0,
  };
}
