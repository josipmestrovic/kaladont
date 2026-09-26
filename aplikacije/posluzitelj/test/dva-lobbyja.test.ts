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
import { izgradiPosluzitelj, type KaladontIo } from '../src/server.js';

let app: FastifyInstance;
let io: KaladontIo;
let adresa: string;
let zaustavi: () => Promise<void>;

beforeAll(async () => {
  ({ app, io, zaustavi } = await izgradiPosluzitelj({ postavkeMotora: { zadrzavanjeSobeNakonKrajaMs: 50 } }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await zaustavi();
});

function spojiSe(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token: `gost.${randomUUID().replaceAll('-', '')}` }, forceNew: true });
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
    const prvaRundaPromise = new Promise<string>((resolve) => {
      klijenti[0]!.once('partija:runda-otvorena', (runda: RundaOtvorena) => resolve(runda.naPotezuId));
    });
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

    let naPotezuId = await prvaRundaPromise;
    const posaljiNeZnam = () => {
      const naPotezu = klijenti.find((k) => igracIdPoKlijentu.get(k) === naPotezuId);
      naPotezu?.emit('potez:ne-znam');
    };
    klijenti[0]!.on('partija:runda-otvorena', (runda: RundaOtvorena) => {
      naPotezuId = runda.naPotezuId;
      setTimeout(posaljiNeZnam, 30);
    });
    setTimeout(posaljiNeZnam, 30);

    const prviKraj = await krajPromise;
    expect(prviKraj.partijaId).toBe(prviPocetci[0]!.partijaId);

    // 2. partija: svi se vraćaju u red; ponovi zahtjev dok se završno spremanje prve partije ne obradi.
    const drugiPocetciPromise = cekajPocetke(klijenti);
    const ponovnoSlanje = setInterval(() => {
      for (const klijent of klijenti) klijent.emit('red:udji');
    }, 500);
    for (const klijent of klijenti) klijent.emit('red:udji');

    const drugiPocetci = await Promise.race([
      drugiPocetciPromise.finally(() => clearInterval(ponovnoSlanje)),
      new Promise<null>((resolve) => setTimeout(() => {
        clearInterval(ponovnoSlanje);
        resolve(null);
      }, 5000)),
    ]);

    expect(drugiPocetci, 'drugi partija:pocetak nije stigao u 5 s').not.toBeNull();
    const idoviDruge = new Set(drugiPocetci!.map((p) => p.partijaId));
    expect(idoviDruge.size).toBe(1);
    expect(idoviDruge.has(prviPocetci[0]!.partijaId)).toBe(false);
    expect(Number.isNaN(new Date(drugiPocetci![0]!.pocetakIso).getTime())).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));
    const staraSoba = io.sockets.adapter.rooms.get(`partija:${prviPocetci[0]!.partijaId}`);
    expect(staraSoba).toBeUndefined();
    for (const klijent of klijenti) {
      const serverskiSocket = io.sockets.sockets.get(klijent.id!);
      expect([...serverskiSocket?.rooms ?? []].filter((soba) => soba.startsWith('partija:'))).not.toContain(`partija:${prviPocetci[0]!.partijaId}`);
    }

    for (const klijent of klijenti) klijent.disconnect();
  }, 30000);
});
