import { describe, expect, it } from 'vitest';
import {
  DEFINICIJE_DOSTIGNUCA,
  UKUPNO_ZVJEZDICA_DOSTIGNUCA,
  izracunajNovaDostignuca,
  jeDostignuceNovo,
  odaberiTopTriDostignuca,
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

  it('ne smanjuje trajni niz kada je trenutni niz kraći', () => {
    const nova = izracunajNovaDostignuca(
      { najduziStreak: 10 },
      { najduziStreak: 4 },
      1,
      false,
    );

    expect(nova).toEqual([]);
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

  it('bira najviše tri dostignuća uz Iskunjaru nakon razina 4 i prioritet za jednake razine', () => {
    const odabrana = odaberiTopTriDostignuca([
      { id: 'iskusnjara', razina: 2 },
      { id: 'kaladont', razina: 4 },
      { id: 'glas_zajednice', razina: 4 },
      { id: 'rijetkolovac', razina: 4 },
      { id: 'dugometras', razina: 3 },
    ]);

    expect(odabrana.map(({ id }) => id)).toEqual(['glas_zajednice', 'kaladont', 'rijetkolovac']);
  });

  it('daje Iskunjari prednost i primjenjuje tie-break redoslijed svih dostignuća', () => {
    const prioriteti = [
      'iskusnjara', 'glas_zajednice', 'kaladont', 'rijetkolovac', 'dugometras',
      'slijepa_ulica', 'lovac_na_glave', 'zavrsna_rijec', 'ka_zna', 'jezik_u_plamenu',
    ];
    const odabrana = odaberiTopTriDostignuca([
      { id: 'jezik_u_plamenu', razina: 3 },
      { id: 'ka_zna', razina: 3 },
      { id: 'zavrsna_rijec', razina: 3 },
      { id: 'lovac_na_glave', razina: 3 },
      { id: 'slijepa_ulica', razina: 3 },
      { id: 'dugometras', razina: 3 },
      { id: 'rijetkolovac', razina: 3 },
      { id: 'kaladont', razina: 3 },
      { id: 'glas_zajednice', razina: 3 },
      { id: 'iskusnjara', razina: 2 },
    ]);

    expect(odabrana.map(({ id }) => id)).toEqual(['iskusnjara', 'glas_zajednice', 'kaladont']);
    for (let indeks = 0; indeks < prioriteti.length - 1; indeks += 1) {
      const par = prioriteti.slice(indeks, indeks + 2).map((id) => ({ id, razina: 3 }));
      expect(odaberiTopTriDostignuca(par).map(({ id }) => id)).toEqual(prioriteti.slice(indeks, indeks + 2));
    }
  });

  it('izostavlja nepoznata i neotključana dostignuća', () => {
    const odabrana = odaberiTopTriDostignuca([
      { id: 'nepoznato', razina: 5 },
      { id: 'kaladont', razina: 1 },
      { id: 'glas_zajednice', razina: 6 },
      { id: 'rijetkolovac', razina: 2 },
    ]);

    expect(odabrana.map(({ id }) => id)).toEqual(['rijetkolovac']);
  });

  it('označuje dostignuće kao novo ako je otključano unutar zadnjih 24 sata', () => {
    const sada = new Date();
    expect(jeDostignuceNovo(new Date(sada.getTime() - 60 * 60 * 1000))).toBe(true);
    expect(jeDostignuceNovo(new Date(sada.getTime() - 2 * 24 * 60 * 60 * 1000))).toBe(false);
    expect(jeDostignuceNovo(null)).toBe(false);
  });
});