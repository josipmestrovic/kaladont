/** Mali helper za pozive prema poslužiteljevom HTTP API-ju (Authorization: Bearer <token>). */
import { ADRESA_POSLUZITELJA } from './konfiguracija.js';
import { dohvatiAuthToken } from './identitet.js';

export async function api<T>(putanja: string, opcije: RequestInit = {}): Promise<T> {
  const token = dohvatiAuthToken();
  const odgovor = await fetch(`${ADRESA_POSLUZITELJA}${putanja}`, {
    ...opcije,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...opcije.headers,
    },
  });
  const tijelo = (await odgovor.json()) as T & { ok: boolean; greska?: string };
  if (!odgovor.ok || tijelo.ok === false) {
    throw new Error(tijelo.greska ?? `Zahtjev nije uspio (${odgovor.status})`);
  }
  return tijelo;
}
