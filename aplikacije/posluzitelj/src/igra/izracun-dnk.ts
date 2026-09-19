import { izracunajKaladontDnk, type DnkOs } from 'zajednicko';

export interface DnkPodaci {
  odigrane: number;
  bodovi: number;
  eliminacije: number;
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  dugeRijeci: number;
  srednjeDugeRijeci: number;
  jakoDugeRijeci: number;
  rijetkeRijeci: number;
  srednjeRijetkeRijeci: number;
  jakoRijetkeRijeci: number;
}

export function izracunajDnk(podaci: DnkPodaci, mod: 'cetiri_igraca' | 'dva_igraca'): DnkOs[] {
  const prosjekPrihvacenogPotezaMs = podaci.prihvaceniPotezi > 0
    ? podaci.ukupnoTrajanjePrihvaceniPoteziMs / podaci.prihvaceniPotezi
    : 0;
  const ponderiraneDuge = podaci.dugeRijeci + podaci.srednjeDugeRijeci * 1.5 + podaci.jakoDugeRijeci * 2;
  const ponderiraneRijetke = podaci.rijetkeRijeci + podaci.srednjeRijetkeRijeci * 1.5 + podaci.jakoRijetkeRijeci * 2;

  return izracunajKaladontDnk({
    mod,
    odigrano: podaci.odigrane,
    prosjekBodova: podaci.odigrane > 0 ? podaci.bodovi / podaci.odigrane : 0,
    eliminacijePoPartiji: podaci.odigrane > 0 ? podaci.eliminacije / podaci.odigrane : 0,
    najduziStreak: podaci.najduziStreak,
    prosjekPrihvacenogPotezaMs,
    ponderiraneDuge: ponderiraneDuge / Math.max(1, podaci.odigrane),
    ponderiraneRijetke: ponderiraneRijetke / Math.max(1, podaci.odigrane),
  }).osi;
}
