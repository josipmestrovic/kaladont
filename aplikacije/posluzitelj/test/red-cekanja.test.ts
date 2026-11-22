import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { PocetakPartije, StanjeReda } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { sesije } from '../src/baza/shema.js';
import { eq } from 'drizzle-orm';

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

interface Gost {
  token: string;
  igracId: string;
  socket: ClientSocket;
}

async function igracIdZaToken(token: string): Promise<string> {
  const hash = createHash('sha256').update(token).digest('hex');
  const [sesija] = await baza.select({ igracId: sesije.igracId }).from(sesije).where(eq(sesije.tokenHash, hash));
  if (!sesija) throw new Error('Gost sesija nije pronađena');
  return sesija.igracId;
}

function spojiSe(token = `gost.${randomUUID().replaceAll('-', '')}`): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

async function stvoriGoste(broj: number): Promise<Gost[]> {
  const tokeni = Array.from({ length: broj }, () => `gost.${randomUUID().replaceAll('-', '')}`);
  const veze = await Promise.all(tokeni.map((token) => spojiSe(token)));
  return Promise.all(veze.map(async (socket, indeks) => ({ token: tokeni[indeks]!, igracId: await igracIdZaToken(tokeni[indeks]!), socket })));
}

describe('red čekanja', () => {
  it('odbija nefunkcijski ack bez mutacije i veza zatim može ući bez acka', async () => {
    const igrac = await spojiSe();
    try {
      const greskaPromise = new Promise<{ kod: string }>((resolve) => igrac.once('greska', resolve));
      igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' }, { nijeFunkcija: true });
      expect(await greskaPromise).toMatchObject({ kod: 'NEVALJAN_PAYLOAD' });
      expect(igrac.connected).toBe(true);

      const stanjePrijeUlaska = new Promise<StanjeReda>((resolve) => igrac.once('red:stanje', resolve));
      igrac.emit('red:stanje', { mod: 'tri_igraca', pravila: 'klasicni' });
      expect((await stanjePrijeUlaska).mjesta.filter(Boolean)).toHaveLength(0);

      const stanjeNakonUlaska = new Promise<StanjeReda>((resolve) => igrac.once('red:stanje', resolve));
      igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
      expect((await stanjeNakonUlaska).mjesta.filter(Boolean)).toHaveLength(1);
    } finally {
      igrac.disconnect();
    }
  });

  it('igrač u privatnoj sobi ne može ući u javni red', async () => {
    const igrac = await spojiSe();
    try {
      const stvorena = new Promise<{ kod: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Poslužitelj nije odgovorio na soba:stvori.')), 5_000);
        igrac.once('soba:stvorena', (poruka) => {
          clearTimeout(timeout);
          resolve(poruka);
        });
        igrac.once('greska', (poruka) => {
          clearTimeout(timeout);
          reject(new Error(`soba:stvori je odbijen: ${JSON.stringify(poruka)}`));
        });
      });
      igrac.emit('soba:stvori', {});
      await stvorena;

      const potvrda = new Promise<StanjeReda | null>((resolve) => igrac.emit('red:udji', {}, resolve));
      expect(await potvrda).toBeNull();
    } finally {
      igrac.disconnect();
    }
  });

  it('stvaranje privatne sobe uklanja igrača iz javnog reda', async () => {
    const uRedu = await spojiSe();
    const vlasnik = await spojiSe();

    try {
      const stanjePromise = new Promise<StanjeReda>((resolve) => uRedu.once('red:stanje', resolve));
      uRedu.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
      await stanjePromise;

      const stvorena = new Promise<{ kod: string }>((resolve) => vlasnik.once('soba:stvorena', resolve));
      const stanjeNakon = new Promise<StanjeReda>((resolve) => uRedu.once('red:stanje', resolve));
      vlasnik.emit('soba:stvori', {});
      await stvorena;
      expect((await stanjeNakon).mjesta.filter(Boolean)).toHaveLength(1);
    } finally {
      uRedu.disconnect();
      vlasnik.disconnect();
    }
  });

  it('sastavlja stol od 3 igrača i svima šalje partija:pocetak s istim partijaId', async () => {
    const klijenti = await Promise.all([spojiSe(), spojiSe(), spojiSe()]);

    const pocetciPromise = Promise.all(
      klijenti.map(
        (klijent) =>
          new Promise<PocetakPartije>((resolve) => {
            klijent.on('partija:pocetak', resolve);
          }),
      ),
    );

    for (const klijent of klijenti) {
      klijent.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    }

    const pocetci = await pocetciPromise;
    const partijaIdovi = new Set(pocetci.map((p) => p.partijaId));
    expect(partijaIdovi.size).toBe(1);
    expect(pocetci[0]!.sjedala).toHaveLength(3);

    for (const klijent of klijenti) klijent.disconnect();
  });

  it('RS-17: četvrti igrač ostaje u redu za sljedeći stol', async () => {
    const klijenti = await Promise.all([spojiSe(), spojiSe(), spojiSe(), spojiSe()]);

    const cekajPocetak = new Promise<void>((resolve) => {
      klijenti[0]!.on('partija:pocetak', () => resolve());
    });

    // ulazak jedan po jedan uz cekanje potvrde (red:stanje) - osigurava deterministican redoslijed u redu
    for (const klijent of klijenti.slice(0, 3)) {
      const potvrda = new Promise<void>((resolve) => klijent.once('red:stanje', () => resolve()));
      klijent.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
      await potvrda;
    }
    await cekajPocetak;

    const stanjaCetvrtog: StanjeReda[] = [];
    klijenti[3]!.on('red:stanje', (stanje: StanjeReda) => stanjaCetvrtog.push(stanje));

    klijenti[3]!.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // četvrti igrač i dalje čeka - vidio je barem jedno stanje s barem 1 zauzetim mjestom (samog sebe)
    expect(stanjaCetvrtog.length).toBeGreaterThan(0);

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
    uRedu.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    const stanje = await stanjePromise;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(stanje.mjesta.filter(Boolean)).toHaveLength(1);
    expect(izvanRedaPrimioStanje).toBe(false);
    izvanReda.disconnect();
    uRedu.disconnect();
  });

  it('RS-18: zamjenska veza ponovno ulazi na kraj reda bez duplikata', async () => {
    // Troboj puni red pri trećem ulasku — testiramo s dvoje u čekanju.
    const gosti = await stvoriGoste(2);
    const veze = gosti.map((gost) => gost.socket);
    for (const veza of veze) {
      const stanjePromise = new Promise<StanjeReda>((resolve) => veza.once('red:stanje', resolve));
      veza.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
      await stanjePromise;
    }

    const odjavaStare = new Promise<void>((resolve) => veze[1]!.once('disconnect', () => resolve()));
    const zamjenskaVeza = await spojiSe(gosti[1]!.token);
    await odjavaStare;
    const stanjeNakonPrekida = new Promise<StanjeReda>((resolve) => veze[0]!.once('red:stanje', resolve));
    const bezOdspojenog = await stanjeNakonPrekida;
    expect(bezOdspojenog.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([gosti[0]!.igracId]);

    const stanjePromise = new Promise<StanjeReda>((resolve) => zamjenskaVeza.once('red:stanje', resolve));
    zamjenskaVeza.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    const stanje = await stanjePromise;

    expect(stanje.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([
      gosti[0]!.igracId,
      gosti[1]!.igracId,
    ]);
    for (const veza of [...veze, zamjenskaVeza]) veza.disconnect();
  });

  it('RS-16: stvarni prekid oslobađa mjesto, a povratak ulazi na kraj reda', async () => {
    const gosti = await stvoriGoste(2);
    const veze = gosti.map((gost) => gost.socket);
    for (const veza of veze) {
      const stanjePromise = new Promise<StanjeReda>((resolve) => veza.once('red:stanje', resolve));
      veza.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
      await stanjePromise;
    }

    const stanjeNakonPrekida = new Promise<StanjeReda>((resolve) => veze[0]!.once('red:stanje', resolve));
    veze[1]!.disconnect();
    const bezOdspojenog = await stanjeNakonPrekida;
    expect(bezOdspojenog.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([gosti[0]!.igracId]);

    const povratnaVeza = await spojiSe(gosti[1]!.token);
    const stanjeNakonPovratka = new Promise<StanjeReda>((resolve) => povratnaVeza.once('red:stanje', resolve));
    povratnaVeza.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    const stanje = await stanjeNakonPovratka;
    expect(stanje.mjesta.filter(Boolean).map((mjesto) => mjesto!.igracId)).toEqual([
      gosti[0]!.igracId,
      gosti[1]!.igracId,
    ]);

    for (const veza of [...veze, povratnaVeza]) veza.disconnect();
  });

  it('igrač iz aktivne partije ne može ponovno popuniti drugi stol', async () => {
    const aktivniGosti = await stvoriGoste(3);
    const aktivniIgraci = aktivniGosti.map((gost) => gost.socket);
    const pocetakAktivne = new Promise<PocetakPartije>((resolve) => {
      aktivniIgraci[0]!.once('partija:pocetak', resolve);
    });
    for (const igrac of aktivniIgraci) igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    await pocetakAktivne;

    const greskaPrivatneSobe = new Promise<{ kod: string }>((resolve) => aktivniIgraci[0]!.once('greska', resolve));
    aktivniIgraci[0]!.emit('soba:stvori', {});
    expect((await greskaPrivatneSobe).kod).toBe('VEC_U_PARTIJI');

    const noviGosti = await stvoriGoste(3);
    const noviIgraci = noviGosti.map((gost) => gost.socket);
    const pocetciNovih = Promise.all(
      noviIgraci.map(
        (igrac) => new Promise<PocetakPartije>((resolve) => igrac.once('partija:pocetak', resolve)),
      ),
    );
    for (const igrac of noviIgraci) igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    aktivniIgraci[0]!.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' });
    const pocetci = await pocetciNovih;

    for (const pocetak of pocetci) {
      expect(new Set(pocetak.sjedala.map((sjedalo) => sjedalo.igracId))).toEqual(new Set(noviGosti.map((gost) => gost.igracId)));
      expect(pocetak.sjedala.some((sjedalo) => sjedalo.igracId === aktivniGosti[0]!.igracId)).toBe(false);
    }

    for (const igrac of [...aktivniIgraci, ...noviIgraci]) {
      igrac.emit('partija:izadji');
      igrac.disconnect();
    }
  });

  it('prazan ulaz i Brza igra; nevažeći pravilnik se odbija; stari javni red se odbija', async () => {
    const igrac = await spojiSe();
    try {
      const stanje = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', {}, resolve);
      });
      expect(stanje.mod).toBe('tri_igraca');
      expect(stanje.pravila).toBe('klasicni');
      igrac.emit('red:izadji');

      const potvrdaTroboj = await new Promise<StanjeReda | null>((resolve) => {
        igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' }, resolve);
      });
      expect(potvrdaTroboj?.mod).toBe('tri_igraca');
      expect(potvrdaTroboj?.pravila).toBe('klasicni');
      expect(potvrdaTroboj?.mjesta).toHaveLength(3);
      igrac.emit('red:izadji');

      const greskaPravila = new Promise<{ kod: string }>((resolve) => igrac.once('greska', resolve));
      igrac.emit('red:udji', { mod: 'tri_igraca', pravila: 'nepoznato' });
      expect(await greskaPravila).toMatchObject({ kod: 'NEVALJAN_PAYLOAD' });

      const greskaStarog = new Promise<{ kod: string }>((resolve) => igrac.once('greska', resolve));
      const potvrdaStarog = await new Promise<StanjeReda | null>((resolve) => {
        igrac.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve);
      });
      expect(potvrdaStarog).toBeNull();
      expect((await greskaStarog).kod).toBe('JAVNI_RED_NEDOSTUPAN');
    } finally {
      igrac.disconnect();
    }
  });
});
