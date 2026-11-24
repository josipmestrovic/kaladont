/** Sažetak aktivnih misija za badge na naslovnici. */
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

export function natpisBadgaMisija(prikaz: PrikazAktivnihMisija): string | null {
  if (prikaz.ukupnoAktivnih <= 0) return null;
  return `${prikaz.dnevneAktivne}·${prikaz.tjedneAktivne}`;
}

export function ariaBadgaMisija(prikaz: PrikazAktivnihMisija): string {
  return `${prikaz.dnevneAktivne} dnevnih i ${prikaz.tjedneAktivne} tjednih aktivnih misija`;
}
