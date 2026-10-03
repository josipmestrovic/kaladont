import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { fork, type ChildProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import {
  AVATAR_ASSET_VERZIJA,
  AVATAR_BOJNE_ULOGE,
  AVATAR_DIJELOVI,
  AVATAR_SHEMA_VERZIJA,
  SVE_VRSTE_RIJECI,
  zadnjaDva,
  type RundaOtvorena,
  type AvatarConfigV1,
  validirajAvatarConfig,
} from 'zajednicko';
import { izgradiPosluzitelj, MAX_SOCKET_PORUKA_BAJTOVA } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { rijeci, sesije } from '../src/baza/shema.js';

let posluzitelj: FastifyInstance;
let zaustavi: () => Promise<void>;
let adresa: string;

beforeAll(async () => {
  ({ app: posluzitelj, zaustavi } = await izgradiPosluzitelj());
  await posluzitelj.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await zaustavi();
});

function spojiSe(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const token = `gost.${randomUUID().replaceAll('-', '')}`;
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function spojiNa(adresaSocketa: string, token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresaSocketa, { auth: { token }, forceNew: true, reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function cekajSocketDogadaj<T>(socket: ClientSocket, dogadaj: string): Promise<T> {
  return new Promise((resolve) => socket.once(dogadaj, resolve));
}

async function igracIdZaToken(token: string): Promise<string> {
  const hash = createHash('sha256').update(token).digest('hex');
  const [sesija] = await baza.select({ igracId: sesije.igracId }).from(sesije).where(eq(sesije.tokenHash, hash));
  if (!sesija) throw new Error('Testna gost sesija nije pronađena.');
  return sesija.igracId;
}

async function pronadjiIgrivuRijec(prefiks: string, pocetnaRijec: string): Promise<string> {
  const [pocetna] = await baza.select({ grupe: rijeci.grupe }).from(rijeci).where(eq(rijeci.rijec, pocetnaRijec)).limit(1);
  const potrosene = new Set(pocetna?.grupe ?? []);
  const kandidati = await baza.select({ rijec: rijeci.rijec, grupe: rijeci.grupe })
    .from(rijeci)
    .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, prefiks)))
    .limit(100);

  for (const kandidat of kandidati) {
    if (kandidat.grupe.some((grupa) => potrosene.has(grupa))) continue;
    const nakonPoteza = new Set([...potrosene, ...kandidat.grupe]);
    const nastavci = await baza.select({ rijec: rijeci.rijec, grupe: rijeci.grupe })
      .from(rijeci)
      .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, zadnjaDva(kandidat.rijec))))
      .limit(30);
    if (nastavci.some((nastavak) => nastavak.rijec !== kandidat.rijec && nastavak.grupe.every((grupa) => !nakonPoteza.has(grupa)))) {
      return kandidat.rijec;
    }
  }
  throw new Error(`Nema valjane riječi s nastavkom za prefiks ${prefiks}.`);
}

function pokreniChildPosluzitelj(): Promise<{ proces: ChildProcess; adresa: string }> {
  const putanjaFixturea = fileURLToPath(new URL('./pomocnici/socket-proces-fixture.ts', import.meta.url));
  const proces = fork(putanjaFixturea, [], {
    cwd: process.cwd(),
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      BAZA_URL: process.env.BAZA_URL ?? 'postgresql://kaladont:kaladont@localhost:5432/kaladont_dev',
      SESIJA_TAJNA: process.env.SESIJA_TAJNA ?? 'socket-proces-test-secret',
      EMAIL_API_KLJUC: '',
      ONEMOGUCI_TIMER_POTEZA: 'true',
      ODGODA_POCETKA_PARTIJE_MS: '0',
    },
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proces.kill();
      reject(new Error('Child Socket.IO poslužitelj nije se pokrenuo na vrijeme.'));
    }, 120_000);
    proces.on('message', (poruka: unknown) => {
      if (typeof poruka !== 'object' || poruka === null || !('vrsta' in poruka)) return;
      if (poruka.vrsta === 'spreman' && 'port' in poruka && typeof poruka.port === 'number') {
        clearTimeout(timeout);
        resolve({ proces, adresa: `http://127.0.0.1:${poruka.port}` });
      } else if (poruka.vrsta === 'greska-pokretanja') {
        clearTimeout(timeout);
        reject(new Error('Child Socket.IO poslužitelj nije se pokrenuo.'));
      }
    });
    proces.once('error', (greska) => {
      clearTimeout(timeout);
      reject(greska);
    });
    proces.once('exit', (kod) => {
      clearTimeout(timeout);
      reject(new Error(`Child Socket.IO poslužitelj završio je prije spremnosti (${kod}).`));
    });
  });
}

async function zaustaviChild(proces: ChildProcess): Promise<void> {
  if (proces.exitCode !== null || proces.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      proces.kill();
      reject(new Error('Child Socket.IO poslužitelj nije se ugasio na vrijeme.'));
    }, 15_000);
    proces.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    if (!proces.connected) {
      clearTimeout(timeout);
      reject(new Error('IPC kanal child poslužitelja je zatvoren prije gašenja.'));
      return;
    }
    proces.send({ vrsta: 'zaustavi' });
  });
}

async function ocekujNevaljanPayload(socket: ClientSocket, posalji: () => void): Promise<void> {
  const greska = new Promise<{ kod: string }>((resolve) => socket.once('greska', resolve));
  posalji();
  expect(await greska).toMatchObject({ kod: 'NEVALJAN_PAYLOAD' });
}

function najduzi(izbori: readonly string[]): string {
  return izbori.reduce((naj, izbor) => izbor.length > naj.length ? izbor : naj, '');
}

function konfiguracijaNajvecegAvatara(): AvatarConfigV1 {
  const parts = Object.fromEntries(
    Object.entries(AVATAR_DIJELOVI).map(([naziv, izbori]) => [naziv, najduzi(izbori)]),
  );
  const colors = Object.fromEntries(AVATAR_BOJNE_ULOGE.map((uloga) => [uloga, '#FFFFFF']));
  return {
    schemaVersion: AVATAR_SHEMA_VERZIJA,
    assetVersion: AVATAR_ASSET_VERZIJA,
    parts,
    colors,
  } as AvatarConfigV1;
}

describe('Socket.IO robusnost', () => {
  it('odbacuje nevaljane argumente svih ulaznih eventa bez prekida veze', async () => {
    const socket = await spojiSe();
    try {
      const nevaljaniPozivi: [string, unknown[]][] = [
        ['red:stanje', [null]],
        ['red:stanje', [{ mod: 'dva_igraca', visak: true }]],
        ['red:stanje', [{}, 'visak']],
        ['red:udji', [null]],
        ['red:udji', [{ mod: 'nepostojeci' }]],
        ['red:izadji', [{}]],
        ['soba:stvori', [null]],
        ['soba:stvori', [{ postavke: {}, visak: true }]],
        ['soba:udji', [[]]],
        ['soba:udji', [{ kod: 'ABC123' }, 'visak']],
        ['soba:izadji', [{}]],
        ['soba:stanje', [{}]],
        ['soba:pokreni', [null]],
        ['partija:stanje', [{}]],
        ['potez:rijec', [null]],
        ['potez:rijec', [{ rijec: 'riječ', dodatno: true }]],
        ['potez:ne-znam', [[]]],
        ['reakcija:posalji', [{ poruka: 'pozdrav', dodatno: true }]],
        ['partija:izadji', [{}]],
        ['igrac:avatar-azuriraj', [{ avatarConfig: {}, avatarRevision: 1 }]],
        ['igrac:avatar-azuriraj', [{ avatarConfig: konfiguracijaNajvecegAvatara(), avatarRevision: 1, visak: true }]],
      ];

      for (const [dogadaj, argumenti] of nevaljaniPozivi) {
        await ocekujNevaljanPayload(socket, () => socket.emit(dogadaj, ...argumenti));
      }

      expect(socket.connected).toBe(true);
      const zdravlje = await fetch(`${adresa}/zdravlje`);
      expect(zdravlje.status).toBe(200);
      expect((await zdravlje.json()).ok).toBe(true);
    } finally {
      socket.disconnect();
    }
  });

  it('valjani avatar, potez i room payloadi ostaju ispod transportne granice', () => {
    const avatarConfig = konfiguracijaNajvecegAvatara();
    expect(validirajAvatarConfig(avatarConfig)).toBe(true);

    const payloadi = [
      { rijec: 'x'.repeat(50), turnToken: 'x'.repeat(64) },
      {
        postavke: {
          trajanjePotezaSek: 60,
          dopusteneVrste: [...SVE_VRSTE_RIJECI],
          eliminacijskiBodovi: true,
        },
      },
      { avatarConfig, avatarRevision: Number.MAX_SAFE_INTEGER },
    ];
    const najveciPayload = Math.max(...payloadi.map((payload) => Buffer.byteLength(JSON.stringify(payload))));

    expect(najveciPayload).toBeLessThan(MAX_SOCKET_PORUKA_BAJTOVA);
  });

  it('transport zatvara samo vezu koja posalje poruku vecu od 16 KiB', async () => {
    const socket = await spojiSe();
    try {
      const prekid = new Promise<string>((resolve) => socket.once('disconnect', resolve));
      socket.emit('potez:rijec', 'x'.repeat(MAX_SOCKET_PORUKA_BAJTOVA));
      expect(await prekid).toBeTruthy();

      const zdravlje = await fetch(`${adresa}/zdravlje`);
      expect(zdravlje.status).toBe(200);
    } finally {
      socket.disconnect();
    }
  });

  it('proces ostaje živ nakon neispravnog ack-a na rate limitu, a druga veza igra', async () => {
    const { proces, adresa: adresaChilda } = await pokreniChildPosluzitelj();
    const tokenPrvog = `gost.${randomUUID().replaceAll('-', '')}`;
    const tokenDrugog = `gost.${randomUUID().replaceAll('-', '')}`;
    let prvi: ClientSocket | undefined;
    let drugi: ClientSocket | undefined;

    try {
      prvi = await spojiNa(adresaChilda, tokenPrvog);
      const igracIdPrvog = await igracIdZaToken(tokenPrvog);
      let brojPozivaAcka = 0;
      const ack = new Promise<unknown>((resolve) => {
        prvi!.emit('red:udji', { mod: 'dva_igraca' }, (stanje: unknown) => {
          brojPozivaAcka += 1;
          resolve(stanje);
        });
      });
      expect(await ack).toBeTruthy();
      expect(brojPozivaAcka).toBe(1);

      const nevaljanAck = cekajSocketDogadaj<{ kod: string }>(prvi, 'greska');
      prvi.emit('red:udji', { mod: 'dva_igraca' }, { nijeFunkcija: true });
      expect(await nevaljanAck).toMatchObject({ kod: 'NEVALJAN_PAYLOAD' });
      expect(proces.exitCode).toBeNull();

      const zdravlje = await fetch(`${adresaChilda}/zdravlje`, { headers: { connection: 'close' } });
      expect(zdravlje.status).toBe(200);
      expect((await zdravlje.json()).ok).toBe(true);

      drugi = await spojiNa(adresaChilda, tokenDrugog);
      const igracIdDrugog = await igracIdZaToken(tokenDrugog);
      const pocetakPrvog = cekajSocketDogadaj<{ partijaId: string }>(prvi, 'partija:pocetak');
      const pocetakDrugog = cekajSocketDogadaj<{ partijaId: string }>(drugi, 'partija:pocetak');
      const rundaPrvog = cekajSocketDogadaj<RundaOtvorena>(prvi, 'partija:runda-otvorena');
      const rundaDrugog = cekajSocketDogadaj<RundaOtvorena>(drugi, 'partija:runda-otvorena');
      drugi.emit('red:udji', { mod: 'dva_igraca' });

      const [, , prvaRunda] = await Promise.all([pocetakPrvog, pocetakDrugog, rundaPrvog]);
      const drugaRunda = await rundaDrugog;
      expect(proces.exitCode).toBeNull();
      expect(prvaRunda.rijec).toBe(drugaRunda.rijec);

      const aktivni = prvaRunda.naPotezuId === igracIdPrvog ? prvi : drugi;
      const aktivniIgracId = aktivni === prvi ? igracIdPrvog : igracIdDrugog;
      const rijec = await pronadjiIgrivuRijec(prvaRunda.trazenaSlova, prvaRunda.rijec);
      const prihvacen = new Promise<{ igracId: string; rijec: string }>((resolve) => {
        const handler = (payload: { igracId: string; rijec: string }) => {
          if (payload.igracId !== aktivniIgracId) return;
          aktivni.off('potez:prihvacen', handler);
          resolve(payload);
        };
        aktivni.on('potez:prihvacen', handler);
      });
      aktivni.emit('potez:rijec', { rijec, turnToken: prvaRunda.turnToken });
      expect(await prihvacen).toMatchObject({ igracId: aktivniIgracId, rijec });

      const stanjePrvog = cekajSocketDogadaj<{ naPotezuId: string }>(prvi, 'partija:stanje');
      const stanjeDrugog = cekajSocketDogadaj<{ naPotezuId: string }>(drugi, 'partija:stanje');
      prvi.emit('partija:stanje');
      drugi.emit('partija:stanje');
      const [novoStanjePrvog, novoStanjeDrugog] = await Promise.all([stanjePrvog, stanjeDrugog]);
      const igracNaPotezu = novoStanjePrvog.naPotezuId === igracIdPrvog ? prvi : drugi;
      expect(novoStanjePrvog.naPotezuId).toBe(novoStanjeDrugog.naPotezuId);

      const krajPrvog = cekajSocketDogadaj(prvi, 'partija:kraj');
      const krajDrugog = cekajSocketDogadaj(drugi, 'partija:kraj');
      igracNaPotezu.emit('potez:ne-znam');
      await Promise.all([krajPrvog, krajDrugog]);

      const zdravljeNakonPoteza = await fetch(`${adresaChilda}/zdravlje`, { headers: { connection: 'close' } });
      expect(zdravljeNakonPoteza.status).toBe(200);
      expect(proces.exitCode).toBeNull();
    } finally {
      prvi?.disconnect();
      drugi?.disconnect();
      await zaustaviChild(proces);
    }
  }, 180_000);
});
