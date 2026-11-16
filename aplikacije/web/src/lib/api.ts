/** Mali helper za pozive prema poslužiteljevom HTTP API-ju (Authorization: Bearer <token>). */
import { apiUrl } from './api-url.js';
import { osigurajAuthToken } from './identitet.js';

export class ApiGreska extends Error {
  readonly status: number;
  readonly kod?: string;
  readonly tijelo: Record<string, unknown>;

  constructor(status: number, poruka: string, tijelo: Record<string, unknown> = {}) {
    super(poruka);
    this.name = 'ApiGreska';
    this.status = status;
    this.kod = typeof tijelo.kod === 'string' ? tijelo.kod : undefined;
    this.tijelo = tijelo;
  }
}

export async function api<T>(putanja: string, opcije: RequestInit = {}): Promise<T> {
  const token = await osigurajAuthToken();
  const odgovor = await fetch(apiUrl(putanja), {
    ...opcije,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...opcije.headers,
    },
  });
  const tijelo = (await odgovor.json()) as T & { ok: boolean; greska?: string; kod?: string };
  if (!odgovor.ok || tijelo.ok === false) {
    const zapis = tijelo as unknown as Record<string, unknown>;
    throw new ApiGreska(
      odgovor.status,
      (typeof tijelo.greska === 'string' ? tijelo.greska : null) ?? `Zahtjev nije uspio (${odgovor.status})`,
      zapis,
    );
  }
  return tijelo;
}
