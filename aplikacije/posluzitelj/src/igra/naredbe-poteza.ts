/**
 * Korelacija i idempotentnost naredbi poteza (#142 B).
 */
import type { PotvrdaNaredbePoteza } from 'zajednicko';
import type { RezultatNaredbe } from './politika-ucinka.js';

export const MAKS_CACHE_ISHODA_PO_IGRACU = 64;

export type VrstaNaredbePoteza = 'rijec' | 'ne-znam';

export interface KljucNaredbePoteza {
  requestId: string;
  igracId: string;
  vrsta: VrstaNaredbePoteza;
  turnToken: string;
  rijec?: string;
}

export interface ZapisIshodaNaredbe {
  kljuc: KljucNaredbePoteza;
  potvrda: PotvrdaNaredbePoteza;
}

export type CacheIshodaNaredbi = Map<string, ZapisIshodaNaredbe[]>;

export function stvoriCacheIshodaNaredbi(): CacheIshodaNaredbi {
  return new Map();
}

export function istiPayloadNaredbe(a: KljucNaredbePoteza, b: KljucNaredbePoteza): boolean {
  return (
    a.requestId === b.requestId &&
    a.igracId === b.igracId &&
    a.vrsta === b.vrsta &&
    a.turnToken === b.turnToken &&
    (a.rijec ?? '') === (b.rijec ?? '')
  );
}

export function dohvatiIshodNaredbe(
  cache: CacheIshodaNaredbi,
  kljuc: KljucNaredbePoteza,
): { vrsta: 'isti'; potvrda: PotvrdaNaredbePoteza } | { vrsta: 'konflikt' } | null {
  const lista = cache.get(kljuc.igracId);
  if (!lista) return null;
  const postojeci = lista.find((z) => z.kljuc.requestId === kljuc.requestId);
  if (!postojeci) return null;
  if (istiPayloadNaredbe(postojeci.kljuc, kljuc)) return { vrsta: 'isti', potvrda: postojeci.potvrda };
  return { vrsta: 'konflikt' };
}

export function zapamtiIshodNaredbe(cache: CacheIshodaNaredbi, kljuc: KljucNaredbePoteza, potvrda: PotvrdaNaredbePoteza): void {
  const lista = cache.get(kljuc.igracId) ?? [];
  const bezStarog = lista.filter((z) => z.kljuc.requestId !== kljuc.requestId);
  bezStarog.push({ kljuc, potvrda });
  while (bezStarog.length > MAKS_CACHE_ISHODA_PO_IGRACU) bezStarog.shift();
  cache.set(kljuc.igracId, bezStarog);
}

export function potvrdaIzRezultataNaredbe(
  ulaz: {
    partijaId: string;
    requestId: string;
    turnToken: string;
    verzijaStanja: number;
  },
  rezultat: RezultatNaredbe,
): PotvrdaNaredbePoteza {
  if (rezultat.ishod === 'prihvacen') {
    return {
      partijaId: ulaz.partijaId,
      requestId: ulaz.requestId,
      turnToken: ulaz.turnToken,
      ishod: 'prihvacen',
      verzijaStanja: ulaz.verzijaStanja,
    };
  }
  if (rezultat.ishod === 'odbijen') {
    return {
      partijaId: ulaz.partijaId,
      requestId: ulaz.requestId,
      turnToken: ulaz.turnToken,
      ishod: 'odbijen',
      kod: rezultat.kod,
      poruka: rezultat.poruka,
      verzijaStanja: ulaz.verzijaStanja,
    };
  }
  const poruke: Record<string, { kod: string; poruka: string }> = {
    nema_partije: { kod: 'NEMA_PARTIJE', poruka: 'Nisi u aktivnoj partiji.' },
    zavrsena: { kod: 'PARTIJA_ZAVRSENA', poruka: 'Partija je već završila.' },
    nije_na_potezu: { kod: 'NIJE_NA_POTEZU', poruka: 'Nisi na potezu.' },
    sustav_bira: { kod: 'SUSTAV_BIRA', poruka: 'Pričekaj dok sustav bira riječ.' },
    nije_sudionik: { kod: 'NIJE_SUDIONIK', poruka: 'Nisi aktivan sudionik ove partije.' },
  };
  const poruka = poruke[rezultat.razlog] ?? { kod: 'IGNORIRAN', poruka: 'Naredba je ignorirana.' };
  return {
    partijaId: ulaz.partijaId,
    requestId: ulaz.requestId,
    turnToken: ulaz.turnToken,
    ishod: 'ignoriran',
    kod: poruka.kod,
    poruka: poruka.poruka,
    verzijaStanja: ulaz.verzijaStanja,
  };
}

export function jeAckCallback(vrijednost: unknown): vrijednost is (potvrda: PotvrdaNaredbePoteza) => void {
  return typeof vrijednost === 'function';
}
