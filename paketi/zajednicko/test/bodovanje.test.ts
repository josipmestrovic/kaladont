import { describe, expect, it } from 'vitest';
import { izracunajBodove, maksimalniBodoviZaMod } from '../src/bodovanje.js';

describe('bodovanje', () => {
  it('zlatni test Četveroboj: Cvita 6, Damir 2, Ana 2, Boris 0', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 2 })).toBe(6); // Cvita
    expect(izracunajBodove({ plasman: 2, eliminacije: 0 })).toBe(2); // Damir
    expect(izracunajBodove({ plasman: 3, eliminacije: 1 })).toBe(2); // Ana
    expect(izracunajBodove({ plasman: 4, eliminacije: 0 })).toBe(0); // Boris
  });

  it('savršena partija Četveroboj = 7 (plasman 1, sve 3 eliminacije, bonus)', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 3 })).toBe(7);
  });

  it('pobjednik Četveroboja ima minimalno 5 bodova (plasman 3 + bonus 1 + barem 1 eliminacija)', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 1 })).toBeGreaterThanOrEqual(5);
  });

  it('Dvoboj: pobjeda 1, poraz 0', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'dva_igraca')).toBe(1);
    expect(izracunajBodove({ plasman: 2, eliminacije: 5 }, 'dva_igraca')).toBe(0);
    expect(maksimalniBodoviZaMod('dva_igraca')).toBe(1);
  });

  it('Troboj: plasman 2/1/0 + bonus + eliminacije, max 5', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 2 }, 'tri_igraca')).toBe(5);
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'tri_igraca')).toBe(3);
    expect(izracunajBodove({ plasman: 2, eliminacije: 1 }, 'tri_igraca')).toBe(2);
    expect(izracunajBodove({ plasman: 3, eliminacije: 0 }, 'tri_igraca')).toBe(0);
    expect(maksimalniBodoviZaMod('tri_igraca')).toBe(5);
  });

  it('odbija nevaljan javni plasman po formatu', () => {
    expect(() => izracunajBodove({ plasman: 3, eliminacije: 0 }, 'dva_igraca')).toThrow(/nevaljan/);
    expect(() => izracunajBodove({ plasman: 4, eliminacije: 0 }, 'tri_igraca')).toThrow(/nevaljan/);
    expect(() => izracunajBodove({ plasman: 5, eliminacije: 0 }, 'cetiri_igraca')).toThrow(/nevaljan/);
    expect(() => izracunajBodove({ plasman: 0, eliminacije: 0 }, 'cetiri_igraca')).toThrow(/nevaljan/);
  });
});
