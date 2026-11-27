import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import type { OdgovorNaslovnicaSazetka } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;

const NASUMICNI_SUFIKS = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');
const EMAIL = `naslovnica-${NASUMICNI_SUFIKS}@example.com`;
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

describe('GET /api/naslovnica/sazetak', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/naslovnica/sazetak`);
    expect(odgovor.status).toBe(401);
  });

  it('vraća sažetak za gosta bez misija', async () => {
    const gostSesija = await fetch(`${adresa}/api/racuni/gost-sesija`, { method: 'POST' });
    const { token, igracId } = (await gostSesija.json()) as { token: string; igracId: string };

    const odgovor = await fetch(`${adresa}/api/naslovnica/sazetak`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(odgovor.status).toBe(200);
    expect(odgovor.headers.get('cache-control')).toContain('no-store');
    const tijelo = (await odgovor.json()) as OdgovorNaslovnicaSazetka;
    expect(tijelo.ok).toBe(true);
    expect(tijelo.igracId).toBe(igracId);
    expect(tijelo.profil.vrsta).toBe('gost');
    expect(tijelo.profil.igracId).toBe(igracId);
    expect(tijelo.profil.iskustvo).toEqual(
      expect.objectContaining({ razina: expect.any(Number), ukupno: expect.any(Number) }),
    );
    expect(tijelo.misije).toBeNull();
    expect(tijelo.kolekcija?.ukupnoOtkljucano).toBeGreaterThanOrEqual(0);
    expect(tijelo.dostignuca?.ukupnoZvjezdica).toBeGreaterThanOrEqual(0);
    expect(tijelo.dostignuca?.maksimalnoZvjezdica).toBeGreaterThan(0);
    expect(tijelo.izazovi?.ukupno).toBeGreaterThan(0);
    expect(tijelo.ljestvice?.status).toBeDefined();
    expect(tijelo.obavijesti?.brojNeprocitanih).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(tijelo.obavijesti?.neprocitane)).toBe(true);
  });

  it('vraća sažetak misija za registriranog igrača', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: EMAIL,
        lozinka: LOZINKA,
        potvrdaDob16: true,
        prihvacamUvjete: true,
      }),
    });
    const { sesijskiToken, igracId } = (await registracija.json()) as {
      sesijskiToken: string;
      igracId: string;
    };

    const odgovor = await fetch(`${adresa}/api/naslovnica/sazetak`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as OdgovorNaslovnicaSazetka;
    expect(tijelo.igracId).toBe(igracId);
    expect(tijelo.profil.vrsta).toBe('registriran');
    expect(tijelo.misije).not.toBeNull();
    expect(tijelo.misije?.ukupnoAktivnih).toBeGreaterThanOrEqual(0);
    expect(tijelo.misije?.novosti).toEqual(
      expect.objectContaining({ dnevne: expect.any(Boolean), tjedne: expect.any(Boolean) }),
    );
  });
});
