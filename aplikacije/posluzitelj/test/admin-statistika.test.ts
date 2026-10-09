import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, partije, sudioniciPartije } from '../src/baza/shema.js';
import { izracunajStatistikuCekanja } from '../src/admin/statistika-cekanja.js';

let posluzitelj: Posluzitelj;
let adresa: string;
const SUFIKS = randomUUID().slice(0, 8);
let adminToken: string;
let obicanToken: string;
const stvoreniIgraci: string[] = [];
const stvorenePartije: string[] = [];

beforeAll(async () => {
  posluzitelj = await izgradiPosluzitelj();
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
  const registriraj = async (email: string) => {
    const odgovor = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, lozinka: 'lozinka123' }),
    });
    return (await odgovor.json()) as { igracId: string; sesijskiToken: string };
  };
  const admin = await registriraj(`admin-stat-${SUFIKS}@example.com`);
  stvoreniIgraci.push(admin.igracId);
  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, admin.igracId));
  adminToken = admin.sesijskiToken;
  const obican = await registriraj(`obican-stat-${SUFIKS}@example.com`);
  stvoreniIgraci.push(obican.igracId);
  obicanToken = obican.sesijskiToken;
});

afterAll(async () => {
  if (stvorenePartije.length) {
    await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, stvorenePartije));
    await baza.delete(partije).where(inArray(partije.id, stvorenePartije));
  }
  if (stvoreniIgraci.length) await baza.delete(igraci).where(inArray(igraci.id, stvoreniIgraci));
  await posluzitelj.zaustavi();
});

describe('GET /admin/statistike/cekanje', () => {
  it('traži administratora', async () => {
    expect((await fetch(`${adresa}/api/admin/statistike/cekanje`)).status).toBe(401);
    expect((await fetch(`${adresa}/api/admin/statistike/cekanje`, { headers: { authorization: `Bearer ${obicanToken}` } })).status).toBe(403);
    expect((await fetch(`${adresa}/api/admin/statistike/cekanje?dani=400`, { headers: { authorization: `Bearer ${adminToken}` } })).status).toBe(400);
    const odgovor = await fetch(`${adresa}/api/admin/statistike/cekanje?dani=7`, { headers: { authorization: `Bearer ${adminToken}` } });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; zivo: { fond: { ukupno: number }; zastavice: { trening: boolean } } | null };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.zivo?.fond.ukupno).toBeGreaterThanOrEqual(0);
    expect(typeof tijelo.zivo?.zastavice.trening).toBe('boolean');
  });

  it('računa čekanje samo ljudima i raspodjelu po broju botova na fiksturi', async () => {
    // Izolirano razdoblje daleko u prošlosti: statistika se traži od „sada” iz tog razdoblja.
    const sada = new Date('2003-05-10T12:00:00Z');
    const covjek = randomUUID();
    const bot = randomUUID();
    stvoreniIgraci.push(covjek, bot);
    await baza.insert(igraci).values([
      { id: covjek, vrsta: 'registriran', nadimak: `Cov${SUFIKS}` },
      { id: bot, vrsta: 'registriran', upravljac: 'bot', nadimak: `Bot${SUFIKS}` },
    ]);
    const dodaj = async (brojBotova: number, cekanjeCovjekaMs: number, pobjednik: string, nacinBota: 'ne_znam' | 'pobjednik') => {
      const id = randomUUID();
      stvorenePartije.push(id);
      const pocetak = new Date(sada.getTime() - 60 * 60 * 1_000);
      await baza.insert(partije).values({ id, mod: 'dva_igraca', status: 'zavrsena', pocetak, kraj: new Date(pocetak.getTime() + 60_000), brojBotova, pobjednikId: pobjednik });
      await baza.insert(sudioniciPartije).values([
        { partijaId: id, igracId: covjek, sjedalo: 0, plasman: pobjednik === covjek ? 1 : 2, bodovi: 0, cekanjeMs: cekanjeCovjekaMs },
        { partijaId: id, igracId: bot, sjedalo: 1, plasman: pobjednik === bot ? 1 : 2, bodovi: 0, cekanjeMs: 999_999, nacinIspadanja: nacinBota },
      ]);
    };
    await dodaj(1, 30_000, covjek, 'ne_znam');
    await dodaj(1, 10_000, bot, 'pobjednik');
    await dodaj(0, 2_000, covjek, 'ne_znam');

    const statistika = await izracunajStatistikuCekanja(1, sada);
    const dan = statistika.poDanu.find((r) => r.mod === 'dva_igraca');
    expect(dan).toMatchObject({ partije: 3, partijeBezBotova: 1, partijeSJednimBotom: 2 });
    expect(dan?.prosjekCekanjaMs).toBe(14_000);
    expect(dan?.p95CekanjaMs).toBeLessThan(999_999);
    const sJednim = statistika.pobjedePoSastavu.find((r) => r.brojBotova === 1);
    expect(sJednim).toMatchObject({ partije: 2, pobjedeLjudi: 1, udioPobjedaLjudi: 0.5 });
    expect(statistika.eliminacijeBotova.find((r) => r.nacinIspadanja === 'ne_znam')?.broj).toBe(2);
  });
});
