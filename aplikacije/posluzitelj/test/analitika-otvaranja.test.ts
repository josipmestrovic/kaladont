import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { analitikaOtvaranja, igraci } from '../src/baza/shema.js';
import {
  agregirajPocetneRijeci,
  danasZagrebIso,
  graniceDanaZagreb,
  upsertOtvaranjaAnalitike,
} from '../src/analitika/otvaranja.js';

describe('granice dana Europe/Zagreb', () => {
  it('računa 23-satni dan ljetnog prijelaza 2026-03-29', () => {
    const { od, do: kraj } = graniceDanaZagreb('2026-03-29');
    expect(kraj.getTime() - od.getTime()).toBe(23 * 3_600_000);
  });

  it('računa 25-satni dan zimskog prijelaza 2026-10-25', () => {
    const { od, do: kraj } = graniceDanaZagreb('2026-10-25');
    expect(kraj.getTime() - od.getTime()).toBe(25 * 3_600_000);
  });

  it('danasZagrebIso vraća YYYY-MM-DD', () => {
    expect(danasZagrebIso(new Date('2026-06-15T12:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('analitika otvaranja upis i admin', () => {
  let app: FastifyInstance;
  let zaustavi: () => Promise<void>;
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;

  beforeAll(async () => {
    process.env.ANALITIKA_U_TESTU = '1';
    ({ app, zaustavi } = await izgradiPosluzitelj({
      postavkeMotora: { tolerancijaPrekidaMs: 50 },
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
    }));
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
    await zaustavi();
  }, 120_000);

  it('idempotentno bilježi rani incident i agregira metrike', async () => {
    const igraId = randomUUID();
    const dodijeljenoU = new Date();
    const zapis = {
      igraId,
      redniBrojOtvaranja: 1,
      kontekst: 'javna' as const,
      mod: 'dva_igraca' as const,
      brojSudionika: 2,
      sustavskaRijec: 'šećer',
      izvor: 'sigurni_skup' as const,
      brojOdgovora: 1,
      odgovor1: 'erupcija',
      odgovor2: null,
      status: 'rani_incident' as const,
      incidentPozicija: 1 as const,
      incidentRijecUzrok: 'erupcija',
      incidentRazlog: 'mrtva_slova_baza',
      incidentAutorUpravljac: 'covjek' as const,
      incidentZrtvaUpravljac: 'covjek' as const,
      dodijeljenoU,
      zatvorenoU: dodijeljenoU,
    };

    await upsertOtvaranjaAnalitike(zapis);
    await upsertOtvaranjaAnalitike(zapis);

    // Sporiji „otvoren” upis ne smije pregaziti rani incident.
    await upsertOtvaranjaAnalitike({
      ...zapis,
      brojOdgovora: 0,
      odgovor1: null,
      status: 'otvoren',
      incidentPozicija: null,
      incidentRijecUzrok: null,
      incidentRazlog: null,
      incidentAutorUpravljac: null,
      incidentZrtvaUpravljac: null,
      zatvorenoU: null,
    });

    const retci = await baza.select().from(analitikaOtvaranja).where(eq(analitikaOtvaranja.igraId, igraId));
    expect(retci).toHaveLength(1);
    expect(retci[0]?.status).toBe('rani_incident');
    expect(retci[0]?.incidentPozicija).toBe(1);
    expect(retci[0]?.odgovor1).toBe('erupcija');

    const dan = danasZagrebIso(dodijeljenoU);
    const { od, do: kraj } = graniceDanaZagreb(dan);
    const agregat = await agregirajPocetneRijeci({ od, do: kraj, kontekst: 'javna' });
    expect(agregat.dodijeljene).toBeGreaterThanOrEqual(1);
    expect(agregat.raniIncidenti).toBeGreaterThanOrEqual(1);
    expect(agregat.incidentiNa1).toBeGreaterThanOrEqual(1);
  });

  it('odbija običnog korisnika na admin analitici', async () => {
    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `obicni-analitika-${Date.now()}@example.com`, lozinka: 'lozinka123' }),
    });
    expect(registracija.statusCode).toBe(200);
    const { sesijskiToken } = registracija.json() as { sesijskiToken: string };
    const odgovor = await app.inject({
      url: '/api/admin/analitika/pocetne-rijeci',
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.statusCode).toBe(403);
  });

  it('admin vidi agregat početnih riječi', async () => {
    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `admin-analitika-${Date.now()}@example.com`, lozinka: 'lozinka123' }),
    });
    expect(registracija.statusCode).toBe(200);
    const { igracId, sesijskiToken } = registracija.json() as { igracId: string; sesijskiToken: string };
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));

    const odgovor = await app.inject({
      url: '/api/admin/analitika/pocetne-rijeci',
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.statusCode).toBe(200);
    const tijelo = odgovor.json() as { ok: boolean; posjecenost: string; dodijeljene: number };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.posjecenost).toContain('nije uključena');
    expect(typeof tijelo.dodijeljene).toBe('number');
  });
});
