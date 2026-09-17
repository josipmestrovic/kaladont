import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as ioClient } from 'socket.io-client';
import { eq } from 'drizzle-orm';
import { izdajTokenPotvrdeEmaila, izdajTokenResetaLozinke } from '../src/racuni/tokeni.js';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, sesije } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;

const EMAIL = `test-${Date.now()}@example.com`;
const LOZINKA = 'lozinka123';

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await baza.delete(igraci).where(eq(igraci.email, EMAIL));
});

afterAll(async () => {
  await app.close();
});

describe('POST /racuni/registracija', () => {
  it('registrira novog korisnika i vraća sesijski token', async () => {
    const odgovor = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, nadimak: 'TestIgrac' }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      ok: boolean;
      igracId: string;
      sesijskiToken: string;
    };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.sesijskiToken).toMatch(/^sesija\.[A-Za-z0-9_-]{43}$/);

    const [redak] = await baza.select().from(igraci).where(eq(igraci.email, EMAIL));
    expect(redak?.vrsta).toBe('registriran');
    expect(redak?.lozinkaHash).not.toBe(LOZINKA); // hashirano, ne plaintext
    expect(redak?.emailPotvrdjen).toBe(false);

    const korisnickeSesije = await baza.select().from(sesije).where(eq(sesije.igracId, tijelo.igracId));
    expect(korisnickeSesije).toHaveLength(1);
    expect(korisnickeSesije[0]?.tokenHash).not.toBe(tijelo.sesijskiToken);
    expect(korisnickeSesije[0]?.tokenHash).toHaveLength(64);
  });

  it('odbija duplikat emaila', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const drugi = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: 'nekaDrugaLozinka1' }),
    });
    expect(drugi.status).toBe(409);
  });

  it('odbija nadimak duži od 12 znakova', async () => {
    const odgovor = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, nadimak: 'PredugackiNadimak' }),
    });
    expect(odgovor.status).toBe(400);
  });
});

describe('POST /racuni/prijava', () => {
  it('uspješna prijava vraća sesijski token', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });

    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; sesijskiToken: string };
    expect(tijelo.ok).toBe(true);
  });

  it('kriva lozinka vraća generičku 401 poruku', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });

    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: 'kriva-lozinka' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('nepostojeći račun vraća istu generičku 401 poruku (ne otkriva postojanje)', async () => {
    const odgovor = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ne-postoji-nikad@example.com', lozinka: 'bilo-sto-123' }),
    });
    expect(odgovor.status).toBe(401);
  });
});

describe('guest identitet odvaja javni ID od pristupnog tokena', () => {
  it('poznavanje javnog igracId-a ne daje HTTP, Socket.IO ni registracijske ovlasti', async () => {
    const gost = (await (await fetch(`${adresa}/racuni/gost-sesija`, { method: 'POST' })).json()) as {
      igracId: string;
      token: string;
    };
    const email = `guest-id-${Date.now()}@example.com`;
    try {
      const profil = await fetch(`${adresa}/profil`, {
        headers: { authorization: `Bearer ${gost.igracId}` },
      });
      expect(profil.status).toBe(401);

      await expect(
        new Promise((resolve, reject) => {
          const socket = ioClient(adresa, { auth: { token: gost.igracId }, forceNew: true, reconnection: false });
          socket.on('connect', () => reject(new Error('javni igracId ne smije otvoriti socket')));
          socket.on('connect_error', (greska) => {
            socket.disconnect();
            resolve(greska);
          });
        }),
      ).resolves.toBeDefined();

      const registracija = await fetch(`${adresa}/racuni/registracija`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.igracId}` },
        body: JSON.stringify({
          gostToken: gost.igracId,
          email,
          lozinka: LOZINKA,
          nadimak: 'JavniIdTest',
        }),
      });
      expect(registracija.status).toBe(200);
      const [redak] = await baza.select({ vrsta: igraci.vrsta }).from(igraci).where(eq(igraci.id, gost.igracId));
      expect(redak?.vrsta).toBe('gost');
    } finally {
      await baza.delete(igraci).where(eq(igraci.email, email));
      await baza.delete(igraci).where(eq(igraci.id, gost.igracId));
    }
  });
});

describe('POST /racuni/odjava', () => {
  it('opoziva samo trenutačnu sesiju i ponovljena odjava ostaje uspješna', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };
    const zaglavlja = { authorization: `Bearer ${sesijskiToken}` };

    expect((await fetch(`${adresa}/profil`, { headers: zaglavlja })).status).toBe(200);

    const odjava = await fetch(`${adresa}/racuni/odjava`, { method: 'POST', headers: zaglavlja });
    expect(odjava.status).toBe(200);
    expect((await fetch(`${adresa}/profil`, { headers: zaglavlja })).status).toBe(401);

    const ponovljena = await fetch(`${adresa}/racuni/odjava`, { method: 'POST', headers: zaglavlja });
    expect(ponovljena.status).toBe(200);
  });

  it('odjava jedne prijave ne opoziva drugu prijavu istog računa', async () => {
    await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const prijava = async () => {
      const odgovor = await fetch(`${adresa}/racuni/prijava`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
      });
      return ((await odgovor.json()) as { sesijskiToken: string }).sesijskiToken;
    };
    const prviToken = await prijava();
    const drugiToken = await prijava();

    await fetch(`${adresa}/racuni/odjava`, {
      method: 'POST',
      headers: { authorization: `Bearer ${prviToken}` },
    });
    expect(
      (await fetch(`${adresa}/profil`, { headers: { authorization: `Bearer ${prviToken}` } })).status,
    ).toBe(401);
    expect(
      (await fetch(`${adresa}/profil`, { headers: { authorization: `Bearer ${drugiToken}` } })).status,
    ).toBe(200);
  });
});

describe('potvrda emaila i reset lozinke', () => {
  it('potvrđuje email POST zahtjevom i vraća preusmjeravanje za stari link', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };
    const token = izdajTokenPotvrdeEmaila(igracId);

    const stariLink = await fetch(`${adresa}/racuni/potvrdi-email?token=${token}`, {
      redirect: 'manual',
    });
    expect(stariLink.status).toBe(302);
    expect(stariLink.headers.get('location')).toContain('/potvrda-emaila?token=');

    const potvrda = await fetch(`${adresa}/racuni/potvrdi-email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(potvrda.status).toBe(200);
    const [igrac] = await baza
      .select({ emailPotvrdjen: igraci.emailPotvrdjen })
      .from(igraci)
      .where(eq(igraci.id, igracId));
    expect(igrac?.emailPotvrdjen).toBe(true);
  });

  it('resetira lozinku valjanim tokenom pa dopušta novu prijavu', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as {
      igracId: string;
      sesijskiToken: string;
    };
    const token = izdajTokenResetaLozinke(igracId);

    const reset = await fetch(`${adresa}/racuni/resetiraj-lozinku`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, novaLozinka: 'nova-lozinka123' }),
    });
    expect(reset.status).toBe(200);

    const prijava = await fetch(`${adresa}/racuni/prijava`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: 'nova-lozinka123' }),
    });
    expect(prijava.status).toBe(200);
    expect((await fetch(`${adresa}/profil`, { headers: { authorization: `Bearer ${sesijskiToken}` } })).status).toBe(200);
  });
});

describe('HTTP auth ne dopušta impersonaciju registriranog/admin računa golim UUID-om', () => {
  it('odbija goli UUID registriranog računa za protected HTTP rute', async () => {
    const email = `http-impersonation-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    try {
      const registracija = await fetch(`${adresa}/racuni/registracija`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lozinka: LOZINKA, nadimak: 'HttpImposter' }),
      });
      expect(registracija.status).toBe(200);
      const { igracId } = (await registracija.json()) as { igracId: string };

      const profil = await fetch(`${adresa}/profil`, {
        method: 'GET',
        headers: { authorization: `Bearer ${igracId}` },
      });
      expect(profil.status).toBe(401);

      const prijave = await fetch(`${adresa}/admin/prijave`, {
        method: 'GET',
        headers: { authorization: `Bearer ${igracId}` },
      });
      expect(prijave.status).toBe(401);
    } finally {
      await baza.delete(igraci).where(eq(igraci.email, email));
    }
  });

  it('odbija goli UUID admin računa za admin HTTP rute', async () => {
    const email = `http-admin-impersonation-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    try {
      const registracija = await fetch(`${adresa}/racuni/registracija`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, lozinka: LOZINKA, nadimak: 'HttpAdmin' }),
      });
      expect(registracija.status).toBe(200);
      const { igracId, sesijskiToken } = (await registracija.json()) as {
        igracId: string;
        sesijskiToken: string;
      };
      await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));

      const odgovor = await fetch(`${adresa}/admin/prijave`, {
        method: 'GET',
        headers: { authorization: `Bearer ${igracId}` },
      });
      expect(odgovor.status).toBe(401);

      const odgovorSesijom = await fetch(`${adresa}/admin/prijave`, {
        method: 'GET',
        headers: { authorization: `Bearer ${sesijskiToken}` },
      });
      expect(odgovorSesijom.status).toBe(200);
    } finally {
      await baza.delete(igraci).where(eq(igraci.email, email));
    }
  });
});

describe('Socket.IO auth sa sesijskim tokenom', () => {
  it('prihvaća valjan sesijski token nakon prijave', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const socket = await new Promise<ReturnType<typeof ioClient>>((resolve, reject) => {
      const s = ioClient(adresa, { auth: { token: sesijskiToken }, forceNew: true });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it('logout prekida socket sesije i opozvani token se ne može ponovno spojiti', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };
    const socket = await new Promise<ReturnType<typeof ioClient>>((resolve, reject) => {
      const s = ioClient(adresa, { auth: { token: sesijskiToken }, forceNew: true, reconnection: false });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
    const odspojen = new Promise<void>((resolve) => socket.once('disconnect', () => resolve()));

    const odjava = await fetch(`${adresa}/racuni/odjava`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odjava.status).toBe(200);
    await odspojen;

    await expect(
      new Promise((resolve, reject) => {
        const ponovnaVeza = ioClient(adresa, {
          auth: { token: sesijskiToken },
          forceNew: true,
          reconnection: false,
        });
        ponovnaVeza.on('connect', () => reject(new Error('opozvani token se ne smije spojiti')));
        ponovnaVeza.on('connect_error', (greska) => {
          ponovnaVeza.disconnect();
          resolve(greska);
        });
      }),
    ).resolves.toBeDefined();
  });

  it('odbija goli UUID kao pokušaj impersonacije registriranog računa', async () => {
    const registracija = await fetch(`${adresa}/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };

    await expect(
      new Promise((resolve, reject) => {
        const s = ioClient(adresa, { auth: { token: igracId }, forceNew: true });
        s.on('connect', () => reject(new Error('nije trebalo uspjeti - impersonacija!')));
        s.on('connect_error', (greska) => resolve(greska));
      }),
    ).resolves.toBeDefined();
  });
});
