import { describe, expect, it } from 'vitest';
import {
  nazivOznakeDuljine,
  nazivOznakeRijetkosti,
  projektirajOznakeNovihRijeci,
} from '../src/oznake-novih-rijeci.js';

describe('oznake novih riječi', () => {
  it('PR02-03: vraća 0/1/2 oznake bez duplikata', () => {
    expect(nazivOznakeDuljine(null)).toBeNull();
    expect(nazivOznakeRijetkosti(null)).toBeNull();
    expect(nazivOznakeDuljine('duga')).toBe('Duga riječ');
    expect(nazivOznakeRijetkosti('rijetka')).toBe('Rijetka riječ');
    expect(nazivOznakeDuljine('srednje_duga')).toBe('Srednje duga riječ');
    expect(nazivOznakeRijetkosti('srednje_rijetka')).toBe('Srednje rijetka riječ');
    expect(nazivOznakeDuljine('jako_duga')).toBe('Jako duga riječ');
    expect(nazivOznakeRijetkosti('jako_rijetka')).toBe('Jako rijetka riječ');

    const bez = projektirajOznakeNovihRijeci([
      { grupa: 'imenica:kuca', odigraniOblik: 'kuca', duljina: null, rijetkost: null },
    ]);
    expect(bez[0]).toMatchObject({ osnovnaRijec: 'kuca', duljina: null, rijetkost: null, odigraniOblik: null });

    const obje = projektirajOznakeNovihRijeci([
      { grupa: 'imenica:kuca', odigraniOblik: 'kuca', duljina: 'duga', rijetkost: 'rijetka' },
    ]);
    expect(obje).toHaveLength(1);
    expect(nazivOznakeDuljine(obje[0]!.duljina)).toBe('Duga riječ');
    expect(nazivOznakeRijetkosti(obje[0]!.rijetkost)).toBe('Rijetka riječ');
  });

  it('PR02-04: oznake veže uz odigrani oblik kad se razlikuje od leme', () => {
    const rezultat = projektirajOznakeNovihRijeci([
      { grupa: 'imenica:kuca', odigraniOblik: 'kucama', duljina: 'duga', rijetkost: null },
    ]);
    expect(rezultat).toEqual([
      {
        osnovnaRijec: 'kuca',
        odigraniOblik: 'kucama',
        duljina: 'duga',
        rijetkost: null,
      },
    ]);
  });

  it('PR02-05: first-wins za istu osnovnu riječ kroz više oblika', () => {
    const rezultat = projektirajOznakeNovihRijeci([
      { grupa: 'imenica:kuca:sg', odigraniOblik: 'kuca', duljina: null, rijetkost: 'rijetka' },
      { grupa: 'imenica:kuca:pl', odigraniOblik: 'kucamaaaaaaaaa', duljina: 'jako_duga', rijetkost: 'jako_rijetka' },
    ]);
    expect(rezultat).toHaveLength(1);
    expect(rezultat[0]).toMatchObject({
      osnovnaRijec: 'kuca',
      odigraniOblik: null,
      duljina: null,
      rijetkost: 'rijetka',
    });
  });

  it('PR02-06: pridjev i prilog ne uvjetuju oznake brojem grupa', () => {
    const rezultat = projektirajOznakeNovihRijeci([
      { grupa: 'pridjev:brz:poz', odigraniOblik: 'brzo', duljina: null, rijetkost: null },
      { grupa: 'prilog:brz:poz', odigraniOblik: 'brzo', duljina: null, rijetkost: null },
    ]);
    expect(rezultat).toHaveLength(1);
    expect(rezultat[0]!.osnovnaRijec).toBe('brz');
  });

  it('PR02-07: null metapodaci ne izmišljaju oznake', () => {
    const rezultat = projektirajOznakeNovihRijeci([
      { grupa: 'glagol:ici', odigraniOblik: 'ici', duljina: null, rijetkost: null },
    ]);
    expect(nazivOznakeDuljine(rezultat[0]?.duljina)).toBeNull();
    expect(nazivOznakeRijetkosti(rezultat[0]?.rijetkost)).toBeNull();
    expect(projektirajOznakeNovihRijeci([])).toEqual([]);
  });
});
