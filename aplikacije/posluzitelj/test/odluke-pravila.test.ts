import { describe, expect, it } from 'vitest';
import {
  odlukaNakonEliminacije,
  odrediMetuPosebneRijeci,
  sljedeciAktivniIza,
} from '../src/igra/odluke-pravila.js';

describe('odluke-pravila', () => {
  const poredak = ['A', 'B', 'C', 'D'];

  it('sljedeciAktivniIza preskače neaktivna sjedala', () => {
    expect(sljedeciAktivniIza(poredak, new Set(['A', 'C', 'D']), 'A')).toBe('C');
    expect(sljedeciAktivniIza(poredak, new Set(['A', 'C']), 'C')).toBe('A');
  });

  it('odrediMetuPosebneRijeci (KA-ZNA) vraća autora prethodne riječi', () => {
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'ka_zna',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(poredak),
      }),
    ).toBe('A');
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'ka_zna',
        autorPrethodneRijeci: null,
        sayerId: 'B',
        poredak,
        aktivni: new Set(poredak),
      }),
    ).toBeNull();
    // Motor mora dodatno provjeriti aktivni.has(zrtva) — inače hang (Bugbot).
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'ka_zna',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(['B', 'C']),
      }),
    ).toBe('A');
  });

  it('odlukaNakonEliminacije: jedan aktivni → zaključi; inače otvori rundu', () => {
    expect(
      odlukaNakonEliminacije({
        brojAktivnih: 1,
        razlog: 'ne_znam',
        zrtvaId: 'B',
        uzrocnikId: 'A',
        naPotezuId: 'B',
        bioNaPotezu: true,
        jeSamoeliminacijaIzvanPoteza: false,
      }),
    ).toEqual({ vrsta: 'zakljuci', razlog: 'jedan_ili_nula_aktivnih' });

    expect(
      odlukaNakonEliminacije({
        brojAktivnih: 3,
        razlog: 'kaladont',
        zrtvaId: 'A',
        uzrocnikId: 'B',
        naPotezuId: 'B',
        bioNaPotezu: false,
        jeSamoeliminacijaIzvanPoteza: false,
      }),
    ).toEqual({ vrsta: 'otvoriRundu', sidroId: 'B', razlog: 'kaladont' });
  });

  it('odlukaNakonEliminacije: prekid na potezu → preskoči sjedalo', () => {
    expect(
      odlukaNakonEliminacije({
        brojAktivnih: 3,
        razlog: 'prekid',
        zrtvaId: 'B',
        uzrocnikId: 'A',
        naPotezuId: 'B',
        bioNaPotezu: true,
        jeSamoeliminacijaIzvanPoteza: false,
      }),
    ).toEqual({ vrsta: 'preskociSjedalo', sljedeciId: 'B', razlog: 'prekid_na_potezu' });
  });
});
