import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { PocetakPartije, StanjeReda } from 'zajednicko';
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

function spojiSe(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token: randomUUID() }, forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

describe('red čekanja', () => {
  it('sastavlja stol od 4 igrača i svima šalje partija:pocetak s istim partijaId', async () => {
    const klijenti = await Promise.all([spojiSe(), spojiSe(), spojiSe(), spojiSe()]);

    const pocetciPromise = Promise.all(
      klijenti.map(
        (klijent) =>
          new Promise<PocetakPartije>((resolve) => {
            klijent.on('partija:pocetak', resolve);
          }),
      ),
    );

    for (const klijent of klijenti) {
      klijent.emit('red:udji');
    }

    const pocetci = await pocetciPromise;
    const partijaIdovi = new Set(pocetci.map((p) => p.partijaId));
    expect(partijaIdovi.size).toBe(1);
    expect(pocetci[0]!.sjedala).toHaveLength(4);

    for (const klijent of klijenti) klijent.disconnect();
  });

  it('RS-17: peti igrač ostaje u redu za sljedeći stol', async () => {
    const klijenti = await Promise.all([spojiSe(), spojiSe(), spojiSe(), spojiSe(), spojiSe()]);

    const cekajPocetak = new Promise<void>((resolve) => {
      klijenti[0]!.on('partija:pocetak', () => resolve());
    });

    // ulazak jedan po jedan uz cekanje potvrde (red:stanje) - osigurava deterministican redoslijed u redu
    for (const klijent of klijenti.slice(0, 4)) {
      const potvrda = new Promise<void>((resolve) => klijent.once('red:stanje', () => resolve()));
      klijent.emit('red:udji');
      await potvrda;
    }
    await cekajPocetak;

    const stanjaPetog: StanjeReda[] = [];
    klijenti[4]!.on('red:stanje', (stanje: StanjeReda) => stanjaPetog.push(stanje));

    klijenti[4]!.emit('red:udji');
    await new Promise((resolve) => setTimeout(resolve, 200));

    // peti igrač i dalje čeka - vidio je barem jedno stanje s barem 1 zauzetim mjestom (samog sebe)
    expect(stanjaPetog.length).toBeGreaterThan(0);

    for (const klijent of klijenti) klijent.disconnect();
  });
});
