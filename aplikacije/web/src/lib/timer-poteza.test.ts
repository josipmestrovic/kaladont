import { describe, expect, it } from 'vitest';
import {
  normalizirajIstekPotezaIso,
  preostaloMsPoteza,
  timerAktivanIzSnimke,
} from './timer-poteza.js';

describe('normalizirajIstekPotezaIso', () => {
  it('F04: prazan string → null', () => {
    expect(normalizirajIstekPotezaIso('')).toBeNull();
    expect(normalizirajIstekPotezaIso(null)).toBeNull();
  });
});

describe('timerAktivanIzSnimke', () => {
  it('F01: timer 0 / bez roka → neaktivan', () => {
    expect(
      timerAktivanIzSnimke({
        trajanjePotezaSek: 0,
        istekPotezaIso: null,
        faza: 'obican_potez',
      }),
    ).toBe(false);
  });

  it('F01: eksplicitni timerAktivan ima prednost', () => {
    expect(
      timerAktivanIzSnimke({
        timerAktivan: true,
        istekPotezaIso: null,
        trajanjePotezaSek: 30,
      }),
    ).toBe(true);
  });

  it('F04: sustav_bira → neaktivan', () => {
    expect(
      timerAktivanIzSnimke({
        faza: 'sustav_bira',
        istekPotezaIso: '2099-01-01T00:00:00.000Z',
        trajanjePotezaSek: 30,
      }),
    ).toBe(false);
  });
});

describe('preostaloMsPoteza', () => {
  it('F06: nula preostalog ne znači eliminaciju — samo 0 ms', () => {
    const istek = new Date(1_000_000).toISOString();
    expect(
      preostaloMsPoteza({
        istekIso: istek,
        pomakSataMs: 0,
        sadaMonotonicMs: 5_000,
        bazaMonotonicMs: 0,
        bazaWallMs: 1_000_000,
      }),
    ).toBe(0);
  });

  it('F06: pozitivno preostalo s pomakom sata', () => {
    const istek = new Date(1_010_000).toISOString();
    expect(
      preostaloMsPoteza({
        istekIso: istek,
        pomakSataMs: 0,
        sadaMonotonicMs: 0,
        bazaMonotonicMs: 0,
        bazaWallMs: 1_000_000,
      }),
    ).toBe(10_000);
  });
});
