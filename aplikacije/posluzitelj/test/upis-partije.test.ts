import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { izracunajRazinuDostignuca, dohvatiDefinicijuDostignuca } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, obracuniPartija, otkljucaneGrupeIgraca, partije, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { ponistiPartijeUTijekuUBazi, zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';

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