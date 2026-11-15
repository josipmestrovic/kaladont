import { describe, expect, it } from 'vitest';
import {
  ishodDokaza,
  odlukaNakonEliminacije,
  odrediMetuPosebneRijeci,
  sljedeciAktivniIza,
  trebaOtvoritiDokaz,
  zrtvaMrtvihSlova,
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
    ).toEqual({ zrtvaId: 'A', vrstaMete: 'prethodni' });
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'ka_zna',
        autorPrethodneRijeci: null,
        sayerId: 'B',
        poredak,
        aktivni: new Set(poredak),
      }),
    ).toEqual({ zrtvaId: null, vrstaMete: null });
    // Motor mora dodatno provjeriti aktivni.has(zrtva) — inače hang (Bugbot).
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'ka_zna',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(['B', 'C']),
      }),
    ).toEqual({ zrtvaId: 'A', vrstaMete: 'prethodni' });
  });

  it('odrediMetuPosebneRijeci (Klasični) vraća sljedećeg aktivnog iza sayera', () => {
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'klasicni',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(poredak),
      }),
    ).toEqual({ zrtvaId: 'C', vrstaMete: 'sljedeci' });
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'klasicni',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak: ['A', 'B', 'C'],
        aktivni: new Set(['A', 'B', 'C']),
      }),
    ).toEqual({ zrtvaId: 'C', vrstaMete: 'sljedeci' });
    // 2 aktivna → protivnik (jedini drugi u krugu).
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'klasicni',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(['A', 'B']),
      }),
    ).toEqual({ zrtvaId: 'A', vrstaMete: 'sljedeci' });
    // Preskače već eliminirano sjedalo.
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'klasicni',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(['A', 'B', 'D']),
      }),
    ).toEqual({ zrtvaId: 'D', vrstaMete: 'sljedeci' });
  });

  it('odrediMetuPosebneRijeci (Dokaži nastavak, običan potez) koristi KA-ZNA granu', () => {
    expect(
      odrediMetuPosebneRijeci({
        pravilnik: 'dokazi_nastavak',
        autorPrethodneRijeci: 'A',
        sayerId: 'B',
        poredak,
        aktivni: new Set(poredak),
      }),
    ).toEqual({ zrtvaId: 'A', vrstaMete: 'prethodni' });
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

  it('odlukaNakonEliminacije: odgoda radi dokaza → nista (PR05)', () => {
    expect(
      odlukaNakonEliminacije({
        brojAktivnih: 2,
        razlog: 'prekid',
        zrtvaId: 'B',
        uzrocnikId: null,
        naPotezuId: 'B',
        bioNaPotezu: true,
        jeSamoeliminacijaIzvanPoteza: false,
        odgodiNastavakRadiDokaza: true,
      }),
    ).toEqual({ vrsta: 'nista', razlog: 'odgoda_radi_dokaza' });
  });

  it('zrtvaMrtvihSlova: klasik/ka_zna → sljedeći; dokazi → autor (PR05)', () => {
    expect(zrtvaMrtvihSlova({ pravilnik: 'ka_zna', autorId: 'A', sljedeciId: 'B' })).toEqual({
      zrtvaId: 'B',
      uzrocnikId: 'A',
    });
    expect(zrtvaMrtvihSlova({ pravilnik: 'klasicni', autorId: 'A', sljedeciId: 'B' })).toEqual({
      zrtvaId: 'B',
      uzrocnikId: 'A',
    });
    expect(zrtvaMrtvihSlova({ pravilnik: 'dokazi_nastavak', autorId: 'A', sljedeciId: 'B' })).toEqual({
      zrtvaId: 'A',
      uzrocnikId: null,
    });
  });

  it('trebaOtvoritiDokaz: samo dokazi_nastavak s aktivnim autorom (PR05)', () => {
    expect(
      trebaOtvoritiDokaz({
        pravilnik: 'dokazi_nastavak',
        fazaJeObicanPotez: true,
        autorId: 'A',
        autorJosAktivan: true,
        igracNaPotezuId: 'B',
        dogadajIgracId: 'B',
      }),
    ).toBe(true);
    expect(
      trebaOtvoritiDokaz({
        pravilnik: 'ka_zna',
        fazaJeObicanPotez: true,
        autorId: 'A',
        autorJosAktivan: true,
        igracNaPotezuId: 'B',
        dogadajIgracId: 'B',
      }),
    ).toBe(false);
    expect(
      trebaOtvoritiDokaz({
        pravilnik: 'dokazi_nastavak',
        fazaJeObicanPotez: true,
        autorId: null,
        autorJosAktivan: false,
        igracNaPotezuId: 'B',
        dogadajIgracId: 'B',
      }),
    ).toBe(false);
  });

  it('ishodDokaza: uspjeh/neuspjeh i cekateljVecIspao (PR05)', () => {
    expect(
      ishodDokaza({ uspjeh: true, autorId: 'A', cekateljId: 'B', cekateljVecIspao: false }),
    ).toEqual({
      vrsta: 'uspjeh',
      zrtvaId: 'B',
      uzrocnikId: 'A',
      sidroNoveRundeId: 'B',
    });
    expect(
      ishodDokaza({ uspjeh: true, autorId: 'A', cekateljId: 'B', cekateljVecIspao: true }),
    ).toEqual({
      vrsta: 'uspjeh',
      zrtvaId: null,
      uzrocnikId: 'A',
      sidroNoveRundeId: 'B',
    });
    expect(
      ishodDokaza({ uspjeh: false, autorId: 'A', cekateljId: 'B', cekateljVecIspao: false }),
    ).toEqual({
      vrsta: 'neuspjeh',
      zrtvaId: 'A',
      uzrocnikId: null,
      sidroNoveRundeId: 'A',
    });
  });
});
