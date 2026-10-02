import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { inArray } from 'drizzle-orm';
import type { OdgovorLjestvice } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { igraci, partije, sudioniciPartije } from '../src/baza/shema.js';
import { registrirajLjestviceRute } from '../src/ljestvice/rute.js';
import { izracunajPoredak, pozicijaIgraca } from '../src/ljestvice/servis.js';

// Izolirani obuhvat u prošlosti da postojeći razvojni podaci ne utječu na poredak.
const OD = new Date('2001-03-05T23:00:00Z');
const DO = new Date('2001-03-12T23:00:00Z');
const stvoreniIgraci: string[] = [];
const stvorenePartije: string[] = [];
let brojac = 0;

async function noviIgrac(nadimak: string, obrisan = false): Promise<string> {
  const id = randomUUID();
  stvoreniIgraci.push(id);
  await baza.insert(igraci).values({ id, vrsta: 'registriran', nadimak, obrisanAt: obrisan ? new Date() : null });
  return id;
}

async function igra(
  igracId: string,
  rezultat: { plasman: number | null; bodovi?: number; mod?: 'cetiri_igraca' | 'dva_igraca'; status?: 'zavrsena' | 'u_tijeku' | 'ponistena'; pocetak?: Date; kraj?: Date },
): Promise<void> {
  brojac += 1;
  const id = randomUUID();
  stvorenePartije.push(id);
  const pocetak = rezultat.pocetak ?? new Date(OD.getTime() + brojac * 60_000);
  await baza.insert(partije).values({
    id,
    mod: rezultat.mod ?? 'cetiri_igraca',
    status: rezultat.status ?? 'zavrsena',
    pocetak,
    kraj: rezultat.kraj ?? new Date(pocetak.getTime() + 30_000),
  });
  await baza.insert(sudioniciPartije).values({
    partijaId: id,
    igracId,
    sjedalo: 0,
    plasman: rezultat.plasman,
    bodovi: rezultat.bodovi ?? (rezultat.plasman === 1 ? 4 : 0),
  });
}

async function niz(igracId: string, plasmani: number[], mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca') {
  for (const plasman of plasmani) await igra(igracId, { plasman, mod });
}

afterAll(async () => {
  if (stvorenePartije.length) {
    await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, stvorenePartije));
    await baza.delete(partije).where(inArray(partije.id, stvorenePartije));
  }
  if (stvoreniIgraci.length) await baza.delete(igraci).where(inArray(igraci.id, stvoreniIgraci));
});

describe('poredak vremenskih ljestvica (stvarni Postgres)', () => {
  it('kvalifikacija, izjednačenje, nizovi, kronologija i isključenja', async () => {
    // K01: 9 dnevnih igara ne ulazi, 10 ulazi.
    const devet = await noviIgrac('Devet');
    await niz(devet, Array(9).fill(1));
    const deset = await noviIgrac('Deset');
    await niz(deset, [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);

    // M01: isti prosjek (2,0), više igara ima prednost.
    const prosjekMalo = await noviIgrac('Prosjek20');
    for (let i = 0; i < 20; i += 1) await igra(prosjekMalo, { plasman: 2, bodovi: 2 });
    const prosjekVise = await noviIgrac('Prosjek30');
    for (let i = 0; i < 30; i += 1) await igra(prosjekVise, { plasman: 2, bodovi: 2 });

    // P01: P,P,N,P,P,P -> najduži niz 3; dopuna porazima do minimuma.
    const nizovi = await noviIgrac('Nizovi');
    await niz(nizovi, [1, 1, 3, 1, 1, 1, ...Array(14).fill(4)]);

    // P06: A (poraz) počinje prvi ali završava zadnji; B i C su pobjede -> niz 2 po redoslijedu ulaska.
    const kronologija = await noviIgrac('Kronologija');
    const t = OD.getTime() + 5 * 86_400_000;
    await igra(kronologija, { plasman: 4, pocetak: new Date(t), kraj: new Date(t + 600_000) });
    await igra(kronologija, { plasman: 1, pocetak: new Date(t + 60_000), kraj: new Date(t + 120_000) });
    await igra(kronologija, { plasman: 1, pocetak: new Date(t + 900_000), kraj: new Date(t + 960_000) });
    await niz(kronologija, Array(17).fill(3));

    // K06/K07/K08: drugi mod, aktivna i poništena igra ne ulaze.
    const izolacija = await noviIgrac('Izolacija');
    await niz(izolacija, Array(20).fill(1), 'dva_igraca');
    await igra(izolacija, { plasman: 1, status: 'u_tijeku' });
    await igra(izolacija, { plasman: 1, status: 'ponistena' });

    // Obrisani igrač ne ulazi u žive poretke.
    const obrisan = await noviIgrac('Obrisan', true);
    await niz(obrisan, Array(20).fill(1));

    // K11: samo porazi -> niz pobjeda nema rezultata, prosjek 0 je rangiran.
    const porazi = await noviIgrac('Porazi');
    await niz(porazi, Array(20).fill(4));

    // Nepotpun plasman ne smije poboljšati rezultat.
    const nepotpun = await noviIgrac('Nepotpun');
    await niz(nepotpun, Array(19).fill(1));
    await igra(nepotpun, { plasman: null });

    const dnevniOd = new Date('2001-03-05T23:00:00Z');
    const dnevniDo = new Date('2001-03-06T23:00:00Z');
    const dnevni = await izracunajPoredak('cetiri_igraca', 'prosjek_bodova', 'dnevno', dnevniOd, dnevniDo);
    expect(pozicijaIgraca(dnevni, devet)).toMatchObject({ status: 'nedovoljan_broj_igara', odigraneIgre: 9, nedostajeIgara: 1 });
    expect(pozicijaIgraca(dnevni, deset).status).toBe('rangiran');
    expect(pozicijaIgraca(dnevni, izolacija).status).toBe('nije_igrano');
    expect(pozicijaIgraca(dnevni, null).status).toBe('prijava_potrebna');

    const prosjek = await izracunajPoredak('cetiri_igraca', 'prosjek_bodova', 'tjedno', OD, DO);
    const mjesto = (id: string) => pozicijaIgraca(prosjek, id).mjesto;
    expect(mjesto(prosjekVise)).toBeLessThan(mjesto(prosjekMalo)!);
    expect(pozicijaIgraca(prosjek, porazi)).toMatchObject({ status: 'rangiran' });
    expect(pozicijaIgraca(prosjek, izolacija).status).toBe('nije_igrano');
    expect(pozicijaIgraca(prosjek, obrisan).status).toBe('nije_igrano');
    expect(pozicijaIgraca(prosjek, nepotpun).status).toBe('podaci_nepotpuni');
    expect(prosjek.rangirani.map((s) => s.mjesto)).toEqual(prosjek.rangirani.map((_, i) => i + 1));

    const pobjede = await izracunajPoredak('cetiri_igraca', 'niz_pobjeda', 'tjedno', OD, DO);
    const vrijednost = (id: string) => pobjede.poIgracu.get(id)?.vrijednost;
    expect(vrijednost(nizovi)).toEqual({ vrsta: 'niz_pobjeda', broj: 3 });
    expect(vrijednost(kronologija)).toEqual({ vrsta: 'niz_pobjeda', broj: 2 });
    expect(pozicijaIgraca(pobjede, porazi).status).toBe('nema_rezultata');

    const dvoboj = await izracunajPoredak('dva_igraca', 'niz_pobjeda', 'tjedno', OD, DO);
    expect(pozicijaIgraca(dvoboj, izolacija)).toMatchObject({ status: 'rangiran', mjesto: 1, odigraneIgre: 20 });
  });
});

describe('GET /api/ljestvice', () => {
  it('validira parametre, ne kešira osobni odgovor i zaključava svih vremena', async () => {
    const app = Fastify();
    await app.register(registrirajLjestviceRute, { prefix: '/api' });

    const los = await app.inject({ method: 'GET', url: '/api/ljestvice?metrika=nepostojeca' });
    expect(los.statusCode).toBe(400);

    const dnevna = await app.inject({ method: 'GET', url: '/api/ljestvice?mod=dva_igraca&metrika=niz_pobjeda&razdoblje=dnevno' });
    const tijelo = dnevna.json<OdgovorLjestvice>();
    expect(dnevna.statusCode).toBe(200);
    expect(dnevna.headers['cache-control']).toBe('private, no-store');
    expect(tijelo.redci.length).toBeLessThanOrEqual(10);
    expect(tijelo.mojaPozicija.status).toBe('prijava_potrebna');
    expect(tijelo.razdoblje.do).not.toBeNull();
    expect(Object.keys(tijelo.pozicijePoRazdobljima)).toEqual(['dnevno', 'tjedno', 'mjesecno', 'godisnje', 'svih_vremena']);

    const svih = (await app.inject({ method: 'GET', url: '/api/ljestvice?razdoblje=svih_vremena' })).json<OdgovorLjestvice>();
    expect(svih.razdoblje.stanje).toBe('zakljucano');
    expect(svih.razdoblje.otkljucavaSe).not.toBeNull();
    expect(svih.redci).toEqual([]);
    expect(svih.mojaPozicija.status).toBe('zakljucano');
    await app.close();
  });
});
