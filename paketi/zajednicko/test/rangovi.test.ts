import { describe, expect, it } from 'vitest';
import { izracunajRang } from '../src/rangovi.js';

describe('izracunajRang', () => {
  it('prvih 10 partija je Piskaralo neovisno o prosjeku', () => {
    expect(izracunajRang(0, 7)).toBe('Piskaralo');
    expect(izracunajRang(9, 5)).toBe('Piskaralo');
  });

  it('od 11. partije racuna se rang prema pragovima', () => {
    expect(izracunajRang(10, 0)).toBe('Prvopisac');
    expect(izracunajRang(10, 1.5)).toBe('Riječarac');
    expect(izracunajRang(10, 2.5)).toBe('Lektor');
    expect(izracunajRang(10, 5.7)).toBe('Kaladont');
  });

  it('očekivani prosjek 2.5 daje Lektor', () => {
    expect(izracunajRang(50, 2.5)).toBe('Lektor');
  });
});
