import { describe, expect, it } from 'vitest';
import { izracunajNovaDostignuca } from '../src/dostignuca.js';
import { odrediPohvaleIgre, type SudionikZaPohvalu } from '../src/pohvale-igre.js';

function s(
  igracId: string,
  upravljac: 'covjek' | 'bot',
  najduziStreak: number,
  finalniBrutoXp: number,
): SudionikZaPohvalu {
  return { igracId, upravljac, najduziStreak, finalniBrutoXp };
}

describe('odrediPohvaleIgre', () => {
  it('P01-01: dva_igraca — veći najduziStreak osvaja pohvalu neovisno o plasmanu', () => {
    const pohvale = odrediPohvaleIgre([
      s('a', 'covjek', 3, 100),
      s('b', 'covjek', 6, 80),
    ]);

    expect(pohvale.get('a')?.some((p) => p.vrsta === 'najduzi_niz')).toBeFalsy();
    expect(pohvale.get('b')).toContainEqual({
      vrsta: 'najduzi_niz',
      vrijednost: 6,
      dijeljenoPrvoMjesto: false,
    });
  });

  it('P01-02: cetiri_igraca — bot 9 ulazi u max pa čovjek 7 ne dobiva niz; bot ne dobiva zapis', () => {
    const pohvale = odrediPohvaleIgre([
      s('h1', 'covjek', 4, 50),
      s('h2', 'covjek', 7, 60),
      s('h3', 'covjek', 5, 40),
      s('bot', 'bot', 9, 200),
    ]);

    expect(pohvale.has('bot')).toBe(false);
    expect(pohvale.get('h2')?.some((p) => p.vrsta === 'najduzi_niz')).toBeFalsy();
    expect(pohvale.get('h2')?.some((p) => p.vrsta === 'najvise_xp')).toBeFalsy();
    expect(pohvale.size).toBe(0);
  });

  it('P01-02c: cetiri_igraca — bez jačeg bota čovjek 7 osvaja niz', () => {
    const pohvale = odrediPohvaleIgre([
      s('h1', 'covjek', 4, 50),
      s('h2', 'covjek', 7, 60),
      s('h3', 'covjek', 5, 40),
      s('bot', 'bot', 2, 30),
    ]);
    expect(pohvale.get('h2')).toContainEqual({
      vrsta: 'najduzi_niz',
      vrijednost: 7,
      dijeljenoPrvoMjesto: false,
    });
  });

  it('P01-03: izjednačenje 4/4 — oba; 0/0 — nitko; 1 čovjek + bot — čovjek može dobiti', () => {
    const izjednaceno = odrediPohvaleIgre([
      s('a', 'covjek', 4, 10),
      s('b', 'covjek', 4, 10),
    ]);
    expect(izjednaceno.get('a')).toEqual([
      { vrsta: 'najduzi_niz', vrijednost: 4, dijeljenoPrvoMjesto: true },
      { vrsta: 'najvise_xp', vrijednost: 10, dijeljenoPrvoMjesto: true },
    ]);
    expect(izjednaceno.get('b')).toHaveLength(2);

    const nula = odrediPohvaleIgre([
      s('a', 'covjek', 0, 0),
      s('b', 'covjek', 0, 0),
    ]);
    expect(nula.size).toBe(0);

    const jedanIBot = odrediPohvaleIgre([
      s('h', 'covjek', 5, 120),
      s('bot', 'bot', 3, 90),
    ]);
    expect(jedanIBot.get('h')).toEqual([
      { vrsta: 'najduzi_niz', vrijednost: 5, dijeljenoPrvoMjesto: false },
      { vrsta: 'najvise_xp', vrijednost: 120, dijeljenoPrvoMjesto: false },
    ]);
  });

  it('P01-04: isti čovjek može dobiti obje pohvale', () => {
    const pohvale = odrediPohvaleIgre([
      s('a', 'covjek', 8, 200),
      s('b', 'covjek', 2, 50),
    ]);
    expect(pohvale.get('a')?.map((p) => p.vrsta)).toEqual(['najduzi_niz', 'najvise_xp']);
  });

  it('P01-05: najvise_xp ide igraču s finalnim brutom 190, ne pobjedniku po bodovima', () => {
    const pohvale = odrediPohvaleIgre([
      s('bodovi1', 'covjek', 3, 160),
      s('xp', 'covjek', 2, 190),
      s('treci', 'covjek', 1, 130),
    ]);
    expect(pohvale.get('xp')).toContainEqual({
      vrsta: 'najvise_xp',
      vrijednost: 190,
      dijeljenoPrvoMjesto: false,
    });
    expect(pohvale.get('bodovi1')?.some((p) => p.vrsta === 'najvise_xp')).toBeFalsy();
  });

  it('P01-06: izbor ne ovisi o redoslijedu sudionika; finalni bruto uključuje bonuse', () => {
    const baza: SudionikZaPohvalu[] = [
      s('a', 'covjek', 2, 100),
      s('b', 'covjek', 1, 150),
      s('c', 'covjek', 1, 120),
    ];
    const prvi = odrediPohvaleIgre(baza);
    const obrnuti = odrediPohvaleIgre([...baza].reverse());
    expect(prvi.get('b')).toEqual(obrnuti.get('b'));
    expect(prvi.get('b')).toContainEqual({
      vrsta: 'najvise_xp',
      vrijednost: 150,
      dijeljenoPrvoMjesto: false,
    });
  });

  it('P01-07: LVL 100 — bruto > 0 može dati pohvalu i kad je stvarno osvojeno 0', () => {
    const pohvale = odrediPohvaleIgre([
      s('max', 'covjek', 2, 80),
      s('drugi', 'covjek', 1, 40),
    ]);
    expect(pohvale.get('max')).toContainEqual({
      vrsta: 'najvise_xp',
      vrijednost: 80,
      dijeljenoPrvoMjesto: false,
    });
  });

  it('P01-02b: bot s većim XP-om sprječava ljudsku XP pohvalu', () => {
    const pohvale = odrediPohvaleIgre([
      s('h', 'covjek', 5, 100),
      s('bot', 'bot', 1, 250),
    ]);
    expect(pohvale.get('h')?.some((p) => p.vrsta === 'najvise_xp')).toBeFalsy();
    expect(pohvale.get('h')).toContainEqual({
      vrsta: 'najduzi_niz',
      vrijednost: 5,
      dijeljenoPrvoMjesto: false,
    });
  });

  it('P01-03b: izjednačenje čovjek+bot — čovjek dobiva dijeljeno', () => {
    const pohvale = odrediPohvaleIgre([
      s('h', 'covjek', 7, 100),
      s('bot', 'bot', 7, 100),
    ]);
    expect(pohvale.get('h')).toEqual([
      { vrsta: 'najduzi_niz', vrijednost: 7, dijeljenoPrvoMjesto: true },
      { vrsta: 'najvise_xp', vrijednost: 100, dijeljenoPrvoMjesto: true },
    ]);
    expect(pohvale.has('bot')).toBe(false);
  });
});

describe('P01-08: Vladar niza vs Jezik u plamenu', () => {
  it('najduziStreak ostaje max; pohvaleNizUkupno je inkrementalni zbroj', () => {
    const jezikuPlamenu = izracunajNovaDostignuca(
      { najduziStreak: 10 },
      { najduziStreak: 4 },
      1,
      false,
    );
    expect(jezikuPlamenu.find((d) => d.id === 'jezik_u_plamenu')).toBeUndefined();

    const vladar = izracunajNovaDostignuca(
      { pohvaleNizUkupno: 0 },
      { pohvaleNizUkupno: 1 },
      1,
      false,
    );
    expect(vladar.find((d) => d.id === 'vladar_niza')).toEqual({
      id: 'vladar_niza',
      novaRazina: 1,
      maksimalnaRazina: 5,
    });

    const vladarDrugaZvijezda = izracunajNovaDostignuca(
      { pohvaleNizUkupno: 14 },
      { pohvaleNizUkupno: 1 },
      1,
      false,
    );
    expect(vladarDrugaZvijezda.find((d) => d.id === 'vladar_niza')).toEqual({
      id: 'vladar_niza',
      novaRazina: 2,
      maksimalnaRazina: 5,
    });
  });
});
