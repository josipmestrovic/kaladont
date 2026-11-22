import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  SVE_VRSTE_RIJECI,
  type DokazZatrazen,
  type KrajPartije,
  type PocetakPartije,
  type PrihvacenPotez,
  type PravilnikPartije,
  type RundaOtvorena,
  type StanjePrivatneSobe,
} from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, rijeci, sesije } from '../src/baza/shema.js';
import { dodijeliRezultatSobeAkoNijeObraden } from '../src/soba/servis-soba.js';
import { izradiGrupuBotova, SimulatorMijesanihBotova } from '../src/cli/opterecenje-mijesani-botovi.js';
import type { SnimkaRjecnika } from '../src/cli/opterecenje-rjecnik.js';
import { izdajSesiju } from '../src/racuni/sesije.js';
import { PRIHVAT_UVJETA_ZA_TEST } from './pomocnici/uvjeti.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  // Datoteka otvara desetke gostiju s iste IP adrese; produkcijski limit handshakea nije predmet ovih testova.
  ({ app } = await izgradiPosluzitelj({ socketOgranicenja: { handshakePoIpMinuti: 1_000, dogadajiPoProzoru: 1_000 } }));
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

  it('PR04: eliminacijskiBodovi mijenja samo privremeni poredak sobe', () => {
    // Ista privatna formula kao motor: pobjednik 2 + (elimBodovi ? eliminacije : 0).
    const plasmaniSElim = [
      { igracId: 'napadac', bodovi: 2 + 1 },
      { igracId: 'zrtva', bodovi: 0 },
    ];
    const plasmaniBezElim = [
      { igracId: 'napadac', bodovi: 2 },
      { igracId: 'zrtva', bodovi: 0 },
    ];
    const sobaS = {
      obradenePartije: new Set<string>(),
      pobjedeUSeriji: new Map<string, number>(),
      bodoviUSeriji: new Map<string, number>(),
    };
    const sobaBez = {
      obradenePartije: new Set<string>(),
      pobjedeUSeriji: new Map<string, number>(),
      bodoviUSeriji: new Map<string, number>(),
    };
    dodijeliRezultatSobeAkoNijeObraden(sobaS, 'p-elim', 'napadac', plasmaniSElim);
    dodijeliRezultatSobeAkoNijeObraden(sobaBez, 'p-bez', 'napadac', plasmaniBezElim);
    expect(sobaS.bodoviUSeriji.get('napadac')).toBe(3);
    expect(sobaBez.bodoviUSeriji.get('napadac')).toBe(2);
    expect(sobaS.pobjedeUSeriji.get('napadac')).toBe(1);
    expect(sobaBez.pobjedeUSeriji.get('napadac')).toBe(1);
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
      expect(stanje.postavke.dopusteneVrste).toEqual(SVE_VRSTE_RIJECI);
      expect(stanje.postavke.pravila).toBe('ka_zna');
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

  it('vlasnik izbacuje člana koji više ne može ući na isti link', async () => {
    const vlasnik = await spojiIgraca();
    const clan = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(clan, kod);

      const izbacen = cekajDogadaj<{ kod: string }>(clan.socket, 'soba:izbacen');
      const stanjeNakonKicka = cekajDogadaj<StanjePrivatneSobe>(vlasnik.socket, 'soba:stanje');
      vlasnik.socket.emit('soba:izbaci', { igracId: clan.token });

      expect(await izbacen).toEqual({ kod });
      const stanje = await stanjeNakonKicka;
      expect(stanje.clanovi.map((sudionik) => sudionik.igracId)).not.toContain(clan.token);
      expect(stanje.clanovi).toHaveLength(1);

      const greska = cekajDogadaj<{ kod: string; poruka: string }>(clan.socket, 'greska');
      clan.socket.emit('soba:udji', { kod });
      expect(await greska).toEqual(expect.objectContaining({ kod: 'IZBACEN_IZ_SOBE' }));
    } finally {
      vlasnik.socket.disconnect();
      clan.socket.disconnect();
    }
  });

  it('ne-vlasnik ne može izbaciti, a vlasnik ne može izbaciti sebe', async () => {
    const vlasnik = await spojiIgraca();
    const clan = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(clan, kod);

      const greskaClana = cekajDogadaj<{ kod: string }>(clan.socket, 'greska');
      clan.socket.emit('soba:izbaci', { igracId: vlasnik.token });
      expect((await greskaClana).kod).toBe('NISI_VLASNIK');

      const greskaSebe = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      vlasnik.socket.emit('soba:izbaci', { igracId: vlasnik.token });
      expect((await greskaSebe).kod).toBe('NEVALJAN_PAYLOAD');
    } finally {
      vlasnik.socket.disconnect();
      clan.socket.disconnect();
    }
  });

  it('odbija izbacivanje dok je partija u tijeku', async () => {
    const vlasnik = await spojiIgraca();
    const drugi = await spojiIgraca();

    try {
      const { kod } = await stvoriSobu(vlasnik.socket);
      await udjiUSobu(drugi, kod);
      const pocetak = cekajDogadaj<PocetakPartije>(vlasnik.socket, 'partija:pocetak');
      vlasnik.socket.emit('soba:pokreni');
      await pocetak;

      const greska = cekajDogadaj<{ kod: string }>(vlasnik.socket, 'greska');
      vlasnik.socket.emit('soba:izbaci', { igracId: drugi.token });
      expect((await greska).kod).toBe('SOBA_U_TIJEKU');
    } finally {
      vlasnik.socket.emit('partija:izadji');
      drugi.socket.emit('partija:izadji');
      vlasnik.socket.disconnect();
      drugi.socket.disconnect();
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
      expect(pocetnoStanje.postavke).toEqual({ ...postavke, pravila: 'ka_zna' });

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

  // PR08 — pravilnik u sobi, stolovi 2/3/8, timer=0 dokaz, gost+registrirani.
  it('PR08 stvara sobu s eksplicitnim pravilnikom i gost/reg čitaju zaključano stanje', async () => {
    const vlasnik = await spojiIgraca();
    const gost = await spojiIgraca();
    const regId = randomUUID();
    await baza.insert(igraci).values({
      id: regId,
      vrsta: 'registriran',
      nadimak: `Rg${regId.slice(0, 6)}`,
      email: `soba-reg-${regId}@example.com`,
      emailPotvrdjen: true,
      ...PRIHVAT_UVJETA_ZA_TEST,
    });
    const sesija = await izdajSesiju(regId);
    const registriran = await spojiIgraca(sesija.token);

    try {
      const { kod, stanje } = await stvoriSobu(vlasnik.socket, {
        trajanjePotezaSek: 30,
        eliminacijskiBodovi: false,
        pravila: 'klasicni',
      });
      expect(stanje.postavke.pravila).toBe('klasicni');

      const stanjeGost = await udjiUSobu(gost, kod);
      expect(stanjeGost.postavke.pravila).toBe('klasicni');
      const stanjeReg = await udjiUSobu(registriran, kod);
      expect(stanjeReg.postavke.pravila).toBe('klasicni');
      expect(stanjeReg.clanovi).toHaveLength(3);
    } finally {
      vlasnik.socket.disconnect();
      gost.socket.disconnect();
      registriran.socket.disconnect();
      await baza.delete(igraci).where(eq(igraci.id, regId));
    }
  }, 20_000);

  it('PR08 pokreće partiju s 2 i 3 igrača uz različite pravilnike; revanš čuva pravila', async () => {
    async function pokreniIProvjeri(brojClanova: number, pravila: PravilnikPartije): Promise<TestniIgrac[]> {
      const igraciSobe = await Promise.all(Array.from({ length: brojClanova }, () => spojiIgraca()));
      const { kod, stanje } = await stvoriSobu(igraciSobe[0]!.socket, {
        trajanjePotezaSek: 15,
        eliminacijskiBodovi: true,
        pravila,
      });
      expect(stanje.postavke.pravila).toBe(pravila);
      for (const clan of igraciSobe.slice(1)) {
        expect((await udjiUSobu(clan, kod)).postavke.pravila).toBe(pravila);
      }
      const pocetci = igraciSobe.map((ig) => cekajDogadaj<PocetakPartije>(ig.socket, 'partija:pocetak'));
      igraciSobe[0]!.socket.emit('soba:pokreni');
      const [pocetak] = await Promise.all(pocetci);
      expect(pocetak.jePrivatna).toBe(true);
      expect(pocetak.pravila).toBe(pravila);
      expect(pocetak.sjedala).toHaveLength(brojClanova);
      return igraciSobe;
    }

    // 2 igrača + klasicni: odigraj do kraja i revanš s istim pravilima.
    const dva = await pokreniIProvjeri(2, 'klasicni');
    try {
      const krajPromise = cekajDogadaj<KrajPartije>(dva[0]!.socket, 'partija:kraj');
      let rezultat = await cekajRunduIliKraj(dva);
      for (let i = 0; i < 8 && rezultat.vrsta !== 'kraj'; i += 1) {
        const naPotezu = dva.find((ig) => ig.token === rezultat.runda!.naPotezuId)!;
        const sljedeci = cekajRunduIliKraj(dva);
        naPotezu.socket.emit('potez:ne-znam');
        rezultat = await sljedeci;
      }
      await krajPromise;

      const lobbyP = cekajDogadaj<StanjePrivatneSobe>(dva[0]!.socket, 'soba:stanje');
      dva[0]!.socket.emit('soba:stanje');
      const lobby = await lobbyP;
      expect(lobby.status).toBe('cekanje');
      expect(lobby.postavke.pravila).toBe('klasicni');

      const revanš = cekajDogadaj<PocetakPartije>(dva[0]!.socket, 'partija:pocetak');
      dva[0]!.socket.emit('soba:pokreni');
      expect((await revanš).pravila).toBe('klasicni');
    } finally {
      for (const ig of dva) ig.socket.disconnect();
    }

    // 3 igrača + dokazi: samo pokretanje i pravilnik (puna igra pokrivena drugdje).
    const tri = await pokreniIProvjeri(3, 'dokazi_nastavak');
    for (const ig of tri) ig.socket.disconnect();
  }, 40_000);

  it('PR08 lobby prima do 8 igrača i pokreće partiju s pravilnikom', async () => {
    const igraciSobe = await Promise.all(Array.from({ length: 8 }, () => spojiIgraca()));
    try {
      const { kod, stanje } = await stvoriSobu(igraciSobe[0]!.socket, { pravila: 'ka_zna' });
      expect(stanje.postavke.pravila).toBe('ka_zna');
      for (const clan of igraciSobe.slice(1)) {
        const s = await udjiUSobu(clan, kod);
        expect(s.postavke.pravila).toBe('ka_zna');
      }
      const zadnje = await new Promise<StanjePrivatneSobe>((resolve) => {
        igraciSobe[0]!.socket.once('soba:stanje', resolve);
        igraciSobe[0]!.socket.emit('soba:stanje');
      });
      expect(zadnje.clanovi).toHaveLength(8);

      const pocetak = cekajDogadaj<PocetakPartije>(igraciSobe[0]!.socket, 'partija:pocetak');
      igraciSobe[0]!.socket.emit('soba:pokreni');
      const p = await pocetak;
      expect(p.sjedala).toHaveLength(8);
      expect(p.pravila).toBe('ka_zna');
      igraciSobe[0]!.socket.emit('partija:izadji');
    } finally {
      for (const ig of igraciSobe) ig.socket.disconnect();
    }
  }, 30_000);

  it('PR08 privatno bez timera: dokaz ima prazan istekPotezaIso', async () => {
    const vlasnik = await spojiIgraca();
    const gost = await spojiIgraca();
    try {
      const { kod } = await stvoriSobu(vlasnik.socket, {
        trajanjePotezaSek: 0,
        eliminacijskiBodovi: true,
        pravila: 'dokazi_nastavak',
      });
      await udjiUSobu(gost, kod);

      const pocetakV = cekajDogadaj<PocetakPartije>(vlasnik.socket, 'partija:pocetak');
      const rundaV = cekajDogadaj<RundaOtvorena>(vlasnik.socket, 'partija:runda-otvorena');
      vlasnik.socket.emit('soba:pokreni');
      const pocetak = await pocetakV;
      expect(pocetak.pravila).toBe('dokazi_nastavak');
      const runda = await rundaV;
      expect(runda.istekPotezaIso).toBe('');

      const naPotezu = runda.naPotezuId === vlasnik.token ? vlasnik : gost;
      const drugi = naPotezu.token === vlasnik.token ? gost : vlasnik;

      const [kandidat] = await baza.execute<{ rijec: string }>(sql`
        select kandidat.rijec from rijeci kandidat
        join rijeci pocetna on pocetna.rijec = ${runda.rijec}
        where kandidat.aktivna and kandidat.prva_dva = ${runda.trazenaSlova}
          and kandidat.zadnja_dva <> 'ka'
          and not (kandidat.grupe && pocetna.grupe)
          and exists (
            select 1 from rijeci nastavak
            where nastavak.aktivna and nastavak.prva_dva = kandidat.zadnja_dva
              and not (nastavak.grupe && (pocetna.grupe || kandidat.grupe))
          )
        order by kandidat.rijec limit 1
      `);
      expect(kandidat?.rijec).toBeTruthy();

      const prihvacen = cekajDogadaj<PrihvacenPotez>(naPotezu.socket, 'potez:prihvacen');
      const dokazPromise = cekajDogadaj<DokazZatrazen>(naPotezu.socket, 'dokaz:zatrazen');
      naPotezu.socket.emit('potez:rijec', { rijec: kandidat!.rijec, turnToken: runda.turnToken });
      const potez = await prihvacen;
      expect(potez.istekPotezaIso).toBe('');
      drugi.socket.emit('potez:ne-znam', { turnToken: potez.turnToken });
      const dokaz = await dokazPromise;
      expect(dokaz.autorId).toBe(naPotezu.token);
      expect(dokaz.cekateljId).toBe(drugi.token);
      expect(dokaz.istekPotezaIso).toBe('');

      naPotezu.socket.emit('potez:ne-znam', { turnToken: dokaz.turnToken });
      await cekajDogadaj<KrajPartije>(vlasnik.socket, 'partija:kraj');
    } finally {
      vlasnik.socket.disconnect();
      gost.socket.disconnect();
    }
  }, 30_000);

  it('bot manager odigra privatni Četveroboj i trening protiv Računala (javni red = Brza igra)', async () => {
    const grupePoRijeci = new Map<string, string[]>();
    const rjecnikTesta: SnimkaRjecnika = {
      brojRijeci: 1,
      sha256: 'test-snimka',
      async nasumicnaRijec(prefiks, potroseneGrupe, pokusaneRijeci) {
        const kandidati = await baza
          .select({ rijec: rijeci.rijec, grupe: rijeci.grupe })
          .from(rijeci)
          .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, prefiks)))
          .limit(100);
        const kandidat = kandidati.find((zapis) =>
          !pokusaneRijeci.has(zapis.rijec) &&
          zapis.grupe.every((grupa) => !potroseneGrupe.has(grupa)),
        );
        if (!kandidat) return null;
        grupePoRijeci.set(kandidat.rijec, kandidat.grupe);
        return kandidat.rijec;
      },
      grupeZaRijec: (rijec) => grupePoRijeci.get(rijec) ?? [],
    };
    const prekid = new AbortController();
    let razlogPrekida = '';
    const simulator = new SimulatorMijesanihBotova({
      adresa,
      timeoutMs: 5_000,
      cekanjePotezaMinMs: 5,
      cekanjePotezaMaksMs: 15,
      maksPotezaPoPartiji: 1,
    }, rjecnikTesta, (razlog) => { razlogPrekida = razlog; prekid.abort(); });

    try {
      // Javni Dvoboj/Četveroboj više nisu dostupni (Brza igra = samo Troboj).
      await Promise.all([
        simulator.pokreniGrupu(izradiGrupuBotova('privatni_cetveroboj'), prekid.signal),
        simulator.pokreniGrupu(izradiGrupuBotova('trening'), prekid.signal),
      ]);

      const rok = Date.now() + 30_000;
      while (
        (simulator.sazetak().zavrsenePoVrsti.privatni_cetveroboj < 2
          || (simulator.sazetak().zavrsenePoVrsti.trening ?? 0) < 2)
        && Date.now() < rok
        && !prekid.signal.aborted
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(prekid.signal.aborted, `${razlogPrekida}; ${JSON.stringify(simulator.sazetak().greske)}`).toBe(false);
      await simulator.dovrsiPartije(5_000, prekid.signal);
      expect(simulator.uzorak().aktivnePartije).toBe(0);
      const sazetak = simulator.sazetak();
      expect(sazetak.zavrsenePartije).toBeGreaterThanOrEqual(2);
      expect(sazetak.zavrsenePoVrsti.privatni_cetveroboj).toBeGreaterThanOrEqual(2);
      expect(sazetak.zavrsenePoVrsti.trening ?? 0).toBeGreaterThanOrEqual(2);
      expect(sazetak.partijeBezSpremanja).toBe(0);
      expect(sazetak.brojPoteza).toBeGreaterThan(0);
      expect(sazetak.odbijeniTreninzi).toBe(0);
      expect(sazetak.istekRacunala).toBe(0);
      expect(sazetak.vanjskiSudioniciJavnih).toBe(0);
      const buduceVrijeme = performance.now() + 60_001;
      const sat = vi.spyOn(performance, 'now').mockReturnValue(buduceVrijeme);
      try {
        expect(simulator.uzorak().aktivnePartije).toBe(0);
        expect(prekid.signal.aborted).toBe(false);
      } finally {
        sat.mockRestore();
      }
    } finally {
      await simulator.zatvori();
    }
  }, 60_000);

});
