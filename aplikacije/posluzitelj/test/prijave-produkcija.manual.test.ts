/**
 * Ručni produkcijski suite za prijave i admin akcije.
 * Nije u CI — pokreni: pnpm --filter posluzitelj test:prijave-produkcija
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import {
  igraci,
  izmjeneRjecnika,
  partije,
  potezi,
  prijave,
  prijaveIgraca,
  rijeci,
  sudioniciPartije,
} from '../src/baza/shema.js';
import { stvoriGostSesiju } from '../src/racuni/sesije.js';

let app: FastifyInstance;
let adresa: string;

const NASUMICNI = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
const TESTNA_RIJEC = `prodrijec${NASUMICNI}`;
const EMAIL_ADMIN = `admin-prod-${NASUMICNI}@example.com`;
const LOZINKA = 'lozinka123';

let adminToken: string;
let adminId: string;
const igracIds: string[] = [];
const partijaIds: string[] = [];

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;

  const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL_ADMIN, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
  });
  const tijelo = (await registracija.json()) as { igracId: string; sesijskiToken: string };
  adminId = tijelo.igracId;
  adminToken = tijelo.sesijskiToken;
  igracIds.push(adminId);
  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, adminId));
}, 120_000);

afterEach(async () => {
  for (const partijaId of partijaIds.splice(0)) {
    await baza.delete(prijave).where(eq(prijave.partijaId, partijaId));
    await baza.delete(prijaveIgraca).where(eq(prijaveIgraca.partijaId, partijaId));
    await baza.delete(potezi).where(eq(potezi.partijaId, partijaId));
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
    await baza.delete(partije).where(eq(partije.id, partijaId));
  }
  await baza.delete(izmjeneRjecnika).where(eq(izmjeneRjecnika.rijec, TESTNA_RIJEC));
  await baza.delete(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC));
});

afterAll(async () => {
  for (const id of igracIds) await baza.delete(igraci).where(eq(igraci.id, id));
  await app.close();
});

async function stvoriPartiju(status: 'u_tijeku' | 'zavrsena') {
  const gost = await stvoriGostSesiju();
  igracIds.push(gost.igracId);
  const drugi = await stvoriGostSesiju();
  igracIds.push(drugi.igracId);
  const [partija] = await baza
    .insert(partije)
    .values({ mod: 'dva_igraca', status, pobjednikId: status === 'zavrsena' ? gost.igracId : null })
    .returning({ id: partije.id });
  if (!partija) throw new Error('Partija nije stvorena.');
  partijaIds.push(partija.id);
  await baza.insert(sudioniciPartije).values([
    { partijaId: partija.id, igracId: gost.igracId, sjedalo: 0 },
    { partijaId: partija.id, igracId: drugi.igracId, sjedalo: 1 },
  ]);
  const [potez] = await baza
    .insert(potezi)
    .values({
      partijaId: partija.id,
      runda: 1,
      redniBroj: 1,
      igracId: gost.igracId,
      vrsta: 'rijec',
      rijec: `rije${NASUMICNI}`,
      trazenaSlova: 'ri',
      trajanjeMs: 100,
    })
    .returning({ id: potezi.id, rijec: potezi.rijec });
  if (!potez) throw new Error('Potez nije stvoren.');
  return { partijaId: partija.id, token: gost.token, igracId: gost.igracId, drugiId: drugi.igracId, potez };
}

describe('produkcijski prijave (ručno)', () => {
  it('admin dodaje riječ pa ju deaktivira', async () => {
    const dodaj = await fetch(`${adresa}/api/admin/rjecnik/dodaj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'manual suite', vrsta: 'imenica' }),
    });
    expect(dodaj.status).toBe(200);

    const [aktivna] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC)).limit(1);
    expect(aktivna?.aktivna).toBe(true);

    const deaktiviraj = await fetch(`${adresa}/api/admin/rjecnik/deaktiviraj`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ rijec: TESTNA_RIJEC, razlog: 'manual suite brisanje' }),
    });
    expect(deaktiviraj.status).toBe(200);

    const [neaktivna] = await baza.select().from(rijeci).where(eq(rijeci.rijec, TESTNA_RIJEC)).limit(1);
    expect(neaktivna?.aktivna).toBe(false);
  });

  it('admin briše račun preko prijave igrača', async () => {
    const { partijaId, token, drugiId } = await stvoriPartiju('zavrsena');
    const prijava = await fetch(`${adresa}/api/prijave-igraca`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ partijaId, prijavljeniIgracId: drugiId, razlog: 'pogrdan_nadimak' }),
    });
    expect(prijava.status).toBe(200);

    const [redak] = await baza.select().from(prijaveIgraca).where(eq(prijaveIgraca.partijaId, partijaId)).limit(1);
    expect(redak).toBeTruthy();

    const brisanje = await fetch(`${adresa}/api/admin/prijave-igraca/${redak!.id}/obrisi-racun`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: '{}',
    });
    expect(brisanje.status).toBe(200);

    const [obrisan] = await baza.select().from(igraci).where(eq(igraci.id, drugiId)).limit(1);
    expect(obrisan).toMatchObject({
      nadimak: 'Obrisani igrač',
      email: null,
      lozinkaHash: null,
      emailPotvrdjen: false,
    });
    expect(obrisan?.obrisanAt).toBeInstanceOf(Date);
    expect(obrisan?.obrisanAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('prijava riječi tijekom partije (za_brisanje + za_dodavanje)', async () => {
    const { partijaId, token, potez } = await stvoriPartiju('u_tijeku');

    const brisanje = await fetch(`${adresa}/api/prijave`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ partijaId, tip: 'za_brisanje', potezId: potez.id }),
    });
    expect(brisanje.status).toBe(200);

    const dodavanje = await fetch(`${adresa}/api/prijave`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ partijaId, tip: 'za_dodavanje', rijec: 'nedostajeproda' }),
    });
    expect(dodavanje.status).toBe(200);

    const retci = await baza.select().from(prijave).where(eq(prijave.partijaId, partijaId));
    expect(retci).toHaveLength(2);
    expect(retci.some((r) => r.tip === 'za_brisanje' && r.rijec === potez.rijec)).toBe(true);
    expect(retci.some((r) => r.tip === 'za_dodavanje' && r.rijec === 'nedostajeproda')).toBe(true);
  });

  it('prijava na kraju partije i admin lista bez prijavitelja', async () => {
    const { partijaId, token, drugiId, potez } = await stvoriPartiju('zavrsena');

    expect(
      (
        await fetch(`${adresa}/api/prijave`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ partijaId, tip: 'za_brisanje', potezId: potez.id }),
        })
      ).status,
    ).toBe(200);

    expect(
      (
        await fetch(`${adresa}/api/prijave-igraca`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ partijaId, prijavljeniIgracId: drugiId, razlog: 'pogrdan_nadimak' }),
        })
      ).status,
    ).toBe(200);

    const rijeciLista = await fetch(`${adresa}/api/admin/prijave`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(rijeciLista.status).toBe(200);
    const tijeloRijeci = (await rijeciLista.json()) as { prijave: Array<Record<string, unknown>> };
    const redakRijeci = tijeloRijeci.prijave.find((p) => p.partijaId === partijaId);
    expect(redakRijeci).toMatchObject({ tip: 'za_brisanje', rijec: potez.rijec });
    expect(redakRijeci).not.toHaveProperty('igracId');

    const igraciLista = await fetch(`${adresa}/api/admin/prijave-igraca`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(igraciLista.status).toBe(200);
    const tijeloIgraci = (await igraciLista.json()) as { prijave: Array<Record<string, unknown>> };
    const redakIgraca = tijeloIgraci.prijave.find((p) => p.prijavljeniIgracId === drugiId);
    expect(redakIgraca).toHaveProperty('nadimak');
    expect(redakIgraca).not.toHaveProperty('prijaviteljId');

    // dismiss ostavlja listu čistom
    const [prijavaRijeci] = await baza
      .select()
      .from(prijave)
      .where(and(eq(prijave.partijaId, partijaId), eq(prijave.tip, 'za_brisanje')))
      .limit(1);
    const dismiss = await fetch(`${adresa}/api/admin/prijave/${prijavaRijeci!.id}/dismiss`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
      body: '{}',
    });
    expect(dismiss.status).toBe(200);
    const [rijesena] = await baza.select().from(prijave).where(eq(prijave.id, prijavaRijeci!.id)).limit(1);
    expect(rijesena?.status).toBe('rijesena');
  });
});
