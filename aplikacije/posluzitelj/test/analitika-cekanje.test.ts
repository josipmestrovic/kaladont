import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  dohvatiAktivniPokusajZaTest,
  oznaciPokretanjeCekanja,
  otvoriPokusajCekanja,
  resetirajCekanjeZivotniCiklusZaTest,
  zatvoriPokusajCekanja,
  zavrsiPokretanjeNeuspjeh,
  zavrsiPokretanjeUparivanje,
} from '../src/analitika/cekanje-zivotni-ciklus.js';
import { upsertZapisCekanja } from '../src/analitika/cekanje-upis.js';
import {
  agregirajCekanje,
  medijanTrajanja,
  p90Trajanja,
  p95Trajanja,
  prosjekTrajanja,
} from '../src/analitika/cekanje.js';
import { danasZagrebIso, pocetakDanaZagrebUtc } from '../src/analitika/otvaranja.js';
import type { IshodAnalitikeCekanja, SnimkaPokusajaCekanja } from '../src/analitika/cekanje-zivotni-ciklus.js';

describe('analitika čekanja — životni ciklus', () => {
  afterEach(() => {
    resetirajCekanjeZivotniCiklusZaTest();
  });

  it('otvara pokušaj i zatvara napuštanjem', () => {
    const igracId = randomUUID();
    otvoriPokusajCekanja({
      igracId,
      generacija: 1,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    expect(dohvatiAktivniPokusajZaTest(igracId)?.generacija).toBe(1);
    zatvoriPokusajCekanja(igracId, 'napustanje');
    expect(dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
  });

  it('promjena reda zatvara stari pokušaj', () => {
    const igracId = randomUUID();
    otvoriPokusajCekanja({
      igracId,
      generacija: 1,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    otvoriPokusajCekanja({
      igracId,
      generacija: 2,
      kljucReda: '3-ka-zna',
      mod: 'tri_igraca',
      pravila: 'ka_zna',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    expect(dohvatiAktivniPokusajZaTest(igracId)?.generacija).toBe(2);
  });

  it('tijekom pokretanja odgađa napuštanje; uspjeh pobjeđuje', () => {
    const igracId = randomUUID();
    otvoriPokusajCekanja({
      igracId,
      generacija: 3,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'registriran',
      pocetakU: new Date(),
    });
    oznaciPokretanjeCekanja([{ igracId, generacija: 3 }]);
    zatvoriPokusajCekanja(igracId, 'napustanje');
    expect(dohvatiAktivniPokusajZaTest(igracId)?.pokretanjeUTijeku).toBe(true);
    zavrsiPokretanjeUparivanje([{ igracId, generacija: 3 }]);
    expect(dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
  });

  it('neuspjeh s povratom u red zadržava pokušaj', () => {
    const igracId = randomUUID();
    otvoriPokusajCekanja({
      igracId,
      generacija: 4,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    oznaciPokretanjeCekanja([{ igracId, generacija: 4 }]);
    zatvoriPokusajCekanja(igracId, 'prekid_veze');
    zavrsiPokretanjeNeuspjeh([{ igracId, generacija: 4 }], new Set([igracId]));
    const aktivni = dohvatiAktivniPokusajZaTest(igracId);
    expect(aktivni?.generacija).toBe(4);
    expect(aktivni?.pokretanjeUTijeku).toBe(false);
    expect(aktivni?.odgodeniIshod).toBeNull();
  });

  it('neuspjeh bez povratka primjenjuje odgođeni ishod', () => {
    const igracId = randomUUID();
    otvoriPokusajCekanja({
      igracId,
      generacija: 5,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    oznaciPokretanjeCekanja([{ igracId, generacija: 5 }]);
    zatvoriPokusajCekanja(igracId, 'napustanje');
    zavrsiPokretanjeNeuspjeh([{ igracId, generacija: 5 }], new Set());
    expect(dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
  });
});

describe('analitika čekanja — agregat', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  it('računa prosjek, medijan, P90 i P95', () => {
    expect(prosjekTrajanja([])).toBeNull();
    expect(medijanTrajanja([])).toBeNull();
    expect(p90Trajanja([])).toBeNull();
    expect(p95Trajanja([])).toBeNull();
    expect(prosjekTrajanja([10, 20, 30])).toBe(20);
    expect(medijanTrajanja([10, 20, 30, 40])).toBe(25);
    expect(p90Trajanja([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])).toBe(90);
    expect(p95Trajanja([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])).toBe(100);
  });

  it('prazan raspon vraća nulte metrike', async () => {
    const daleko = '2099-07-01';
    const agregat = await agregirajCekanje({ odDan: daleko, doDan: daleko });
    expect(agregat.ukupno.terminalniPokusaji).toBe(0);
    expect(agregat.ukupno.trajanjeDoUparivanja.prosjekSekundi).toBeNull();
    expect(agregat.gosti.terminalniPokusaji).toBe(0);
    expect(agregat.registrirani.terminalniPokusaji).toBe(0);
  });

  it('agregira ishode, segment gost/reg i kantice napuštanja', async () => {
    const dan = danasZagrebIso();
    const bazaMs = pocetakDanaZagrebUtc(dan).getTime() + 12 * 3_600_000;

    async function zapisi(
      ishod: IshodAnalitikeCekanja,
      vrsta: 'gost' | 'registriran',
      trajanjeSek: number,
    ) {
      const snimka: SnimkaPokusajaCekanja = {
        attemptId: randomUUID(),
        generacija: 1,
        kljucReda: '2-zajednicki',
        mod: 'dva_igraca',
        pravila: 'klasicni',
        vrstaRacuna: vrsta,
        pocetakU: new Date(bazaMs),
      };
      await upsertZapisCekanja(snimka, ishod, new Date(bazaMs + trajanjeSek * 1000));
    }

    await zapisi('uparivanje', 'gost', 12);
    await zapisi('uparivanje', 'registriran', 20);
    await zapisi('napustanje', 'gost', 3);
    await zapisi('napustanje', 'gost', 8);
    await zapisi('prekid_veze', 'registriran', 40);

    const agregat = await agregirajCekanje({ odDan: dan, doDan: dan });
    expect(agregat.ukupno.terminalniPokusaji).toBeGreaterThanOrEqual(5);
    const uparivanja = agregat.ukupno.ishodi.find((i) => i.ishod === 'uparivanje')!.broj;
    const napustanja = agregat.ukupno.ishodi.find((i) => i.ishod === 'napustanje')!.broj;
    expect(uparivanja).toBeGreaterThanOrEqual(2);
    expect(napustanja).toBeGreaterThanOrEqual(2);
    expect(agregat.gosti.terminalniPokusaji).toBeGreaterThanOrEqual(3);
    expect(agregat.registrirani.terminalniPokusaji).toBeGreaterThanOrEqual(2);
    const kanta05 = agregat.ukupno.distribucijaNapustanja.find((d) => d.interval === '0-5');
    const kanta510 = agregat.ukupno.distribucijaNapustanja.find((d) => d.interval === '5-10');
    expect(kanta05!.broj).toBeGreaterThanOrEqual(1);
    expect(kanta510!.broj).toBeGreaterThanOrEqual(1);
  });
});
