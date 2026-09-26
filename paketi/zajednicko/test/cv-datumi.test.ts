import { describe, expect, it } from 'vitest';
import {
  datumZagrebacki,
  formatirajKalendarskiStaz,
  formatirajStazBiografski,
  izracunajKalendarskiStaz,
  jeValjanCivilniDatum,
} from '../src/cv-datumi.js';

describe('kalendarski staž', () => {
  it('provjerava civilne ISO datume strogo', () => {
    expect(jeValjanCivilniDatum('2026-09-26')).toBe(true);
    expect(jeValjanCivilniDatum('2026-02-29')).toBe(false);
    expect(jeValjanCivilniDatum('26.09.2026')).toBe(false);
  });

  it('računa prvi dan i kalendarski prijelaz preko ponoći', () => {
    expect(izracunajKalendarskiStaz('2026-09-26', '2026-09-26')).toMatchObject({
      godine: 0,
      mjeseci: 0,
      dani: 0,
      ukupnoDana: 0,
      tekst: 'Prvi dan',
    });
    expect(izracunajKalendarskiStaz('2026-09-26', '2026-09-27')).toMatchObject({ dani: 1, tekst: '1 dan' });
  });

  it('klampa mjesečne i godišnje obljetnice na zadnji dan mjeseca', () => {
    expect(izracunajKalendarskiStaz('2027-01-31', '2027-02-28')).toMatchObject({ mjeseci: 1, dani: 0, tekst: '1 mjesec' });
    expect(izracunajKalendarskiStaz('2024-02-29', '2025-02-28')).toMatchObject({ godine: 1, mjeseci: 0, dani: 0, tekst: '1 godina' });
  });

  it('prikazuje najviše dvije nenulte jedinice s hrvatskim oblicima', () => {
    expect(formatirajKalendarskiStaz(2, 3, 8)).toBe('2 godine i 3 mjeseca');
    expect(formatirajKalendarskiStaz(0, 1, 2)).toBe('1 mjesec i 2 dana');
    expect(formatirajKalendarskiStaz(0, 0, 22)).toBe('22 dana');
  });

  it('pretvara registracijski staž u biografsku rečenicu po dogovorenim pragovima', () => {
    const ocekivano = new Map<number, string>([
      [0, 'U čarima Kaladonta uživa tek prvi dan.'],
      [1, 'U čarima Kaladonta uživa već 1 dan.'],
      [6, 'U čarima Kaladonta uživa već 6 dana.'],
      [7, 'U čarima Kaladonta uživa već 1 tjedan.'],
      [14, 'U čarima Kaladonta uživa već 2 tjedna.'],
      [21, 'U čarima Kaladonta uživa već 3 tjedna.'],
      [27, 'U čarima Kaladonta uživa već 3 tjedna.'],
      [28, 'S nama je već 1 mjesec.'],
      [45, 'S nama je već 1 mjesec.'],
      [57, 'S nama je već 1 mjesec.'],
      [58, 'S nama je već 2 mjeseca.'],
      [59, 'S nama je već 2 mjeseca.'],
      [60, 'S nama je već 2 mjeseca.'],
      [357, 'S nama je već 11 mjeseci.'],
      [358, 'S nama je već 1 godina.'],
      [359, 'S nama je već 1 godina.'],
      [360, 'S nama je već 1 godina.'],
      [390, 'S nama je već 1 godina i 1 mjesec.'],
      [750, 'S nama je već 2 godine i 1 mjesec.'],
    ]);

    for (const [ukupnoDana, tekst] of ocekivano) {
      expect(formatirajStazBiografski({ ukupnoDana })).toBe(tekst);
    }
    expect(formatirajStazBiografski(null)).toBeNull();
  });

  it('odbacuje nevaljane i buduće datume', () => {
    expect(izracunajKalendarskiStaz('2026-02-29', '2026-09-26')).toBeNull();
    expect(izracunajKalendarskiStaz('2026-09-27', '2026-09-26')).toBeNull();
  });

  it('računa DST početak i kraj kao jedan Zagrebački kalendarski dan', () => {
    expect(datumZagrebacki(new Date('2026-03-28T23:30:00Z'))).toBe('2026-03-29');
    expect(datumZagrebacki(new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-30');
    expect(izracunajKalendarskiStaz(
      datumZagrebacki(new Date('2026-03-28T23:30:00Z'))!,
      datumZagrebacki(new Date('2026-03-29T22:30:00Z'))!,
    )?.ukupnoDana).toBe(1);

    expect(datumZagrebacki(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    expect(datumZagrebacki(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
    expect(izracunajKalendarskiStaz(
      datumZagrebacki(new Date('2026-10-24T22:30:00Z'))!,
      datumZagrebacki(new Date('2026-10-25T23:30:00Z'))!,
    )?.ukupnoDana).toBe(1);
  });
});