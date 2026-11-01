import { describe, expect, it } from 'vitest';
import { izracunajRokoveNeaktivnostiTreninga, stanjeNeaktivnostiTreninga, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA } from '../src/trening/neaktivnost.js';

describe('neaktivnost treninga', () => {
  it('upozori na četiri minute i zatvara na pet minuta', () => {
    const zadnjiPotez = Date.parse('2026-10-10T12:00:00Z');
    const rokovi = izracunajRokoveNeaktivnostiTreninga(zadnjiPotez, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA);
    expect(rokovi).toEqual({ upozorenjeMs: zadnjiPotez + 240_000, zatvaranjeMs: zadnjiPotez + 300_000 });
    expect(stanjeNeaktivnostiTreninga(zadnjiPotez, zadnjiPotez + 239_999, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('aktivno');
    expect(stanjeNeaktivnostiTreninga(zadnjiPotez, rokovi.upozorenjeMs, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('upozorenje');
    expect(stanjeNeaktivnostiTreninga(zadnjiPotez, rokovi.zatvaranjeMs - 1, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('upozorenje');
    expect(stanjeNeaktivnostiTreninga(zadnjiPotez, rokovi.zatvaranjeMs, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('isteklo');
  });

  it('nastavak stvara novi period bez pomicanja rokova dok je prethodni aktivan', () => {
    const prviPocetak = 1_000_000;
    const nastavljenoU = prviPocetak + 200_000;
    const prvi = izracunajRokoveNeaktivnostiTreninga(prviPocetak, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA);
    expect(stanjeNeaktivnostiTreninga(prviPocetak, nastavljenoU, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('aktivno');
    const drugi = izracunajRokoveNeaktivnostiTreninga(nastavljenoU, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA);
    expect(drugi.upozorenjeMs).toBe(prvi.upozorenjeMs + 200_000);
    expect(drugi.zatvaranjeMs).toBe(prvi.zatvaranjeMs + 200_000);
    expect(stanjeNeaktivnostiTreninga(nastavljenoU, prvi.zatvaranjeMs, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('aktivno');
    expect(stanjeNeaktivnostiTreninga(nastavljenoU, drugi.zatvaranjeMs, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA)).toBe('isteklo');
  });

  it('odbija rokove koji upozoravaju nakon zatvaranja ili nemaju vrijednost', () => {
    expect(() => izracunajRokoveNeaktivnostiTreninga(0, { upozorenjeMs: 300_000, zatvaranjeMs: 240_000 })).toThrow(RangeError);
    expect(() => izracunajRokoveNeaktivnostiTreninga(0, { upozorenjeMs: Number.NaN, zatvaranjeMs: 300_000 })).toThrow(RangeError);
  });
});