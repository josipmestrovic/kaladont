/**
 * Rezervacija starta Izazova + stub motora (PR01).
 * Pravo spajanje na motor-partije dolazi u PR03.
 */
import { randomBytes } from 'node:crypto';
import {
  definicijaIzazova,
  jeIdIzazova,
  prethodniIzazovId,
  type IdIzazova,
  type KodGreske,
  type PotvrdaIzazova,
} from 'zajednicko';
import {
  dohvatiPokusajPoRequestId,
  dohvatiZavrseneChallengeIds,
  oznaciTehnickiPrekinuto,
  umetniRezerviraniPokusaj,
  type RedakPokusajaIzazova,
} from './pohrana.js';

export interface RezultatRezervacijeIzazova {
  ok: true;
  pokusaj: RedakPokusajaIzazova;
  pokrenut: boolean;
  partijaId: string | null;
}

export interface GreskaRezervacijeIzazova {
  ok: false;
  kod: KodGreske;
  poruka: string;
}

/**
 * Hook za pokretanje partije. PR01 stub uvijek vraća greska;
 * PR03 zamjenjuje pravom implementacijom.
 */
export type PokreniPartijuIzazova = (ulaz: {
  attemptId: string;
  igracId: string;
  challengeId: IdIzazova;
}) => Promise<{ ok: true; partijaId: string } | { ok: false; razlog: string }>;

export const stubPokreniPartijuIzazova: PokreniPartijuIzazova = async () => ({
  ok: false,
  razlog: 'motor_nije_spojen',
});

export async function rezervirajPokusajIzazova(ulaz: {
  igracId: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  challengeId: string;
  requestId: string;
  omogucen: boolean;
  pokreniPartiju?: PokreniPartijuIzazova;
}): Promise<RezultatRezervacijeIzazova | GreskaRezervacijeIzazova> {
  if (!ulaz.omogucen) {
    return { ok: false, kod: 'IZAZOV_NEDOSTUPAN', poruka: 'Izazov trenutačno nije dostupan.' };
  }
  if (!jeIdIzazova(ulaz.challengeId)) {
    return { ok: false, kod: 'NEVALJAN_PAYLOAD', poruka: 'Nepoznat izazov.' };
  }
  if (typeof ulaz.requestId !== 'string' || ulaz.requestId.length < 8 || ulaz.requestId.length > 128) {
    return { ok: false, kod: 'NEVALJAN_PAYLOAD', poruka: 'Neispravan requestId.' };
  }

  const postojeći = await dohvatiPokusajPoRequestId(ulaz.igracId, ulaz.requestId);
  if (postojeći) {
    if (postojeći.challengeId !== ulaz.challengeId) {
      return { ok: false, kod: 'NEVALJAN_PAYLOAD', poruka: 'requestId je već iskorišten za drugi izazov.' };
    }
    return {
      ok: true,
      pokusaj: postojeći,
      pokrenut: Boolean(postojeći.partijaId) && postojeći.status === 'u_tijeku',
      partijaId: postojeći.partijaId,
    };
  }

  const definicija = definicijaIzazova(ulaz.challengeId);
  const zavrseni = await dohvatiZavrseneChallengeIds(ulaz.igracId);
  const prethodni = prethodniIzazovId(definicija.id);
  if (prethodni !== null && !zavrseni.has(prethodni)) {
    return {
      ok: false,
      kod: 'IZAZOV_ZAKLJUCAN',
      poruka: `Najprije dovrši izazov ${prethodni}.`,
    };
  }

  const accountTypeAtStart = ulaz.vrsta === 'gost' ? 'gost' as const : 'registriran' as const;
  let pokusaj: RedakPokusajaIzazova;
  try {
    pokusaj = await umetniRezerviraniPokusaj({
      igracId: ulaz.igracId,
      requestId: ulaz.requestId,
      definicija,
      accountTypeAtStart,
      seed: randomBytes(16).toString('hex'),
    });
  } catch (greska: unknown) {
    // Unique aktivni pokušaj / requestId utrka
    const ponovno = await dohvatiPokusajPoRequestId(ulaz.igracId, ulaz.requestId);
    if (ponovno) {
      return {
        ok: true,
        pokusaj: ponovno,
        pokrenut: Boolean(ponovno.partijaId) && ponovno.status === 'u_tijeku',
        partijaId: ponovno.partijaId,
      };
    }
    if (jeKonfliktAktivnogPokusaja(greska)) {
      return {
        ok: false,
        kod: 'IZAZOV_AKTIVAN',
        poruka: 'Već imaš aktivan pokušaj Izazova. Dovrši ga ili pričekaj završetak.',
      };
    }
    throw greska;
  }

  const pokreni = ulaz.pokreniPartiju ?? stubPokreniPartijuIzazova;
  const motor = await pokreni({
    attemptId: pokusaj.id,
    igracId: ulaz.igracId,
    challengeId: definicija.id,
  });

  if (!motor.ok) {
    const terminalni = await oznaciTehnickiPrekinuto(pokusaj.id);
    return {
      ok: true,
      pokusaj: terminalni ?? { ...pokusaj, status: 'tehnicki_prekinuto' },
      pokrenut: false,
      partijaId: null,
    };
  }

  return {
    ok: true,
    pokusaj,
    pokrenut: true,
    partijaId: motor.partijaId,
  };
}

function jeKonfliktAktivnogPokusaja(greska: unknown): boolean {
  const tekst = greska instanceof Error ? `${greska.message} ${String((greska as { cause?: unknown }).cause ?? '')}` : String(greska);
  if (tekst.includes('uq_pokusaji_izazova_aktivan_igrac')) return true;
  const cause = greska && typeof greska === 'object' && 'cause' in greska
    ? (greska as { cause?: { code?: string; constraint_name?: string } }).cause
    : undefined;
  return cause?.code === '23505' && (
    cause.constraint_name === 'uq_pokusaji_izazova_aktivan_igrac'
    || Boolean(cause.constraint_name?.includes('aktivan_igrac'))
  );
}

export function potvrdaIzRezultata(rezultat: RezultatRezervacijeIzazova | GreskaRezervacijeIzazova): Parameters<PotvrdaIzazova>[0] {
  if (!rezultat.ok) {
    return { rezerviran: false, kod: rezultat.kod, poruka: rezultat.poruka };
  }
  return {
    rezerviran: true,
    attemptId: rezultat.pokusaj.id,
    challengeId: rezultat.pokusaj.challengeId as IdIzazova,
    pokrenut: rezultat.pokrenut,
    partijaId: rezultat.partijaId,
    status: rezultat.pokusaj.status,
  };
}
