import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, partije, potezi, prijave, sudioniciPartije } from '../src/baza/shema.js';
import { stvoriGostSesiju } from '../src/racuni/sesije.js';

let app: FastifyInstance;
let partijaId: string;
let igracId: string;
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
  const [partija] = await baza.insert(partije).values({ mod: 'dva_igraca', status: 'zavrsena', pobjednikId: igracId }).returning({ id: partije.id });
  if (!partija) throw new Error('Testna partija nije stvorena.');
  partijaId = partija.id;
  await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
  const drugi = await stvoriGostSesiju();
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
  await baza.delete(potezi).where(eq(potezi.partijaId, partijaId));
  await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
  await baza.delete(partije).where(eq(partije.id, partijaId));
  for (const id of igracIds) await baza.delete(igraci).where(eq(igraci.id, id));
  igracIds.length = 0;
  potezIds.length = 0;
});

async function prijavi(potezId: number | null | undefined) {
  return app.inject({
    url: '/api/prijave',
    method: 'POST',
    headers: { authorization: `Bearer ${sesijskiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ partijaId, potezId }),
  });
}

describe('POST /prijave', () => {
  it('odbija izostavljen ili null potezId', async () => {
    expect((await prijavi(null)).statusCode).toBe(400);
    expect((await prijavi(undefined)).statusCode).toBe(400);
  });

  it('dopušta tri riječi, odbija četvrtu i duplikat', async () => {
    expect((await prijavi(potezIds[0]!)).statusCode).toBe(200);
    expect((await prijavi(potezIds[0]!)).statusCode).toBe(409);
    expect((await prijavi(potezIds[1]!)).statusCode).toBe(200);
    expect((await prijavi(potezIds[2]!)).statusCode).toBe(200);
    expect((await prijavi(potezIds[3]!)).statusCode).toBe(429);
  });

  it('ne dopušta potez iz druge partije ni nesudionika', async () => {
    const drugi = await stvoriGostSesiju();
    igracIds.push(drugi.igracId);
    const odgovor = await app.inject({
      url: '/api/prijave',
      method: 'POST',
      headers: { authorization: `Bearer ${drugi.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ partijaId, potezId: potezIds[0] }),
    });
    expect(odgovor.statusCode).toBe(403);
  });

  it('konkurentni zahtjevi ne mogu probiti limit od tri prijave', async () => {
    const odgovori = await Promise.all(potezIds.map((potezId) => prijavi(potezId)));
    expect(odgovori.filter((odgovor) => odgovor.statusCode === 200)).toHaveLength(3);
    expect(odgovori.filter((odgovor) => odgovor.statusCode === 429)).toHaveLength(1);
    const spremljene = await baza.select({ id: prijave.id }).from(prijave).where(eq(prijave.partijaId, partijaId));
    expect(spremljene).toHaveLength(3);
  });
});
