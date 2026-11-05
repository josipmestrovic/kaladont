import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { izracunajRazinuDostignuca, dohvatiDefinicijuDostignuca, ukupnoIskustvoZaRazinu } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, obracuniPartija, otkljucaneGrupeIgraca, partije, pohvaleIgre, potezi, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { osigurajUpisePoteza, ponistiPartijeUTijekuUBazi, zapisiPocetakPartije, zapisiPotez, zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';
import type { ZapisPoteza, ZapisStatistikeRijeci } from '../src/igra/upis-partije.js';

function praznaStatistika(igracId: string, najduziStreak = 0): ZapisStatistikeRijeci {
  const imaNiza = najduziStreak > 0;
  return {
    igracId,
    grupe: [],
    otkljucaneRijeci: [],
    prihvaceniPotezi: najduziStreak,
    ukupnoTrajanjePrihvaceniPoteziMs: 0,
    najduziStreak,
    otkriveneJakoRijetkeGrupe: 0,
    otkriveneSrednjeRijetkeGrupe: 0,
    otkriveneRijetkeGrupe: 0,
    upisaneDugeRijeci: 0,
    upisaneSrednjeDugeRijeci: 0,
    upisaneJakoDugeRijeci: 0,
    najduzaRijec: imaNiza ? 'test' : null,
    najduzaRijecGrafemi: imaNiza ? 4 : 0,
    najrjedaRijec: null,
    najrjedaRijecFrekvencija: null,
    najrjedaTier: null,
  };
}

describe('upis partije i javne pobjede', () => {
  const igracId = randomUUID();
  const obracuniZaBrisanje: string[] = [];

  afterEach(async () => {
    for (const partijaId of obracuniZaBrisanje.splice(0)) {
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
    }
    await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
    await baza.delete(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId));
    await baza.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igracId));
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.igracId, igracId));
    await baza.delete(partije).where(eq(partije.pobjednikId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  });

  it('povećava javne pobjede jednom po partiji i dodjeljuje ispravnu razinu', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Pobjednik' });

    for (let brojPartije = 0; brojPartije < 5; brojPartije += 1) {
      const partijaId = randomUUID();
      obracuniZaBrisanje.push(partijaId);
      await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
      await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

      const zavrsniRezultati = [{ igracId, plasman: 1 as const, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
      const napredak = new Map([[igracId, { delta: {} }]]);
      await Promise.all([
        zakljuciPartijuUBazi(partijaId, igracId, zavrsniRezultati, 'cetiri_igraca', new Map(), false, napredak),
        zakljuciPartijuUBazi(partijaId, igracId, zavrsniRezultati, 'cetiri_igraca', new Map(), false, napredak),
      ]);
      await zakljuciPartijuUBazi(
        partijaId,
        igracId,
        zavrsniRezultati,
        'cetiri_igraca',
        new Map(),
        false,
        napredak,
      );

      const [partija] = await baza.select({ status: partije.status }).from(partije).where(eq(partije.id, partijaId));
      const obracuni = await baza.select().from(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      const [sudionik] = await baza
        .select({ plasman: sudioniciPartije.plasman, nacinIspadanja: sudioniciPartije.nacinIspadanja })
        .from(sudioniciPartije)
        .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, igracId)));
      expect(partija?.status).toBe('zavrsena');
      expect(obracuni).toHaveLength(1);
      expect(sudionik).toEqual({ plasman: 1, nacinIspadanja: 'pobjednik' });
    }

    const [igrac] = await baza.select({ pobjede: igraci.pobjede }).from(igraci).where(eq(igraci.id, igracId));
    const [napredak] = await baza
      .select({ javnePobjede: napredakDostignucaIgraca.javnePobjede })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId));
    const [dostignuce] = await baza
      .select({ razina: dostignucaIgraca.razina })
      .from(dostignucaIgraca)
      .where(and(eq(dostignucaIgraca.igracId, igracId), eq(dostignucaIgraca.dostignuceId, 'zavrsna_rijec')));

    const definicija = dohvatiDefinicijuDostignuca('zavrsna_rijec')!;
    expect(igrac?.pobjede).toBe(5);
    expect(napredak?.javnePobjede).toBe(5);
    expect(dostignuce?.razina).toBe(izracunajRazinuDostignuca(definicija, 5));
    expect(dostignuce?.razina).toBe(2);
  });

  it('pobjeda daje 5 zvjezdica, a 0 XP bez doprinosa daje 1', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Ocjene' });

    const partijaPobjede = randomUUID();
    obracuniZaBrisanje.push(partijaPobjede);
    await baza.insert(partije).values({ id: partijaPobjede, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId: partijaPobjede, igracId, sjedalo: 0 });

    const agregatiPobjede = await zakljuciPartijuUBazi(
      partijaPobjede,
      igracId,
      [{ igracId, plasman: 1, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 0,
        ukupnoTrajanjePrihvaceniPoteziMs: 0,
        najduziStreak: 0,
        otkriveneJakoRijetkeGrupe: 0,
        otkriveneSrednjeRijetkeGrupe: 0,
        otkriveneRijetkeGrupe: 0,
        upisaneDugeRijeci: 0,
        upisaneSrednjeDugeRijeci: 0,
        upisaneJakoDugeRijeci: 0,
        najduzaRijec: null,
        najduzaRijecGrafemi: 0,
        najrjedaRijec: null,
        najrjedaRijecFrekvencija: null,
        najrjedaTier: null,
      }]]),
      false,
      new Map(),
    );
    expect(agregatiPobjede.get(igracId)?.ocjenaIgre).toBe(5);

    const partijaPoraza = randomUUID();
    obracuniZaBrisanje.push(partijaPoraza);
    await baza.insert(partije).values({ id: partijaPoraza, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId: partijaPoraza, igracId, sjedalo: 0 });

    const agregatiPoraza = await zakljuciPartijuUBazi(
      partijaPoraza,
      igracId,
      [{ igracId, plasman: 4, bodovi: 0, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'istek' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 0,
        ukupnoTrajanjePrihvaceniPoteziMs: 0,
        najduziStreak: 0,
        otkriveneJakoRijetkeGrupe: 0,
        otkriveneSrednjeRijetkeGrupe: 0,
        otkriveneRijetkeGrupe: 0,
        upisaneDugeRijeci: 0,
        upisaneSrednjeDugeRijeci: 0,
        upisaneJakoDugeRijeci: 0,
        najduzaRijec: null,
        najduzaRijecGrafemi: 0,
        najrjedaRijec: null,
        najrjedaRijecFrekvencija: null,
        najrjedaTier: null,
      }]]),
      false,
      new Map(),
    );
    expect(agregatiPoraza.get(igracId)?.ocjenaIgre).toBe(1);

    const [statistika] = await baza.select({
      zbrojOcjenaIgre: dnkStatistikeIgraca.zbrojOcjenaIgre,
      brojOcjenaIgre: dnkStatistikeIgraca.brojOcjenaIgre,
    }).from(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
    expect(statistika).toEqual({ zbrojOcjenaIgre: 6, brojOcjenaIgre: 2 });
  });

  it('privatna partija ne zapisuje statistiku javnog moda', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Privatni Test' });

    await zakljuciPartijuUBazi(
      randomUUID(),
      igracId,
      [{ igracId, plasman: 1, bodovi: 2, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 3,
        ukupnoTrajanjePrihvaceniPoteziMs: 3_000,
        najduziStreak: 3,
        otkriveneJakoRijetkeGrupe: 0,
        otkriveneSrednjeRijetkeGrupe: 0,
        otkriveneRijetkeGrupe: 0,
        upisaneDugeRijeci: 1,
        upisaneSrednjeDugeRijeci: 0,
        upisaneJakoDugeRijeci: 0,
        najduzaRijec: null,
        najduzaRijecGrafemi: 0,
        najrjedaRijec: null,
        najrjedaRijecFrekvencija: null,
        najrjedaTier: null,
      }]]),
      true,
      new Map(),
    );

    expect(await baza.select().from(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igracId))).toHaveLength(0);
    expect(await baza.select().from(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId))).toHaveLength(0);
  });

  it('privatnu gamifikaciju obračunava samo jednom', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Privatni Idempotentni Test' });
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    const rezultati = [{ igracId, plasman: 1 as const, bodovi: 2, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
    const napredak = new Map([[igracId, { delta: { kaladontIzvedbe: 1 } }]]);

    await Promise.all([
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', new Map(), true, napredak),
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', new Map(), true, napredak),
    ]);

    const [stanje] = await baza
      .select({ kaladontIzvedbe: napredakDostignucaIgraca.kaladontIzvedbe })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId));
    const obracuni = await baza.select().from(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
    expect(stanje?.kaladontIzvedbe).toBe(1);
    expect(obracuni).toHaveLength(1);
  });

  it('promovira trening-grupu za dostignuća jednom, uključujući istodobni obračun', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Promocija Treninga' });
    const grupa = `imenica:promocija-${randomUUID()}`;
    await baza.insert(otkljucaneGrupeIgraca).values({ igracId, grupa, tier: 1, zaDostignuca: false });
    const statistika = {
      igracId,
      grupe: [{ grupa, tier: 1 }],
      otkljucaneRijeci: [],
      prihvaceniPotezi: 1,
      ukupnoTrajanjePrihvaceniPoteziMs: 1_000,
      najduziStreak: 1,
      otkriveneJakoRijetkeGrupe: 0,
      otkriveneSrednjeRijetkeGrupe: 0,
      otkriveneRijetkeGrupe: 0,
      upisaneDugeRijeci: 0,
      upisaneSrednjeDugeRijeci: 0,
      upisaneJakoDugeRijeci: 0,
      najduzaRijec: null,
      najduzaRijecGrafemi: 0,
      najrjedaRijec: null,
      najrjedaRijecFrekvencija: null,
      najrjedaTier: null,
    };
    const rezultati = [{ igracId, plasman: 1 as const, bodovi: 0, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
    const napredak = new Map([[igracId, { delta: { rijetkeLeksemskeGrupe: 0 } }]]);
    const obracun = (partijaId: string) => zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'dva_igraca', new Map([[igracId, statistika]]), true, napredak);
    const prviId = randomUUID();
    obracuniZaBrisanje.push(prviId);
    await Promise.all([obracun(prviId), obracun(prviId)]);
    const drugiId = randomUUID();
    obracuniZaBrisanje.push(drugiId);
    await obracun(drugiId);

    const [otkljucana] = await baza.select({ zaDostignuca: otkljucaneGrupeIgraca.zaDostignuca }).from(otkljucaneGrupeIgraca).where(and(eq(otkljucaneGrupeIgraca.igracId, igracId), eq(otkljucaneGrupeIgraca.grupa, grupa)));
    const [napredakDB] = await baza.select({ rijetke: napredakDostignucaIgraca.rijetkeLeksemskeGrupe }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    const [dostignuce] = await baza.select({ razina: dostignucaIgraca.razina }).from(dostignucaIgraca).where(and(eq(dostignucaIgraca.igracId, igracId), eq(dostignucaIgraca.dostignuceId, 'rijetkolovac')));
    expect(otkljucana?.zaDostignuca).toBe(true);
    expect(napredakDB?.rijetke).toBe(1);
    expect(dostignuce?.razina).toBe(1);
  });

  it('pri oporavku označava nezavršenu partiju kao poništenu', async () => {
    const partijaId = randomUUID();
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    const brojPonistenih = await ponistiPartijeUTijekuUBazi([partijaId]);
    const [partija] = await baza.select({ status: partije.status }).from(partije).where(eq(partije.id, partijaId));

    expect(brojPonistenih).toBe(1);
    expect(partija?.status).toBe('ponistena');
    await baza.delete(partije).where(eq(partije.id, partijaId));
  });

  it('sprema sažetak igre za ljestvice i zadržava stvarni kraj pri ponovljenom upisu', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Sažetka' });
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

    const zavrsenoU = new Date('2026-10-01T21:59:30.000Z');
    const rezultati = [{ igracId, plasman: 1 as const, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
    const statistike = new Map([[igracId, {
      igracId,
      grupe: [],
      otkljucaneRijeci: [],
      prihvaceniPotezi: 5,
      ukupnoTrajanjePrihvaceniPoteziMs: 12_345,
      najduziStreak: 3,
      otkriveneJakoRijetkeGrupe: 0,
      otkriveneSrednjeRijetkeGrupe: 0,
      otkriveneRijetkeGrupe: 0,
      upisaneDugeRijeci: 0,
      upisaneSrednjeDugeRijeci: 0,
      upisaneJakoDugeRijeci: 0,
      najduzaRijec: 'njuškalo',
      najduzaRijecGrafemi: 7,
      najrjedaRijec: null,
      najrjedaRijecFrekvencija: null,
      najrjedaTier: null,
    }]]);

    await zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', statistike, false, new Map(), zavrsenoU);
    await zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', statistike, false, new Map(), new Date());

    const [partija] = await baza.select({ kraj: partije.kraj }).from(partije).where(eq(partije.id, partijaId));
    const [sudionik] = await baza.select({
      metrikeVerzija: sudioniciPartije.metrikeVerzija,
      prihvaceneRijeci: sudioniciPartije.prihvaceneRijeci,
      trajanjePrihvacenihMs: sudioniciPartije.trajanjePrihvacenihMs,
      najduziNizRijeci: sudioniciPartije.najduziNizRijeci,
      najduzaRijec: sudioniciPartije.najduzaRijec,
      najduzaRijecGrafemi: sudioniciPartije.najduzaRijecGrafemi,
    }).from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
    const [igrac] = await baza.select({ odigrane: igraci.odigrane }).from(igraci).where(eq(igraci.id, igracId));

    expect(partija?.kraj?.toISOString()).toBe(zavrsenoU.toISOString());
    expect(sudionik).toEqual({
      metrikeVerzija: 1,
      prihvaceneRijeci: 5,
      trajanjePrihvacenihMs: 12_345,
      najduziNizRijeci: 3,
      najduzaRijec: 'njuškalo',
      najduzaRijecGrafemi: 7,
    });
    expect(igrac?.odigrane).toBe(1);
  });

  it('igra bez prihvaćenih riječi ima nulti sažetak, a bez statistike ostaje nepoznat', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Bez Riječi' });
    const prazna = {
      igracId,
      grupe: [],
      otkljucaneRijeci: [],
      prihvaceniPotezi: 0,
      ukupnoTrajanjePrihvaceniPoteziMs: 0,
      najduziStreak: 0,
      otkriveneJakoRijetkeGrupe: 0,
      otkriveneSrednjeRijetkeGrupe: 0,
      otkriveneRijetkeGrupe: 0,
      upisaneDugeRijeci: 0,
      upisaneSrednjeDugeRijeci: 0,
      upisaneJakoDugeRijeci: 0,
      najduzaRijec: null,
      najduzaRijecGrafemi: 0,
      najrjedaRijec: null,
      najrjedaRijecFrekvencija: null,
      najrjedaTier: null,
    };
    const ocekivano: unknown[] = [];
    for (const statistike of [new Map([[igracId, prazna]]), new Map()]) {
      const partijaId = randomUUID();
      obracuniZaBrisanje.push(partijaId);
      await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
      await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
      await zakljuciPartijuUBazi(
        partijaId,
        igracId,
        [{ igracId, plasman: 1, bodovi: 1, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
        'dva_igraca',
        statistike,
      );
      const [sudionik] = await baza.select({
        metrikeVerzija: sudioniciPartije.metrikeVerzija,
        prihvaceneRijeci: sudioniciPartije.prihvaceneRijeci,
        najduzaRijec: sudioniciPartije.najduzaRijec,
      }).from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      ocekivano.push(sudionik);
    }

    expect(ocekivano).toEqual([
      { metrikeVerzija: 1, prihvaceneRijeci: 0, najduzaRijec: null },
      { metrikeVerzija: null, prihvaceneRijeci: null, najduzaRijec: null },
    ]);
  });
});

describe('P01 pohvale igre', () => {
  const igracA = randomUUID();
  const igracB = randomUUID();
  const botId = randomUUID();
  const gostId = randomUUID();
  const obracuniZaBrisanje: string[] = [];
  const igraciZaBrisanje = [igracA, igracB, botId, gostId];

  afterEach(async () => {
    for (const partijaId of obracuniZaBrisanje.splice(0)) {
      await baza.delete(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId));
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
    for (const id of igraciZaBrisanje) {
      await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, id));
      await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, id));
      await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, id));
      await baza.delete(igraci).where(eq(igraci.id, id));
    }
  });

  it('P01-09: ista igra dvaput — jedan audit red i jedan pomak brojača', async () => {
    await baza.insert(igraci).values([
      { id: igracA, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'A' },
      { id: igracB, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'B' },
    ]);
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values([
      { partijaId, igracId: igracA, sjedalo: 0 },
      { partijaId, igracId: igracB, sjedalo: 1 },
    ]);
    const rezultati = [
      { igracId: igracA, plasman: 1 as const, bodovi: 2, eliminacije: 0, iskustvo: 50, nacinIspadanja: 'pobjednik' as const },
      { igracId: igracB, plasman: 2 as const, bodovi: 1, eliminacije: 0, iskustvo: 30, nacinIspadanja: 'ne_znam' as const },
    ];
    const statistike = new Map([
      [igracA, praznaStatistika(igracA, 6)],
      [igracB, praznaStatistika(igracB, 3)],
    ]);
    const bruto = new Map([[igracA, 50], [igracB, 30]]);
    await Promise.all([
      zakljuciPartijuUBazi(partijaId, igracA, rezultati, 'dva_igraca', statistike, false, new Map(), new Date(), bruto),
      zakljuciPartijuUBazi(partijaId, igracA, rezultati, 'dva_igraca', statistike, false, new Map(), new Date(), bruto),
    ]);
    const audit = await baza.select().from(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId));
    const [napredak] = await baza.select().from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracA));
    expect(audit.filter((r) => r.igracId === igracA)).toHaveLength(2);
    expect(napredak?.pohvaleNizUkupno).toBe(1);
    expect(napredak?.pohvaleXpUkupno).toBe(1);
  });

  it('P01-10: prag 0→1 otključava Vladar niza', async () => {
    await baza.insert(igraci).values([
      { id: igracA, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'A' },
      { id: igracB, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'B' },
    ]);
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values([
      { partijaId, igracId: igracA, sjedalo: 0 },
      { partijaId, igracId: igracB, sjedalo: 1 },
    ]);
    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracA,
      [
        { igracId: igracA, plasman: 1, bodovi: 1, eliminacije: 0, iskustvo: 10, nacinIspadanja: 'pobjednik' },
        { igracId: igracB, plasman: 2, bodovi: 0, eliminacije: 0, iskustvo: 5, nacinIspadanja: 'ne_znam' },
      ],
      'dva_igraca',
      new Map([[igracA, praznaStatistika(igracA, 4)], [igracB, praznaStatistika(igracB, 1)]]),
      false,
      new Map(),
      new Date(),
      new Map([[igracA, 10], [igracB, 5]]),
    );
    expect(agregati.get(igracA)?.pohvale.some((p) => p.vrsta === 'najduzi_niz')).toBe(true);
    expect(agregati.get(igracA)?.novaDostignuca.some((d) => d.id === 'vladar_niza' && d.novaRazina === 1)).toBe(true);
    const [dostignuce] = await baza.select().from(dostignucaIgraca)
      .where(and(eq(dostignucaIgraca.igracId, igracA), eq(dostignucaIgraca.dostignuceId, 'vladar_niza')));
    expect(dostignuce?.razina).toBe(1);
  });

  it('P01: LVL ≥ 10 + obje pohvale ne laže iskusnjaru (ni dvaput)', async () => {
    const iskustvoPrije = ukupnoIskustvoZaRazinu(12);
    await baza.insert(igraci).values([
      { id: igracA, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'A', iskustvoUkupno: iskustvoPrije },
      { id: igracB, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'B' },
    ]);
    await baza.insert(dostignucaIgraca).values({
      igracId: igracA,
      dostignuceId: 'iskusnjara',
      razina: 1,
      prvoOtkljucano: new Date('2020-01-01T00:00:00Z'),
      zadnjeOtkljucavanje: new Date('2020-01-01T00:00:00Z'),
    });
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values([
      { partijaId, igracId: igracA, sjedalo: 0 },
      { partijaId, igracId: igracB, sjedalo: 1 },
    ]);
    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracA,
      [
        { igracId: igracA, plasman: 1, bodovi: 2, eliminacije: 0, iskustvo: 40, nacinIspadanja: 'pobjednik' },
        { igracId: igracB, plasman: 2, bodovi: 1, eliminacije: 0, iskustvo: 10, nacinIspadanja: 'ne_znam' },
      ],
      'dva_igraca',
      new Map([[igracA, praznaStatistika(igracA, 6)], [igracB, praznaStatistika(igracB, 2)]]),
      false,
      new Map(),
      new Date(),
      new Map([[igracA, 40], [igracB, 10]]),
    );
    const pohvale = agregati.get(igracA)?.pohvale ?? [];
    expect(pohvale.some((p) => p.vrsta === 'najduzi_niz')).toBe(true);
    expect(pohvale.some((p) => p.vrsta === 'najvise_xp')).toBe(true);
    const lazneIskusnjare = (agregati.get(igracA)?.novaDostignuca ?? []).filter((d) => d.id === 'iskusnjara');
    expect(lazneIskusnjare).toEqual([]);
    const [iskusnjara] = await baza.select().from(dostignucaIgraca)
      .where(and(eq(dostignucaIgraca.igracId, igracA), eq(dostignucaIgraca.dostignuceId, 'iskusnjara')));
    expect(iskusnjara?.razina).toBe(1);
    expect(iskusnjara?.zadnjeOtkljucavanje?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
  });

  it('P01-11: privatna soba ne stvara pohvale', async () => {
    await baza.insert(igraci).values([
      { id: igracA, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'A' },
      { id: igracB, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'B' },
    ]);
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values([
      { partijaId, igracId: igracA, sjedalo: 0 },
      { partijaId, igracId: igracB, sjedalo: 1 },
    ]);
    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracA,
      [
        { igracId: igracA, plasman: 1, bodovi: 1, eliminacije: 0, iskustvo: 40, nacinIspadanja: 'pobjednik' },
        { igracId: igracB, plasman: 2, bodovi: 0, eliminacije: 0, iskustvo: 10, nacinIspadanja: 'ne_znam' },
      ],
      'dva_igraca',
      new Map([[igracA, praznaStatistika(igracA, 5)], [igracB, praznaStatistika(igracB, 1)]]),
      true,
      new Map(),
      new Date(),
      new Map([[igracA, 40], [igracB, 10]]),
    );
    expect(agregati.get(igracA)?.pohvale ?? []).toEqual([]);
    const audit = await baza.select().from(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId));
    expect(audit).toHaveLength(0);
  });

  it('P01-12/13: gost dobiva DTO pohvalu bez brojača; bot ne dobiva zapis', async () => {
    await baza.insert(igraci).values([
      { id: gostId, vrsta: 'gost', upravljac: 'covjek', nadimak: 'Gost' },
      { id: botId, vrsta: 'registriran', upravljac: 'bot', nadimak: 'Bot' },
      { id: igracA, vrsta: 'registriran', upravljac: 'covjek', nadimak: 'A' },
    ]);
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values([
      { partijaId, igracId: gostId, sjedalo: 0 },
      { partijaId, igracId: botId, sjedalo: 1 },
      { partijaId, igracId: igracA, sjedalo: 2 },
    ]);
    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      gostId,
      [
        { igracId: gostId, plasman: 1, bodovi: 3, eliminacije: 0, iskustvo: 80, nacinIspadanja: 'pobjednik' },
        { igracId: botId, plasman: 2, bodovi: 2, eliminacije: 0, iskustvo: 200, nacinIspadanja: 'ne_znam' },
        { igracId: igracA, plasman: 3, bodovi: 1, eliminacije: 0, iskustvo: 20, nacinIspadanja: 'ne_znam' },
      ],
      'cetiri_igraca',
      new Map([
        [gostId, praznaStatistika(gostId, 8)],
        [botId, praznaStatistika(botId, 2)],
        [igracA, praznaStatistika(igracA, 1)],
      ]),
      false,
      new Map(),
      new Date(),
      new Map([[gostId, 80], [botId, 200], [igracA, 20]]),
    );
    expect(agregati.get(gostId)?.pohvale.some((p) => p.vrsta === 'najduzi_niz')).toBe(true);
    expect(agregati.get(gostId)?.pohvale.some((p) => p.vrsta === 'najvise_xp')).toBeFalsy();
    expect(agregati.get(botId)?.pohvale ?? []).toEqual([]);
    const [napredakGost] = await baza.select().from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, gostId));
    expect(napredakGost?.pohvaleNizUkupno ?? 0).toBe(0);
    const auditBot = await baza.select().from(pohvaleIgre)
      .where(and(eq(pohvaleIgre.igraId, partijaId), eq(pohvaleIgre.igracId, botId)));
    expect(auditBot).toHaveLength(0);
  });
});

describe('pouzdan upis poteza', () => {
  const igracId = randomUUID();
  const partijeZaBrisanje: string[] = [];

  afterEach(async () => {
    for (const partijaId of partijeZaBrisanje.splice(0)) {
      await baza.delete(potezi).where(eq(potezi.partijaId, partijaId));
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
    await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
    await baza.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  });

  function zapisPoteza(partijaId: string, redniBroj: number, rijec: string): ZapisPoteza {
    return {
      partijaId,
      runda: 1,
      redniBroj,
      igracId,
      vrsta: 'rijec',
      rijec,
      trazenaSlova: rijec.slice(0, 2),
      trajanjeMs: 1_000,
    };
  }

  it('propagira DB grešku umjesto da je proguta kao uspjeh', async () => {
    const nepostojecaPartija = randomUUID();
    await expect(zapisiPotez(zapisPoteza(nepostojecaPartija, 1, 'mama'))).rejects.toBeTruthy();
  });

  it('idempotentno upisuje isti redni broj samo jednom', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Upis Idem' });
    const partijaId = randomUUID();
    partijeZaBrisanje.push(partijaId);
    await zapisiPocetakPartije(partijaId, [{
      igracId,
      nadimak: 'Upis Idem',
      sjedalo: 0,
      avatarId: 1,
      avatarConfig: null,
      avatarRevision: 0,
      rang: null,
      razina: 1,
      trenutniNiz: 0,
      razinaVatre: 0,
      upravljac: 'covjek',
      vrsta: 'registriran',
    }], new Map([[igracId, 0]]));

    const zapis = zapisPoteza(partijaId, 1, 'mama');
    await zapisiPotez(zapis);
    await zapisiPotez(zapis);
    await osigurajUpisePoteza([zapis, zapis]);

    const redovi = await baza.select().from(potezi).where(eq(potezi.partijaId, partijaId));
    expect(redovi).toHaveLength(1);
    expect(redovi[0]?.rijec).toBe('mama');
  });

  it('nakon privremenog kvara osigurava potpunu povijest i jedan XP', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Upis Retry', iskustvoUkupno: 100 });
    const partijaId = randomUUID();
    partijeZaBrisanje.push(partijaId);

    const prvi = zapisPoteza(partijaId, 1, 'mama');
    const drugi = zapisPoteza(partijaId, 2, 'mata');

    // Prekid: FK još ne postoji — greška se mora vidjeti, ne gutati.
    await expect(zapisiPotez(prvi)).rejects.toBeTruthy();

    await zapisiPocetakPartije(partijaId, [{
      igracId,
      nadimak: 'Upis Retry',
      sjedalo: 0,
      avatarId: 1,
      avatarConfig: null,
      avatarRevision: 0,
      rang: null,
      razina: 1,
      trenutniNiz: 0,
      razinaVatre: 0,
      upravljac: 'covjek',
      vrsta: 'registriran',
    }], new Map([[igracId, 0]]));

    // Ponovni pokušaj (kao završni osigurajUpisePoteza) — potpuna povijest.
    await osigurajUpisePoteza([prvi, drugi]);
    // Ponovna provjera nije novi write.
    await osigurajUpisePoteza([prvi, drugi]);

    const redovi = await baza.select({ redniBroj: potezi.redniBroj, rijec: potezi.rijec })
      .from(potezi)
      .where(eq(potezi.partijaId, partijaId));
    expect(redovi).toHaveLength(2);
    expect(redovi.map((r) => r.rijec).sort()).toEqual(['mama', 'mata']);

    const rezultati = [{ igracId, plasman: 1 as const, bodovi: 3, eliminacije: 0, iskustvo: 50, nacinIspadanja: 'pobjednik' as const }];
    const statistike = new Map([[igracId, praznaStatistika(igracId, 2)]]);
    const osnovni = new Map([[igracId, 50]]);
    await Promise.all([
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', statistike, false, new Map(), new Date(), osnovni),
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', statistike, false, new Map(), new Date(), osnovni),
    ]);
    const [nakonPrvih] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    await zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', statistike, false, new Map(), new Date(), osnovni);
    const [nakonPonovnog] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    const obracuni = await baza.select().from(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
    expect(obracuni).toHaveLength(1);
    expect(nakonPrvih?.iskustvoUkupno).toBeGreaterThan(100);
    expect(nakonPonovnog?.iskustvoUkupno).toBe(nakonPrvih?.iskustvoUkupno);
  });
});