import { describe, expect, it } from 'vitest';
import {
  AKTIVNI_JAVNI_REDOVI,
  BRZA_IGRA,
  jeAktivanJavniKljuc,
  jeDostignuceOstvarivo,
  jeDostignuceVidljivo,
  jeJavnaKombinacijaAktivna,
  kanonskiModLjestvice,
  KLJUCEVI_JAVNOG_REDA,
  kljucJavnogReda,
  MODOVI_PARTIJE,
  PRAVILNICI_PARTIJE,
} from '../src/index.js';

describe('dostupnost-igranja', () => {
  it('jedini aktivan javni red je 3-klasicni (Brza igra)', () => {
    expect(AKTIVNI_JAVNI_REDOVI).toEqual(['3-klasicni']);
    expect(BRZA_IGRA).toEqual({
      mod: 'tri_igraca',
      pravila: 'klasicni',
      kljucReda: '3-klasicni',
      putanja: '/red?mod=tri_igraca&pravila=klasicni',
    });
    expect(jeAktivanJavniKljuc('3-klasicni')).toBe(true);
    expect(jeAktivanJavniKljuc('2-zajednicki')).toBe(false);
    expect(jeJavnaKombinacijaAktivna('tri_igraca', 'klasicni')).toBe(true);
    expect(jeJavnaKombinacijaAktivna('tri_igraca', 'ka_zna')).toBe(false);
    expect(jeJavnaKombinacijaAktivna('dva_igraca', 'klasicni')).toBe(false);
    expect(jeJavnaKombinacijaAktivna('cetiri_igraca', 'klasicni')).toBe(false);
  });

  it('katalog 8 ključeva ostaje; samo jedan je aktivan', () => {
    expect(KLJUCEVI_JAVNOG_REDA).toHaveLength(8);
    const aktivni = KLJUCEVI_JAVNOG_REDA.filter(jeAktivanJavniKljuc);
    expect(aktivni).toEqual(['3-klasicni']);
    for (const mod of MODOVI_PARTIJE) {
      for (const pravila of PRAVILNICI_PARTIJE) {
        const kljuc = kljucJavnogReda(mod, pravila);
        expect(jeJavnaKombinacijaAktivna(mod, pravila)).toBe(kljuc === '3-klasicni');
      }
    }
  });

  it('ljestvice normaliziraju bilo koji mod na Troboj', () => {
    expect(kanonskiModLjestvice('dva_igraca')).toBe('tri_igraca');
    expect(kanonskiModLjestvice('cetiri_igraca')).toBe('tri_igraca');
    expect(kanonskiModLjestvice('tri_igraca')).toBe('tri_igraca');
    expect(kanonskiModLjestvice(undefined)).toBe('tri_igraca');
  });

  it('skriva nedostižna dostignuća, ali ne ka_zna (žrtva)', () => {
    expect(jeDostignuceVidljivo('dvostruka_kruna')).toBe(false);
    expect(jeDostignuceVidljivo('na_dvije_fronte')).toBe(false);
    expect(jeDostignuceVidljivo('imam_nastavak')).toBe(false);
    expect(jeDostignuceVidljivo('stara_skola')).toBe(false);
    expect(jeDostignuceVidljivo('ka_zna')).toBe(true);
    expect(jeDostignuceOstvarivo('salji_dalje')).toBe(true);
  });
});
