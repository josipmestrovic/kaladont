import { describe, expect, it } from 'vitest';
import { hrvatskiBrojObavijesti, tekstSanducicToasta, tekstZavrsnogSazetka } from '../src/sanducic.js';

describe('sandučic tekstovi', () => {
  it('bira ispravne hrvatske oblike', () => {
    expect(hrvatskiBrojObavijesti(1)).toBe('1 novu obavijest');
    expect(hrvatskiBrojObavijesti(2)).toBe('2 nove obavijesti');
    expect(hrvatskiBrojObavijesti(5)).toBe('5 novih obavijesti');
    expect(tekstSanducicToasta(3)).toBe('Imaš 3 nove obavijesti.');
    expect(tekstZavrsnogSazetka(1)).toBe('Imaš 1 novu obavijest');
  });
});
