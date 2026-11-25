import { describe, expect, it } from 'vitest';
import {
  ikonaZaTipObavijesti,
  indeksNakonUklanjanja,
  kratkiBrojNovih,
  relativnoVrijemeObavijesti,
  tekstPozicijePagera,
  zaglavljeObavijesti,
} from './naslovnica-obavijesti.js';

describe('naslovnica-obavijesti', () => {
  it('kratkiBrojNovih poštuje hrvatsku gramatiku', () => {
    expect(kratkiBrojNovih(0)).toBe('');
    expect(kratkiBrojNovih(1)).toBe('1 nova');
    expect(kratkiBrojNovih(3)).toBe('3 nove');
    expect(kratkiBrojNovih(5)).toBe('5 novih');
  });

  it('zaglavljeObavijesti skriva broj kad nema novih', () => {
    expect(zaglavljeObavijesti(0)).toBe('Obavijesti');
    expect(zaglavljeObavijesti(2)).toBe('Obavijesti · 2 nove');
  });

  it('relativnoVrijemeObavijesti daje čitljiv sažetak', () => {
    const sada = new Date('2026-11-25T12:00:00.000Z');
    expect(relativnoVrijemeObavijesti(sada.toISOString(), sada)).toBe('Upravo sad');
    expect(
      relativnoVrijemeObavijesti(new Date(sada.getTime() - 5 * 60_000).toISOString(), sada),
    ).toMatch(/5/);
    expect(
      relativnoVrijemeObavijesti(new Date(sada.getTime() - 26 * 60 * 60_000).toISOString(), sada),
    ).toMatch(/jučer|1/i);
  });

  it('indeksNakonUklanjanja zadržava najbližu poziciju', () => {
    expect(indeksNakonUklanjanja(0, 1)).toBe(0);
    expect(indeksNakonUklanjanja(0, 3)).toBe(0);
    expect(indeksNakonUklanjanja(2, 3)).toBe(1);
    expect(indeksNakonUklanjanja(1, 3)).toBe(1);
  });

  it('tekstPozicijePagera i ikone', () => {
    expect(tekstPozicijePagera(0, 3, false)).toBe('1 / 3');
    expect(tekstPozicijePagera(0, 20, true)).toBe('1 / 20+');
    expect(ikonaZaTipObavijesti('nova_zvjezdica')).toContain('zvjezdica');
    expect(ikonaZaTipObavijesti('dobrodoslica')).toContain('mailbox');
  });
});
