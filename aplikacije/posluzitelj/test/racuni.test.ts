import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as ioClient } from 'socket.io-client';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;

const EMAIL = `test-${Date.now()}@example.com`;
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

describe('POST /racuni/registracija', () => {
  it('registrira novog korisnika i vraća sesijski token', async () => {
    const odgovor = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, nadimak: 'TestIgrac' }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; igracId: string; sesijskiToken: string };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.sesijskiToken.split('.')).toHaveLength(4);

    const [redak] = await baza.select().from(igraci).where(eq(igraci.email, EMAIL));
    expect(redak?.vrsta).toBe('registriran');
    expect(redak?.lozinkaHash).not.toBe(LOZINKA); // hashirano, ne plaintext
    expect(redak?.emailPotvrdjen).toBe(false);
  });

  it('odbija duplikat emaila', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const drugi = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: 'nekaDrugaLozinka1' }),
    });
    expect(drugi.status).toBe(409);
  });
});

describe('POST /racuni/prijava', () => {
  it('uspješna prijava vraća sesijski token', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });

    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; sesijskiToken: string };
    expect(tijelo.ok).toBe(true);
  });

  it('kriva lozinka vraća generičku 401 poruku', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });

    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: 'kriva-lozinka' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('nepostojeći račun vraća istu generičku 401 poruku (ne otkriva postojanje)', async () => {
    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ne-postoji-nikad@example.com', lozinka: 'bilo-sto-123' }),
    });
    expect(odgovor.status).toBe(401);
  });
});

describe('Socket.IO auth sa sesijskim tokenom', () => {
  it('prihvaća valjan sesijski token nakon prijave', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const socket = await new Promise<ReturnType<typeof ioClient>>((resolve, reject) => {
      const s = ioClient(adresa, { auth: { token: sesijskiToken }, forceNew: true });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('odbija goli UUID kao pokušaj impersonacije registriranog računa', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };

    await expect(
      new Promise((resolve, reject) => {
        const s = ioClient(adresa, { auth: { token: igracId }, forceNew: true });
        s.on('connect', () => reject(new Error('nije trebalo uspjeti - impersonacija!')));
        s.on('connect_error', (greska) => resolve(greska));
      }),
    ).resolves.toBeDefined();
  });
});
