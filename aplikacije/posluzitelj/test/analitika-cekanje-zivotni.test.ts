import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  stvoriCekanjeZivotniCiklus,
  type IshodAnalitikeCekanja,
} from '../src/analitika/cekanje-zivotni-ciklus.js';

describe('analitika čekanja — životni ciklus', () => {
  type Zapis = { attemptId: string; ishod: IshodAnalitikeCekanja; krajU: Date };
  let zapisi: Zapis[];
  let ciklus: ReturnType<typeof stvoriCekanjeZivotniCiklus>;

  afterEach(() => {
    vi.useRealTimers();
  });

  function noviCiklus() {
    zapisi = [];
    ciklus = stvoriCekanjeZivotniCiklus({
      zabiljezi: (snimka, ishod, krajU = new Date()) => {
        zapisi.push({ attemptId: snimka.attemptId, ishod, krajU });
      },
    });
    return ciklus;
  }

  function otvori(igracId: string, generacija: number, pocetakU = new Date()) {
    return ciklus.otvoriPokusajCekanja({
      igracId,
      generacija,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU,
    });
  }

  it('otvara pokušaj i zatvara napuštanjem', () => {
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 1);
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracId)?.generacija).toBe(1);
    ciklus.zatvoriPokusajCekanja(igracId, 'napustanje');
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
    expect(zapisi).toHaveLength(1);
    expect(zapisi[0]!.ishod).toBe('napustanje');
  });

  it('promjena reda zatvara stari pokušaj', () => {
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 1);
    otvori(igracId, 2);
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracId)?.generacija).toBe(2);
    expect(zapisi).toHaveLength(1);
    expect(zapisi[0]!.ishod).toBe('promjena_reda');
  });

  it('čuva stvarno vrijeme napuštanja pri odgođenom neuspjuhu', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'));
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 1, new Date());
    ciklus.oznaciPokretanjeCekanja([{ igracId, generacija: 1 }]);

    vi.setSystemTime(new Date('2026-03-01T10:00:12.000Z'));
    const vrijemeNapustanja = new Date();
    ciklus.zatvoriPokusajCekanja(igracId, 'napustanje');

    vi.setSystemTime(new Date('2026-03-01T10:00:40.000Z'));
    ciklus.zavrsiPokretanjeNeuspjeh([{ igracId, generacija: 1 }], new Set());

    expect(zapisi).toHaveLength(1);
    expect(zapisi[0]!.ishod).toBe('napustanje');
    expect(zapisi[0]!.krajU.toISOString()).toBe(vrijemeNapustanja.toISOString());
  });

  it('napuštanje nakon kojeg slijedi disconnect zadržava prvi ishod i vrijeme', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T11:00:00.000Z'));
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 1);
    ciklus.oznaciPokretanjeCekanja([{ igracId, generacija: 1 }]);

    vi.setSystemTime(new Date('2026-03-01T11:00:05.000Z'));
    const vrijemeNapustanja = new Date();
    ciklus.zatvoriPokusajCekanja(igracId, 'napustanje');

    vi.setSystemTime(new Date('2026-03-01T11:00:06.000Z'));
    ciklus.zatvoriPokusajCekanja(igracId, 'prekid_veze');

    vi.setSystemTime(new Date('2026-03-01T11:00:20.000Z'));
    ciklus.zavrsiPokretanjeNeuspjeh([{ igracId, generacija: 1 }], new Set());

    expect(zapisi).toHaveLength(1);
    expect(zapisi[0]!.ishod).toBe('napustanje');
    expect(zapisi[0]!.krajU.toISOString()).toBe(vrijemeNapustanja.toISOString());
  });

  it('uspješno uparivanje pobjeđuje odgođeni ishod', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 1);
    ciklus.oznaciPokretanjeCekanja([{ igracId, generacija: 1 }]);
    ciklus.zatvoriPokusajCekanja(igracId, 'napustanje');
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracId)?.odgodeniIshod).toBe('napustanje');

    vi.setSystemTime(new Date('2026-03-01T12:00:08.000Z'));
    const vrijemeUparivanja = new Date();
    ciklus.zavrsiPokretanjeUparivanje([{ igracId, generacija: 1 }]);

    expect(zapisi).toHaveLength(1);
    expect(zapisi[0]!.ishod).toBe('uparivanje');
    expect(zapisi[0]!.krajU.toISOString()).toBe(vrijemeUparivanja.toISOString());
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
  });

  it('neuspješan start s povratom u red zadržava pokušaj i čisti odgodu', () => {
    noviCiklus();
    const igracId = randomUUID();
    otvori(igracId, 4);
    ciklus.oznaciPokretanjeCekanja([{ igracId, generacija: 4 }]);
    ciklus.zatvoriPokusajCekanja(igracId, 'prekid_veze');
    ciklus.zavrsiPokretanjeNeuspjeh([{ igracId, generacija: 4 }], new Set([igracId]));
    const aktivni = ciklus.dohvatiAktivniPokusajZaTest(igracId);
    expect(aktivni?.generacija).toBe(4);
    expect(aktivni?.pokretanjeUTijeku).toBe(false);
    expect(aktivni?.odgodeniIshod).toBeNull();
    expect(aktivni?.odgodeniU).toBeNull();
    expect(zapisi).toHaveLength(0);
  });

  it('izolira memorijsko stanje dviju instanci', () => {
    const a = noviCiklus();
    const b = stvoriCekanjeZivotniCiklus({
      zabiljezi: () => {
        /* druga instanca */
      },
    });
    const igracId = randomUUID();
    a.otvoriPokusajCekanja({
      igracId,
      generacija: 1,
      kljucReda: '2-zajednicki',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      vrstaRacuna: 'gost',
      pocetakU: new Date(),
    });
    expect(a.dohvatiAktivniPokusajZaTest(igracId)?.generacija).toBe(1);
    expect(b.dohvatiAktivniPokusajZaTest(igracId)).toBeUndefined();
    expect(a.brojAktivnihZaTest()).toBe(1);
    expect(b.brojAktivnihZaTest()).toBe(0);
  });

  it('čišćenje zatvara sve aktivne i odgođene pokušaje', () => {
    noviCiklus();
    const igracA = randomUUID();
    const igracB = randomUUID();
    otvori(igracA, 1);
    otvori(igracB, 1);
    ciklus.oznaciPokretanjeCekanja([{ igracId: igracB, generacija: 1 }]);
    ciklus.zatvoriPokusajCekanja(igracB, 'napustanje');
    expect(ciklus.brojAktivnihZaTest()).toBe(2);

    ciklus.zatvoriSvePokusajeCekanja('uklonjen');
    expect(ciklus.brojAktivnihZaTest()).toBe(0);
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracA)).toBeUndefined();
    expect(ciklus.dohvatiAktivniPokusajZaTest(igracB)).toBeUndefined();
    expect(zapisi.map((z) => z.ishod).sort()).toEqual(['uklonjen', 'uklonjen']);
  });
});
