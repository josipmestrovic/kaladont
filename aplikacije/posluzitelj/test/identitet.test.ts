import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';

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

async function cekajBrojAktivnihVeza(veze: readonly ClientSocket[], broj: number): Promise<void> {
  const istek = Date.now() + 1_000;
  while (Date.now() < istek) {
    if (veze.filter((veza) => veza.connected).length === broj) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Očekivano aktivnih veza: ${broj}.`);
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

  it('zadnju aktivnost ne ažurira češće od svakih 15 minuta', async () => {
    const token = randomUUID();
    const prvaVeza = await spojiSe(token);
    prvaVeza.disconnect();

    const svjezaAktivnost = new Date(Date.now() - 60_000);
    await baza.update(igraci).set({ zadnjaAktivnost: svjezaAktivnost }).where(eq(igraci.id, token));

    const drugaVeza = await spojiSe(token);
    drugaVeza.disconnect();
    const [nakonSvjeze] = await baza
      .select({ zadnjaAktivnost: igraci.zadnjaAktivnost })
      .from(igraci)
      .where(eq(igraci.id, token));
    expect(nakonSvjeze!.zadnjaAktivnost.getTime()).toBe(svjezaAktivnost.getTime());

    const staraAktivnost = new Date(Date.now() - 16 * 60_000);
    await baza.update(igraci).set({ zadnjaAktivnost: staraAktivnost }).where(eq(igraci.id, token));

    const trecaVeza = await spojiSe(token);
    trecaVeza.disconnect();
    const [nakonStare] = await baza
      .select({ zadnjaAktivnost: igraci.zadnjaAktivnost })
      .from(igraci)
      .where(eq(igraci.id, token));
    expect(nakonStare!.zadnjaAktivnost.getTime()).toBeGreaterThan(staraAktivnost.getTime());
  });

  it('paralelni reconnectovi konkurentno sigurno osvježavaju zastarjelu aktivnost', async () => {
    const token = randomUUID();
    const pocetnaVeza = await spojiSe(token);
    pocetnaVeza.disconnect();
    const staraAktivnost = new Date(Date.now() - 16 * 60_000);
    await baza.update(igraci).set({ zadnjaAktivnost: staraAktivnost }).where(eq(igraci.id, token));

    const veze = await Promise.all([spojiSe(token), spojiSe(token)]);
    await cekajBrojAktivnihVeza(veze, 1);
    const [nakonReconnecta] = await baza
      .select({ zadnjaAktivnost: igraci.zadnjaAktivnost })
      .from(igraci)
      .where(eq(igraci.id, token));

    expect(nakonReconnecta!.zadnjaAktivnost.getTime()).toBeGreaterThan(staraAktivnost.getTime());
    expect(veze.filter((veza) => veza.connected)).toHaveLength(1);
    for (const veza of veze) veza.disconnect();
  });
});
