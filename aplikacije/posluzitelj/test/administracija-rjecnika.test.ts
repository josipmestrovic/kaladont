import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, izmjeneRjecnika, rijeci } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;
// samo slova (bez brojki) - dodajRijec odbija sve osim hrvatskih malih slova
const NASUMICNI_SUFIKS = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');
const TESTNA_RIJEC = `testnarijec${NASUMICNI_SUFIKS}`;
const EMAIL_ADMIN = `admin-${NASUMICNI_SUFIKS}@example.com`;
const EMAIL_OBICAN = `obican-${NASUMICNI_SUFIKS}@example.com`;
const LOZINKA = 'lozinka123';

let adminToken: string;
let obicanToken: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;

  const registracijaAdmin = await fetch(`${adresa}/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_ADMIN, lozinka: LOZINKA }),
  });
  const { igracId: adminId, sesijskiToken } = (await registracijaAdmin.json()) as {
    igracId: string;
    sesijskiToken: string;
  };
  adminToken = sesijskiToken;
  // rucna promocija u admina - jedini nacin u ovoj fazi (nema self-service)
  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, adminId));

  const registracijaObican = await fetch(`${adresa}/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_OBICAN, lozinka: LOZINKA }),
  });
  ({ sesijskiToken: obicanToken } = (await registracijaObican.json()) as { sesijskiToken: string });
});

afterEach(async () => {
  await baza.delete(izmjeneRjecnika).where(eq(izmjeneRjecnika.rijec, TESTNA_RIJEC));
  await baza.delete(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
});

afterAll(async () => {
  await baza.delete(igraci).where(eq(igraci.email, EMAIL_ADMIN));
  await baza.delete(igraci).where(eq(igraci.email, EMAIL_OBICAN));
  await app.close();
});

describe('POST /admin/rjecnik/dodaj', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('odbija prijavljenog korisnika koji nije admin', async () => {
    const odgovor = await fetch(`${adresa}/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${obicanToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test' }),
    });
    expect(odgovor.status).toBe(403);
  });

  it('admin dodaje riječ i odmah je vidljiva u rječniku bez restarta (live reload)', async () => {
    const odgovor = await fetch(`${adresa}/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'ručni test', vrsta: 'imenica' }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; brojRijeci: number };
    expect(tijelo.ok).toBe(true);

    const zdravlje = await fetch(`${adresa}/zdravlje`);
    const zdravljeTijelo = (await zdravlje.json()) as { brojRijeci: number };
    expect(zdravljeTijelo.brojRijeci).toBe(tijelo.brojRijeci);

    const [redak] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(redak?.aktivna).toBe(true);
    expect(redak?.vrste).toEqual(['imenica']);
    expect(redak?.grupe).toEqual([`imenica:${TESTNA_RIJEC}`]);
  });

  it('odbija dodavanje bez vrste riječi (ADR-013)', async () => {
    const odgovor = await fetch(`${adresa}/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'bez vrste' }),
    });
    expect(odgovor.status).toBe(400);
  });

  // 3 admin operacije = 3 puna reloada rjecnika od ~1,2 M redaka - treba vise od zadanih 15 s
  it('admin deaktivira pa vraća riječ', { timeout: 90_000 }, async () => {
    await fetch(`${adresa}/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'priprema testa', vrsta: 'imenica' }),
    });

    const deaktivacija = await fetch(`${adresa}/admin/rjecnik/deaktiviraj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test deaktivacije' }),
    });
    expect(deaktivacija.status).toBe(200);
    const [poslijeDeaktivacije] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(poslijeDeaktivacije?.aktivna).toBe(false);

    const vracanje = await fetch(`${adresa}/admin/rjecnik/vrati`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test vracanja' }),
    });
    expect(vracanje.status).toBe(200);
    const [poslijeVracanja] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(poslijeVracanja?.aktivna).toBe(true);
  });
});

describe('GET /zdravlje', () => {
  it('vraća dokumentirani health ugovor kada su baza i rječnik dostupni', async () => {
    const odgovor = await fetch(`${adresa}/zdravlje`);
    const tijelo = (await odgovor.json()) as {
      ok: boolean;
      baza: string;
      brojRijeci: number;
      aktivnePartije: number;
      uptimeSekunde: number;
      verzija: string;
      digest: string;
    };

    expect(odgovor.status).toBe(200);
    expect(tijelo).toMatchObject({
      ok: true,
      baza: 'dostupna',
      aktivnePartije: 0,
      verzija: 'lokalno',
      digest: 'lokalno',
    });
    expect(tijelo.brojRijeci).toBeGreaterThan(0);
    expect(tijelo.uptimeSekunde).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /rjecnik/statistika', () => {
  it('javno vraća broj oblika po kategoriji sortirano silazno', async () => {
    const odgovor = await fetch(`${adresa}/rjecnik/statistika`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      ukupno: number;
      kategorije: { vrsta: string; brojOblika: number }[];
    };
    expect(tijelo.ukupno).toBeGreaterThan(0);
    expect(tijelo.kategorije.length).toBeGreaterThan(0);
    for (const kategorija of tijelo.kategorije) {
      expect(kategorija.brojOblika).toBeGreaterThan(0);
    }
    const brojevi = tijelo.kategorije.map((k) => k.brojOblika);
    expect([...brojevi].sort((a, b) => b - a)).toEqual(brojevi);
    const zbroj = brojevi.reduce((a, b) => a + b, 0);
    expect(zbroj).toBeGreaterThanOrEqual(tijelo.ukupno); // višekategorijski oblici broje se u svakoj vrsti
  });
});
