import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  zadnjaDva,
  type Eliminacija,
  type KrajPartije,
  type PocetakPartije,
  type RundaOtvorena,
  type StanjePartije,
} from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { partije, rijeci } from '../src/baza/shema.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

interface Igrac {
  token: string;
  socket: ClientSocket;
}

function spojiIgraca(token = randomUUID(), ciljnaAdresa = adresa): Promise<Igrac> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ciljnaAdresa, { auth: { token }, forceNew: true });
    socket.on('connect', () => resolve({ token, socket }));
    socket.on('connect_error', reject);
  });
}

function spojiIgracaIPricekajStanje(
  token: string,
  ciljnaAdresa = adresa,
): Promise<{ igrac: Igrac; stanje: StanjePartije }> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ciljnaAdresa, { auth: { token }, forceNew: true, autoConnect: false });
    let spojeno = false;
    let stanje: StanjePartije | null = null;
    const dovrsi = () => {
      if (spojeno && stanje) resolve({ igrac: { token, socket }, stanje });
    };
    socket.once('connect', () => {
      spojeno = true;
      dovrsi();
    });
    socket.once('partija:stanje', (novoStanje) => {
      stanje = novoStanje;
      dovrsi();
    });
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function spojiIgracaIPricekajStanjeIKraj(
  token: string,
  ciljnaAdresa = adresa,
): Promise<{ igrac: Igrac; stanje: StanjePartije; kraj: KrajPartije }> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(ciljnaAdresa, { auth: { token }, forceNew: true, autoConnect: false });
    let stanje: StanjePartije | null = null;
    let kraj: KrajPartije | null = null;
    const dovrsi = () => {
      if (stanje && kraj) resolve({ igrac: { token, socket }, stanje, kraj });
    };
    socket.once('partija:stanje', (poruka) => {
      stanje = poruka;
      dovrsi();
    });
    socket.once('partija:kraj', (poruka) => {
      kraj = poruka;
      dovrsi();
    });
    socket.once('connect_error', reject);
    socket.connect();
  });
}

function odgodi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cekajZavrsenuPartiju(partijaId: string, timeoutMs = 2_000): Promise<void> {
  const istek = Date.now() + timeoutMs;
  while (Date.now() < istek) {
    const [partija] = await baza
      .select({ status: partije.status })
      .from(partije)
      .where(eq(partije.id, partijaId));
    if (partija?.status === 'zavrsena') return;
    await odgodi(20);
  }
  throw new Error(`Partija ${partijaId} nije završena unutar ${timeoutMs} ms.`);
}

async function pokreniPartiju(
  ciljnaAdresa = adresa,
): Promise<{ igraci: Igrac[]; pocetak: PocetakPartije; runda: RundaOtvorena }> {
  const igraci = await Promise.all(Array.from({ length: 4 }, () => spojiIgraca(randomUUID(), ciljnaAdresa)));
  const pocetakPromise = new Promise<PocetakPartije>((resolve) => igraci[0]!.socket.once('partija:pocetak', resolve));
  const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
  for (const igrac of igraci) igrac.socket.emit('red:udji');
  const [pocetak, runda] = await Promise.all([pocetakPromise, rundaPromise]);
  return { igraci, pocetak, runda };
}

function odspojiIgrace(igraci: readonly Igrac[]): void {
  for (const igrac of igraci) {
    if (igrac.socket.connected) igrac.socket.disconnect();
  }
}

function cekajJedanOd<T extends string>(
  socket: ClientSocket,
  eventi: T[],
): Promise<{ event: T; payload: unknown }> {
  return new Promise((resolve) => {
    const funkcije = eventi.map((event) => {
      const fn = (payload: unknown) => {
        for (const [drugiEvent, drugaFn] of parovi) socket.off(drugiEvent, drugaFn);
        resolve({ event, payload });
      };
      return [event, fn] as const;
    });
    const parovi = funkcije;
    for (const [event, fn] of funkcije) socket.on(event, fn);
  });
}

/** Ceka da sustav otkrije rijec za otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta). */
function cekajRunduOtvorenu(socket: ClientSocket): Promise<RundaOtvorena> {
  return new Promise((resolve) => socket.on('partija:runda-otvorena', resolve));
}

/**
 * Ceka potez:prihvacen ciji je autor bas `igracId` - potrebno jer je 'potez:prihvacen' broadcast
 * svima u sobi, pa bi listener na necijem tudjem socketu mogao uhvatiti "jos u letu" broadcast
 * prethodnog poteza umjesto sljedeceg (svaki igrac je istovremeno i mover i promatrac).
 */
function cekajPrihvacenOdIgraca(
  socket: ClientSocket,
  igracId: string,
): Promise<{ igracId: string; rijec: string; trazenaSlova: string; sljedeciId: string }> {
  return new Promise((resolve) => {
    function handler(p: { igracId: string; rijec: string; trazenaSlova: string; sljedeciId: string }) {
      if (p.igracId !== igracId) return;
      socket.off('potez:prihvacen', handler);
      resolve(p);
    }
    socket.on('potez:prihvacen', handler);
  });
}

/** Kandidat s grupama - potrebno jer potez troši SVE grupe oblika (RS-28/RS-29, ADR-013). */
interface KandidatRijec {
  rijec: string;
  grupe: string[];
}

async function kandidatiNaPrefiks(prefiks: string, limit: number): Promise<KandidatRijec[]> {
  return baza
    .select({ rijec: rijeci.rijec, grupe: rijeci.grupe })
    .from(rijeci)
    .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, prefiks)))
    .limit(limit);
}

async function grupeRijeci(rijec: string): Promise<string[]> {
  const [redak] = await baza
    .select({ grupe: rijeci.grupe })
    .from(rijeci)
    .where(eq(rijeci.rijec, rijec))
    .limit(1);
  return redak?.grupe ?? [];
}

function jeIgriva(kandidat: KandidatRijec, potrosene: ReadonlySet<string>): boolean {
  return kandidat.grupe.every((grupa) => !potrosene.has(grupa));
}

function uzGrupe(potrosene: ReadonlySet<string>, grupe: readonly string[]): Set<string> {
  const novo = new Set(potrosene);
  for (const grupa of grupe) novo.add(grupa);
  return novo;
}

/** Postoji li igriva rijec (nijedna grupa potrosena) koja nastavlja na zadnja dva grafema kandidata. */
async function imaZivNastavak(kandidat: KandidatRijec, potrosene: ReadonlySet<string>): Promise<boolean> {
  const nakon = uzGrupe(potrosene, kandidat.grupe);
  const nastavci = await kandidatiNaPrefiks(zadnjaDva(kandidat.rijec), 50);
  return nastavci.some((n) => n.rijec !== kandidat.rijec && jeIgriva(n, nakon));
}

/** Igriva rijec koja pocinje na zadane grafeme i sama ima daljnji nastavak (server bi je inace odmah eliminirao). */
async function pronadjiRijecNaPrefiks(prefiks: string, potrosene: ReadonlySet<string>): Promise<string> {
  const rezultati = await kandidatiNaPrefiks(prefiks, 100);
  for (const kandidat of rezultati) {
    if (jeIgriva(kandidat, potrosene) && (await imaZivNastavak(kandidat, potrosene))) return kandidat.rijec;
  }
  throw new Error(`Nema "zive" rijeci za prefiks ${prefiks}`);
}

/**
 * Trazi lanac stvarnih rijeci (svaka sa zivim nastavkom, inace bi server sam eliminirao sljedeceg
 * igraca umjesto da normalno prihvati potez) koji pocinje na `prefiks` i zavrsava rijecju na "ka" -
 * potrebno jer sustav (ne test) bira pocetnu rijec runde pa se unaprijed ne zna trazeni dvograf.
 * BFS po dvografima (ne po rijecima), uz pracenje potrosenih grupa duz puta (ADR-013).
 */
async function pronadjiLanacDoKa(
  prefiks: string,
  pocetnePotrosene: ReadonlySet<string>,
): Promise<string[] | null> {
  interface Cvor {
    prefiks: string;
    put: string[];
    potrosene: Set<string>;
  }
  let razina: Cvor[] = [{ prefiks, put: [], potrosene: new Set(pocetnePotrosene) }];
  const posjeceniPrefiksi = new Set([prefiks]);

  for (let dubina = 0; dubina < 6 && razina.length > 0; dubina += 1) {
    const sljedecaRazina: Cvor[] = [];
    for (const cvor of razina) {
      // ciljano: rijeci na trazeni prefiks koje ZAVRSAVAJU na "ka" (dovoljno raznolik uzorak iz baze)
      const kaKandidati = await baza
        .select({ rijec: rijeci.rijec, grupe: rijeci.grupe })
        .from(rijeci)
        .where(and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, cvor.prefiks), eq(rijeci.zadnjaDva, 'ka')))
        .limit(50);
      for (const kandidat of kaKandidati) {
        if (jeIgriva(kandidat, cvor.potrosene) && (await imaZivNastavak(kandidat, cvor.potrosene))) {
          return [...cvor.put, kandidat.rijec];
        }
      }

      const rezultati = await kandidatiNaPrefiks(cvor.prefiks, 300);
      const kandidati = rezultati.filter(
        (k) => jeIgriva(k, cvor.potrosene) && !cvor.put.includes(k.rijec),
      );

      for (const kandidat of kandidati.slice(0, 15)) {
        const noviPrefiks = zadnjaDva(kandidat.rijec);
        if (posjeceniPrefiksi.has(noviPrefiks)) continue;
        if (!(await imaZivNastavak(kandidat, cvor.potrosene))) continue;
        posjeceniPrefiksi.add(noviPrefiks);
        sljedecaRazina.push({
          prefiks: noviPrefiks,
          put: [...cvor.put, kandidat.rijec],
          potrosene: uzGrupe(cvor.potrosene, kandidat.grupe),
        });
      }
    }
    razina = sljedecaRazina;
  }
  return null;
}

describe('motor partije - kraj do kraja koristeći samo "ne znam"', () => {
  it('vraća trenutačno stanje partije za resinkronizaciju', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);
    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);

    for (const igrac of igraci) igrac.socket.emit('red:udji');
    const pocetak = await pocetakPromise;
    const runda = await rundaPromise;

    const stanjePromise = new Promise<StanjePartije>((resolve) => {
      igraci[1]!.socket.once('partija:stanje', resolve);
    });
    igraci[1]!.socket.emit('partija:stanje');
    const stanje = await stanjePromise;

    expect(stanje.partijaId).toBe(pocetak.partijaId);
    expect(stanje.mojIgracId).toBe(igraci[1]!.token);
    expect(stanje.sjedala).toHaveLength(4);
    expect(stanje.naPotezuId).toBe(runda.naPotezuId);
    expect(stanje.trazenaSlova).toBe(runda.trazenaSlova);
    expect(stanje.sustavBiraRijec).toBe(false);
    expect(stanje.brojIskoristenih).toBeGreaterThan(0);
    expect(stanje.zadnjaRijec).toBe(runda.rijec);
    expect(stanje.zadnjaRijecIgracId).toBeNull();
    expect(stanje.zadnjaRijecVrsta).toBe('sustav_rijec');

    for (const igrac of igraci) igrac.socket.disconnect();
  });

  it('partija završava s 4 plasmana i bodovima koji poštuju bodovanje-i-rangovi.md', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);

    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const prvaRundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    const pocetak = await pocetakPromise;
    const prvaRunda = await prvaRundaPromise;

    let naPotezuId = prvaRunda.naPotezuId;
    let krajPoruka: KrajPartije | null = null;

    for (let i = 0; i < 15 && !krajPoruka; i += 1) {
      const igrac = igraci.find((ig) => ig.token === naPotezuId)!;
      const cekanje = cekajJedanOd(igrac.socket, ['partija:runda-otvorena', 'partija:kraj']);
      igrac.socket.emit('potez:ne-znam');
      const { event, payload } = await cekanje;
      if (event === 'partija:kraj') {
        krajPoruka = payload as KrajPartije;
      } else {
        naPotezuId = (payload as RundaOtvorena).naPotezuId;
      }
    }

    expect(krajPoruka).not.toBeNull();
  expect(krajPoruka!.partijaId).toBe(pocetak.partijaId);
    const plasmani = krajPoruka!.plasmani;
    expect(plasmani).toHaveLength(4);
    expect(new Set(plasmani.map((p) => p.plasman))).toEqual(new Set([1, 2, 3, 4]));
    for (const p of plasmani) {
      expect(p.bodovi).toBeGreaterThanOrEqual(0);
      expect(p.bodovi).toBeLessThanOrEqual(7);
    }

    for (const igrac of igraci) igrac.socket.disconnect();
  });

  it('prihvaća valjan potez stvarnom riječi iz uvezenog rječnika i emitira potez:prihvacen', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);

    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    await pocetakPromise;
    const runda = await rundaPromise;

    const otvarac = igraci.find((ig) => ig.token === runda.naPotezuId)!;
    const potrosene = new Set(await grupeRijeci(runda.rijec));
    const rijecZaIgru = await pronadjiRijecNaPrefiks(runda.trazenaSlova, potrosene);

    const prihvacenoPromise = new Promise<{ trazenaSlova: string; sljedeciId: string }>((resolve) => {
      otvarac.socket.on('potez:prihvacen', resolve);
    });
    const odbijenoPromise = new Promise((resolve) => otvarac.socket.on('potez:odbijen', resolve));

    otvarac.socket.emit('potez:rijec', { rijec: rijecZaIgru });

    const rezultat = await Promise.race([prihvacenoPromise, odbijenoPromise]);
    expect(rezultat).toHaveProperty('trazenaSlova', zadnjaDva(rijecZaIgru));

    const stanjePromise = new Promise<StanjePartije>((resolve) => {
      igraci[1]!.socket.once('partija:stanje', resolve);
    });
    igraci[1]!.socket.emit('partija:stanje');
    const stanje = await stanjePromise;
    expect(stanje.zadnjaRijec).toBe(rijecZaIgru);
    expect(stanje.zadnjaRijecIgracId).toBe(otvarac.token);
    expect(stanje.zadnjaRijecVrsta).toBe('rijec');
    expect(stanje.zavrsena).toBe(false);

    for (const igrac of igraci) igrac.socket.disconnect();
  });

  it('RS-09: istek tolerancije na potezu eliminira igrača i daje bod napadaču', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);

    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    await pocetakPromise;
    const runda = await rundaPromise;

    const otvarac = igraci.find((ig) => ig.token === runda.naPotezuId)!;
    const rijecZaIgru = await pronadjiRijecNaPrefiks(
      runda.trazenaSlova,
      new Set(await grupeRijeci(runda.rijec)),
    );

    const prihvacenoPromise = new Promise<{ sljedeciId: string }>((resolve) => {
      otvarac.socket.on('potez:prihvacen', resolve);
    });
    otvarac.socket.emit('potez:rijec', { rijec: rijecZaIgru });
    const prihvaceno = await prihvacenoPromise;

    const sljedeci = igraci.find((ig) => ig.token === prihvaceno.sljedeciId)!;
    const promatrac = igraci.find((ig) => ig !== otvarac && ig !== sljedeci)!;

    const eliminacijaPromise = new Promise<{ igracId: string; razlog: string; bodZa: string | null }>(
      (resolve) => {
        promatrac.socket.on('partija:eliminacija', resolve);
      },
    );

    sljedeci.socket.disconnect(); // prekid veze dok je na potezu (RS-09)

    const eliminacija = await eliminacijaPromise;
    expect(eliminacija.igracId).toBe(sljedeci.token);
    expect(eliminacija.razlog).toBe('prekid');
    expect(eliminacija.bodZa).toBe(otvarac.token); // napadac = autor zadnje prihvacene rijeci

    for (const igrac of igraci) if (igrac !== sljedeci) igrac.socket.disconnect();
  });

  it('RS-10: istek tolerancije izvan poteza je samoeliminacija bez boda, igra se nastavlja', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);

    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    await pocetakPromise;
    const runda = await rundaPromise;

    const naPotezu = igraci.find((ig) => ig.token === runda.naPotezuId)!;
    const izvanPoteza = igraci.find((ig) => ig.token !== runda.naPotezuId)!;
    const promatrac = igraci.find((ig) => ig !== naPotezu && ig !== izvanPoteza)!;

    const eliminacijaPromise = new Promise<{ igracId: string; razlog: string; bodZa: string | null }>(
      (resolve) => {
        promatrac.socket.on('partija:eliminacija', resolve);
      },
    );

    izvanPoteza.socket.disconnect(); // prekid izvan poteza (RS-10)

    const eliminacija = await eliminacijaPromise;
    expect(eliminacija.igracId).toBe(izvanPoteza.token);
    expect(eliminacija.razlog).toBe('prekid');
    expect(eliminacija.bodZa).toBeNull(); // samoeliminacija - nitko ne dobiva bod

    for (const igrac of igraci) igrac.socket.disconnect();
  });

  it('RS-10 koristi stanje u trenutku prekida ako red tijekom tolerancije dođe do igrača', async () => {
    const { igraci, pocetak, runda } = await pokreniPartiju();
    const poredak = pocetak.sjedala.map((sjedalo) => sjedalo.igracId);
    const indeksNaPotezu = poredak.indexOf(runda.naPotezuId);
    const sljedeciId = poredak[(indeksNaPotezu + 1) % poredak.length]!;
    const naPotezu = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const sljedeci = igraci.find((igrac) => igrac.token === sljedeciId)!;
    const promatrac = igraci.find((igrac) => igrac !== naPotezu && igrac !== sljedeci)!;
    const rijecZaIgru = await pronadjiRijecNaPrefiks(
      runda.trazenaSlova,
      new Set(await grupeRijeci(runda.rijec)),
    );
    const prihvacenoPromise = cekajPrihvacenOdIgraca(promatrac.socket, naPotezu.token);
    const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
      promatrac.socket.on('partija:eliminacija', (eliminacija) => {
        if (eliminacija.igracId === sljedeciId) resolve(eliminacija);
      });
    });
    const stanjeNakonPreskakanja = new Promise<StanjePartije>((resolve) => {
      promatrac.socket.once('partija:stanje', resolve);
    });

    sljedeci.socket.disconnect();
    naPotezu.socket.emit('potez:rijec', { rijec: rijecZaIgru });
    const prihvaceno = await prihvacenoPromise;
    expect(prihvaceno.sljedeciId).toBe(sljedeciId);

    const eliminacija = await eliminacijaPromise;
    const stanje = await stanjeNakonPreskakanja;
    expect(eliminacija.razlog).toBe('prekid');
    expect(eliminacija.bodZa).toBeNull();
    expect(stanje.naPotezuId).not.toBe(sljedeciId);
    expect(stanje.trazenaSlova).toBe(prihvaceno.trazenaSlova);

    odspojiIgrace(igraci);
  });

  it('RS-09/RS-12: povratak unutar tolerancije obnavlja stanje bez eliminacije i resetiranja timera', async () => {
    const { igraci, runda } = await pokreniPartiju();
    const odspojeni = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const promatrac = igraci.find((igrac) => igrac !== odspojeni)!;
    const eliminacije: Eliminacija[] = [];
    promatrac.socket.on('partija:eliminacija', (eliminacija) => eliminacije.push(eliminacija));

    odspojeni.socket.disconnect();
    await odgodi(25);
    const { igrac: obnovljeni, stanje } = await spojiIgracaIPricekajStanje(odspojeni.token);

    expect(stanje.partijaId).toBeDefined();
    expect(stanje.naPotezuId).toBe(runda.naPotezuId);
    expect(stanje.istekPotezaIso).toBe(runda.istekPotezaIso);
    const reakcijaUSobi = new Promise<void>((resolve) => obnovljeni.socket.once('reakcija:nova', () => resolve()));
    promatrac.socket.emit('reakcija:posalji', { poruka: 'pozdrav' });
    await reakcijaUSobi;
    await odgodi(350);
    expect(eliminacije.filter((eliminacija) => eliminacija.igracId === odspojeni.token)).toHaveLength(0);

    odspojiIgrace([...igraci, obnovljeni]);
  });

  it('RS-18: zamjena veze u aktivnoj partiji ne pokreće eliminaciju', async () => {
    const { igraci, runda } = await pokreniPartiju();
    const zamijenjeni = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const promatrac = igraci.find((igrac) => igrac !== zamijenjeni)!;
    const eliminacije: Eliminacija[] = [];
    promatrac.socket.on('partija:eliminacija', (eliminacija) => eliminacije.push(eliminacija));

    const { igrac: novaVeza, stanje } = await spojiIgracaIPricekajStanje(zamijenjeni.token);

    expect(zamijenjeni.socket.connected).toBe(false);
    expect(stanje.naPotezuId).toBe(runda.naPotezuId);
    await odgodi(350);
    expect(eliminacije.filter((eliminacija) => eliminacija.igracId === zamijenjeni.token)).toHaveLength(0);

    odspojiIgrace([...igraci, novaVeza]);
  });

  it('RS-22: reconnect ne resetira cooldown reakcije', async () => {
    const { igraci } = await pokreniPartiju();
    const posiljatelj = igraci[0]!;
    const promatrac = igraci[1]!;
    const prvaReakcija = new Promise<void>((resolve) => promatrac.socket.once('reakcija:nova', () => resolve()));
    posiljatelj.socket.emit('reakcija:posalji', { poruka: 'pozdrav' });
    await prvaReakcija;

    posiljatelj.socket.disconnect();
    const novaVeza = await spojiIgraca(posiljatelj.token);
    let drugaReakcijaStigla = false;
    promatrac.socket.once('reakcija:nova', () => {
      drugaReakcijaStigla = true;
    });
    novaVeza.socket.emit('reakcija:posalji', { poruka: 'sorry' });
    await odgodi(100);

    expect(drugaReakcijaStigla).toBe(false);
    odspojiIgrace([...igraci, novaVeza]);
  });

  it('RS-23: reconnect ne resetira limit pokušaja poteza', async () => {
    const { igraci, runda } = await pokreniPartiju();
    const igracNaPotezu = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const prvaGreskaPromise = new Promise<{ kod: string }>((resolve) => {
      igracNaPotezu.socket.once('greska', resolve);
    });
    for (let pokusaj = 0; pokusaj < 4; pokusaj += 1) {
      igracNaPotezu.socket.emit('potez:rijec', { rijec: 'x' });
    }
    expect((await prvaGreskaPromise).kod).toBe('PREBRZO');

    igracNaPotezu.socket.disconnect();
    const novaVeza = await spojiIgraca(igracNaPotezu.token);
    const drugaGreskaPromise = new Promise<{ kod: string }>((resolve) => {
      novaVeza.socket.once('greska', resolve);
    });
    novaVeza.socket.emit('potez:rijec', { rijec: 'x' });

    expect((await drugaGreskaPromise).kod).toBe('PREBRZO');
    odspojiIgrace([...igraci, novaVeza]);
  });

  it('RS-11: dobrovoljni izlazak eliminira odmah bez tolerancije', async () => {
    const { igraci, runda } = await pokreniPartiju();
    const igracKojiIzlazi = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const promatrac = igraci.find((igrac) => igrac !== igracKojiIzlazi)!;
    const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
      promatrac.socket.once('partija:eliminacija', resolve);
    });

    igracKojiIzlazi.socket.emit('partija:izadji');
    igracKojiIzlazi.socket.emit('potez:ne-znam');
    const eliminacija = await eliminacijaPromise;

    expect(eliminacija.igracId).toBe(igracKojiIzlazi.token);
    expect(eliminacija.razlog).toBe('prekid');
    odspojiIgrace(igraci);
  });

  it('eliminirani igrač se nakon reconnecta vraća kao promatrač', async () => {
    const { igraci, runda } = await pokreniPartiju();
    const eliminirani = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const promatrac = igraci.find((igrac) => igrac !== eliminirani)!;
    const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
      promatrac.socket.once('partija:eliminacija', resolve);
    });
    eliminirani.socket.emit('potez:ne-znam');
    await eliminacijaPromise;
    eliminirani.socket.disconnect();

    const { igrac: novaVeza, stanje } = await spojiIgracaIPricekajStanje(eliminirani.token);

    expect(stanje.eliminacije.some((eliminacija) => eliminacija.igracId === eliminirani.token)).toBe(true);
    odspojiIgrace([...igraci, novaVeza]);
  });

  it('igrač koji se vrati nakon završetka dobiva stanje i personalizirani rezultat', async () => {
    const { igraci, pocetak, runda } = await pokreniPartiju();
    const buduciPobjednik = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
    const ostali = igraci.filter((igrac) => igrac !== buduciPobjednik);
    buduciPobjednik.socket.disconnect();
    for (const igrac of ostali) igrac.socket.emit('partija:izadji');

    await cekajZavrsenuPartiju(pocetak.partijaId);

    const rezultat = await spojiIgracaIPricekajStanjeIKraj(buduciPobjednik.token);

    expect(rezultat.stanje.partijaId).toBe(pocetak.partijaId);
    expect(rezultat.stanje.zavrsena).toBe(true);
    expect(rezultat.kraj.plasmani.find((p) => p.igracId === buduciPobjednik.token)?.plasman).toBe(1);
    odspojiIgrace([...igraci, rezultat.igrac]);
  });

  it('RS-13: kod istodobnih prekida igrač koji je bio na potezu nema prednost', async () => {
    const { igraci, pocetak, runda } = await pokreniPartiju();
    let rezultat: Awaited<ReturnType<typeof spojiIgracaIPricekajStanjeIKraj>> | null = null;
    try {
      const naPotezu = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
      const izvanPoteza = igraci.filter((igrac) => igrac !== naPotezu);

      for (const igrac of izvanPoteza) igrac.socket.disconnect();
      naPotezu.socket.disconnect();
      await cekajZavrsenuPartiju(pocetak.partijaId);

      rezultat = await spojiIgracaIPricekajStanjeIKraj(igraci[0]!.token);
      const pobjednik = rezultat.kraj.plasmani.find((plasman) => plasman.plasman === 1)!;
      expect(pobjednik.igracId).not.toBe(naPotezu.token);
    } finally {
      odspojiIgrace([...igraci, ...(rezultat ? [rezultat.igrac] : [])]);
    }
  });

  it('kaladont: eliminira igraca koji je omogucio "ka", bod ide igracu koji ga izgovori', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);

    const pocetakPromise = new Promise<PocetakPartije>((resolve) => {
      igraci[0]!.socket.on('partija:pocetak', resolve);
    });
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    await pocetakPromise;
    const runda = await rundaPromise;

    // odigraj stvaran lanac rijeci dok netko ne odigra rijec koja zavrsava na "ka"
    const lanac = await pronadjiLanacDoKa(runda.trazenaSlova, new Set(await grupeRijeci(runda.rijec)));
    expect(lanac).not.toBeNull();

    let otvarac = igraci.find((ig) => ig.token === runda.naPotezuId)!;
    let igracKojiJeOmoguciKa = otvarac.token;
    for (const rijec of lanac!) {
      const prihvacenoPromise = cekajPrihvacenOdIgraca(otvarac.socket, otvarac.token);
      otvarac.socket.emit('potez:rijec', { rijec });
      const prihvaceno = await prihvacenoPromise;
      igracKojiJeOmoguciKa = otvarac.token; // zadnji koji je odigrao rijec je taj koji "omogucuje ka"
      otvarac = igraci.find((ig) => ig.token === prihvaceno.sljedeciId)!;
    }
    // otvarac je sada sljedeci na potezu nakon rijeci koja zavrsava na "ka" - on postaje sayer
    const sayer = otvarac;
    const promatrac = igraci.find((ig) => ig.token !== igracKojiJeOmoguciKa && ig !== sayer)!;

    const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
      promatrac.socket.on('partija:eliminacija', resolve);
    });
    const novaRundaPromise = cekajRunduOtvorenu(promatrac.socket);

    sayer.socket.emit('potez:rijec', { rijec: 'kaladont' });

    const eliminacija = await eliminacijaPromise;
    expect(eliminacija.igracId).toBe(igracKojiJeOmoguciKa); // otvarac je omogucio "ka" - on ispada
    expect(eliminacija.razlog).toBe('kaladont');
    expect(eliminacija.bodZa).toBe(sayer.token); // bod ide onome tko je izgovorio kaladont

    const novaRunda = await novaRundaPromise;
    expect(novaRunda.naPotezuId).not.toBe(igracKojiJeOmoguciKa);
    expect(novaRunda.naPotezuId).not.toBe(sayer.token);

    const stanjePromise = new Promise<StanjePartije>((resolve) => {
      promatrac.socket.once('partija:stanje', resolve);
    });
    promatrac.socket.emit('partija:stanje');
    const stanje = await stanjePromise;
    expect(stanje.eliminacije).toContainEqual(eliminacija);

    for (const igrac of igraci) igrac.socket.disconnect();
  });

  it('RS-22: emitira reakciju cijeloj sobi, a drugu unutar dvije sekunde tiho ignorira', async () => {
    const igraci = await Promise.all([spojiIgraca(), spojiIgraca(), spojiIgraca(), spojiIgraca()]);
    const rundaPromise = cekajRunduOtvorenu(igraci[0]!.socket);
    for (const igrac of igraci) igrac.socket.emit('red:udji');
    await rundaPromise;

    const reakcijePromise = Promise.all(
      igraci.map(
        (igrac) =>
          new Promise<{ igracId: string; poruka: string }>((resolve) => {
            igrac.socket.once('reakcija:nova', resolve);
          }),
      ),
    );
    igraci[0]!.socket.emit('reakcija:posalji', { poruka: 'pozdrav' });

    const reakcije = await reakcijePromise;
    for (const reakcija of reakcije) {
      expect(reakcija).toEqual({ igracId: igraci[0]!.token, poruka: 'pozdrav' });
    }

    let drugaReakcijaStigla = false;
    igraci[1]!.socket.once('reakcija:nova', () => {
      drugaReakcijaStigla = true;
    });
    igraci[0]!.socket.emit('reakcija:posalji', { poruka: 'sorry' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(drugaReakcijaStigla).toBe(false);

    for (const igrac of igraci) igrac.socket.disconnect();
  });
});

describe('motor partije - utrka timera i tolerancije prekida', () => {
  it('zakašnjeli reconnect obrađuje sve istekle prekide kronološkim redom', async () => {
    const posebniPosluzitelj = await izgradiPosluzitelj({
      postavkeMotora: {
        timerOnemogucen: true,
        tolerancijaPrekidaMs: 100,
        odgodaObradePrekidaMs: 500,
      },
    });
    const igraciZaCiscenje: Igrac[] = [];
    try {
      await posebniPosluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = posebniPosluzitelj.app.server.address();
      const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
      const posebnaAdresa = `http://127.0.0.1:${port}`;
      const { igraci, runda } = await pokreniPartiju(posebnaAdresa);
      igraciZaCiscenje.push(...igraci);
      const naPotezu = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
      const ranijeOdspojeni = igraci.find((igrac) => igrac !== naPotezu)!;
      const promatrac = igraci.find((igrac) => igrac !== naPotezu && igrac !== ranijeOdspojeni)!;
      const redoslijedEliminacija: string[] = [];
      const dvijeEliminacije = new Promise<void>((resolve) => {
        promatrac.socket.on('partija:eliminacija', (eliminacija) => {
          if (eliminacija.igracId !== ranijeOdspojeni.token && eliminacija.igracId !== naPotezu.token) return;
          redoslijedEliminacija.push(eliminacija.igracId);
          if (redoslijedEliminacija.length === 2) resolve();
        });
      });

      ranijeOdspojeni.socket.disconnect();
      await odgodi(50);
      naPotezu.socket.disconnect();
      await odgodi(120);
      const zakasnjeli = await spojiIgraca(naPotezu.token, posebnaAdresa);
      igraciZaCiscenje.push(zakasnjeli);
      await dvijeEliminacije;

      expect(redoslijedEliminacija).toEqual([ranijeOdspojeni.token, naPotezu.token]);
    } finally {
      odspojiIgrace(igraciZaCiscenje);
      await posebniPosluzitelj.app.close();
    }
  });

  it('reconnect nakon formalnog roka ne poništava eliminaciju dok batch obrada kasni', async () => {
    const posebniPosluzitelj = await izgradiPosluzitelj({
      postavkeMotora: {
        timerOnemogucen: true,
        tolerancijaPrekidaMs: 100,
        odgodaObradePrekidaMs: 500,
      },
    });
    const igraciZaCiscenje: Igrac[] = [];
    try {
      await posebniPosluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = posebniPosluzitelj.app.server.address();
      const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
      const posebnaAdresa = `http://127.0.0.1:${port}`;
      const { igraci, runda } = await pokreniPartiju(posebnaAdresa);
      igraciZaCiscenje.push(...igraci);
      const odspojeni = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
      const promatrac = igraci.find((igrac) => igrac !== odspojeni)!;
      const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
        promatrac.socket.on('partija:eliminacija', (eliminacija) => {
          if (eliminacija.igracId === odspojeni.token) resolve(eliminacija);
        });
      });

      odspojeni.socket.disconnect();
      await odgodi(150);
      const zakasnjeli = await spojiIgraca(odspojeni.token, posebnaAdresa);
      igraciZaCiscenje.push(zakasnjeli);
      const eliminacija = await eliminacijaPromise;

      expect(eliminacija.razlog).toBe('prekid');
    } finally {
      odspojiIgrace(igraciZaCiscenje);
      await posebniPosluzitelj.app.close();
    }
  });

  it('istek poteza prije tolerancije proizvodi samo jednu eliminaciju s razlogom istek', async () => {
    const posebniPosluzitelj = await izgradiPosluzitelj({
      postavkeMotora: {
        timerOnemogucen: false,
        trajanjePotezaMs: 1_000,
        tolerancijaPrekidaMs: 2_000,
      },
    });
    const igraciZaCiscenje: Igrac[] = [];
    try {
      await posebniPosluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = posebniPosluzitelj.app.server.address();
      const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
      const posebnaAdresa = `http://127.0.0.1:${port}`;
      const { igraci, runda } = await pokreniPartiju(posebnaAdresa);
      igraciZaCiscenje.push(...igraci);
      const odspojeni = igraci.find((igrac) => igrac.token === runda.naPotezuId)!;
      const promatrac = igraci.find((igrac) => igrac !== odspojeni)!;
      const eliminacije: Eliminacija[] = [];
      const eliminacijaPromise = new Promise<Eliminacija>((resolve) => {
        promatrac.socket.on('partija:eliminacija', (eliminacija) => {
          eliminacije.push(eliminacija);
          if (eliminacija.igracId === odspojeni.token) resolve(eliminacija);
        });
      });

      expect(new Date(runda.istekPotezaIso).getTime() - Date.now()).toBeGreaterThan(500);
      odspojeni.socket.disconnect();
      const eliminacija = await eliminacijaPromise;
      expect(eliminacija.razlog).toBe('istek');
      await odgodi(2_050);
      expect(eliminacije.filter((dogadaj) => dogadaj.igracId === odspojeni.token)).toHaveLength(1);
    } finally {
      odspojiIgrace(igraciZaCiscenje);
      await posebniPosluzitelj.app.close();
    }
  });
});

