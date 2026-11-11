import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, partije, potezi, prijave, prijaveIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { stvoriGostSesiju } from '../src/racuni/sesije.js';

let app: FastifyInstance;
let partijaId: string;
let igracId: string;
let drugiIgracId: string;
let sesijskiToken: string;
const potezIds: number[] = [];
const igracIds: string[] = [];

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  const gost = await stvoriGostSesiju();
  igracId = gost.igracId;
  igracIds.push(gost.igracId);
  sesijskiToken = gost.token;
  const [partija] = await baza.insert(partije).values({ mod: 'dva_igraca', status: 'u_tijeku', pobjednikId: null }).returning({ id: partije.id });
  if (!partija) throw new Error('Testna partija nije stvorena.');
  partijaId = partija.id;
  await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
  const drugi = await stvoriGostSesiju();
  drugiIgracId = drugi.igracId;
  igracIds.push(drugi.igracId);
  await baza.insert(sudioniciPartije).values({ partijaId, igracId: drugi.igracId, sjedalo: 1 });
  for (let redniBroj = 1; redniBroj <= 4; redniBroj += 1) {
    const [potez] = await baza.insert(potezi).values({
      partijaId,
      runda: redniBroj,
      redniBroj,
      igracId,
      vrsta: 'rijec',
      rijec: `rijec${redniBroj}`,
      trazenaSlova: 'ri',
      trajanjeMs: 100,
    }).returning({ id: potezi.id });
    if (!potez) throw new Error('Testni potez nije stvoren.');
    potezIds.push(potez.id);
  }
});

afterEach(async () => {
  await baza.delete(prijave).where(eq(prijave.partijaId, partijaId));
  await baza.delete(prijaveIgraca).where(eq(prijaveIgraca.partijaId, partijaId));
  await baza.delete(potezi).where(eq(potezi.partijaId, partijaId));
  await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
  await baza.delete(partije).where(eq(partije.id, partijaId));
  for (const id of igracIds) await baza.delete(igraci).where(eq(igraci.id, id));
  igracIds.length = 0;
  potezIds.length = 0;
});

async function prijaviBrisanje(potezId: number | null | undefined) {
  return app.inject({
    url: '/api/prijave',
    method: 'POST',
    headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ partijaId, tip: 'za_brisanje', potezId }),
  });
}

async function prijaviDodavanje(rijec: string) {
  return app.inject({
    url: '/api/prijave',
    method: 'POST',
    headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ partijaId, tip: 'za_dodavanje', rijec }),
  });
}

describe('POST /prijave', () => {
  it('odbija izostavljen potezId za brisanje', async () => {
    expect((await prijaviBrisanje(null)).statusCode).toBe(400);
    expect((await prijaviBrisanje(undefined)).statusCode).toBe(400);
  });

  it('dopušta prijavu tijekom partije u tijeku', async () => {
    const odgovor = await prijaviBrisanje(potezIds[0]!);
    expect(odgovor.statusCode).toBe(200);
    const [redak] = await baza.select().from(prijave).where(eq(prijave.partijaId, partijaId)).limit(1);
    expect(redak?.tip).toBe('za_brisanje');
    expect(redak?.rijec).toBe('rijec1');
  });

  it('dopušta 3+3 odvojeno i odbija četvrtu u svakom tipu', async () => {
    expect((await prijaviBrisanje(potezIds[0]!)).statusCode).toBe(200);
    expect((await prijaviBrisanje(potezIds[0]!)).statusCode).toBe(409);
    expect((await prijaviBrisanje(potezIds[1]!)).statusCode).toBe(200);
    expect((await prijaviBrisanje(potezIds[2]!)).statusCode).toBe(200);
    expect((await prijaviBrisanje(potezIds[3]!)).statusCode).toBe(429);

    expect((await prijaviDodavanje('nedostaje1')).statusCode).toBe(200);
    expect((await prijaviDodavanje('nedostaje1')).statusCode).toBe(409);
    expect((await prijaviDodavanje('nedostaje2')).statusCode).toBe(200);
    expect((await prijaviDodavanje('nedostaje3')).statusCode).toBe(200);
    expect((await prijaviDodavanje('nedostaje4')).statusCode).toBe(429);

    const brisanje = await baza.select({ id: prijave.id }).from(prijave).where(and(eq(prijave.partijaId, partijaId), eq(prijave.tip, 'za_brisanje')));
    const dodavanje = await baza.select({ id: prijave.id }).from(prijave).where(and(eq(prijave.partijaId, partijaId), eq(prijave.tip, 'za_dodavanje')));
    expect(brisanje).toHaveLength(3);
    expect(dodavanje).toHaveLength(3);
  });

  it('ne dopušta potez iz druge partije ni nesudionika', async () => {
    const drugi = await stvoriGostSesiju();
    igracIds.push(drugi.igracId);
    const odgovor = await app.inject({
      url: '/api/prijave',
      method: 'POST',
      headers: { authorization: `Bearer ${drugi.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ partijaId, tip: 'za_brisanje', potezId: potezIds[0] }),
    });
    expect(odgovor.statusCode).toBe(403);
  });

  it('konkurentni zahtjevi ne mogu probiti limit od tri prijave za brisanje', async () => {
    const odgovori = await Promise.all(potezIds.map((potezId) => prijaviBrisanje(potezId)));
    expect(odgovori.filter((odgovor) => odgovor.statusCode === 200)).toHaveLength(3);
    expect(odgovori.filter((odgovor) => odgovor.statusCode === 429)).toHaveLength(1);
    const spremljene = await baza.select({ id: prijave.id }).from(prijave).where(and(eq(prijave.partijaId, partijaId), eq(prijave.tip, 'za_brisanje')));
    expect(spremljene).toHaveLength(3);
  });
});

describe('POST /prijave-igraca', () => {
  it('prima prijavu tijekom partije i ne curi prijavitelja u admin listi', async () => {
    const odgovor = await app.inject({
      url: '/api/prijave-igraca',
      method: 'POST',
      headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ partijaId, prijavljeniIgracId: drugiIgracId, razlog: 'pogrdan_nadimak' }),
    });
    expect(odgovor.statusCode).toBe(200);

    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `admin-prijave-${Date.now()}@example.com`, lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true }),
    });
    expect(registracija.statusCode).toBe(200);
    const admin = registracija.json() as { igracId: string; sesijskiToken: string };
    igracIds.push(admin.igracId);
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, admin.igracId));

    const adminLista = await app.inject({
      url: '/api/admin/prijave-igraca',
      method: 'GET',
      headers: { authorization: `Bearer ${admin.sesijskiToken}` },
    });
    expect(adminLista.statusCode).toBe(200);
    const tijelo = adminLista.json() as { prijave: Array<Record<string, unknown>> };
    const redak = tijelo.prijave.find((p) => p.prijavljeniIgracId === drugiIgracId);
    expect(redak).toMatchObject({ prijavljeniIgracId: drugiIgracId });
    expect(redak).toHaveProperty('nadimak');
    expect(redak).not.toHaveProperty('prijaviteljId');
  });

  it('admin obrisi-racun soft-briše igrača u bazi', async () => {
    await baza.update(partije).set({ status: 'zavrsena', pobjednikId: igracId }).where(eq(partije.id, partijaId));
    const prijavaOdgovor = await app.inject({
      url: '/api/prijave-igraca',
      method: 'POST',
      headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ partijaId, prijavljeniIgracId: drugiIgracId, razlog: 'pogrdan_nadimak' }),
    });
    expect(prijavaOdgovor.statusCode).toBe(200);

    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `admin-brisanje-${Date.now()}@example.com`, lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const admin = registracija.json() as { igracId: string; sesijskiToken: string };
    igracIds.push(admin.igracId);
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, admin.igracId));

    const [prijava] = await baza.select().from(prijaveIgraca).where(eq(prijaveIgraca.partijaId, partijaId)).limit(1);
    expect(prijava).toBeTruthy();

    const brisanje = await app.inject({
      url: `/api/admin/prijave-igraca/${prijava!.id}/obrisi-racun`,
      method: 'POST',
      headers: { authorization: `Bearer ${admin.sesijskiToken}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(brisanje.statusCode).toBe(200);
    expect(brisanje.json()).toMatchObject({ ok: true, ishod: 'obrisan' });

    const [obrisan] = await baza.select().from(igraci).where(eq(igraci.id, drugiIgracId)).limit(1);
    expect(obrisan).toMatchObject({
      nadimak: 'Obrisani igrač',
      email: null,
      lozinkaHash: null,
    });
    expect(obrisan?.obrisanAt).toBeInstanceOf(Date);

    const [rijesena] = await baza.select().from(prijaveIgraca).where(eq(prijaveIgraca.id, prijava!.id)).limit(1);
    expect(rijesena?.status).toBe('rijesena');
    expect(rijesena?.napomenaAdmina).toBe('racun_obrisan');
  });

  it('admin obrisi-racun odbija botove i admine', async () => {
    await baza.update(partije).set({ status: 'zavrsena', pobjednikId: igracId }).where(eq(partije.id, partijaId));
    await baza.update(igraci).set({ upravljac: 'bot' }).where(eq(igraci.id, drugiIgracId));

    const prijavaOdgovor = await app.inject({
      url: '/api/prijave-igraca',
      method: 'POST',
      headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ partijaId, prijavljeniIgracId: drugiIgracId, razlog: 'pogrdan_nadimak' }),
    });
    expect(prijavaOdgovor.statusCode).toBe(200);

    const registracija = await app.inject({
      url: '/api/racuni/registracija',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `admin-zasticen-${Date.now()}@example.com`, lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const admin = registracija.json() as { igracId: string; sesijskiToken: string };
    igracIds.push(admin.igracId);
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, admin.igracId));

    const [prijava] = await baza.select().from(prijaveIgraca).where(eq(prijaveIgraca.partijaId, partijaId)).limit(1);
    const brisanjeBota = await app.inject({
      url: `/api/admin/prijave-igraca/${prijava!.id}/obrisi-racun`,
      method: 'POST',
      headers: { authorization: `Bearer ${admin.sesijskiToken}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(brisanjeBota.statusCode).toBe(400);
    expect(brisanjeBota.json()).toMatchObject({ ok: false });

    const [bot] = await baza.select().from(igraci).where(eq(igraci.id, drugiIgracId)).limit(1);
    expect(bot?.obrisanAt).toBeNull();
    expect(bot?.upravljac).toBe('bot');

    await baza.update(igraci).set({ upravljac: 'covjek', vrsta: 'admin' }).where(eq(igraci.id, drugiIgracId));
    const brisanjeAdmina = await app.inject({
      url: `/api/admin/prijave-igraca/${prijava!.id}/obrisi-racun`,
      method: 'POST',
      headers: { authorization: `Bearer ${admin.sesijskiToken}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(brisanjeAdmina.statusCode).toBe(400);
    const [zasticen] = await baza.select().from(igraci).where(eq(igraci.id, drugiIgracId)).limit(1);
    expect(zasticen?.obrisanAt).toBeNull();
    expect(zasticen?.vrsta).toBe('admin');
  });
});
