import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { KrajPartije, PocetakPartije, StanjePrivatneSobe } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { sesije } from '../src/baza/shema.js';
import { dodijeliRezultatSobeAkoNijeObraden } from '../src/soba/servis-soba.js';

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

interface TestniIgrac {
  token: string;
  authToken: string;
  socket: ClientSocket;
}

async function igracIdZaToken(token: string): Promise<string> {
  const hash = createHash('sha256').update(token).digest('hex');
  const [sesija] = await baza.select({ igracId: sesije.igracId }).from(sesije).where(eq(sesije.tokenHash, hash));
  if (!sesija) throw new Error('Guest sesija nije pronađena');
  return sesija.igracId;
}

function spojiIgraca(token = `gost.${randomUUID().replaceAll('-', '')}`): Promise<TestniIgrac> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.once('connect', async () => resolve({ token: await igracIdZaToken(token), authToken: token, socket }));
    socket.once('connect_error', reject);
  });
}

function cekajDogadaj<T>(socket: ClientSocket, dogadaj: string): Promise<T> {
  return new Promise((resolve) => socket.once(dogadaj, resolve));
}

async function stvoriSobu(socket: ClientSocket, postavke: Record<string, unknown> = {}): Promise<{ kod: string; stanje: StanjePrivatneSobe }> {
  const stvorena = cekajDogadaj<{ kod: string }>(socket, 'soba:stvorena');
  const stanje = cekajDogadaj<StanjePrivatneSobe>(socket, 'soba:stanje');
  socket.emit('soba:stvori', { postavke });
  const [{ kod }, pocetnoStanje] = await Promise.all([stvorena, stanje]);
  return { kod, stanje: pocetnoStanje };
}

async function udjiUSobu(igrac: TestniIgrac, kod: string): Promise<StanjePrivatneSobe> {
  const stanje = cekajDogadaj<StanjePrivatneSobe>(igrac.socket, 'soba:stanje');
  igrac.socket.emit('soba:udji', { kod });
  return stanje;
}

function cekajRunduIliKraj(
  igraci: readonly TestniIgrac[],
): Promise<{ vrsta: 'runda' | 'kraj'; runda?: { naPotezuId: string }; kraj?: KrajPartije }> {
  return new Promise((resolve) => {
    const odjave: (() => void)[] = [];
    for (const igrac of igraci) {
      const naRundu = (runda: { naPotezuId: string }) => {
        ocisti();
        resolve({ vrsta: 'runda', runda });
      };
      const naKraj = (kraj: KrajPartije) => {
        ocisti();
        resolve({ vrsta: 'kraj', kraj });
      };
      igrac.socket.once('partija:runda-otvorena', naRundu);
      igrac.socket.once('partija:kraj', naKraj);
      odjave.push(() => {
        igrac.socket.off('partija:runda-otvorena', naRundu);
        igrac.socket.off('partija:kraj', naKraj);
      });
    }
    function ocisti() {
      for (const odjava of odjave) odjava();
    }
  });
}

describe('privatne sobe', () => {
  it('isti završetak privatne partije dodjeljuje pobjedu i bodove samo jednom', () => {
    const soba = {
      obradenePartije: new Set<string>(),
      pobjedeUSeriji: new Map<string, number>(),
      bodoviUSeriji: new Map<string, number>(),
    };
    const rezultati = [
      { igracId: 'igrac-a', bodovi: 2 },
      { igracId: 'igrac-b', bodovi: 0 },
    ];

    dodijeliRezultatSobeAkoNijeObraden(soba, 'partija-1', 'igrac-a', rezultati);
    dodijeliRezultatSobeAkoNijeObraden(soba, 'partija-1', 'igrac-a', rezultati);

    expect(soba.pobjedeUSeriji.get('igrac-a')).toBe(1);
    expect(soba.bodoviUSeriji.get('igrac-a')).toBe(2);
    expect(soba.bodoviUSeriji.get('igrac-b')).toBe(0);

    dodijeliRezultatSobeAkoNijeObraden(soba, 'partija-2', 'igrac-b', rezultati);

    expect(soba.pobjedeUSeriji.get('igrac-b')).toBe(1);
    expect(soba.bodoviUSeriji.get('igrac-a')).toBe(4);
    expect(soba.bodoviUSeriji.get('igrac-b')).toBe(0);
  });

  it('kontrolirano odbija neispravne Socket.IO payloadove bez rušenja procesa', async () => {
    const vlasnik = await spojiIgraca();

    try {
      const greskaPostavki = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      vlasnik.socket.emit('soba:stvori', { postavke: { dopusteneVrste: 'imenica' } });
      expect(await greskaPostavki).toEqual(expect.objectContaining({ kod: 'NEVALJAN_PAYLOAD' }));

      const greskaKoda = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      vlasnik.socket.emit('soba:udji', { kod: 123456 });
      expect(await greskaKoda).toEqual(expect.objectContaining({ kod: 'NEVALJAN_PAYLOAD' }));

      const zdravo = await fetch(`${adresa}/zdravlje`);
      expect(zdravo.ok).toBe(true);
    } finally {
      vlasnik.socket.disconnect();
    }
  });

  it('autoritativno dodaje imenice u postavke privatne sobe', async () => {
    const vlasnik = await spojiIgraca();

    try {
      const { stanje } = await stvoriSobu(vlasnik.socket, {
        trajanjePotezaSek: 30,
        dopusteneVrste: ['glagol'],
        eliminacijskiBodovi: false,
      });

      expect(stanje.postavke.dopusteneVrste).toEqual(['imenica', 'glagol']);
    } finally {
      vlasnik.socket.disconnect();
    }
  });

  it('za prazne postavke zadržava sve vrste riječi', async () => {
    const vlasnik = await spojiIgraca();

    try {
      const { stanje } = await stvoriSobu(vlasnik.socket);
      expect(stanje.postavke.dopusteneVrste).toEqual([
        'imenica',
        'glagol',
        'pridjev',
        'prilog',
        'zamjenica',
        'broj',
        'prijedlog',
        'veznik',
        'cestica',
        'uzvik',
      ]);
    } finally {
      vlasnik.socket.disconnect();
    }
  });

  it('odbija nepostojeći kod i ulazak u punu sobu', async () => {
    const izvanSobe = await spojiIgraca();
    const igraci = [await spojiIgraca(), ...await Promise.all(Array.from({ length: 7 }, () => spojiIgraca()))];

    try {
      const greskaKoda = cekajDogadaj<{ kod: string }>(izvanSobe.socket, 'greska');
      izvanSobe.socket.emit('soba:udji', { kod: 'NEPOST' });
      expect((await greskaKoda).kod).toBe('SOBA_NE_POSTOJI');

      const { kod } = await stvoriSobu(igraci[0]!.socket);
      for (const igrac of igraci.slice(1)) {
        const stanje = await udjiUSobu(igrac, kod);
        expect(stanje.clanovi.length).toBeGreaterThanOrEqual(2);
      }

      const deveti = await spojiIgraca();
      try {
        const greskaPuneSobe = cekajDogadaj<{ kod: string }>(deveti.socket, 'greska');
        deveti.socket.emit('soba:udji', { kod });
        expect((await greskaPuneSobe).kod).toBe('SOBA_PUNA');
      } finally {
        deveti.socket.disconnect();
      }
    } finally {
      izvanSobe.socket.disconnect();
      for (const igrac of igraci) igrac.socket.disconnect();
    }
  }, 20_000);

  it('zatvara sobu i obavještava članove nakon izlaska vlasnika', async () => {
    const vlasnik = await spojiIgraca();
    const drugi = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      const stanje = await udjiUSobu(drugi, kod);
      expect(stanje.vlasnikId).toBe(vlasnik.token);

      const vlasnikNapustio = cekajDogadaj<{ kod: string }>(drugi.socket, 'soba:vlasnik-napustio');
      vlasnik.socket.emit('soba:izadji');
      expect(await vlasnikNapustio).toEqual({ kod });
    } finally {
      vlasnik.socket.disconnect();
      drugi.socket.disconnect();
    }
  });

  it('zatvara sobu i obavještava članove nakon prekida veze vlasnika', async () => {
    const vlasnik = await spojiIgraca();
    const drugi = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(drugi, kod);
      const vlasnikNapustio = cekajDogadaj<{ kod: string }>(drugi.socket, 'soba:vlasnik-napustio');
      vlasnik.socket.disconnect();
      expect(await vlasnikNapustio).toEqual({ kod });
    } finally {
      drugi.socket.disconnect();
    }
  });

  it('samo vlasnik može pokrenuti sobu, a premalo igrača se odbija', async () => {
    const vlasnik = await spojiIgraca();
    const drugi = await spojiIgraca();

    try {
      const greskaVlasnika = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      await stvoriSobu(vlasnik.socket);
      vlasnik.socket.emit('soba:pokreni');
      expect((await greskaVlasnika).kod).toBe('NEDOVOLJNO_IGRACA');

      const drugaSoba = await stvoriSobu(drugi.socket);
      await udjiUSobu(vlasnik, drugaSoba.kod);
      const greskaDrugog = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      vlasnik.socket.emit('soba:pokreni');
      expect((await greskaDrugog).kod).toBe('NISI_VLASNIK');
    } finally {
      vlasnik.socket.disconnect();
      drugi.socket.disconnect();
    }
  });

  it('odbija ulazak u sobu nakon pokretanja partije', async () => {
    const vlasnik = await spojiIgraca();
    const drugi = await spojiIgraca();
    const treci = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(drugi, kod);
      const pocetak = cekajDogadaj<PocetakPartije>(vlasnik.socket, 'partija:pocetak');
      vlasnik.socket.emit('soba:pokreni');
      await pocetak;

      const greska = cekajDogadaj<{ kod: string }>(treci.socket, 'greska');
      treci.socket.emit('soba:udji', { kod });
      expect((await greska).kod).toBe('SOBA_U_TIJEKU');
    } finally {
      vlasnik.socket.emit('partija:izadji');
      drugi.socket.emit('partija:izadji');
      vlasnik.socket.disconnect();
      drugi.socket.disconnect();
      treci.socket.disconnect();
    }
  });

  it('reconnect istog člana vraća ga u privatnu sobu bez duplikata', async () => {
    const vlasnik = await spojiIgraca();
    const clan = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(clan, kod);
      clan.socket.disconnect();

      const novaVeza = await spojiIgraca(clan.authToken);
      try {
        const stanje = await udjiUSobu(novaVeza, kod);
        expect(stanje.clanovi.filter((sudionik) => sudionik.igracId === clan.token)).toHaveLength(1);
        expect(stanje.clanovi).toHaveLength(2);
      } finally {
        novaVeza.socket.disconnect();
      }
    } finally {
      vlasnik.socket.disconnect();
    }
  });

  it('stvara sobu, prima igrača i pokreće privatnu partiju s postavkama', async () => {
    const vlasnik = await spojiIgraca();
    const gost = await spojiIgraca();
    const postavke = {
      trajanjePotezaSek: 15,
      dopusteneVrste: ['imenica'],
      eliminacijskiBodovi: true,
    };

    try {
      const { kod, stanje: pocetnoStanje } = await stvoriSobu(vlasnik.socket, postavke);
      expect(pocetnoStanje.kod).toBe(kod);
      expect(pocetnoStanje.status).toBe('cekanje');
      expect(pocetnoStanje.postavke).toEqual(postavke);

      const stanjeNakonUlaska = cekajDogadaj<StanjePrivatneSobe>(vlasnik.socket, 'soba:stanje');
      gost.socket.emit('soba:udji', { kod });
      const stanje = await stanjeNakonUlaska;
      expect(stanje.clanovi).toHaveLength(2);
      expect(stanje.clanovi.map((clan) => clan.igracId)).toContain(gost.token);

      const pocetakVlasnik = cekajDogadaj<PocetakPartije>(vlasnik.socket, 'partija:pocetak');
      const pocetakGost = cekajDogadaj<PocetakPartije>(gost.socket, 'partija:pocetak');
      vlasnik.socket.emit('soba:pokreni');
      const [pocetak, pocetakDrugog] = await Promise.all([pocetakVlasnik, pocetakGost]);
      expect(pocetak.jePrivatna).toBe(true);
      expect(pocetak.kodSobe).toBe(kod);
      expect(pocetakDrugog.partijaId).toBe(pocetak.partijaId);

      const krajVlasnik = cekajDogadaj<KrajPartije>(vlasnik.socket, 'partija:kraj');
      const krajGost = cekajDogadaj<KrajPartije>(gost.socket, 'partija:kraj');
      let rezultat = await cekajRunduIliKraj([vlasnik, gost]);
      for (let i = 0; i < 8 && rezultat.vrsta !== 'kraj'; i += 1) {
        const naPotezuId = rezultat.runda!.naPotezuId;
        const naPotezu = naPotezuId === vlasnik.token ? vlasnik : gost;
        const sljedeci = cekajRunduIliKraj([vlasnik, gost]);
        naPotezu.socket.emit('potez:ne-znam');
        rezultat = await sljedeci;
      }

      const [kraj, krajDrugog] = await Promise.all([krajVlasnik, krajGost]);
      expect(kraj.jePrivatna).toBe(true);
      expect(kraj.kodSobe).toBe(kod);
      expect(kraj.mojeIskustvo).toBeNull();
      expect(kraj.novaDostignuca).toEqual([]);
      expect(krajDrugog.partijaId).toBe(kraj.partijaId);

      const stanjeNakonKraja = cekajDogadaj<StanjePrivatneSobe>(vlasnik.socket, 'soba:stanje');
      vlasnik.socket.emit('soba:stanje');
      const sobaNakonKraja = await stanjeNakonKraja;
      expect(sobaNakonKraja.status).toBe('cekanje');
      expect(sobaNakonKraja.partijaId).toBeNull();
      expect(sobaNakonKraja.clanovi).toHaveLength(2);

      const drugiPocetakVlasnik = cekajDogadaj<PocetakPartije>(vlasnik.socket, 'partija:pocetak');
      const drugiPocetakGost = cekajDogadaj<PocetakPartije>(gost.socket, 'partija:pocetak');
      vlasnik.socket.emit('soba:pokreni');
      const [drugiPocetak, drugiPocetakDrugog] = await Promise.all([drugiPocetakVlasnik, drugiPocetakGost]);
      expect(drugiPocetak.jePrivatna).toBe(true);
      expect(drugiPocetak.partijaId).not.toBe(pocetak.partijaId);
      expect(drugiPocetakDrugog.partijaId).toBe(drugiPocetak.partijaId);
    } finally {
      vlasnik.socket.disconnect();
      gost.socket.disconnect();
    }
  }, 20_000);

});
