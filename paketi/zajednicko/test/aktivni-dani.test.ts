import { describe, expect, it } from 'vitest';
import {
  izracunajNizNakonNovogDana,
  jeSljedeciKalendarskiDan,
  lokalniDatumIso,
  pomakniKalendarskiDan,
  trenutniNizZaPrikaz,
} from '../src/aktivni-dani.js';

describe('aktivni dani — kalendar', () => {
  it('prepoznaje sljedeći kalendarski dan i DST ožujak 2026.', () => {
    expect(jeSljedeciKalendarskiDan('2026-03-28', '2026-03-29')).toBe(true);
    expect(jeSljedeciKalendarskiDan('2026-03-29', '2026-03-30')).toBe(true);
    expect(pomakniKalendarskiDan('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('prepoznaje jesenski DST 2026.', () => {
    expect(jeSljedeciKalendarskiDan('2026-10-24', '2026-10-25')).toBe(true);
    expect(jeSljedeciKalendarskiDan('2026-10-25', '2026-10-26')).toBe(true);
  });

  it('dijeli dane točno na ponoć', () => {
    // 2026-03-30 00:00 lokalno = 2026-03-29T22:00:00Z (CET→CEST)
    expect(lokalniDatumIso(new Date('2026-03-29T21:59:59.000Z'))).toBe('2026-03-29');
    expect(lokalniDatumIso(new Date('2026-03-29T22:00:00.000Z'))).toBe('2026-03-30');
    // 2026-10-26 00:00 lokalno = 2026-10-25T23:00:00Z
    expect(lokalniDatumIso(new Date('2026-10-25T22:59:59.000Z'))).toBe('2026-10-25');
    expect(lokalniDatumIso(new Date('2026-10-25T23:00:00.000Z'))).toBe('2026-10-26');
  });

  it('isti UTC trenutak daje isti lokalni datum', () => {
    const t = new Date('2026-11-04T13:30:00.000Z');
    expect(lokalniDatumIso(t)).toBe('2026-11-04');
  });
});

describe('aktivni dani — niz i pragovi', () => {
  it('S05-U01: prvi dan = 1/1, razina 0', () => {
    const ishod = izracunajNizNakonNovogDana(null, '2026-11-01');
    expect(ishod).toEqual({
      trenutniNiz: 1,
      najboljiNiz: 1,
      razinaDostignuca: 0,
      novootkljucanaRazina: null,
    });
  });

  it('S05-U02: drugi uzastopni dan otključava razinu 1', () => {
    const ishod = izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-01', trenutniNiz: 1, najboljiNiz: 1 },
      '2026-11-02',
    );
    expect(ishod.trenutniNiz).toBe(2);
    expect(ishod.najboljiNiz).toBe(2);
    expect(ishod.razinaDostignuca).toBe(1);
    expect(ishod.novootkljucanaRazina).toBe(1);
  });

  it('S05-U03–U06: pragovi 5/10/20/30', () => {
    expect(izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-04', trenutniNiz: 4, najboljiNiz: 4 },
      '2026-11-05',
      1,
    ).novootkljucanaRazina).toBe(2);

    expect(izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-09', trenutniNiz: 9, najboljiNiz: 9 },
      '2026-11-10',
      2,
    ).novootkljucanaRazina).toBe(3);

    expect(izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-19', trenutniNiz: 19, najboljiNiz: 19 },
      '2026-11-20',
      3,
    ).novootkljucanaRazina).toBe(4);

    expect(izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-29', trenutniNiz: 29, najboljiNiz: 29 },
      '2026-11-30',
      4,
    ).novootkljucanaRazina).toBe(5);
  });

  it('S05-U07: 31. dan ne daje šestu razinu', () => {
    const ishod = izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-12-30', trenutniNiz: 30, najboljiNiz: 30 },
      '2026-12-31',
      5,
    );
    expect(ishod.najboljiNiz).toBe(31);
    expect(ishod.razinaDostignuca).toBe(5);
    expect(ishod.novootkljucanaRazina).toBeNull();
  });

  it('S05-U08: isti dan ne mijenja niz', () => {
    const ishod = izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-04', trenutniNiz: 3, najboljiNiz: 5 },
      '2026-11-04',
      2,
    );
    expect(ishod.trenutniNiz).toBe(3);
    expect(ishod.najboljiNiz).toBe(5);
    expect(ishod.novootkljucanaRazina).toBeNull();
  });

  it('S05-U09/U10: propušten dan resetira trenutni, čuva najbolji', () => {
    const ishod = izracunajNizNakonNovogDana(
      { zadnjiAktivniDatum: '2026-11-01', trenutniNiz: 8, najboljiNiz: 20 },
      '2026-11-04',
      4,
    );
    expect(ishod.trenutniNiz).toBe(1);
    expect(ishod.najboljiNiz).toBe(20);
    expect(ishod.razinaDostignuca).toBe(4);
    expect(ishod.novootkljucanaRazina).toBeNull();
  });

  it('S05-U16: prikaz trenutnog niza je 0 nakon pauze', () => {
    expect(trenutniNizZaPrikaz(
      { zadnjiAktivniDatum: '2026-11-01', trenutniNiz: 5, najboljiNiz: 5 },
      '2026-11-04',
    )).toBe(0);
    expect(trenutniNizZaPrikaz(
      { zadnjiAktivniDatum: '2026-11-03', trenutniNiz: 5, najboljiNiz: 5 },
      '2026-11-04',
    )).toBe(5);
    expect(trenutniNizZaPrikaz(
      { zadnjiAktivniDatum: '2026-11-04', trenutniNiz: 5, najboljiNiz: 5 },
      '2026-11-04',
    )).toBe(5);
  });
});

describe('aktivni dani — izolacija od party unlocka', () => {
  it('ne otključava se kroz izracunajNovaDostignuca', async () => {
    const { izracunajNovaDostignuca } = await import('../src/dostignuca.js');
    const nova = izracunajNovaDostignuca(
      { najboljiNizAktivnosti: 0 },
      { najboljiNizAktivnosti: 30 },
      1,
      false,
    );
    expect(nova.find((d) => d.id === 'stalno_si_tu')).toBeUndefined();
  });
});
