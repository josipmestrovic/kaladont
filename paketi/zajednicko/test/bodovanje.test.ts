import { describe, expect, it } from 'vitest';
import { izracunajBodove } from '../src/bodovanje.js';

describe('bodovanje', () => {
  it('zlatni test: Cvita 6, Damir 2, Ana 2, Boris 0', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 2 })).toBe(6); // Cvita
    expect(izracunajBodove({ plasman: 2, eliminacije: 0 })).toBe(2); // Damir
    expect(izracunajBodove({ plasman: 3, eliminacije: 1 })).toBe(2); // Ana
    expect(izracunajBodove({ plasman: 4, eliminacije: 0 })).toBe(0); // Boris
  });

  it('savršena partija = 7 (plasman 1, sve 3 eliminacije, bonus)', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 3 })).toBe(7);
  });

  it('pobjednik ima minimalno 5 bodova (plasman 3 + bonus 1 + barem 1 eliminacija)', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 1 })).toBeGreaterThanOrEqual(5);
  });
});
