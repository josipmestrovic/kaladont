/**
 * Reprodukcija buga: odbrojavanje u čekaonici radi samo za prvu partiju.
 * Ista 4 igrača odigraju partiju do kraja (svi "ne znam"), vrate se u red
 * i očekuju drugi partija:pocetak s valjanim pocetakIso.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import type { KrajPartije, PocetakPartije, RundaOtvorena } from 'zajednicko';
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

function cekajPocetke(klijenti: ClientSocket[]): Promise<PocetakPartije[]> {
  return Promise.all(
    klijenti.map(
      (klijent) =>
        new Promise<PocetakPartije>((resolve) => {
          klijent.once('partija:pocetak', resolve);
        }),
    ),
  );
}

describe('dva lobbyja zaredom s istim igračima', () => {
  it('drugi partija:pocetak stiže svima s valjanim pocetakIso', async () => {
    const klijenti = await Promise.all([spojiSe(), spojiSe(), spojiSe(), spojiSe()]);

    // 1. partija
    const prviPocetciPromise = cekajPocetke(klijenti);
    for (const klijent of klijenti) klijent.emit('red:udji');
    const prviPocetci = await prviPocetciPromise;
    expect(new Set(prviPocetci.map((p) => p.partijaId)).size).toBe(1);
    expect(Number.isNaN(new Date(prviPocetci[0]!.pocetakIso).getTime())).toBe(false);

    // odigraj do kraja: tko je na potezu kaže "ne znam" dok partija ne završi
    const krajPromise = new Promise<KrajPartije>((resolve) => {
      klijenti[0]!.once('partija:kraj', resolve);
    });
    const igracIdPoKlijentu = new Map<ClientSocket, string>();
    klijenti.forEach((klijent, i) => igracIdPoKlijentu.set(klijent, prviPocetci[i]!.mojIgracId));

    let naPotezuId = await new Promise<string>((resolve) => {
      klijenti[0]!.once('partija:runda-otvorena', (runda: RundaOtvorena) => resolve(runda.naPotezuId));
    });
    const posaljiNeZnam = () => {
      const naPotezu = klijenti.find((k) => igracIdPoKlijentu.get(k) === naPotezuId);
      naPotezu?.emit('potez:ne-znam');
    };
    klijenti[0]!.on('partija:runda-otvorena', (runda: RundaOtvorena) => {
      naPotezuId = runda.naPotezuId;
      setTimeout(posaljiNeZnam, 30);
    });
    setTimeout(posaljiNeZnam, 30);

    await krajPromise;

    // 2. partija: svi se odmah vraćaju u red ("Igraj opet" unutar prozora zadržavanja sobe)
    const drugiPocetciPromise = cekajPocetke(klijenti);
    for (const klijent of klijenti) klijent.emit('red:udji');

    const drugiPocetci = await Promise.race([
      drugiPocetciPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    expect(drugiPocetci, 'drugi partija:pocetak nije stigao u 3 s').not.toBeNull();
    const idoviDruge = new Set(drugiPocetci!.map((p) => p.partijaId));
    expect(idoviDruge.size).toBe(1);
    expect(idoviDruge.has(prviPocetci[0]!.partijaId)).toBe(false);
    expect(Number.isNaN(new Date(drugiPocetci![0]!.pocetakIso).getTime())).toBe(false);

    for (const klijent of klijenti) klijent.disconnect();
  }, 20000);
});
