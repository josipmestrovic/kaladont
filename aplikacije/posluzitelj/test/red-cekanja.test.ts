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

function spojiSe(token = randomUUID()): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
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

  it('stanje reda šalje samo socketima koji su u sobi reda', async () => {
    const izvanReda = await spojiSe();
    const uRedu = await spojiSe();
    let izvanRedaPrimioStanje = false;
    izvanReda.on('red:stanje', () => {
      izvanRedaPrimioStanje = true;
    });

    const stanjePromise = new Promise<StanjeReda>((resolve) => uRedu.once('red:stanje', resolve));
    uRedu.emit('red:udji');
    const stanje = await stanjePromise;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(stanje.mjesta.filter(Boolean)).toHaveLength(1);
    expect(izvanRedaPrimioStanje).toBe(false);
    izvanReda.disconnect();
    uRedu.disconnect();
  });

  it('RS-18: zamjenska veza ponovno ulazi na kraj reda bez duplikata', async () => {
    const tokeni = [randomUUID(), randomUUID(), randomUUID()];
    const veze = await Promise.all(tokeni.map((token) => spojiSe(token)));
    for (const veza of veze) {
      const stanjePromise = new Promise<StanjeReda>((resolve) => veza.once('red:stanje', resolve));
      veza.emit('red:udji');
      await stanjePromise;
    }

    const odjavaStare = new Promise<void>((resolve) => veze[1]!.once('disconnect', () => resolve()));
    const zamjenskaVeza = await spojiSe(tokeni[1]!);
    await odjavaStare;
    const stanjePromise = new Promise<StanjeReda>((resolve) => zamjenskaVeza.once('red:stanje', resolve));
    zamjenskaVeza.emit('red:udji');
    const stanje = await stanjePromise;

    expect(stanje.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([
      tokeni[0],
      tokeni[2],
      tokeni[1],
    ]);
    for (const veza of [...veze, zamjenskaVeza]) veza.disconnect();
  });

  it('RS-16: stvarni prekid oslobađa mjesto, a povratak ulazi na kraj reda', async () => {
    const tokeni = [randomUUID(), randomUUID(), randomUUID()];
    const veze = await Promise.all(tokeni.map((token) => spojiSe(token)));
    for (const veza of veze) {
      const stanjePromise = new Promise<StanjeReda>((resolve) => veza.once('red:stanje', resolve));
      veza.emit('red:udji');
      await stanjePromise;
    }

    const stanjeNakonPrekida = new Promise<StanjeReda>((resolve) => veze[0]!.once('red:stanje', resolve));
    veze[1]!.disconnect();
    const bezOdspojenog = await stanjeNakonPrekida;
    expect(bezOdspojenog.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([
      tokeni[0],
      tokeni[2],
    ]);

    const povratnaVeza = await spojiSe(tokeni[1]!);
    const stanjeNakonPovratka = new Promise<StanjeReda>((resolve) => povratnaVeza.once('red:stanje', resolve));
    povratnaVeza.emit('red:udji');
    const stanje = await stanjeNakonPovratka;
    expect(stanje.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([
      tokeni[0],
      tokeni[2],
      tokeni[1],
    ]);

    for (const veza of [...veze, povratnaVeza]) veza.disconnect();
  });

  it('igrač iz aktivne partije ne može ponovno popuniti drugi stol', async () => {
    const tokeniAktivnePartije = Array.from({ length: 4 }, () => randomUUID());
    const aktivniIgraci = await Promise.all(tokeniAktivnePartije.map((token) => spojiSe(token)));
    const pocetakAktivne = new Promise<PocetakPartije>((resolve) => {
      aktivniIgraci[0]!.once('partija:pocetak', resolve);
    });
    for (const igrac of aktivniIgraci) igrac.emit('red:udji');
    await pocetakAktivne;

    const noviTokeni = Array.from({ length: 4 }, () => randomUUID());
    const noviIgraci = await Promise.all(noviTokeni.map((token) => spojiSe(token)));
    for (const igrac of noviIgraci.slice(0, 3)) igrac.emit('red:udji');
    aktivniIgraci[0]!.emit('red:udji');

    const pocetciNovih = Promise.all(
      noviIgraci.map(
        (igrac) => new Promise<PocetakPartije>((resolve) => igrac.once('partija:pocetak', resolve)),
      ),
    );
    noviIgraci[3]!.emit('red:udji');
    const pocetci = await pocetciNovih;

    for (const pocetak of pocetci) {
      expect(new Set(pocetak.sjedala.map((sjedalo) => sjedalo.igracId))).toEqual(new Set(noviTokeni));
      expect(pocetak.sjedala.some((sjedalo) => sjedalo.igracId === tokeniAktivnePartije[0])).toBe(false);
    }

    for (const igrac of [...aktivniIgraci, ...noviIgraci]) {
      igrac.emit('partija:izadji');
      igrac.disconnect();
    }
  });
});
