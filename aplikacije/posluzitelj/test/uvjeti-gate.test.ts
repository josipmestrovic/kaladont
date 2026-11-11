import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { StanjeReda } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj({ socketOgranicenja: { handshakePoIpMinuti: 1_000 } }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

function spojiSe(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

describe('Uvjeti samo na registraciji', () => {
  it('registracija bez kućica vraća 400', async () => {
    const email = `uvjeti-bez-${Date.now()}@example.com`;
    const odgovor = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, lozinka: 'lozinka123', nadimak: 'BezKucica' }),
    });
    expect(odgovor.status).toBe(400);
  });

  it('gost bez prihvata Uvjeta smije ući u red', async () => {
    const token = `gost.${randomUUID().replaceAll('-', '')}`;
    const socket = await spojiSe(token);
    try {
      const stanje = await new Promise<StanjeReda>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Nema red:stanje')), 5_000);
        socket.once('red:stanje', (poruka) => {
          clearTimeout(timeout);
          resolve(poruka);
        });
        socket.once('greska', (poruka) => {
          clearTimeout(timeout);
          reject(new Error(`Neočekivana greška: ${JSON.stringify(poruka)}`));
        });
        socket.emit('red:udji', { mod: 'dva_igraca' });
      });
      expect(stanje.mjesta.filter(Boolean).length).toBeGreaterThanOrEqual(1);
    } finally {
      socket.disconnect();
    }
  });
});
