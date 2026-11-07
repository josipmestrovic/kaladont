import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { TIP_SANDUCIC_TEST } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, sanducicPoruke } from '../src/baza/shema.js';
import { izdajSesiju, stvoriGostSesiju } from '../src/racuni/sesije.js';
import { obrisiRacun } from '../src/racuni/brisanje.js';
import { ocistiStareSanducicPoruke, ROK_SANDUCIC_PORUKE_MS } from '../src/sanducic/ciscenje.js';
import {
  dohvatiSazetak,
  oznaciProcitane,
  oznaciSveProcitane,
  potvrdiNajavu,
  stvoriPoruku,
} from '../src/sanducic/servis.js';

const igraciZaBrisanje: string[] = [];
let app: FastifyInstance;
let adresa: string;

async function noviIgrac(vrsta: 'gost' | 'registriran' = 'registriran'): Promise<{ id: string; token: string; email?: string }> {
  if (vrsta === 'gost') {
    const gost = await stvoriGostSesiju();
    igraciZaBrisanje.push(gost.igracId);
    return { id: gost.igracId, token: gost.token };
  }
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  const email = `sanducic-${id}@example.com`;
  await baza.insert(igraci).values({
    id,
    vrsta: 'registriran',
    nadimak: `Sand ${id.slice(0, 6)}`,
    email,
    lozinkaHash: 'lozinka123',
    emailPotvrdjen: true,
  });
  const sesija = await izdajSesiju(id);
  return { id, token: sesija.token, email };
}

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  if (igraciZaBrisanje.length === 0) return;
  for (const id of igraciZaBrisanje.splice(0)) {
    await baza.delete(sanducicPoruke).where(eq(sanducicPoruke.igracId, id));
    await baza.delete(igraci).where(eq(igraci.id, id));
  }
});

afterAll(async () => {
  await app.close();
});

describe('sandučic', () => {
  it('deduplicira po (igrac, ključ)', async () => {
    const igrac = await noviIgrac();
    const prva = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:jedan',
      podaci: { tekst: 'Prva' },
    });
    const druga = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:jedan',
      podaci: { tekst: 'Druga' },
    });
    expect(prva?.id).toBeTruthy();
    expect(druga).toBeNull();
    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi).toHaveLength(1);
  });

  it('razlikuje najavu od čitanja', async () => {
    const igrac = await noviIgrac();
    const poruka = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:najava',
    });
    expect(poruka).toBeTruthy();

    let sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu.map((p) => p.id)).toEqual([poruka!.id]);

    await potvrdiNajavu(igrac.id, [poruka!.id]);
    sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu).toHaveLength(0);

    await oznaciProcitane(igrac.id, [poruka!.id]);
    sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(0);
  });

  it('oznaciSve ne gutaju poruke stvorene nakon granice', async () => {
    const igrac = await noviIgrac();
    const stara = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:stara',
      stvorenaAt: new Date('2026-11-07T10:00:00.000Z'),
    });
    const granica = new Date('2026-11-07T10:00:30.000Z');
    const nova = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:nova',
      stvorenaAt: new Date('2026-11-07T10:01:00.000Z'),
    });
    const broj = await oznaciSveProcitane(igrac.id, granica);
    expect(broj).toBe(1);

    const sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu.map((p) => p.id)).toEqual([nova!.id]);
    expect(stara).toBeTruthy();
  });

  it('gost može čitati vlastiti sandučic, tuđi ID je 404', async () => {
    const gost = await noviIgrac('gost');
    const drugi = await noviIgrac('gost');
    const poruka = await stvoriPoruku({
      igracId: gost.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:gost',
    });
    const tuda = await stvoriPoruku({
      igracId: drugi.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:tuda',
    });

    const sazetak = await fetch(`${adresa}/api/sanducic/sazetak`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(sazetak.status).toBe(200);
    const tijelo = await sazetak.json() as { brojNeprocitanih: number };
    expect(tijelo.brojNeprocitanih).toBe(1);

    const tudaDetalj = await fetch(`${adresa}/api/sanducic/${tuda!.id}`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(tudaDetalj.status).toBe(404);

    const vlastita = await fetch(`${adresa}/api/sanducic/${poruka!.id}`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(vlastita.status).toBe(200);
  });

  it('briše poruke starije od 3 dana', async () => {
    const igrac = await noviIgrac();
    const sada = new Date('2026-11-07T12:00:00.000Z');
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:stara-3d',
      stvorenaAt: new Date(sada.getTime() - ROK_SANDUCIC_PORUKE_MS - 60_000),
    });
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:svjeza',
      stvorenaAt: sada,
    });
    const obrisano = await ocistiStareSanducicPoruke(sada);
    expect(obrisano).toBe(1);
    const preostale = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(preostale).toHaveLength(1);
    expect(preostale[0]?.deduplikacijskiKljuc).toBe('test:svjeza');
  });

  it('soft-delete uklanja sandučic poruke', async () => {
    const igrac = await noviIgrac('registriran');
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:brisanje',
    });
    expect(await obrisiRacun(igrac.email!, true)).toBe('obrisan');
    const preostale = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(preostale).toHaveLength(0);
  });
});
