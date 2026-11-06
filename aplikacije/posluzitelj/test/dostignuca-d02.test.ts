import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_CISTA_PETICA,
  ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
  ID_DOSTIGNUCA_RIJETKA_GRDOSIJA,
  ID_DOSTIGNUCA_SVE_POHVALE,
} from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import {
  dnkStatistikeIgraca,
  dokaziDostignucaCistaPetica,
  dokaziDostignucaDvostrukaKruna,
  dokaziDostignucaRijetkaGrdosija,
  dokaziDostignucaSvePohvale,
  dostignucaIgraca,
  evidencijaDnevnihPobjedaModova,
  igraci,
  napredakDostignucaIgraca,
  obavijestiIgraca,
  obracuniPartija,
  partije,
  pohvaleIgre,
  sudioniciPartije,
} from '../src/baza/shema.js';
import {
  priznajCistuPetica,
  priznajDnevnuPobjeduModa,
  priznajRijetkuGrdosiju,
  priznajSvePohvale,
} from '../src/dostignuca/dodjela-d02.js';
import { zakljuciPartijuUBazi, type ZapisStatistikeRijeci } from '../src/igra/upis-partije.js';

const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];

function statistika(
  igracId: string,
  prihvaceniPotezi: number,
  extras: Partial<ZapisStatistikeRijeci> = {},
): ZapisStatistikeRijeci {
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
    pogresniUnosi: 0,
    dugeRijetkeRijeci: [],
    ...extras,
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

async function novaPartija(mod: 'dva_igraca' | 'cetiri_igraca' = 'cetiri_igraca'): Promise<string> {
  const id = randomUUID();
  partijeZaBrisanje.push(id);
  await baza.insert(partije).values({ id, mod, status: 'u_tijeku' });
  return id;
}

describe('dostignuća D02', () => {
  afterEach(async () => {
    for (const partijaId of partijeZaBrisanje.splice(0)) {
      await baza.delete(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId));
      await baza.delete(dokaziDostignucaCistaPetica).where(eq(dokaziDostignucaCistaPetica.partijaId, partijaId));
      await baza.delete(dokaziDostignucaSvePohvale).where(eq(dokaziDostignucaSvePohvale.partijaId, partijaId));
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
    for (const igracId of igraciZaBrisanje.splice(0)) {
      await baza.delete(dokaziDostignucaDvostrukaKruna).where(eq(dokaziDostignucaDvostrukaKruna.igracId, igracId));
      await baza.delete(dokaziDostignucaRijetkaGrdosija).where(eq(dokaziDostignucaRijetkaGrdosija.igracId, igracId));
      await baza.delete(evidencijaDnevnihPobjedaModova).where(eq(evidencijaDnevnihPobjedaModova.igracId, igracId));
      await baza.delete(obavijestiIgraca).where(eq(obavijestiIgraca.igracId, igracId));
      await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
      await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
      await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
      await baza.delete(igraci).where(eq(igraci.id, igracId));
    }
  });

  it('dvostruka kruna tek nakon oba moda istog zagrebačkog dana', async () => {
    const igracId = await noviIgrac('Kruna');
    const zavrsenoU = new Date('2026-11-06T12:00:00.000Z');

    const samoDvoboj = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'dva_igraca', zavrsenoU }));
    expect(samoDvoboj.doprinosUmetnut).toBe(false);

    const oba = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'cetiri_igraca', zavrsenoU }));
    expect(oba.novaDostignuca).toEqual([
      { id: ID_DOSTIGNUCA_DVOSTRUKA_KRUNA, novaRazina: 1, maksimalnaRazina: 5 },
    ]);

    const ponovo = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'dva_igraca', zavrsenoU }));
    expect(ponovo.doprinosUmetnut).toBe(false);

    const [napredak] = await baza.select({ dvostrukeKrune: napredakDostignucaIgraca.dvostrukeKrune })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.dvostrukeKrune).toBe(1);
  });

  it('čista petica kroz zaključak: 5 riječi i 0 pogrešaka; pogreška ili retry ne daju duplo', async () => {
    const igracId = await noviIgrac('Petica');
    const partijaId = await novaPartija();
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
    const zavrsenoU = new Date('2026-11-06T13:00:00.000Z');

    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 10, eliminacije: 0, iskustvo: 5, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId, 5, { pogresniUnosi: 0 })]]),
      false,
      new Map(),
      zavrsenoU,
    );
    expect(agregati.get(igracId)?.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_CISTA_PETICA)).toBe(true);

    const retry = await baza.transaction((tx) => priznajCistuPetica(tx, { igracId, partijaId, zavrsenoU }));
    expect(retry.doprinosUmetnut).toBe(false);

    const prljava = await novaPartija();
    await baza.insert(sudioniciPartije).values({ partijaId: prljava, igracId, sjedalo: 0 });
    const prljavi = await zakljuciPartijuUBazi(
      prljava,
      igracId,
      [{ igracId, plasman: 1, bodovi: 10, eliminacije: 0, iskustvo: 5, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, statistika(igracId, 5, { pogresniUnosi: 1 })]]),
      false,
      new Map(),
      new Date('2026-11-06T14:00:00.000Z'),
    );
    expect(prljavi.get(igracId)?.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_CISTA_PETICA)).toBe(false);

    const [napredak] = await baza.select({ cistePetice: napredakDostignucaIgraca.cistePetice })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.cistePetice).toBe(1);
  });

  it('sve pohvale jednom po igri', async () => {
    const igracId = await noviIgrac('Pohvale');
    const partijaId = await novaPartija();
    const zavrsenoU = new Date('2026-11-06T15:00:00.000Z');

    const ishod = await baza.transaction((tx) => priznajSvePohvale(tx, { igracId, partijaId, zavrsenoU }));
    expect(ishod.novaDostignuca).toEqual([
      { id: ID_DOSTIGNUCA_SVE_POHVALE, novaRazina: 1, maksimalnaRazina: 5 },
    ]);
    const ponovo = await baza.transaction((tx) => priznajSvePohvale(tx, { igracId, partijaId, zavrsenoU }));
    expect(ponovo.doprinosUmetnut).toBe(false);
  });

  it('rijetka grdosija broji različite oblike, ne ponavljanja', async () => {
    const igracId = await noviIgrac('Grdosija');
    const zavrsenoU = new Date('2026-11-06T16:00:00.000Z');

    const prvi = await baza.transaction((tx) =>
      priznajRijetkuGrdosiju(tx, { igracId, normaliziraniOblik: 'elektrokardiograf', zavrsenoU }));
    expect(prvi.novaDostignuca).toEqual([
      { id: ID_DOSTIGNUCA_RIJETKA_GRDOSIJA, novaRazina: 1, maksimalnaRazina: 5 },
    ]);

    const isti = await baza.transaction((tx) =>
      priznajRijetkuGrdosiju(tx, { igracId, normaliziraniOblik: 'Elektrokardiograf', zavrsenoU }));
    expect(isti.doprinosUmetnut).toBe(false);

    const drugi = await baza.transaction((tx) =>
      priznajRijetkuGrdosiju(tx, { igracId, normaliziraniOblik: 'elektrokardiogrami', zavrsenoU }));
    expect(drugi.doprinosUmetnut).toBe(true);

    const [napredak] = await baza.select({ rijetkeGrdosije: napredakDostignucaIgraca.rijetkeGrdosije })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.rijetkeGrdosije).toBe(2);

    const [razina] = await baza.select({ razina: dostignucaIgraca.razina })
      .from(dostignucaIgraca)
      .where(and(
        eq(dostignucaIgraca.igracId, igracId),
        eq(dostignucaIgraca.dostignuceId, ID_DOSTIGNUCA_RIJETKA_GRDOSIJA),
      ));
    expect(razina?.razina).toBe(1);
  });
});
