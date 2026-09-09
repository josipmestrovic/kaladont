import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;

const NASUMICNI_SUFIKS = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');
const EMAIL = `profil-${NASUMICNI_SUFIKS}@example.com`;
const LOZINKA = 'lozinka123';

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await baza.delete(igraci).where(eq(igraci.email, EMAIL));
});

afterAll(async () => {
  await app.close();
});

describe('GET /profil', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/profil`);
    expect(odgovor.status).toBe(401);
  });

  it('vraća vlastite agregate i rang za prijavljenog korisnika', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const odgovor = await fetch(`${adresa}/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; rang: string; odigrane: number };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.odigrane).toBe(0);
    expect(tijelo.rang).toBe('Piskaralo');
  });
});

describe('GET /ljestvica', () => {
  it('vraća listu (javno, bez prijave)', async () => {
    const odgovor = await fetch(`${adresa}/ljestvica`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; ljestvica: unknown[] };
    expect(tijelo.ok).toBe(true);
    expect(Array.isArray(tijelo.ljestvica)).toBe(true);
  });
});

describe('GET /povijest/:igracId', () => {
  it('vraća praznu listu za igrača bez partija', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };

    const odgovor = await fetch(`${adresa}/povijest/${igracId}`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; partije: unknown[] };
    expect(tijelo.partije).toEqual([]);
  });
});
