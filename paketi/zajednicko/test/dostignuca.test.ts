import { describe, expect, it } from 'vitest';
import {
  DEFINICIJE_DOSTIGNUCA,
  UKUPNO_ZVJEZDICA_DOSTIGNUCA,
  izracunajNovaDostignuca,
} from '../src/dostignuca.js';

describe('dostignuca', () => {
  it('ima devet dostignuća i 45 zvjezdica', () => {
    expect(DEFINICIJE_DOSTIGNUCA).toHaveLength(9);
    expect(DEFINICIJE_DOSTIGNUCA.every((definicija) => definicija.pragovi.length === 5)).toBe(true);
    expect(UKUPNO_ZVJEZDICA_DOSTIGNUCA).toBe(45);
  });

  it('preskače više razina i vraća najvišu novu razinu', () => {
    const [novo] = izracunajNovaDostignuca(
      { rijetkeLeksemskeGrupe: 0 },
      { rijetkeLeksemskeGrupe: 20 },
      1,
      false,
    );

    expect(novo).toEqual({ id: 'rijetkolovac', novaRazina: 3, maksimalnaRazina: 5 });
  });

  it('privatno propušta samo dostignuća označena za privatne sobe', () => {
    const nova = izracunajNovaDostignuca(
      {},
      { kaladontIzvedbe: 1, dugeRijeci: 1, rijetkeLeksemskeGrupe: 1 },
      10,
      true,
    );

    expect(nova.map((dostignuce) => dostignuce.id)).toEqual(['rijetkolovac', 'dugometras']);
  });

  it('računa Iskusnjaru iz razine iskustva', () => {
    const nova = izracunajNovaDostignuca({}, {}, 75, false);

    expect(nova.find((dostignuce) => dostignuce.id === 'iskusnjara')).toEqual({
      id: 'iskusnjara',
      novaRazina: 4,
      maksimalnaRazina: 5,
    });
  });
});