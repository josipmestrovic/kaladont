/**
 * PR06: javni redovi (9→8), spojeni Dvoboj, Troboj pragovi, idempotencija ulaska.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { PocetakPartije, StanjeReda } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { partije, sesije, sudioniciPartije } from '../src/baza/shema.js';
import { parsajSpremljenuKonfiguraciju } from '../src/bot/trajne-postavke.js';
import { VERZIJA_BOT_POLITIKE, ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj({
    socketOgranicenja: { handshakePoIpMinuti: 1_000 },
    popunaBotovima: { dvoboj: false, troboj: false, cetveroboj: false },
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

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

describe('PR06 javni redovi', () => {
  it('Klasični + KA-ZNA Dvoboj dijele red i pokreću spojeni stol bez bota', async () => {
    const tokenA = `gost.${randomUUID().replaceAll('-', '')}`;
    const tokenB = `gost.${randomUUID().replaceAll('-', '')}`;
    const a = await spojiSe(tokenA);
    const b = await spojiSe(tokenB);
    const idA = await igracIdZaToken(tokenA);
    const idB = await igracIdZaToken(tokenB);
    try {
      const pocetakA = new Promise<PocetakPartije>((resolve) => a.once('partija:pocetak', resolve));
      const pocetakB = new Promise<PocetakPartije>((resolve) => b.once('partija:pocetak', resolve));

      await new Promise<StanjeReda>((resolve) => a.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve));
      await new Promise<StanjeReda>((resolve) => b.emit('red:udji', { mod: 'dva_igraca', pravila: 'ka_zna' }, resolve));

      const [pa, pb] = await Promise.all([pocetakA, pocetakB]);
      expect(pa.partijaId).toBe(pb.partijaId);
      expect(pa.mod).toBe('dva_igraca');
      expect(pa.pravila).toBe('ka_zna');
      expect(pa.spojeniDvoboj).toBe(true);
      expect(pa.sjedala.every((s) => !s.jeBot)).toBe(true);

      const odabiri = new Map(pa.sjedala.map((s) => [s.igracId, s.odabranaPravila]));
      expect(odabiri.get(idA)).toBe('klasicni');
      expect(odabiri.get(idB)).toBe('ka_zna');

      const [partija] = await baza.select({
        pravila: partije.pravila,
        spojeniDvoboj: partije.spojeniDvoboj,
      }).from(partije).where(eq(partije.id, pa.partijaId));
      expect(partija).toEqual({ pravila: 'ka_zna', spojeniDvoboj: true });

      const sudionici = await baza.select({
        igracId: sudioniciPartije.igracId,
        odabranaPravila: sudioniciPartije.odabranaPravila,
      }).from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, pa.partijaId));
      expect(sudionici).toHaveLength(2);
      expect(new Map(sudionici.map((s) => [s.igracId, s.odabranaPravila])).get(idA)).toBe('klasicni');
    } finally {
      a.emit('partija:izadji');
      b.emit('partija:izadji');
      a.disconnect();
      b.disconnect();
    }
  });

  it('različiti Troboj pravilnici ne dijele red', async () => {
    const a = await spojiSe();
    const b = await spojiSe();
    try {
      const sa = await new Promise<StanjeReda>((resolve) => {
        a.emit('red:udji', { mod: 'tri_igraca', pravila: 'klasicni' }, resolve);
      });
      const sb = await new Promise<StanjeReda>((resolve) => {
        b.emit('red:udji', { mod: 'tri_igraca', pravila: 'ka_zna' }, resolve);
      });
      expect(sa.mjesta.filter(Boolean)).toHaveLength(1);
      expect(sb.mjesta.filter(Boolean)).toHaveLength(1);
      expect(sa.mjesta.find((m) => m)?.igracId).not.toBe(sb.mjesta.find((m) => m)?.igracId);
    } finally {
      a.emit('red:izadji');
      b.emit('red:izadji');
      a.disconnect();
      b.disconnect();
    }
  });

  it('identičan red:udji je no-op; promjena pravilnika u 2-zajednicki je novi ulazak', async () => {
    const igrac = await spojiSe();
    try {
      const prvo = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve);
      });
      const usaoUPrije = prvo.mjesta.find((m) => m)?.igracId;
      expect(usaoUPrije).toBeTruthy();

      const drugo = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve);
      });
      expect(drugo.mjesta.filter(Boolean)).toHaveLength(1);
      expect(drugo.pravila).toBe('klasicni');

      const trece = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', { mod: 'dva_igraca', pravila: 'ka_zna' }, resolve);
      });
      expect(trece.pravila).toBe('ka_zna');
      expect(trece.mjesta.find((m) => m)?.odabranaPravila).toBe('ka_zna');
      expect(trece.mjesta.filter(Boolean)).toHaveLength(1);
    } finally {
      igrac.emit('red:izadji');
      igrac.disconnect();
    }
  });

  it('Dokaz Dvoboj ima zaseban red od spojenog', async () => {
    const a = await spojiSe();
    const b = await spojiSe();
    try {
      await new Promise<StanjeReda>((resolve) => {
        a.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve);
      });
      const sb = await new Promise<StanjeReda>((resolve) => {
        b.emit('red:udji', { mod: 'dva_igraca', pravila: 'dokazi_nastavak' }, resolve);
      });
      expect(sb.mjesta.filter(Boolean)).toHaveLength(1);
      expect(sb.pravila).toBe('dokazi_nastavak');
    } finally {
      a.emit('red:izadji');
      b.emit('red:izadji');
      a.disconnect();
      b.disconnect();
    }
  });

  it('stara bot konfiguracija bez tri_igraca se uspješno parsira', () => {
    const stara = {
      ...ZADANA_KONFIGURACIJA_BOTA,
      verzija: 3,
      botoviTroboj: undefined,
      pragoviPopuneMs: { dva_igraca: [30_000], cetiri_igraca: [20_000, 30_000, 40_000] },
      odstupanjaPopuneMs: { dva_igraca: [4_000], cetiri_igraca: [3_000, 3_000, 3_000] },
    };
    const parsano = parsajSpremljenuKonfiguraciju(stara);
    expect(parsano.verzija).toBe(VERZIJA_BOT_POLITIKE);
    expect(parsano.pragoviPopuneMs.tri_igraca).toEqual([20_000, 30_000]);
    expect(parsano.botoviTroboj).toBe(false);
  });
});
