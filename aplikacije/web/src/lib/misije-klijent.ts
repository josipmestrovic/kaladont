/** Tipizirani HTTP klijent za misije; zadržava status i serverski `kod`. */
import type { StanjeMisijaDto } from 'zajednicko';
import { apiUrl } from './api-url.js';
import { dohvatiAuthToken } from './identitet.js';

export class ApiGreska extends Error {
  readonly status: number;
  readonly kod: string | null;

  constructor(poruka: string, status: number, kod: string | null = null) {
    super(poruka);
    this.name = 'ApiGreska';
    this.status = status;
    this.kod = kod;
  }
}

type ApiOdgovor = { ok?: boolean; greska?: string; kod?: string };

async function misijeFetch<T>(putanja: string, opcije: RequestInit = {}): Promise<T> {
  const token = dohvatiAuthToken();
  let odgovor: Response;
  try {
    odgovor = await fetch(apiUrl(putanja), {
      ...opcije,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...opcije.headers,
      },
    });
  } catch {
    throw new ApiGreska('Mreža nije dostupna.', 0, 'MREZA');
  }

  let tijelo: ApiOdgovor = {};
  try {
    tijelo = (await odgovor.json()) as ApiOdgovor;
  } catch {
    throw new ApiGreska(`Zahtjev nije uspio (${odgovor.status})`, odgovor.status, null);
  }

  if (!odgovor.ok || tijelo.ok === false) {
    throw new ApiGreska(
      tijelo.greska ?? `Zahtjev nije uspio (${odgovor.status})`,
      odgovor.status,
      typeof tijelo.kod === 'string' ? tijelo.kod : null,
    );
  }
  return tijelo as T;
}

export function noviIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function dohvatiStanjeMisija(): Promise<StanjeMisijaDto> {
  return misijeFetch<StanjeMisijaDto>('/misije');
}

export function zamijeniMisiju(dodjelaId: string, idempotencyKey: string): Promise<StanjeMisijaDto> {
  return misijeFetch<StanjeMisijaDto>(`/misije/${encodeURIComponent(dodjelaId)}/zamijeni`, {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ idempotencyKey }),
  });
}

export function oznaciPregledMisija(skupina: 'dnevna' | 'tjedna'): Promise<StanjeMisijaDto> {
  return misijeFetch<StanjeMisijaDto>('/misije/pregled', {
    method: 'POST',
    body: JSON.stringify({ skupina }),
  });
}

export function porukaZaKodMisije(kod: string | null, fallback: string): string {
  switch (kod) {
    case 'MISIJA_DOVRSENA':
      return 'Ova misija već je završena.';
    case 'MISIJA_NIJE_AKTIVNA':
    case 'MISIJA_NIJE_PRONADENA':
      return 'Misija više nije dostupna.';
    case 'ZAMJENA_ISKORISTENA':
      return 'Današnja zamjena je iskorištena.';
    case 'NEMA_ALTERNATIVE':
      return 'Trenutačno nema druge dostupne misije.';
    case 'OBRACUN_U_TIJEKU':
      return 'Završetak igre još se sprema. Pokušaj nakon spremanja.';
    case 'REGISTRACIJA_POTREBNA':
      return 'Misije su dostupne registriranim igračima.';
    case 'PRIJAVA_POTREBNA':
      return 'Prijava je istekla. Prijavi se ponovno.';
    default:
      return fallback;
  }
}
