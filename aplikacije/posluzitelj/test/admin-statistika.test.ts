import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { botovi, igraci, izmjeneBotova, izmjenePostavkiBotova, partije, postavkeBotova, sudioniciPartije } from '../src/baza/shema.js';
import { ucitajTrajnePostavkeBotova, type ZapisPostavkiBotova } from '../src/bot/trajne-postavke.js';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import { izracunajStatistikuCekanja } from '../src/admin/statistika-cekanja.js';
import type { PregledNadzora } from 'zajednicko';

let posluzitelj: Posluzitelj;
let adresa: string;
const SUFIKS = randomUUID().slice(0, 8);
let adminToken: string;
let obicanToken: string;
const stvoreniIgraci: string[] = [];
const stvorenePartije: string[] = [];
const stvoreniBotovi: { igracId: string; kljucSeeda: string }[] = [];
let pocetnePostavke: typeof postavkeBotova.$inferSelect | undefined;
const stvoreneRevizije: number[] = [];

beforeAll(async () => {
  [pocetnePostavke] = await baza.select().from(postavkeBotova);
  posluzitelj = await izgradiPosluzitelj();
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
  const registriraj = async (email: string) => {
    const odgovor = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true }),
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
  if (stvoreniBotovi.length) {
    const kljucevi = stvoreniBotovi.map((bot) => bot.kljucSeeda);
    await baza.delete(izmjeneBotova).where(inArray(izmjeneBotova.kljucSeeda, kljucevi));
    await baza.delete(botovi).where(inArray(botovi.igracId, stvoreniBotovi.map((bot) => bot.igracId)));
    await baza.delete(igraci).where(inArray(igraci.id, stvoreniBotovi.map((bot) => bot.igracId)));
  }
  if (stvoreneRevizije.length) {
    await baza.transaction(async (transakcija) => {
      const [aktualne] = await transakcija.select().from(postavkeBotova).where(eq(postavkeBotova.id, 1)).for('update');
      if (!aktualne || !stvoreneRevizije.includes(aktualne.revizija)) throw new Error('Postavke su promijenjene izvan testa; ne vraćam tuđu izmjenu.');
      await transakcija.delete(izmjenePostavkiBotova).where(inArray(izmjenePostavkiBotova.revizija, stvoreneRevizije));
      if (pocetnePostavke) await transakcija.update(postavkeBotova).set(pocetnePostavke).where(eq(postavkeBotova.id, 1));
      else await transakcija.delete(postavkeBotova).where(eq(postavkeBotova.id, 1));
    });
  }
  if (stvorenePartije.length) {
    await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, stvorenePartije));
    await baza.delete(partije).where(inArray(partije.id, stvorenePartije));
  }
  if (stvoreniIgraci.length) await baza.delete(igraci).where(inArray(igraci.id, stvoreniIgraci));
  await posluzitelj.zaustavi();
});

describe('GET /admin/statistike/cekanje', () => {
  it('bot postavke zahtijevaju admina, validiraju i transakcijski odbijaju neaktualnu reviziju', async () => {
    const putanja = `${adresa}/api/admin/botovi/postavke`;
    expect((await fetch(putanja)).status).toBe(401);
    expect((await fetch(putanja, { headers: { authorization: `Bearer ${obicanToken}` } })).status).toBe(403);
    const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
    expect((await fetch(putanja, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
    expect((await fetch(putanja, { method: 'PUT', headers: { authorization: `Bearer ${obicanToken}`, 'content-type': 'application/json' }, body: '{}' })).status).toBe(403);
    const odgovor = await fetch(putanja, { headers });
    expect(odgovor.headers.get('cache-control')).toBe('no-store');
    const prije = await odgovor.json() as ZapisPostavkiBotova;
    expect(prije.revizija).toBe(pocetnePostavke?.revizija ?? 0);
    const spremi = (konfiguracija = prije.konfiguracija, revizija = prije.revizija) => fetch(putanja, { method: 'PUT', headers, body: JSON.stringify({ revizija, konfiguracija }) });
    expect((await spremi({ ...prije.konfiguracija, udioBrzih: 0.9, udioUobicajenih: 0.9 })).status).toBe(400);
    expect((await spremi({ ...prije.konfiguracija, brziRazvoj: true })).status).toBe(400);
    const odgovori = await Promise.all([
      spremi({ ...prije.konfiguracija, brziRazvoj: false, vjerojatnostOstavljanjaKa: 0.22 }),
      spremi({ ...prije.konfiguracija, brziRazvoj: false, vjerojatnostOstavljanjaKa: 0.33 }),
    ]);
    expect(odgovori.map((stavka) => stavka.status).sort()).toEqual([200, 409]);
    const uspjeh = await odgovori.find((stavka) => stavka.status === 200)!.json() as ZapisPostavkiBotova;
    stvoreneRevizije.push(uspjeh.revizija);
    expect(uspjeh.revizija).toBe(prije.revizija + 1);
    expect((await spremi({ ...prije.konfiguracija, brziRazvoj: false }, prije.revizija)).status).toBe(409);
    const trajno = await ucitajTrajnePostavkeBotova(ZADANA_KONFIGURACIJA_BOTA);
    expect({ ok: true, ...trajno }).toEqual(uspjeh);
    const [audit] = await baza.select().from(izmjenePostavkiBotova).where(eq(izmjenePostavkiBotova.revizija, uspjeh.revizija));
    expect(audit?.konfiguracija).toEqual(uspjeh.konfiguracija);
    expect(audit?.adminId).toBe(stvoreniIgraci[0]);
    const poslije = await (await fetch(putanja, { headers })).json() as ZapisPostavkiBotova;
    expect(poslije.revizija).toBe(uspjeh.revizija);
    expect(poslije.konfiguracija).toEqual(uspjeh.konfiguracija);
    expect(JSON.stringify(poslije)).not.toContain(adminToken);
  });

  it('privatni nadzor zahtijeva admina, ne izlaže identitete i ne resetira health uzorak', async () => {
    const putanja = `${adresa}/api/admin/statistike/posluzitelj`;
    expect((await fetch(putanja)).status).toBe(401);
    expect((await fetch(putanja, { headers: { authorization: `Bearer ${obicanToken}` } })).status).toBe(403);
    const odgovor = await fetch(putanja, { headers: { authorization: `Bearer ${adminToken}` } });
    expect(odgovor.status).toBe(200);
    expect(odgovor.headers.get('cache-control')).toBe('no-store');
    const pregled = await odgovor.json() as PregledNadzora;
    expect(pregled.trenutno?.rssBajtovi).toBeGreaterThan(0);
    expect(pregled.povijest.length).toBeLessThanOrEqual(180);
    expect(pregled.emailOmogucen).toBe(false);
    const json = JSON.stringify(pregled);
    expect(json).not.toContain(adminToken);
    expect(json).not.toContain('remoteAddress');
    expect(json).not.toContain('@example.com');
    const prvi = (await posluzitelj.app.inject('/zdravlje')).json();
    const drugi = (await posluzitelj.app.inject('/zdravlje')).json();
    expect(drugi.eventLoopP95Ms).toBe(prvi.eventLoopP95Ms);
    expect((await posluzitelj.app.inject({ method: 'POST', url: '/api/admin/nadzor/probna-obavijest', remoteAddress: '203.0.113.20' })).statusCode).toBe(401);
    expect((await fetch(`${adresa}/api/admin/nadzor/probna-obavijest`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}` } })).status).toBe(409);
  });

  it('živi pregled botova je privatan i čitanje ne mijenja fond', async () => {
    const putanja = `${adresa}/api/admin/botovi/pregled`;
    expect((await fetch(putanja)).status).toBe(401);
    expect((await fetch(putanja, { headers: { authorization: `Bearer ${obicanToken}` } })).status).toBe(403);
    const headers = { authorization: `Bearer ${adminToken}` };
    const prvi = await fetch(putanja, { headers });
    expect(prvi.status).toBe(200);
    expect(prvi.headers.get('cache-control')).toBe('no-store');
    const pregled = await prvi.json() as { fond: unknown; botovi: { igracId: string; status: string; plan: unknown; rezervacija: unknown }[] };
    const drugi = await (await fetch(putanja, { headers })).json() as typeof pregled;
    expect(drugi.fond).toEqual(pregled.fond);
    expect(drugi.botovi).toEqual(pregled.botovi);
    expect(new Set(pregled.botovi.map((bot) => bot.igracId)).size).toBe(pregled.botovi.length);
    // Povijesni deaktivirani gost-botovi ostaju u pregledu; aktivni imenovani moraju biti slobodni.
    expect(pregled.botovi.filter((bot) => bot.aktivan).every((bot) => bot.status === 'slobodan' && bot.plan === null && bot.rezervacija === null)).toBe(true);
    expect(pregled.botovi.filter((bot) => !bot.aktivan).every((bot) => bot.status === 'deaktiviran')).toBe(true);
    expect(JSON.stringify(pregled)).not.toContain(adminToken);
    expect(JSON.stringify(pregled)).not.toContain('@example.com');
  });

  it('odbija novo stvaranje gost-bota; imenovani bot nema javni profil i može se deaktivirati', async () => {
    const putanja = `${adresa}/api/admin/botovi`;
    const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
    const odbijenGost = await fetch(putanja, { method: 'POST', headers, body: JSON.stringify({ broj: 1, tip: 'gost' }) });
    expect(odbijenGost.status).toBe(400);

    const prije = posluzitelj.fondBotova.stanje().ukupno;
    const odgovor = await fetch(putanja, { method: 'POST', headers, body: JSON.stringify({ broj: 1, tip: 'imenovani' }) });
    expect(odgovor.status).toBe(200);
    const stvoren = await odgovor.json() as { stvoreno: { igracId: string; kljucSeeda: string; tip: string }[]; aktivnoPoslije: number };
    const imenovani = stvoren.stvoreno[0]!;
    stvoreniBotovi.push(imenovani);
    expect(imenovani.tip).toBe('imenovani');
    expect(stvoren.aktivnoPoslije).toBe(prije + 1);
    expect((await fetch(`${adresa}/api/profil/javni/${imenovani.igracId}`)).status).toBe(404);

    const aktivacija = `${adresa}/api/admin/botovi/${imenovani.igracId}/aktivacija`;
    const deaktiviran = await fetch(aktivacija, { method: 'PUT', headers, body: JSON.stringify({ aktivan: false }) });
    expect(deaktiviran.status).toBe(200);
    expect(await deaktiviran.json()).toMatchObject({ ok: true, aktivan: false, dovrsavaIgru: false });
    const pregled = await (await fetch(`${adresa}/api/admin/botovi/pregled`, { headers: { authorization: `Bearer ${adminToken}` } })).json() as { botovi: { igracId: string; status: string; tip: string }[] };
    expect(pregled.botovi.find((bot) => bot.igracId === imenovani.igracId)).toMatchObject({ status: 'deaktiviran', tip: 'imenovani' });
    const aktiviran = await fetch(aktivacija, { method: 'PUT', headers, body: JSON.stringify({ aktivan: true }) });
    expect(aktiviran.status).toBe(200);
    expect(await baza.select().from(izmjeneBotova).where(eq(izmjeneBotova.botId, imenovani.igracId))).toHaveLength(3);
  });

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
