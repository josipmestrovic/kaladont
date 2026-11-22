/**
 * PR06 — live agregacija Izazova, admin 403, CSV, retencija 90d.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { definicijaIzazova, VERZIJA_DEFINICIJE_IZAZOVA, type IdIzazova } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, pokusajiIzazova, zavrseciIzazova } from '../src/baza/shema.js';
import { danasZagrebIso } from '../src/analitika/otvaranja.js';
import { napraviSnapshot } from '../src/izazovi/pohrana.js';
import {
  agregirajIzazove,
  izazoviAgregatUCsv,
  ocistiStarePokusajeIzazova,
  percentilSortiranih,
  ROK_RETENCIJE_POKUSAJA_IZAZOVA_MS,
  wilsonInterval95,
} from '../src/izazovi/analitika.js';
import { PRIHVAT_UVJETA_ZA_TEST } from './pomocnici/uvjeti.js';

/** Izolacija od ostalih testova u istoj bazi. */
const BOT_VERZIJA_TEST = 90601;

const igraciZaBrisanje: string[] = [];
const pokusajiZaBrisanje: string[] = [];

let app: FastifyInstance;
let zaustavi: () => Promise<void>;

beforeAll(async () => {
  ({ app, zaustavi } = await izgradiPosluzitelj({
    socketOgranicenja: { handshakePoIpMinuti: 1_000 },
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
}, 120_000);

afterAll(async () => {
  if (pokusajiZaBrisanje.length > 0) {
    await baza.delete(zavrseciIzazova).where(inArray(zavrseciIzazova.firstSuccessAttemptId, pokusajiZaBrisanje));
    await baza.delete(pokusajiIzazova).where(inArray(pokusajiIzazova.id, pokusajiZaBrisanje));
  }
  for (const igracId of igraciZaBrisanje) {
    await baza.delete(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  }
  await zaustavi();
}, 120_000);

async function noviIgrac(vrsta: 'gost' | 'registriran' = 'gost'): Promise<string> {
  const id = randomUUID();
  await baza.insert(igraci).values({
    id,
    nadimak: `iz-an-${id.slice(0, 8)}`,
    vrsta,
    ...(vrsta === 'registriran'
      ? {
        email: `iz-an-${id.slice(0, 8)}@example.com`,
        emailPotvrdjen: true,
        ...PRIHVAT_UVJETA_ZA_TEST,
      }
      : {}),
  });
  igraciZaBrisanje.push(id);
  return id;
}

async function umetniPokusaj(ulaz: {
  igracId: string;
  challengeId?: IdIzazova;
  definitionVersion?: number;
  botProfileVersion?: number;
  status: 'rezerviran' | 'u_tijeku' | 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto';
  reason?: 'eliminiran' | 'cilj_neispunjen' | 'odustao' | 'prekid_veze' | null;
  gameWon?: boolean | null;
  accountTypeAtStart?: 'gost' | 'registriran';
  startedAt?: Date;
  terminalAt?: Date | null;
  partijaId?: string | null;
  turnDurationMs?: number;
}): Promise<string> {
  const challengeId = ulaz.challengeId ?? 'IZ01';
  const def = definicijaIzazova(challengeId);
  const snapshot = {
    ...napraviSnapshot(def),
    botProfileVersion: ulaz.botProfileVersion ?? BOT_VERZIJA_TEST,
    ...(ulaz.turnDurationMs !== undefined ? { turnDurationMs: ulaz.turnDurationMs as 15_000 | 30_000 | 45_000 } : {}),
  };
  const startedAt = ulaz.startedAt ?? new Date();
  const terminal =
    ulaz.terminalAt !== undefined
      ? ulaz.terminalAt
      : (ulaz.status === 'uspjeh' || ulaz.status === 'neuspjeh' || ulaz.status === 'tehnicki_prekinuto'
        ? new Date(startedAt.getTime() + 60_000)
        : null);
  const partijaId =
    ulaz.partijaId !== undefined
      ? ulaz.partijaId
      : (ulaz.status === 'rezerviran' ? null : randomUUID());
  const [red] = await baza.insert(pokusajiIzazova).values({
    igracId: ulaz.igracId,
    challengeId,
    requestId: randomUUID(),
    definitionVersion: ulaz.definitionVersion ?? VERZIJA_DEFINICIJE_IZAZOVA,
    botProfileVersion: snapshot.botProfileVersion,
    snapshot,
    partijaId,
    startedAt,
    terminalAt: terminal,
    status: ulaz.status,
    reason: ulaz.reason ?? null,
    gameWon: ulaz.gameWon ?? null,
    metrics: {},
    settlementState: 'nije_potrebno',
    accountTypeAtStart: ulaz.accountTypeAtStart ?? 'gost',
    seed: 'pr06-test',
  }).returning({ id: pokusajiIzazova.id });
  const id = red!.id;
  pokusajiZaBrisanje.push(id);
  return id;
}

function filterTest() {
  return { botProfileVersion: BOT_VERZIJA_TEST } as const;
}

describe('Wilson i percentili', () => {
  it('wilsonInterval95 za prazan nazivnik je null; za 1/2 je oko 50%', () => {
    expect(wilsonInterval95(0, 0)).toBeNull();
    const w = wilsonInterval95(1, 2)!;
    expect(w.low).toBeLessThan(50);
    expect(w.high).toBeGreaterThan(50);
  });

  it('percentilSortiranih medijan i p90', () => {
    expect(percentilSortiranih([], 0.5)).toBeNull();
    expect(percentilSortiranih([10], 0.5)).toBe(10);
    expect(percentilSortiranih([1, 2, 3, 4], 0.5)).toBe(2.5);
  });
});

describe('Agregacija Izazova — fixture A/B', () => {
  it('A: 2 neuspjeha + uspjeh; B: 1 neuspjeh → 25% attempt, 50% unique', async () => {
    const igracA = await noviIgrac('gost');
    const igracB = await noviIgrac('gost');
    const dan = danasZagrebIso();
    const bazaMs = Date.now();

    await umetniPokusaj({
      igracId: igracA,
      status: 'neuspjeh',
      reason: 'eliminiran',
      gameWon: false,
      startedAt: new Date(bazaMs - 3_000),
    });
    await umetniPokusaj({
      igracId: igracA,
      status: 'neuspjeh',
      reason: 'cilj_neispunjen',
      gameWon: false,
      startedAt: new Date(bazaMs - 2_000),
    });
    await umetniPokusaj({
      igracId: igracA,
      status: 'uspjeh',
      gameWon: true,
      startedAt: new Date(bazaMs - 1_000),
    });
    await umetniPokusaj({
      igracId: igracB,
      status: 'neuspjeh',
      reason: 'eliminiran',
      gameWon: false,
      startedAt: new Date(bazaMs),
    });

    const agregat = await agregirajIzazove({
      odDan: dan,
      doDan: dan,
      challengeId: 'IZ01',
      definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
      ...filterTest(),
    });

    expect(agregat.ukupno.started).toBe(4);
    expect(agregat.ukupno.uspjesi).toBe(1);
    expect(agregat.ukupno.neuspjesi).toBe(3);
    expect(agregat.ukupno.uniqueStarted).toBe(2);
    expect(agregat.ukupno.uniqueSuccess).toBe(1);
    expect(agregat.ukupno.uniqueSuccessRate).toBeCloseTo(50, 5);

    const red = agregat.redovi.find(
      (r) => r.challengeId === 'IZ01' && r.definitionVersion === VERZIJA_DEFINICIJE_IZAZOVA,
    );
    expect(red).toBeTruthy();
    expect(red!.attemptSuccessBrojnik).toBe(1);
    expect(red!.attemptSuccessNazivnik).toBe(4);
    expect(red!.attemptSuccessRate).toBeCloseTo(25, 5);
    expect(red!.firstTrySuccess).toBe(0); // A prvi netehnički = neuspjeh; B = neuspjeh
    expect(red!.firstTryPlayers).toBe(2);
    expect(red!.attemptsToFirstSuccessMedian).toBe(3); // A uspio na 3. pokušaju
    expect(red!.maliUzorak).toBe(true);
    expect(red!.reasons.eliminiran).toBe(2);
    expect(red!.reasons.cilj_neispunjen).toBe(1);

    const csv = izazoviAgregatUCsv(agregat);
    expect(csv).toContain('challengeId');
    expect(csv).toContain('attemptSuccessRate');
    expect(csv).not.toMatch(/@example\.com/);
    expect(csv).toContain('IZ01');
  });

  it('aktivni i tehnički ne ulaze u attempt success nazivnik', async () => {
    const igrac = await noviIgrac('gost');
    const dan = danasZagrebIso();
    const t = Date.now();

    await umetniPokusaj({
      igracId: igrac,
      challengeId: 'IZ02',
      status: 'uspjeh',
      gameWon: true,
      startedAt: new Date(t),
    });
    // Aktivni na drugom igraču (unique aktivni constraint po igracu)
    const aktivan = await noviIgrac('gost');
    await umetniPokusaj({
      igracId: aktivan,
      challengeId: 'IZ02',
      status: 'u_tijeku',
      startedAt: new Date(t + 1),
      terminalAt: null,
    });
    const teh = await noviIgrac('gost');
    await umetniPokusaj({
      igracId: teh,
      challengeId: 'IZ02',
      status: 'tehnicki_prekinuto',
      startedAt: new Date(t + 2),
    });

    const agregat = await agregirajIzazove({
      odDan: dan,
      doDan: dan,
      challengeId: 'IZ02',
      ...filterTest(),
    });
    const red = agregat.redovi.find((r) => r.challengeId === 'IZ02');
    expect(red).toBeTruthy();
    expect(red!.aktivni).toBe(1);
    expect(red!.tehnicki).toBe(1);
    expect(red!.attemptSuccessNazivnik).toBe(red!.uspjesi + red!.neuspjesi);
    expect(red!.attemptSuccessNazivnik).toBe(1);
    expect(red!.uspjesi).toBe(1);
    expect(red!.started).toBe(3);
  });

  it('isti igracId nakon „registracije” nije nova osoba u unique', async () => {
    const igracId = await noviIgrac('gost');
    const dan = danasZagrebIso();
    const t = Date.now();
    await umetniPokusaj({
      igracId,
      challengeId: 'IZ03',
      status: 'neuspjeh',
      reason: 'eliminiran',
      accountTypeAtStart: 'gost',
      startedAt: new Date(t),
    });
    await baza.update(igraci).set({ vrsta: 'registriran' }).where(eq(igraci.id, igracId));
    await umetniPokusaj({
      igracId,
      challengeId: 'IZ03',
      status: 'uspjeh',
      gameWon: true,
      accountTypeAtStart: 'registriran',
      startedAt: new Date(t + 1_000),
    });

    const agregat = await agregirajIzazove({
      odDan: dan,
      doDan: dan,
      challengeId: 'IZ03',
      ...filterTest(),
    });
    const red = agregat.redovi.find((r) => r.challengeId === 'IZ03');
    expect(red!.uniqueStarted).toBe(1);
    expect(red!.uniqueSuccess).toBe(1);
    expect(red!.startedGost).toBe(1);
    expect(red!.startedRegistriran).toBe(1);
  });

  it('dva definitionVersion ostaju odvojena', async () => {
    const igrac = await noviIgrac('gost');
    const dan = danasZagrebIso();
    const t = Date.now();
    await umetniPokusaj({
      igracId: igrac,
      challengeId: 'IZ04',
      definitionVersion: 1,
      status: 'uspjeh',
      gameWon: true,
      startedAt: new Date(t),
    });
    // Novi igrac jer unique aktivni; terminalni OK na istom — ali drugi uspjeh na istom challenge za završetak nije potreban
    const igrac2 = await noviIgrac('gost');
    await umetniPokusaj({
      igracId: igrac2,
      challengeId: 'IZ04',
      definitionVersion: 2,
      status: 'neuspjeh',
      reason: 'eliminiran',
      startedAt: new Date(t + 1),
    });

    const agregat = await agregirajIzazove({
      odDan: dan,
      doDan: dan,
      challengeId: 'IZ04',
      ...filterTest(),
    });
    const v1 = agregat.redovi.find((r) => r.definitionVersion === 1);
    const v2 = agregat.redovi.find((r) => r.definitionVersion === 2);
    expect(v1?.uspjesi).toBe(1);
    expect(v2?.neuspjesi).toBe(1);
    expect(v1?.attemptSuccessRate).toBeCloseTo(100, 5);
    expect(v2?.attemptSuccessRate).toBeCloseTo(0, 5);
  });

  it('ponovna agregacija (idempotentni read) ne mijenja brojače', async () => {
    const dan = danasZagrebIso();
    const a = await agregirajIzazove({ odDan: dan, doDan: dan, challengeId: 'IZ01', ...filterTest() });
    const b = await agregirajIzazove({ odDan: dan, doDan: dan, challengeId: 'IZ01', ...filterTest() });
    expect(b.ukupno.started).toBe(a.ukupno.started);
    expect(b.ukupno.uspjesi).toBe(a.ukupno.uspjesi);
    expect(b.redovi.length).toBe(a.redovi.length);
  });
});

describe('Admin rute Izazov analitike', () => {
  it('obični korisnik dobiva 403', async () => {
    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `obicni-iz-an-${Date.now()}@example.com`,
        lozinka: 'lozinka123',
        potvrdaDob16: true,
        prihvacamUvjete: true,
      }),
    });
    expect(registracija.statusCode).toBe(200);
    const { sesijskiToken } = registracija.json() as { sesijskiToken: string };
    const odgovor = await app.inject({
      url: '/api/admin/analitika/izazovi',
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.statusCode).toBe(403);

    const csv = await app.inject({
      url: '/api/admin/analitika/izazovi.csv',
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(csv.statusCode).toBe(403);
  });

  it('admin vidi JSON i CSV; raspon >90 dana → 400', async () => {
    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `admin-iz-an-${Date.now()}@example.com`,
        lozinka: 'lozinka123',
        potvrdaDob16: true,
        prihvacamUvjete: true,
      }),
    });
    expect(registracija.statusCode).toBe(200);
    const { igracId, sesijskiToken } = registracija.json() as { igracId: string; sesijskiToken: string };
    igraciZaBrisanje.push(igracId);
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));

    const dan = danasZagrebIso();
    const ok = await app.inject({
      url: `/api/admin/analitika/izazovi?od=${dan}&do=${dan}`,
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    const tijelo = ok.json() as { ok: boolean; vremenskaZona: string; redovi: unknown[] };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.vremenskaZona).toBe('Europe/Zagreb');
    expect(Array.isArray(tijelo.redovi)).toBe(true);

    const csv = await app.inject({
      url: `/api/admin/analitika/izazovi.csv?od=${dan}&do=${dan}`,
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(csv.statusCode).toBe(200);
    expect(String(csv.headers['content-type'])).toContain('text/csv');
    expect(csv.body).toContain('challengeId');

    const predug = await app.inject({
      url: '/api/admin/analitika/izazovi?od=2020-01-01&do=2020-06-01',
      method: 'GET',
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(predug.statusCode).toBe(400);
  });
});

describe('Retencija pokušaja Izazova', () => {
  it('briše stare terminalne; čuva one referencirane iz zavrseci', async () => {
    const igrac = await noviIgrac('gost');
    const staro = new Date(Date.now() - ROK_RETENCIJE_POKUSAJA_IZAZOVA_MS - 86_400_000);

    const zaBrisanje = await umetniPokusaj({
      igracId: igrac,
      challengeId: 'IZ05',
      status: 'neuspjeh',
      reason: 'eliminiran',
      startedAt: staro,
      terminalAt: staro,
    });
    const zasticen = await umetniPokusaj({
      igracId: igrac,
      challengeId: 'IZ05',
      status: 'uspjeh',
      gameWon: true,
      startedAt: new Date(staro.getTime() + 1_000),
      terminalAt: new Date(staro.getTime() + 2_000),
    });
    await baza.insert(zavrseciIzazova).values({
      igracId: igrac,
      challengeId: 'IZ05',
      firstSuccessAttemptId: zasticen,
      vrijeme: new Date(staro.getTime() + 2_000),
      nominalXp: 100,
      awardedXp: 100,
      rewardEpoch: 1,
    });

    const rezultat = await ocistiStarePokusajeIzazova();
    expect(rezultat.obrisano).toBeGreaterThanOrEqual(1);
    expect(rezultat.zadrzanoZbogZavrsaka).toBeGreaterThanOrEqual(1);

    const [ostaoBrisanje] = await baza.select({ id: pokusajiIzazova.id })
      .from(pokusajiIzazova)
      .where(eq(pokusajiIzazova.id, zaBrisanje));
    expect(ostaoBrisanje).toBeUndefined();

    const [ostaoZasticen] = await baza.select({ id: pokusajiIzazova.id })
      .from(pokusajiIzazova)
      .where(eq(pokusajiIzazova.id, zasticen));
    expect(ostaoZasticen?.id).toBe(zasticen);

    const [zavrs] = await baza.select().from(zavrseciIzazova)
      .where(eq(zavrseciIzazova.firstSuccessAttemptId, zasticen));
    expect(zavrs).toBeTruthy();
  });
});
