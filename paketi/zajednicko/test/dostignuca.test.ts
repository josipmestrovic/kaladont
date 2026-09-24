import { describe, expect, it } from 'vitest';
import {
  DEFINICIJE_DOSTIGNUCA,
  UKUPNO_ZVJEZDICA_DOSTIGNUCA,
  izracunajNovaDostignuca,
} from '../src/dostignuca.js';

describe('dostignuca', () => {
  it('ima deset dostignuća i 50 zvjezdica', () => {
    expect(DEFINICIJE_DOSTIGNUCA).toHaveLength(10);
    expect(DEFINICIJE_DOSTIGNUCA.every((definicija) => definicija.pragovi.length === 5)).toBe(true);
    expect(UKUPNO_ZVJEZDICA_DOSTIGNUCA).toBe(50);
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

  it('otključava zvjezdicu za svaki brojač koji dosegne prvi prag', () => {
    const brojači = [
      'rijetkeLeksemskeGrupe',
      'dugeRijeci',
      'najduziStreak',
      'kaladontIzvedbe',
      'kaladontZrtve',
      'izazvaneEliminacije',
      'mrtvaSlovaEliminacije',
      'javnePobjede',
      'povratneInformacije',
    ] as const;

    const prviPrag: Record<(typeof brojači)[number], number> = {
      rijetkeLeksemskeGrupe: 1,
      dugeRijeci: 1,
      najduziStreak: 3,
      kaladontIzvedbe: 1,
      kaladontZrtve: 1,
      izazvaneEliminacije: 1,
      mrtvaSlovaEliminacije: 1,
      javnePobjede: 1,
      povratneInformacije: 1,
    };

    for (const brojac of brojači) {
      const [novo] = izracunajNovaDostignuca({}, { [brojac]: prviPrag[brojac] }, 1, false);
      expect(novo?.novaRazina, brojac).toBe(1);
    }
  });
});