import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { dnkStatistikeIgraca, igraci, partije, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';

let app: FastifyInstance;
let adresa: string;

const NASUMICNI_SUFIKS = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');
const EMAIL = `profil-${NASUMICNI_SUFIKS}@example.com`;
const LOZINKA = 'lozinka123';

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(eq(igraci.email, EMAIL));
  if (igrac) {
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.igracId, igrac.id));
    await baza.delete(partije).where(eq(partije.pobjednikId, igrac.id));
    await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igrac.id));
    await baza.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igrac.id));
  }
  await baza.delete(igraci).where(eq(igraci.email, EMAIL));
});

afterAll(async () => {
  await app.close();
});

/** Umeće gost-zapis izravno u bazu (bez Socket.IO handshakea) za testiranje REST ruta. */
async function stvoriGosta(): Promise<{ token: string; id: string }> {
  const odgovor = await fetch(`${adresa}/api/racuni/gost-sesija`, { method: 'POST' });
  const podaci = (await odgovor.json()) as { token: string; igracId: string };
  return { token: podaci.token, id: podaci.igracId };
}

describe('GET /profil', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil`);
    expect(odgovor.status).toBe(401);
  });

  it('vraća vlastite agregate i rang za prijavljenog korisnika', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const odgovor = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; rang: string; odigrane: number; iskustvo: { razina: number; ukupno: number; uRazini: number; doIduce: number | null } };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.odigrane).toBe(0);
    expect(tijelo.rang).toBe('Piskaralo');
    expect(tijelo.iskustvo).toEqual({ razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 });
  });
});

describe('GET /ljestvica', () => {
  it('vraća listu (javno, bez prijave)', async () => {
    const odgovor = await fetch(`${adresa}/api/ljestvica`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; ljestvica: unknown[] };
    expect(tijelo.ok).toBe(true);
    expect(Array.isArray(tijelo.ljestvica)).toBe(true);
  });

  it('računa 1v1 rang i za listu i za vlastito mjesto', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    await baza
      .update(igraci)
      .set({ odigrane1v1: 10, bodovi1v1: 9 })
      .where(eq(igraci.id, igracId));

    const odgovor = await fetch(`${adresa}/api/ljestvica?mod=dva_igraca`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    const tijelo = (await odgovor.json()) as {
      mojeMjesto: { rang: string } | null;
      ljestvica: { igracId: string; rang: string }[];
    };

    expect(odgovor.status).toBe(200);
    expect(tijelo.ljestvica.find((redak) => redak.igracId === igracId)?.rang).toBe('Kaladont');
    expect(tijelo.mojeMjesto?.rang).toBe('Kaladont');
  });

  it('zadržava isti DNK u završnom rezultatu i nakon ponovnog učitavanja profila', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    const partijaId = randomUUID();
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 3,
        ukupnoTrajanjePrihvaceniPoteziMs: 3_000,
        najduziStreak: 3,
        otkriveneJakoRijetkeGrupe: 1,
        otkriveneSrednjeRijetkeGrupe: 0,
        otkriveneRijetkeGrupe: 0,
        upisaneDugeRijeci: 1,
        upisaneSrednjeDugeRijeci: 0,
        upisaneJakoDugeRijeci: 0,
        najduzaRijec: null,
        najduzaRijecGrafemi: 0,
        najrjedaRijec: null,
        najrjedaRijecFrekvencija: null,
        najrjedaTier: null,
      }]]),
      false,
      new Map(),
    );
    const dnkNakonPartije = agregati.get(igracId)?.dnkPoslije;

    const odgovor = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    const tijelo = (await odgovor.json()) as { dnk: { cetiriIgraca: { osi: unknown[] } } };

    expect(odgovor.status).toBe(200);
    expect(dnkNakonPartije).toBeDefined();
    expect(tijelo.dnk.cetiriIgraca.osi).toEqual(dnkNakonPartije);
  });
});

describe('GET /povijest/:igracId', () => {
  it('vraća praznu listu za igrača bez partija', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };

    const odgovor = await fetch(`${adresa}/api/povijest/${igracId}`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; partije: unknown[]; imaJos: boolean; sljedeciCursor: string | null };
    expect(tijelo.partije).toEqual([]);
    expect(tijelo.imaJos).toBe(false);
    expect(tijelo.sljedeciCursor).toBeNull();
  });
});

describe('GET /partije/:partijaId/potezi', () => {
  it('vraća paginirani oblik i metapodatke za nepostojeću partiju', async () => {
    const odgovor = await fetch(`${adresa}/api/partije/${randomUUID()}/potezi?limit=9999`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      potezi: unknown[];
      limit: number;
      imaJos: boolean;
    };
    expect(tijelo.potezi).toEqual([]);
    expect(tijelo.limit).toBe(500);
    expect(tijelo.imaJos).toBe(false);
  });
});

describe('PUT /profil/avatar', () => {
  it('odbija neidentificirani zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatarId: 1 }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('dopušta gostu da odabere avatar (onboarding)', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ avatarId: 3 }),
      });
      expect(odgovor.status).toBe(200);
      const tijelo = (await odgovor.json()) as { ok: boolean; avatarId: number };
      expect(tijelo.avatarId).toBe(3);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('odbija avatarId izvan raspona', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ avatarId: 999 }),
      });
      expect(odgovor.status).toBe(400);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });
});

describe('PUT /profil/nadimak', () => {
  it('odbija neidentificirani zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nadimak: 'Ana' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('dopušta gostu da postavi ime (onboarding)', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'Ana' }),
      });
      expect(odgovor.status).toBe(200);
      const tijelo = (await odgovor.json()) as { ok: boolean; nadimak: string };
      expect(tijelo.nadimak).toBe('Ana');
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('odbija ime kraće od 2 znaka', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'An' }),
      });
      expect(odgovor.status).toBe(400);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('odbija ime dulje od 20 znakova', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'A'.repeat(13) }),
      });
      expect(odgovor.status).toBe(400);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });
});
