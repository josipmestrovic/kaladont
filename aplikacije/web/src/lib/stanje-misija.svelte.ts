/**
 * Zajednički dohvat GET /misije za toast i badge na naslovnici (bez interval pollinga).
 */
import type { StanjeMisijaDto } from 'zajednicko';
import { ApiGreska, dohvatiStanjeMisija } from './misije-klijent.js';
import { jeRegistriranKorisnik } from './identitet.js';
import {
  izracunajAktivneMisije,
  type PrikazAktivnihMisija,
} from './naslovnica-misije.js';

let stanje = $state<StanjeMisijaDto | null>(null);
let status = $state<'prazno' | 'ucitavanje' | 'spreman' | 'gost' | 'greska'>('prazno');
let ucitavanje: Promise<StanjeMisijaDto | null> | null = null;

export function dohvatiStanjeMisijaStore() {
  return {
    get stanje() {
      return stanje;
    },
    get status() {
      return status;
    },
    get aktivne(): PrikazAktivnihMisija {
      if (!stanje) return { dnevneAktivne: 0, tjedneAktivne: 0, ukupnoAktivnih: 0 };
      return izracunajAktivneMisije(stanje);
    },
  };
}

export function invalidirajStanjeMisija(): void {
  stanje = null;
  status = 'prazno';
  ucitavanje = null;
}

export async function osigurajStanjeMisija(opcije: { forsaj?: boolean } = {}): Promise<StanjeMisijaDto | null> {
  if (!jeRegistriranKorisnik()) {
    stanje = null;
    status = 'gost';
    ucitavanje = null;
    return null;
  }

  if (!opcije.forsaj && ucitavanje) return ucitavanje;
  if (!opcije.forsaj && status === 'spreman' && stanje) return stanje;

  status = 'ucitavanje';
  const zahtjev = (async (): Promise<StanjeMisijaDto | null> => {
    try {
      const odgovor = await dohvatiStanjeMisija();
      stanje = odgovor;
      status = 'spreman';
      return odgovor;
    } catch (e) {
      if (e instanceof ApiGreska && (e.status === 401 || e.status === 403)) {
        stanje = null;
        status = 'gost';
        return null;
      }
      status = 'greska';
      return null;
    }
  })();

  ucitavanje = zahtjev;
  void zahtjev.finally(() => {
    if (ucitavanje === zahtjev) ucitavanje = null;
  });
  return zahtjev;
}
