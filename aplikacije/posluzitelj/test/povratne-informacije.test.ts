import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca, povratneInformacije } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;
const sufiks = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const email = `misljenje-${sufiks}@example.com`;
const emailAdmin = `misljenje-admin-${sufiks}@example.com`;
const lozinka = 'lozinka123';
let token: string;
let tokenAdmin: string;
let igracId: string;

const ocjene = {
  pravila: 5,
  rjecnik: 4,
  vrijemePoteza: 3,
  snalazenjeUAplikaciji: 5,
  brzinaUcitavanja: 4,
  gamifikacija: 5,
};

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;

  const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, lozinka, nadimak: 'Mislilac' }),
  });
  ({ igracId, sesijskiToken: token } = await registracija.json() as { igracId: string; sesijskiToken: string });
  const registracijaAdmin = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: emailAdmin, lozinka, nadimak: 'AdminMisli' }),
  });
  const admin = await registracijaAdmin.json() as { igracId: string; sesijskiToken: string };
  tokenAdmin = admin.sesijskiToken;
  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, admin.igracId));
});

afterEach(async () => {
  await baza.delete(povratneInformacije).where(eq(povratneInformacije.igracId, igracId));
  await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
  await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
});

afterAll(async () => {
  await baza.delete(igraci).where(eq(igraci.email, email));
  await baza.delete(igraci).where(eq(igraci.email, emailAdmin));
  await app.close();
});

function zaglavlja(tokenZahtjeva = token) {
  return { 'content-type': 'application/json', authorization: `Bearer ${tokenZahtjeva}` };
}

describe('povratne informacije', () => {
  it('odbija gosta bez registrirane prijave', async () => {
    const odgovor = await fetch(`${adresa}/api/povratne-informacije/stanje`);
    expect(odgovor.status).toBe(401);
  });

  it('odbija prekratku poruku', async () => {
    const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(), body: JSON.stringify({ poruka: 'Prekratko.' }),
    });
    expect(odgovor.status).toBe(400);
    expect((await odgovor.json() as { greska: string }).greska).toBe('Prekratka poruka.');
  });

  it('odbija nepotpunu prvu anketu', async () => {
    const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Poruka je dovoljno duga, ali anketa namjerno nema sve ocjene.', ocjene: { pravila: 5 } }),
    });
    expect(odgovor.status).toBe(400);
  });

  it('prvu anketu sprema s ocjenama i otključava Glas zajednice', async () => {
    const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Pravila su jasna, a igra se brzo i ugodno učitava.', ocjene }),
    });
    expect(odgovor.status).toBe(200);
    expect(await odgovor.json()).toMatchObject({ ok: true, anketaIspunjena: true, brojPoslanih: 1 });

    const stanje = await fetch(`${adresa}/api/povratne-informacije/stanje`, { headers: zaglavlja() });
    expect(await stanje.json()).toMatchObject({ anketaIspunjena: true, brojPoslanih: 1 });
    const [dostignuce] = await baza.select().from(dostignucaIgraca)
      .where(eq(dostignucaIgraca.igracId, igracId));
    expect(dostignuce).toMatchObject({ dostignuceId: 'glas_zajednice', razina: 1 });
  });

  it('nakon ankete prihvaća samo tekst i odbija nove ocjene', async () => {
    await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Prva detaljna povratna informacija ima dovoljno znakova.', ocjene }),
    });
    const tekstualna = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Druga povratna informacija je samo tekstualna i također je dovoljno duga.' }),
    });
    expect(tekstualna.status).toBe(200);
    const ponovljeneOcjene = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Treća poruka pokušava ponovno poslati detaljne ocjene igre.', ocjene }),
    });
    expect(ponovljeneOcjene.status).toBe(409);
  });

  it('prvi tekstualni obrazac bez ocjena trajno zatvara detaljnu anketu', async () => {
    const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Želim poslati samo tekstualnu povratnu informaciju bez ocjena igre.' }),
    });
    expect(odgovor.status).toBe(200);
    const stanje = await fetch(`${adresa}/api/povratne-informacije/stanje`, { headers: zaglavlja() });
    expect(await stanje.json()).toMatchObject({ anketaIspunjena: true, brojPoslanih: 1 });
  });

  it('Glas zajednice doseže petu razinu nakon pet obrazaca', async () => {
    for (let redniBroj = 1; redniBroj <= 5; redniBroj += 1) {
      const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
        method: 'POST', headers: zaglavlja(),
        body: JSON.stringify({ poruka: `Povratna informacija broj ${redniBroj} ima dovoljno znakova za spremanje.` }),
      });
      expect(odgovor.status).toBe(200);
    }
    const [dostignuce] = await baza.select().from(dostignucaIgraca)
      .where(eq(dostignucaIgraca.igracId, igracId));
    expect(dostignuce).toMatchObject({ dostignuceId: 'glas_zajednice', razina: 5 });
  });

  it('admin vidi email i može arhivirati povratnu informaciju', async () => {
    const slanje = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST', headers: zaglavlja(),
      body: JSON.stringify({ poruka: 'Ova povratna informacija omogućuje provjeru administrativnog pregleda.' }),
    });
    const { id } = await slanje.json() as { id: number };
    const obican = await fetch(`${adresa}/api/admin/povratne-informacije`, { headers: zaglavlja() });
    expect(obican.status).toBe(403);
    const admin = await fetch(`${adresa}/api/admin/povratne-informacije`, { headers: zaglavlja(tokenAdmin) });
    const tijelo = await admin.json() as { povratneInformacije: { id: number; email: string }[] };
    expect(tijelo.povratneInformacije.find((redak) => redak.id === id)?.email).toBe(email);
    const status = await fetch(`${adresa}/api/admin/povratne-informacije/${id}/status`, {
      method: 'POST', headers: zaglavlja(tokenAdmin), body: JSON.stringify({ status: 'arhivirana' }),
    });
    expect(status.status).toBe(200);
  });
});
