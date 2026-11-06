import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { and, eq, gte, sql } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_DNEVNA_DESETKA,
  ID_DOSTIGNUCA_MJESECNA_ELITA,
  ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
  ID_DOSTIGNUCA_TJEDNA_ELITA,
} from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import {
  botovi,
  dnkStatistikeIgraca,
  dokaziDostignucaNaDvijeFronte,
  dokaziDostignucaTop10,
  dokaziTop10Ulazaka,
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  obavijestiIgraca,
  obracuniPartija,
  partije,
  pohvaleIgre,
  sudioniciPartije,
} from '../src/baza/shema.js';
import { obradiNeobradeneTop10Dokaze, zabiljeziTop10NakonPromjene } from '../src/dostignuca/top10.js';
import { zakljuciPartijuUBazi, type ZapisStatistikeRijeci } from '../src/igra/upis-partije.js';
import { obrisiRacunPoId } from '../src/racuni/brisanje.js';

/** Izoliran dan nakon LJESTVICE_POCETAK, bez tuđih partija u prozoru. */
const DAN = new Date('2099-02-02T11:00:00.000Z');
const SLJEDECI_DAN = new Date('2099-02-03T11:00:00.000Z');

const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];

function statistika(igracId: string): ZapisStatistikeRijeci {
  return {
    igracId,
    grupe: [],
    otkljucaneRijeci: [],
    prihvaceniPotezi: 1,
    ukupnoTrajanjePrihvaceniPoteziMs: 1000,
    najduziStreak: 1,
    otkriveneJakoRijetkeGrupe: 0,
    otkriveneSrednjeRijetkeGrupe: 0,
    otkriveneRijetkeGrupe: 0,
    upisaneDugeRijeci: 0,
    upisaneSrednjeDugeRijeci: 0,
    upisaneJakoDugeRijeci: 0,
    najduzaRijec: 'test',
    najduzaRijecGrafemi: 4,
    najrjedaRijec: null,
    najrjedaRijecFrekvencija: null,
    najrjedaTier: null,
    pogresniUnosi: 1,
    dugeRijetkeRijeci: [],
  };
}

async function noviIgrac(
  nadimak: string,
  vrsta: 'registriran' | 'gost' | 'admin' = 'registriran',
  upravljac: 'covjek' | 'bot' = 'covjek',
): Promise<string> {
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  await baza.insert(igraci).values({
    id,
    vrsta,
    upravljac,
    nadimak,
    email: vrsta === 'gost' ? null : `${nadimak}-${id}@example.com`,
  });
  if (upravljac === 'bot') {
    await baza.insert(botovi).values({ igracId: id, kljucSeeda: `d03-${id}`, tip: 'imenovani' });
  }
  return id;
}

async function igre(
  igracId: string,
  broj: number,
  bodovi: number,
  mod: 'cetiri_igraca' | 'dva_igraca',
  kraj: Date,
  plasman: number | null = 2,
): Promise<void> {
  for (let i = 0; i < broj; i += 1) {
    const id = randomUUID();
    partijeZaBrisanje.push(id);
    const zavrseno = new Date(kraj.getTime() - i * 1000);
    await baza.insert(partije).values({
      id,
      mod,
      status: 'zavrsena',
      pocetak: new Date(zavrseno.getTime() - 500),
      kraj: zavrseno,
    });
    await baza.insert(sudioniciPartije).values({
      partijaId: id,
      igracId,
      sjedalo: 0,
      plasman,
      bodovi,
    });
  }
}

async function snimi(
  mod: 'cetiri_igraca' | 'dva_igraca',
  opazenoU: Date,
  izvor: 'partija' | 'brisanje' = 'partija',
): Promise<void> {
  await baza.transaction(async (tx) => {
    await zabiljeziTop10NakonPromjene(tx, {
      modovi: [mod],
      opazenoU,
      izvor,
      partijaId: null,
    });
  });
  await obradiNeobradeneTop10Dokaze();
}

async function brojac(igracId: string) {
  const [red] = await baza.select({
    dnevneDesetke: napredakDostignucaIgraca.dnevneDesetke,
    tjedneElite: napredakDostignucaIgraca.tjedneElite,
    mjesecneElite: napredakDostignucaIgraca.mjesecneElite,
    naDvijeFronte: napredakDostignucaIgraca.naDvijeFronte,
  }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
  return red ?? { dnevneDesetke: 0, tjedneElite: 0, mjesecneElite: 0, naDvijeFronte: 0 };
}

async function brojUlazaka(igracId: string, mod?: 'cetiri_igraca' | 'dva_igraca'): Promise<number> {
  const redovi = await baza.select({ mod: dokaziTop10Ulazaka.mod }).from(dokaziTop10Ulazaka).where(mod
    ? and(eq(dokaziTop10Ulazaka.igracId, igracId), eq(dokaziTop10Ulazaka.mod, mod))
    : eq(dokaziTop10Ulazaka.igracId, igracId));
  return redovi.length;
}

describe('dostignuća D03 Top 10', () => {
  afterEach(async () => {
    for (const igracId of igraciZaBrisanje) {
      await baza.delete(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igracId));
      await baza.delete(dokaziDostignucaTop10).where(eq(dokaziDostignucaTop10.igracId, igracId));
      await baza.delete(dokaziDostignucaNaDvijeFronte).where(eq(dokaziDostignucaNaDvijeFronte.igracId, igracId));
      await baza.delete(obavijestiIgraca).where(eq(obavijestiIgraca.igracId, igracId));
      await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
      await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
      await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
      await baza.delete(botovi).where(eq(botovi.igracId, igracId));
    }
    if (partijeZaBrisanje.length > 0) {
      await baza.delete(pohvaleIgre).where(sql`${pohvaleIgre.igraId} in (${sql.join(partijeZaBrisanje.map((id) => sql`${id}::uuid`), sql`, `)})`);
      await baza.delete(obracuniPartija).where(sql`${obracuniPartija.partijaId} in (${sql.join(partijeZaBrisanje.map((id) => sql`${id}::uuid`), sql`, `)})`);
      await baza.delete(sudioniciPartije).where(sql`${sudioniciPartije.partijaId} in (${sql.join(partijeZaBrisanje.map((id) => sql`${id}::uuid`), sql`, `)})`);
      await baza.delete(partije).where(sql`${partije.id} in (${sql.join(partijeZaBrisanje.map((id) => sql`${id}::uuid`), sql`, `)})`);
    }
    for (const igracId of igraciZaBrisanje.splice(0)) {
      await baza.delete(igraci).where(eq(igraci.id, igracId));
    }
    partijeZaBrisanje.splice(0);
  });

  it('deseto mjesto ulazi, jedanaesto ne; bot i gost zauzimaju mjesto bez nagrade', async () => {
    const bot = await noviIgrac('BotD03', 'registriran', 'bot');
    const gost = await noviIgrac('GostD03', 'gost');
    await igre(bot, 10, 500, 'cetiri_igraca', DAN);
    await igre(gost, 10, 400, 'cetiri_igraca', DAN);

    const nagrađeni: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const id = await noviIgrac(`H${i}`);
      nagrađeni.push(id);
      await igre(id, 10, 300 - i * 20, 'cetiri_igraca', DAN);
    }
    const jedanaesti = await noviIgrac('Jedanaesti');
    await igre(jedanaesti, 10, 100, 'cetiri_igraca', DAN);

    const pocetak = performance.now();
    await snimi('cetiri_igraca', DAN);
    const trajanjeMs = performance.now() - pocetak;
    console.info(`D03 snimka i dodjela (11 rangiranih): ${trajanjeMs.toFixed(0)} ms`);
    expect(trajanjeMs).toBeLessThan(15_000);

    for (const id of nagrađeni) {
      expect(await brojUlazaka(id)).toBe(1);
      expect((await brojac(id)).dnevneDesetke).toBe(1);
    }
    expect(await brojUlazaka(jedanaesti)).toBe(0);
    expect((await brojac(jedanaesti)).dnevneDesetke).toBe(0);
    expect(await brojUlazaka(bot)).toBe(0);
    expect(await brojUlazaka(gost)).toBe(0);

    const [obavijest] = await baza.select().from(obavijestiIgraca).where(and(
      eq(obavijestiIgraca.igracId, nagrađeni[0]!),
      eq(obavijestiIgraca.dostignuceId, ID_DOSTIGNUCA_DNEVNA_DESETKA),
    ));
    expect(obavijest?.prikazanoU).toBeNull();
    expect(obavijest?.novaRazina).toBe(1);
  });

  it('isti dan ne broji dvaput, ispadanje ne oduzima, tuđa igra promakne jedanaestog', async () => {
    const deseti = await noviIgrac('Deseti');
    const jedanaesti = await noviIgrac('Ispod');
    await igre(deseti, 10, 20, 'cetiri_igraca', DAN);
    await igre(jedanaesti, 10, 10, 'cetiri_igraca', DAN);
    for (let i = 0; i < 9; i += 1) {
      const id = await noviIgrac(`Iznad${i}`);
      await igre(id, 10, 100 + i, 'cetiri_igraca', DAN);
    }

    await snimi('cetiri_igraca', DAN);
    expect((await brojac(deseti)).dnevneDesetke).toBe(1);
    expect((await brojac(jedanaesti)).dnevneDesetke).toBe(0);

    await snimi('cetiri_igraca', DAN);
    expect((await brojac(deseti)).dnevneDesetke).toBe(1);
    expect(await brojUlazaka(deseti)).toBe(1);

    await igre(deseti, 11, 0, 'cetiri_igraca', DAN);
    await snimi('cetiri_igraca', DAN);
    expect((await brojac(deseti)).dnevneDesetke).toBe(1);
    expect((await brojac(jedanaesti)).dnevneDesetke).toBe(1);
    expect(await brojUlazaka(jedanaesti)).toBe(1);
  });

  it('devet igara i nepotpun plasman ne ulaze; deseta kroz zaključak partije ulazi bez GET /ljestvice', async () => {
    const igracId = await noviIgrac('Devet');
    await igre(igracId, 9, 30, 'cetiri_igraca', DAN, 1);
    await snimi('cetiri_igraca', DAN);
    expect(await brojUlazaka(igracId)).toBe(0);

    const nepotpun = await noviIgrac('Nepotpun');
    await igre(nepotpun, 9, 40, 'cetiri_igraca', DAN, 1);
    await igre(nepotpun, 1, 40, 'cetiri_igraca', DAN, null);
    await snimi('cetiri_igraca', DAN);
    expect(await brojUlazaka(nepotpun)).toBe(0);

    const partijaId = randomUUID();
    partijeZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
    await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 2, bodovi: 30, eliminacije: 0, iskustvo: 1, nacinIspadanja: 'istek' }],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId)]]),
      false,
      new Map(),
      DAN,
    );
    expect((await brojac(igracId)).dnevneDesetke).toBe(1);
    const [ulazak] = await baza.select().from(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igracId));
    expect(ulazak?.metrika).toBe('prosjek_bodova');
    expect(ulazak?.mjesto).toBe(1);
    expect(ulazak?.izvor).toBe('partija');
    expect((await brojac(igracId)).tjedneElite).toBe(0);
  });

  it('oba moda istog dana daju Na dvije fronte jednom, a 20 igara diže tri razdoblja u jednu obavijest', async () => {
    const igracId = await noviIgrac('Fronte');
    await igre(igracId, 20, 8, 'cetiri_igraca', DAN, 1);
    await snimi('cetiri_igraca', DAN);
    let stanje = await brojac(igracId);
    expect(stanje).toMatchObject({ dnevneDesetke: 1, tjedneElite: 1, mjesecneElite: 1, naDvijeFronte: 0 });
    expect(await brojUlazaka(igracId, 'cetiri_igraca')).toBe(3);

    await igre(igracId, 20, 8, 'dva_igraca', DAN, 1);
    await snimi('dva_igraca', DAN);
    stanje = await brojac(igracId);
    expect(stanje).toMatchObject({ dnevneDesetke: 1, tjedneElite: 1, mjesecneElite: 1, naDvijeFronte: 3 });

    const obavijesti = await baza.select().from(obavijestiIgraca).where(and(
      eq(obavijestiIgraca.igracId, igracId),
      eq(obavijestiIgraca.dostignuceId, ID_DOSTIGNUCA_NA_DVIJE_FRONTE),
    ));
    expect(obavijesti.map((red) => red.novaRazina)).toEqual([3]);

    const razine = await baza.select({ id: dostignucaIgraca.dostignuceId, razina: dostignucaIgraca.razina })
      .from(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
    expect(razine.find((red) => red.id === ID_DOSTIGNUCA_DNEVNA_DESETKA)?.razina).toBe(1);
    expect(razine.find((red) => red.id === ID_DOSTIGNUCA_TJEDNA_ELITA)?.razina).toBe(1);
    expect(razine.find((red) => red.id === ID_DOSTIGNUCA_MJESECNA_ELITA)?.razina).toBe(1);
    expect(razine.find((red) => red.id === ID_DOSTIGNUCA_NA_DVIJE_FRONTE)?.razina).toBe(3);
  });

  it('sljedeći dan daje novi doprinos, a zakašnjela obrada čuva ključ dokaza', async () => {
    const igracId = await noviIgrac('DvaDana');
    await igre(igracId, 10, 15, 'cetiri_igraca', DAN, 1);
    await baza.transaction(async (tx) => {
      await zabiljeziTop10NakonPromjene(tx, {
        modovi: ['cetiri_igraca'],
        opazenoU: DAN,
        izvor: 'partija',
        partijaId: null,
      });
    });
    const [prije] = await baza.select().from(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igracId));
    expect(prije?.obradjenoU).toBeNull();
    await obradiNeobradeneTop10Dokaze();
    const dokazi = await baza.select().from(dokaziDostignucaTop10).where(eq(dokaziDostignucaTop10.igracId, igracId));
    expect(dokazi).toHaveLength(1);
    expect(dokazi[0]?.kalendarskiPocetak.toISOString()).toBe(prije?.kalendarskiPocetak.toISOString());
    expect((await brojac(igracId)).dnevneDesetke).toBe(1);

    await igre(igracId, 10, 15, 'cetiri_igraca', SLJEDECI_DAN, 1);
    await snimi('cetiri_igraca', SLJEDECI_DAN);
    expect((await brojac(igracId)).dnevneDesetke).toBe(2);
  });

  it('privatna igra ne daje Top 10, a brisanje čisti dokaze i ne radi backfill tekućeg poretka', async () => {
    const igracId = await noviIgrac('Privatno');
    await igre(igracId, 10, 12, 'cetiri_igraca', DAN, 1);
    await snimi('cetiri_igraca', DAN);
    expect((await brojac(igracId)).dnevneDesetke).toBe(1);

    const privatna = randomUUID();
    partijeZaBrisanje.push(privatna);
    await baza.insert(partije).values({ id: privatna, mod: 'dva_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId: privatna, igracId, sjedalo: 0 });
    await zakljuciPartijuUBazi(
      privatna,
      igracId,
      [{ igracId, plasman: 1, bodovi: 1, eliminacije: 0, iskustvo: 1, nacinIspadanja: 'pobjednik' }],
      'dva_igraca',
      new Map([[igracId, statistika(igracId)]]),
      true,
      new Map(),
      DAN,
    );
    expect(await brojUlazaka(igracId, 'dva_igraca')).toBe(0);

    const prijeBrisanja = new Date();
    expect(await obrisiRacunPoId(igracId)).toBe('obrisan');
    const ostali = await baza.select({ id: dokaziTop10Ulazaka.igracId }).from(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igracId));
    expect(ostali).toHaveLength(0);
    const svjezi = await baza.select({ igracId: dokaziTop10Ulazaka.igracId }).from(dokaziTop10Ulazaka).where(gte(dokaziTop10Ulazaka.opazenoU, prijeBrisanja));
    expect(svjezi).toHaveLength(0);
  });
});
