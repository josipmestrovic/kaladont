/** Sažetak aktivnih misija za badge/podnaslov na naslovnici. */
import type { StanjeMisijaDto } from 'zajednicko';

export type PrikazAktivnihMisija = {
  dnevneAktivne: number;
  tjedneAktivne: number;
  ukupnoAktivnih: number;
};

export function izracunajAktivneMisije(stanje: StanjeMisijaDto): PrikazAktivnihMisija {
  const dnevneAktivne = stanje.dnevne.aktivne.length;
  const tjedneAktivne = stanje.tjedne.misije.filter((misija) => misija.status === 'aktivna').length;
  return {
    dnevneAktivne,
    tjedneAktivne,
    ukupnoAktivnih: dnevneAktivne + tjedneAktivne,
  };
}

/**
 * Narančasti badge samo za događaje koji traže pažnju (npr. nepreuzeta nagrada).
 * Bez API-ja za taj signal — badge se ne prikazuje; broj aktivnih ide u podnaslov.
 */
export function natpisBadgaMisija(_prikaz: PrikazAktivnihMisija): string | null {
  return null;
}

export function labelaAktivnihMisija(prikaz: PrikazAktivnihMisija): string {
  const broj = prikaz.ukupnoAktivnih;
  if (broj === 1) return '1 aktivna';
  if (broj >= 2 && broj <= 4) return `${broj} aktivne`;
  return `${broj} aktivnih`;
}

export function ariaBadgaMisija(prikaz: PrikazAktivnihMisija): string {
  const broj = prikaz.ukupnoAktivnih;
  if (broj === 1) return '1 aktivna misija';
  if (broj >= 2 && broj <= 4) return `${broj} aktivne misije`;
  return `${broj} aktivnih misija`;
}
