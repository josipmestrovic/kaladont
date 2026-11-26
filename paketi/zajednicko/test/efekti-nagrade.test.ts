import { describe, expect, it } from 'vitest';
import {
  odrediEfektPrihvacenogPoteza,
  trebaPljesakPobjede,
} from '../src/efekti-nagrade.js';
import type { StavkaIskustva } from '../src/iskustvo.js';
import type { NagradaZaRijec } from '../src/protokol.js';

const nagrada = (intenzitet: NagradaZaRijec['intenzitet']): NagradaZaRijec => ({
  intenzitet,
  rijetkost: null,
  duljina: 'duga',
  tekst: 'test',
  kategorija: 'duge',
  otkljucano: null,
  ukupno: null,
});

function stavka(
  vrsta: StavkaIskustva['vrsta'],
  iskustvo: number,
): StavkaIskustva {
  return { vrsta, naziv: vrsta, kolicina: 1, poStavci: iskustvo, iskustvo };
}

describe('odrediEfektPrihvacenogPoteza', () => {
  it('obična riječ bez nagrade ne daje efekt', () => {
    expect(odrediEfektPrihvacenogPoteza('stol', [], null)).toBeNull();
  });

  it('duga/rijetka iz XP daje proporcionalni intenzitet', () => {
    expect(odrediEfektPrihvacenogPoteza('prepoznavanje', [stavka('duge_rijeci', 10)], null)).toEqual({
      vrsta: 'duza_rijetka',
      intenzitetKonfeta: 'mali',
      zvuk: null,
    });
    expect(
      odrediEfektPrihvacenogPoteza('x', [stavka('rijetke_rijeci', 20)], null)?.intenzitetKonfeta,
    ).toBe('srednji');
    expect(
      odrediEfektPrihvacenogPoteza('x', [stavka('duge_rijeci', 35)], null)?.intenzitetKonfeta,
    ).toBe('veliki');
  });

  it('kombinira XP i nagradu u jedan jači intenzitet', () => {
    expect(
      odrediEfektPrihvacenogPoteza('rijec', [stavka('duge_rijeci', 10)], nagrada('srednji')),
    ).toEqual({
      vrsta: 'duza_rijetka',
      intenzitetKonfeta: 'srednji',
      zvuk: null,
    });
  });

  it('Kaladont ima prednost i daje pljesak', () => {
    expect(
      odrediEfektPrihvacenogPoteza('Kaladont', [stavka('duge_rijeci', 35)], nagrada('veliki')),
    ).toEqual({
      vrsta: 'kaladont',
      intenzitetKonfeta: 'veliki',
      zvuk: 'aplauz-kaladont',
    });
  });
});

describe('trebaPljesakPobjede', () => {
  it('samo kad je lokalni igrač pobjednik', () => {
    expect(trebaPljesakPobjede('ja', 'ja')).toBe(true);
    expect(trebaPljesakPobjede('ja', 'bot')).toBe(false);
    expect(trebaPljesakPobjede(null, 'ja')).toBe(false);
  });
});
