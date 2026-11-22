/**
 * Javni redovi: Brza igra (3-klasicni) aktivna; ostali ključevi kataloga odbijeni.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { PayloadGreska, PocetakPartije, StanjeReda } from 'zajednicko';
import { BRZA_IGRA, KLJUCEVI_JAVNOG_REDA } from 'zajednicko';
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

const ULZAZ_BRZA = { mod: BRZA_IGRA.mod, pravila: BRZA_IGRA.pravila } as const;

describe('javni redovi — Brza igra', () => {
  it('katalog i dalje ima 8 ključeva; samo Brza igra je aktivna', () => {
    expect(KLJUCEVI_JAVNOG_REDA).toHaveLength(8);
    expect(BRZA_IGRA.kljucReda).toBe('3-klasicni');
  });

  it('tri čovjeka u Brzoj igri pokreću Troboj bez bota', async () => {
    const tokeni = Array.from({ length: 3 }, () => `gost.${randomUUID().replaceAll('-', '')}`);
    const socke = await Promise.all(tokeni.map((t) => spojiSe(t)));
    const idovi = await Promise.all(tokeni.map((t) => igracIdZaToken(t)));
    try {
      const pocetci = socke.map((s) => new Promise<PocetakPartije>((resolve) => s.once('partija:pocetak', resolve)));
      for (const s of socke) {
        await new Promise<StanjeReda | null>((resolve) => s.emit('red:udji', ULZAZ_BRZA, resolve));
      }
      const [pa] = await Promise.all(pocetci);
      expect(pa.mod).toBe('tri_igraca');
      expect(pa.pravila).toBe('klasicni');
      expect(pa.sjedala.every((s) => !s.jeBot)).toBe(true);
      expect(pa.sjedala).toHaveLength(3);
      expect(new Set(pa.sjedala.map((s) => s.igracId))).toEqual(new Set(idovi));

      const [partija] = await baza.select({
        pravila: partije.pravila,
        mod: partije.mod,
      }).from(partije).where(eq(partije.id, pa.partijaId));
      expect(partija).toEqual({ pravila: 'klasicni', mod: 'tri_igraca' });

      const sudionici = await baza.select({ igracId: sudioniciPartije.igracId })
        .from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, pa.partijaId));
      expect(sudionici).toHaveLength(3);
    } finally {
      for (const s of socke) {
        s.emit('partija:izadji');
        s.disconnect();
      }
    }
  });

  it('nedostupan javni red:udji i red:stanje se odbijaju bez premještanja', async () => {
    const socket = await spojiSe();
    try {
      const greskaUdji = new Promise<PayloadGreska>((resolve) => socket.once('greska', resolve));
      const potvrda = await new Promise<StanjeReda | null>((resolve) => {
        socket.emit('red:udji', { mod: 'dva_igraca', pravila: 'klasicni' }, resolve);
      });
      expect(potvrda).toBeNull();
      const g = await greskaUdji;
      expect(g.kod).toBe('JAVNI_RED_NEDOSTUPAN');

      const greskaStanje = new Promise<PayloadGreska>((resolve) => socket.once('greska', resolve));
      socket.emit('red:stanje', { mod: 'cetiri_igraca', pravila: 'ka_zna' });
      expect((await greskaStanje).kod).toBe('JAVNI_RED_NEDOSTUPAN');

      const greskaTrobojKaZna = new Promise<PayloadGreska>((resolve) => socket.once('greska', resolve));
      const potvrdaKa = await new Promise<StanjeReda | null>((resolve) => {
        socket.emit('red:udji', { mod: 'tri_igraca', pravila: 'ka_zna' }, resolve);
      });
      expect(potvrdaKa).toBeNull();
      expect((await greskaTrobojKaZna).kod).toBe('JAVNI_RED_NEDOSTUPAN');
    } finally {
      socket.disconnect();
    }
  });

  it('identičan red:udji u Brzoj igri je no-op', async () => {
    const igrac = await spojiSe();
    try {
      const prvo = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', ULZAZ_BRZA, resolve);
      });
      expect(prvo.mjesta.filter(Boolean)).toHaveLength(1);
      expect(prvo.pravila).toBe('klasicni');
      expect(prvo.mod).toBe('tri_igraca');

      const drugo = await new Promise<StanjeReda>((resolve) => {
        igrac.emit('red:udji', ULZAZ_BRZA, resolve);
      });
      expect(drugo.mjesta.filter(Boolean)).toHaveLength(1);
      expect(drugo.pravila).toBe('klasicni');
    } finally {
      igrac.emit('red:izadji');
      igrac.disconnect();
    }
  });

  it('zadani Troboj pragovi su 10/20 s bez jittera', () => {
    expect(ZADANA_KONFIGURACIJA_BOTA.pragoviPopuneMs.tri_igraca).toEqual([10_000, 20_000]);
    expect(ZADANA_KONFIGURACIJA_BOTA.odstupanjaPopuneMs.tri_igraca).toEqual([0, 0]);
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
    expect(parsano.pragoviPopuneMs.tri_igraca).toEqual([10_000, 20_000]);
    expect(parsano.botoviTroboj).toBe(false);
  });

  it('nedostajući botoviTroboj uzima vrijednost iz env zadanih postavki', () => {
    const stara = {
      ...ZADANA_KONFIGURACIJA_BOTA,
      verzija: 3,
      botoviTroboj: undefined,
      botoviDvoboj: true,
      botoviCetveroboj: true,
    };
    const izEnv = { ...ZADANA_KONFIGURACIJA_BOTA, botoviTroboj: true, botoviDvoboj: true, botoviCetveroboj: true };
    const parsano = parsajSpremljenuKonfiguraciju(stara, izEnv);
    expect(parsano.botoviTroboj).toBe(true);
    expect(parsano.botoviDvoboj).toBe(true);
  });
});
