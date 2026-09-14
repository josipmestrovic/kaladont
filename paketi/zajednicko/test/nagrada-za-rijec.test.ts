import { describe, expect, it } from 'vitest';
import { izracunajNagraduZaRijec } from '../src/nagrada-za-rijec.js';

describe('izracunajNagraduZaRijec', () => {
  it('razlikuje tri frekvencijska tiera', () => {
    const grupe = ['imenica:test'];
    expect(izracunajNagraduZaRijec('test', 0, grupe, new Set(), 1)?.rijetkost).toBe('jako_rijetka');
    expect(izracunajNagraduZaRijec('test', 1, grupe, new Set(), 1)?.rijetkost).toBe('srednje_rijetka');
    expect(izracunajNagraduZaRijec('test', 10, grupe, new Set(), 1)?.rijetkost).toBe('rijetka');
    expect(izracunajNagraduZaRijec('test', 100, grupe, new Set(), 1)).toBeNull();
  });

  it('broji grafeme i spaja rijetkost s duljinom u jedan efekt', () => {
    const rezultat = izracunajNagraduZaRijec('džunglamaaa', 0, ['imenica:džungla'], new Set(), 4);
    expect(rezultat?.duljina).toBe('duga');
    expect(rezultat?.rijetkost).toBe('jako_rijetka');
    expect(rezultat?.tekst).toContain('jako rijetka');
    expect(rezultat?.tekst).toContain('duga');
  });

  it('ne nagrađuje ponovljenu leksemsku grupu za rijetkost', () => {
    const rezultat = izracunajNagraduZaRijec('riječ', 0, ['imenica:riječ'], new Set(['imenica:riječ']), 2);
    expect(rezultat).toBeNull();
  });

  it('koristi pragove 10, 12 i 15 grafema', () => {
    expect(izracunajNagraduZaRijec('aaaaaaaaaa', 100, ['imenica:a'], new Set(), 1)?.duljina).toBe('duga');
    expect(izracunajNagraduZaRijec('aaaaaaaaaaaa', 100, ['imenica:a'], new Set(), 1)?.duljina).toBe('srednje_duga');
    expect(izracunajNagraduZaRijec('aaaaaaaaaaaaaaa', 100, ['imenica:a'], new Set(), 1)?.duljina).toBe('jako_duga');
  });
});