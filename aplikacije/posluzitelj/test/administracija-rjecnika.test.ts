import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, izmjeneRjecnika, rijeci, sigurnePocetneRijeci } from '../src/baza/shema.js';
import { RAZLOG_CISCENJA_NSTANDARDNIH } from '../src/rjecnik/administracija.js';

let app: FastifyInstance;
let adresa: string;
// samo hrvatska mala slova bez q/w/x/y — inače bi „normalna” riječ upala u čišćenje
const HR_SLOVA = 'abcdefghijklmnoprstuvz';
const NASUMICNI_SUFIKS = Array.from(
  { length: 6 },
  () => HR_SLOVA[Math.floor(Math.random() * HR_SLOVA.length)]!,
).join('');
const TESTNA_RIJEC = `testnarijec${NASUMICNI_SUFIKS}`;
const RIJEC_S_X = `taksix${NASUMICNI_SUFIKS}`;
const RIJEC_S_Y = `whisky${NASUMICNI_SUFIKS}`;
const RIJEC_NORMALNA = `cista${NASUMICNI_SUFIKS}`;
const EMAIL_ADMIN = `admin-${NASUMICNI_SUFIKS}@example.com`;
const EMAIL_OBICAN = `obican-${NASUMICNI_SUFIKS}@example.com`;
const LOZINKA = 'lozinka123';
const RIJEC_CISCENJA = [RIJEC_S_X, RIJEC_S_Y, RIJEC_NORMALNA];

let adminToken: string;
let obicanToken: string;
let adminId: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;

  const registracijaAdmin = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_ADMIN, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
  });
  const registracija = (await registracijaAdmin.json()) as {
    igracId: string;
    sesijskiToken: string;
  };
  adminId = registracija.igracId;
  adminToken = registracija.sesijskiToken;
  // rucna promocija u admina - jedini nacin u ovoj fazi (nema self-service)
  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, adminId));

  const registracijaObican = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_OBICAN, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
  });
  ({ sesijskiToken: obicanToken } = (await registracijaObican.json()) as { sesijskiToken: string });
});

afterEach(async () => {
  await baza.delete(sigurnePocetneRijeci).where(eq(sigurnePocetneRijeci.rijec, TESTNA_RIJEC));
  await baza.delete(izmjeneRjecnika).where(eq(izmjeneRjecnika.rijec, TESTNA_RIJEC));
  await baza.delete(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
  await baza.delete(izmjeneRjecnika).where(inArray(izmjeneRjecnika.rijec, RIJEC_CISCENJA));
  await baza.delete(rijeci).where(inArray(rijeci.rijec, RIJEC_CISCENJA));
});

afterAll(async () => {
  // Bulk čišćenje ostavlja audit retke s admin_id — mora prije brisanja računa.
  await baza.delete(izmjeneRjecnika).where(eq(izmjeneRjecnika.adminId, adminId));
  await baza.delete(igraci).where(eq(igraci.email, EMAIL_ADMIN));
  await baza.delete(igraci).where(eq(igraci.email, EMAIL_OBICAN));
  await app.close();
});

describe('POST /admin/rjecnik/dodaj', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('odbija prijavljenog korisnika koji nije admin', async () => {
    const odgovor = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${obicanToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test' }),
    });
    expect(odgovor.status).toBe(403);
  });

  it('admin dodaje riječ i odmah je vidljiva u rječniku bez restarta (live reload)', async () => {
    const odgovor = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, vrsta: 'imenica' }),
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
    expect(redak?.frekvencija).toBe(100);
  });

  it('admin može eksplicitno postaviti jako rijetku frekvenciju', async () => {
    const odgovor = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, vrsta: 'imenica', tierRijetkosti: 'jako_rijetka' }),
    });
    expect(odgovor.status).toBe(200);
    const [redak] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(redak?.frekvencija).toBe(0);
  });

  it('admin dodaje i izbacuje riječ iz sigurnog skupa', async () => {
    await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, vrsta: 'imenica' }),
    });

    const dodaj = await fetch(`${adresa}/api/admin/rjecnik/sigurni-skup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC }),
    });
    expect(dodaj.status).toBe(200);
    expect(((await dodaj.json()) as { promjena: string }).promjena).toBe('dodana');

    const lista = await fetch(`${adresa}/api/admin/rjecnik/sigurni-skup`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const tijeloListe = (await lista.json()) as { rijeci: { rijec: string }[] };
    expect(tijeloListe.rijeci.some((r) => r.rijec === TESTNA_RIJEC)).toBe(true);

    const izbaci = await fetch(`${adresa}/api/admin/rjecnik/sigurni-skup/${encodeURIComponent(TESTNA_RIJEC)}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(izbaci.status).toBe(200);
    expect(((await izbaci.json()) as { promjena: string }).promjena).toBe('uklonjena');
  });

  it('odbija dodavanje bez vrste riječi (ADR-013)', async () => {
    const odgovor = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC }),
    });
    expect(odgovor.status).toBe(400);
  });

  // 3 admin operacije = 3 puna reloada rjecnika od ~1,2 M redaka - treba vise od zadanih 15 s
  it('admin deaktivira pa vraća riječ', { timeout: 90_000 }, async () => {
    await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'priprema testa', vrsta: 'imenica' }),
    });

    const deaktivacija = await fetch(`${adresa}/api/admin/rjecnik/deaktiviraj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test deaktivacije' }),
    });
    expect(deaktivacija.status).toBe(200);
    const [poslijeDeaktivacije] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(poslijeDeaktivacije?.aktivna).toBe(false);

    const vracanje = await fetch(`${adresa}/api/admin/rjecnik/vrati`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'test vracanja' }),
    });
    expect(vracanje.status).toBe(200);
    const [poslijeVracanja] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
    expect(poslijeVracanja?.aktivna).toBe(true);
  });
});

describe('čišćenje nstandardnih riječi', () => {
  async function seedNstandardne() {
    await baza.insert(rijeci).values([
      {
        rijec: RIJEC_S_X,
        prvaDva: 'ta',
        zadnjaDva: NASUMICNI_SUFIKS.slice(-2),
        vrste: ['imenica'],
        grupe: [`imenica:${RIJEC_S_X}`],
        frekvencija: 3,
        aktivna: true,
      },
      {
        rijec: RIJEC_S_Y,
        prvaDva: 'wh',
        zadnjaDva: NASUMICNI_SUFIKS.slice(-2),
        vrste: ['imenica'],
        grupe: [`imenica:${RIJEC_S_Y}`],
        frekvencija: 2,
        aktivna: true,
      },
      {
        rijec: RIJEC_NORMALNA,
        prvaDva: 'ci',
        zadnjaDva: NASUMICNI_SUFIKS.slice(-2),
        vrste: ['imenica'],
        grupe: [`imenica:${RIJEC_NORMALNA}`],
        frekvencija: 9,
        aktivna: true,
      },
    ]);
  }

  it('non-admin ne smije pregledavati ni potvrditi čišćenje', async () => {
    const get = await fetch(`${adresa}/api/admin/rjecnik/ciscenje-nstandardnih`, {
      headers: { authorization: `Bearer ${obicanToken}` },
    });
    expect(get.status).toBe(403);

    const post = await fetch(`${adresa}/api/admin/rjecnik/ciscenje-nstandardnih`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${obicanToken}` },
      body: '{}',
    });
    expect(post.status).toBe(403);
  });

  it('GET vraća samo aktivne nstandardne; POST ih deaktivira i blokira vraćanje', { timeout: 90_000 }, async () => {
    await seedNstandardne();

    const preview = await fetch(`${adresa}/api/admin/rjecnik/ciscenje-nstandardnih`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(preview.status).toBe(200);
    const previewTijelo = (await preview.json()) as {
      ok: boolean;
      ukupno: number;
      rijeci: { rijec: string; frekvencija: number }[];
    };
    const kandidati = previewTijelo.rijeci.map((r) => r.rijec);
    expect(kandidati).toEqual(expect.arrayContaining([RIJEC_S_X, RIJEC_S_Y]));
    expect(kandidati).not.toContain(RIJEC_NORMALNA);

    const potvrda = await fetch(`${adresa}/api/admin/rjecnik/ciscenje-nstandardnih`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: '{}',
    });
    expect(potvrda.status).toBe(200);
    const potvrdaTijelo = (await potvrda.json()) as { ok: boolean; deaktivirano: number };
    expect(potvrdaTijelo.deaktivirano).toBeGreaterThanOrEqual(2);

    const [x, y, normalna] = await Promise.all([
      baza.select().from(rijeci).where(eq(rijeci.rijec, RIJEC_S_X)),
      baza.select().from(rijeci).where(eq(rijeci.rijec, RIJEC_S_Y)),
      baza.select().from(rijeci).where(eq(rijeci.rijec, RIJEC_NORMALNA)),
    ]);
    expect(x[0]?.aktivna).toBe(false);
    expect(y[0]?.aktivna).toBe(false);
    expect(normalna[0]?.aktivna).toBe(true);

    const izmjene = await baza
      .select()
      .from(izmjeneRjecnika)
      .where(inArray(izmjeneRjecnika.rijec, [RIJEC_S_X, RIJEC_S_Y]));
    expect(izmjene.length).toBe(2);
    expect(izmjene.every((i) => i.akcija === 'uklonjena' && i.razlog === RAZLOG_CISCENJA_NSTANDARDNIH)).toBe(true);

    const previewPoslije = await fetch(`${adresa}/api/admin/rjecnik/ciscenje-nstandardnih`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const previewPoslijeTijelo = (await previewPoslije.json()) as { rijeci: { rijec: string }[] };
    const kandidatiPoslije = previewPoslijeTijelo.rijeci.map((r) => r.rijec);
    expect(kandidatiPoslije).not.toContain(RIJEC_S_X);
    expect(kandidatiPoslije).not.toContain(RIJEC_S_Y);

    const vracanje = await fetch(`${adresa}/api/admin/rjecnik/vrati`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: RIJEC_S_X, razlog: 'pokusaj vracanja nstandardne' }),
    });
    expect(vracanje.status).toBe(400);
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
      aktivneVeze: number;
      rssBajtovi: number;
      heapUsedBajtovi: number;
      heapTotalBajtovi: number;
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
    expect(tijelo.aktivneVeze).toBeGreaterThanOrEqual(0);
    expect(tijelo.rssBajtovi).toBeGreaterThan(0);
    expect(tijelo.heapUsedBajtovi).toBeGreaterThan(0);
    expect(tijelo.heapTotalBajtovi).toBeGreaterThanOrEqual(tijelo.heapUsedBajtovi);
    expect(tijelo.uptimeSekunde).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /rjecnik/statistika', () => {
  it('javno vraća broj oblika po kategoriji sortirano silazno', async () => {
    const odgovor = await fetch(`${adresa}/api/rjecnik/statistika`);
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
