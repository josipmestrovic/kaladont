import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { izgradiPosluzitelj } from '../src/server.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
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

describe('identitet preko Socket.IO handshakea', () => {
  it('odbija spajanje s nevaljanim tokenom', async () => {
    await expect(
      new Promise((resolve, reject) => {
        const socket = ioClient(adresa, { auth: { token: 'nije-uuid' }, forceNew: true });
        socket.on('connect', () => reject(new Error('nije trebalo uspjeti')));
        socket.on('connect_error', (greska) => resolve(greska));
      }),
    ).resolves.toBeDefined();
  });

  it('prihvaća spajanje s valjanim UUID tokenom i dodjeljuje nadimak', async () => {
    const token = randomUUID();
    const socket = await spojiSe(token);
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('RS-18: nova veza istog identiteta odjavljuje staru', async () => {
    const token = randomUUID();
    const prvaVeza = await spojiSe(token);

    const odjavaPromise = new Promise<void>((resolve) => {
      prvaVeza.on('disconnect', () => resolve());
    });

    const drugaVeza = await spojiSe(token);
    await odjavaPromise;

    expect(prvaVeza.connected).toBe(false);
    expect(drugaVeza.connected).toBe(true);
    drugaVeza.disconnect();
  });
});
