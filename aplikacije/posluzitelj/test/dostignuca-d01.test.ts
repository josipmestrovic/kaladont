import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
  ID_DOSTIGNUCA_PRIVATNIK,
  ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
  type MetrikeMisijaIgre,
} from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import {
  ciklusiTjednihMisija,
  dodjeleMisija,
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  obracuniPartija,
  obavijestiIgraca,
  partije,
} from '../src/baza/shema.js';
import { priznajDovrsenuMisiju, priznajTjedniPaketAkoKompletan } from '../src/dostignuca/dodjela.js';
import { dohvatiNepotvrdeneObavijesti, potvrdiObavijesti } from '../src/dostignuca/obavijesti.js';
import { zakljuciPartijuUBazi, type ZapisStatistikeRijeci } from '../src/igra/upis-partije.js';
import { obracunajMisijeZaIgraca } from '../src/misije/obracun.js';
import { osigurajStanjeMisija } from '../src/misije/stanje.js';

const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];

function snapshotPartije(xp = 0) {
  return {
    predlozakId: 'D01',
    verzijaDefinicije: 1,
    naziv: 'Partija',
    opis: 'Test',
    metrika: 'partije',
    cilj: 1,
    pragMetrike: null,
    podciljevi: null,
    xp,
    obitelj: 'test-d01',
    zahtjevnija: false,
    kontekst: 'javna' as const,
    mod: 'oba' as const,
  };
}

function statistika(igracId: string, prihvaceniPotezi: number): ZapisStatistikeRijeci {
  return {
    igracId,
    grupe: [],
    otkljucaneRijeci: [],
    prihvaceniPotezi,
    ukupnoTrajanjePrihvaceniPoteziMs: prihvaceniPotezi * 1000,
    najduziStreak: prihvaceniPotezi,
    otkriveneJakoRijetkeGrupe: 0,
    otkriveneSrednjeRijetkeGrupe: 0,
    otkriveneRijetkeGrupe: 0,
    upisaneDugeRijeci: 0,
    upisaneSrednjeDugeRijeci: 0,
    upisaneJakoDugeRijeci: 0,
    najduzaRijec: prihvaceniPotezi > 0 ? 'test' : null,
    najduzaRijecGrafemi: prihvaceniPotezi > 0 ? 4 : 0,
    najrjedaRijec: null,
    najrjedaRijecFrekvencija: null,
    najrjedaTier: null,
  };
}

function metrike(igracId: string, izvorId: string): MetrikeMisijaIgre {
  return {
    izvorId,
    kontekst: 'javna',
    mod: 'cetiri_igraca',
    igracId,
    zavrsenoU: new Date('2026-11-06T12:00:00.000Z'),
    plasman: 1,
    nacinIspadanja: 'pobjednik',
    prihvaceneRijeci: 2,
    najduziNiz: 2,
    dugeRijeci: 0,
    jakoDugeRijeci: 0,
    rijetkeRijeci: 0,
    jakoRijetkeRijeci: 0,
    dugeIRijetkeRijeci: 0,
    eliminacije: 0,
    kaladontIzvedbe: 0,
    razlicitiPoceci: [],
  };
}

async function noviIgrac(nadimak: string): Promise<string> {
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  await baza.insert(igraci).values({
    id,
    vrsta: 'registriran',
    nadimak,
    email: `${nadimak}-${id}@example.com`,
  });
  return id;
}

async function novaPartija(): Promise<string> {
  const id = randomUUID();
  partijeZaBrisanje.push(id);
  await baza.insert(partije).values({ id, mod: 'cetiri_igraca', status: 'u_tijeku' });
  return id;
}

describe('dostignuća D01', () => {
  afterEach(async () => {
    for (const partijaId of partijeZaBrisanje.splice(0)) {
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
    for (const igracId of igraciZaBrisanje.splice(0)) {
      await baza.delete(igraci).where(eq(igraci.id, igracId));
    }
  });

  it('dovršena misija s nula XP-a i kompletan tjedni paket otključavaju razinu', async () => {
    const igracId = await noviIgrac('Misija');
    const sada = new Date('2026-11-06T12:00:00.000Z');
    await baza.transaction((tx) => osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: Math.random }));
    const dodjele = await baza.select({ id: dodjeleMisija.id, vrsta: dodjeleMisija.vrsta })
      .from(dodjeleMisija)
      .where(eq(dodjeleMisija.igracId, igracId));
    expect(dodjele.filter((dodjela) => dodjela.vrsta === 'tjedna')).toHaveLength(3);
    await baza.update(dodjeleMisija).set({ napredak: 0, cilj: 1, snapshot: snapshotPartije(0) })
      .where(eq(dodjeleMisija.igracId, igracId));

    const igra = metrike(igracId, randomUUID());
    const ishod = await baza.transaction((tx) => obracunajMisijeZaIgraca(tx, igra, 0, 0));
    expect(ishod.novaDostignuca).toEqual(expect.arrayContaining([
      { id: ID_DOSTIGNUCA_COVJEK_NA_MISIJI, novaRazina: 1, maksimalnaRazina: 5 },
      { id: ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM, novaRazina: 1, maksimalnaRazina: 5 },
    ]));
    expect(ishod.noveObavijesti?.map((obavijest) => obavijest.dostignuceId).sort()).toEqual([
      ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
      ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
    ]);

    const [napredak] = await baza.select({
      dovrseneMisije: napredakDostignucaIgraca.dovrseneMisije,
      tjedniPaketi: napredakDostignucaIgraca.tjedniPaketi,
    }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak).toEqual({ dovrseneMisije: dodjele.length, tjedniPaketi: 1 });

    const ponovo = await baza.transaction((tx) => obracunajMisijeZaIgraca(tx, igra, 0, 0));
    expect(ponovo.noveObavijesti ?? []).toEqual([]);
    const [nakon] = await baza.select({
      dovrseneMisije: napredakDostignucaIgraca.dovrseneMisije,
      tjedniPaketi: napredakDostignucaIgraca.tjedniPaketi,
    }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(nakon).toEqual(napredak);
  });

  it('isti dokaz misije i nepotpun tjedni paket ne uvećavaju brojač', async () => {
    const igracId = await noviIgrac('Dokaz');
    const dodjelaId = randomUUID();
    const ciklusId = randomUUID();
    const zavrsenoU = new Date('2026-11-06T10:00:00.000Z');
    await baza.insert(dodjeleMisija).values({
      id: dodjelaId,
      igracId,
      vrsta: 'dnevna',
      slot: 1,
      predlozakId: 'D01',
      verzijaDefinicije: 1,
      snapshot: snapshotPartije(0),
      napredak: 1,
      cilj: 1,
      status: 'dovrsena',
      dostupnaOd: zavrsenoU,
      zavrsenaU: zavrsenoU,
    });
    await baza.insert(ciklusiTjednihMisija).values({
      id: ciklusId,
      igracId,
      periodOd: new Date('2026-11-02T00:00:00.000Z'),
      periodDo: new Date('2026-11-09T00:00:00.000Z'),
    });
    for (const slot of [1, 2]) {
      await baza.insert(dodjeleMisija).values({
        igracId,
        vrsta: 'tjedna',
        slot,
        ciklusId,
        predlozakId: `W0${slot}`,
        verzijaDefinicije: 1,
        snapshot: snapshotPartije(0),
        napredak: 1,
        cilj: 1,
        status: 'dovrsena',
        dostupnaOd: zavrsenoU,
        istjeceU: new Date('2026-11-09T00:00:00.000Z'),
        zavrsenaU: zavrsenoU,
      });
    }

    const prvi = await baza.transaction((tx) => priznajDovrsenuMisiju(tx, { igracId, dodjelaId, zavrsenoU }));
    const drugi = await baza.transaction((tx) => priznajDovrsenuMisiju(tx, { igracId, dodjelaId, zavrsenoU }));
    expect(prvi.doprinosUmetnut).toBe(true);
    expect(prvi.novaDostignuca).toEqual([{ id: ID_DOSTIGNUCA_COVJEK_NA_MISIJI, novaRazina: 1, maksimalnaRazina: 5 }]);
    expect(drugi).toEqual({ doprinosUmetnut: false, novaDostignuca: [], noveObavijesti: [] });

    const bezPaketa = await baza.transaction((tx) => priznajTjedniPaketAkoKompletan(tx, { igracId, ciklusId, zavrsenoU }));
    expect(bezPaketa.doprinosUmetnut).toBe(false);

    await baza.insert(dodjeleMisija).values({
      igracId,
      vrsta: 'tjedna',
      slot: 3,
      ciklusId,
      predlozakId: 'W03',
      verzijaDefinicije: 1,
      snapshot: snapshotPartije(0),
      napredak: 1,
      cilj: 1,
      status: 'dovrsena',
      dostupnaOd: zavrsenoU,
      istjeceU: new Date('2026-11-09T00:00:00.000Z'),
      zavrsenaU: zavrsenoU,
    });
    const paket = await baza.transaction((tx) => priznajTjedniPaketAkoKompletan(tx, { igracId, ciklusId, zavrsenoU }));
    const ponovljeniPaket = await baza.transaction((tx) => priznajTjedniPaketAkoKompletan(tx, { igracId, ciklusId, zavrsenoU }));
    expect(paket.novaDostignuca).toEqual([{ id: ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM, novaRazina: 1, maksimalnaRazina: 5 }]);
    expect(ponovljeniPaket.doprinosUmetnut).toBe(false);

    const [napredak] = await baza.select({
      dovrseneMisije: napredakDostignucaIgraca.dovrseneMisije,
      tjedniPaketi: napredakDostignucaIgraca.tjedniPaketi,
    }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak).toEqual({ dovrseneMisije: 1, tjedniPaketi: 1 });
  });

  it('privatnik broji završenu igru s riječi, a prekid i praznu igru ne', async () => {
    const igracId = await noviIgrac('Privatnik');
    const partijaId = await novaPartija();
    const rezultat = { igracId, plasman: 1 as const, bodovi: 0, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const };
    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [rezultat],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId, 1)]]),
      true,
    );
    expect(agregati.get(igracId)?.novaDostignuca).toEqual([
      { id: ID_DOSTIGNUCA_PRIVATNIK, novaRazina: 1, maksimalnaRazina: 5 },
    ]);

    const prekidId = await novaPartija();
    await zakljuciPartijuUBazi(
      prekidId,
      igracId,
      [{ ...rezultat, plasman: 2, nacinIspadanja: 'prekid' }],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId, 3)]]),
      true,
    );
    const praznaId = await novaPartija();
    await zakljuciPartijuUBazi(
      praznaId,
      igracId,
      [rezultat],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId, 0)]]),
      true,
    );
    await zakljuciPartijuUBazi(partijaId, igracId, [rezultat], 'cetiri_igraca', new Map([[igracId, statistika(igracId, 1)]]), true);

    const [napredak] = await baza.select({ privatneIgre: napredakDostignucaIgraca.privatneIgre })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.privatneIgre).toBe(1);
    const [dostignuce] = await baza.select({ razina: dostignucaIgraca.razina }).from(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
    expect(dostignuce?.razina).toBe(1);
    const obavijesti = await dohvatiNepotvrdeneObavijesti(igracId);
    expect(obavijesti).toHaveLength(1);
    expect(obavijesti[0]?.dostignuceId).toBe(ID_DOSTIGNUCA_PRIVATNIK);
    const potvrdene = await potvrdiObavijesti(igracId, [obavijesti[0]!.id]);
    expect(potvrdene).toEqual([obavijesti[0]!.id]);
    expect(await dohvatiNepotvrdeneObavijesti(igracId)).toEqual([]);
  });
});

describe('API obavijesti dostignuća', () => {
  let app: FastifyInstance;
  let adresa: string;
  const emailovi: string[] = [];

  beforeAll(async () => {
    ({ app } = await izgradiPosluzitelj());
    await app.listen({ port: 0, host: '127.0.0.1' });
    const podaci = app.server.address();
    adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(async () => {
    for (const email of emailovi.splice(0)) {
      const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(eq(igraci.email, email));
      if (!igrac) continue;
      await baza.delete(obavijestiIgraca).where(eq(obavijestiIgraca.igracId, igrac.id));
      await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igrac.id));
      await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igrac.id));
      await baza.delete(igraci).where(eq(igraci.id, igrac.id));
    }
    for (const partijaId of partijeZaBrisanje.splice(0)) {
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
  });

  it('vraća nepročitane obavijesti i potvrđuje ih', async () => {
    const email = `obavijest-${Date.now()}@example.com`;
    emailovi.push(email);
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, lozinka: 'lozinka123', nadimak: 'Obavijest' }),
    });
    expect(registracija.status).toBe(200);
    const tijelo = (await registracija.json()) as { sesijskiToken: string; igracId: string };
    const dodjelaId = randomUUID();
    await baza.insert(dodjeleMisija).values({
      id: dodjelaId,
      igracId: tijelo.igracId,
      vrsta: 'dnevna',
      slot: 1,
      predlozakId: 'D01',
      verzijaDefinicije: 1,
      snapshot: snapshotPartije(0),
      napredak: 1,
      cilj: 1,
      status: 'dovrsena',
      dostupnaOd: new Date(),
      zavrsenaU: new Date(),
    });
    await baza.transaction((tx) => priznajDovrsenuMisiju(tx, { igracId: tijelo.igracId, dodjelaId, zavrsenoU: new Date() }));

    const neprijavljen = await fetch(`${adresa}/api/dostignuca/obavijesti`);
    expect(neprijavljen.status).toBe(401);

    const zaglavlje = { authorization: `Bearer ${tijelo.sesijskiToken}` };
    const prvi = await fetch(`${adresa}/api/dostignuca/obavijesti`, { headers: zaglavlje });
    expect(prvi.status).toBe(200);
    const neprocitane = (await prvi.json()) as { ok: boolean; obavijesti: { id: string; dostignuceId: string; naziv: string }[] };
    expect(neprocitane.obavijesti).toHaveLength(1);
    expect(neprocitane.obavijesti[0]?.dostignuceId).toBe(ID_DOSTIGNUCA_COVJEK_NA_MISIJI);
    expect(neprocitane.obavijesti[0]?.naziv).toBe('Čovjek na misiji');

    const potvrda = await fetch(`${adresa}/api/dostignuca/obavijesti/potvrdi`, {
      method: 'POST',
      headers: { ...zaglavlje, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [neprocitane.obavijesti[0]!.id] }),
    });
    expect(potvrda.status).toBe(200);
    const nakon = await fetch(`${adresa}/api/dostignuca/obavijesti`, { headers: zaglavlje });
    const prazno = (await nakon.json()) as { obavijesti: unknown[] };
    expect(prazno.obavijesti).toEqual([]);
  });
});
