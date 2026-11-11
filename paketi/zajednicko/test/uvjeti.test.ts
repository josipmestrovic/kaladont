import { describe, expect, it } from 'vitest';
import { AKTUALNA_VERZIJA_UVJETA, jePrihvacenaAktualnaVerzijaUvjeta } from '../src/uvjeti.js';

describe('uvjeti', () => {
  it('zahtijeva potvrdu dobi i aktualnu verziju', () => {
    expect(AKTUALNA_VERZIJA_UVJETA).toBe('2026-11-11');
    expect(jePrihvacenaAktualnaVerzijaUvjeta(true, AKTUALNA_VERZIJA_UVJETA)).toBe(true);
    expect(jePrihvacenaAktualnaVerzijaUvjeta(false, AKTUALNA_VERZIJA_UVJETA)).toBe(false);
    expect(jePrihvacenaAktualnaVerzijaUvjeta(true, 'stara')).toBe(false);
    expect(jePrihvacenaAktualnaVerzijaUvjeta(true, null)).toBe(false);
  });
});
