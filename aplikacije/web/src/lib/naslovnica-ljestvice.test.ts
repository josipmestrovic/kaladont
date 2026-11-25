import { describe, expect, it } from 'vitest';
import { oblikTroboja, tekstSazetkaLjestvice } from './naslovnica-ljestvice.js';

describe('naslovnica-ljestvice', () => {
  it('deklinira troboj', () => {
    expect(oblikTroboja(1)).toBe('troboj');
    expect(oblikTroboja(2)).toBe('troboja');
    expect(oblikTroboja(5)).toBe('troboja');
    expect(oblikTroboja(11)).toBe('troboja');
    expect(oblikTroboja(21)).toBe('troboj');
  });

  it('formatira rangirani i nedostaje status', () => {
    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 4,
      metrika: 'prosjek_bodova',
      razdoblje: 'tjedno',
    })).toMatchObject({
      kratki: '4. tjedno',
      puni: 'Trenutno si 4. na tjednoj',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 1,
      metrika: 'niz_pobjeda',
      razdoblje: 'mjesecno',
    })?.kratki).toBe('1. mjesečno · niz');

    expect(tekstSazetkaLjestvice({
      vrsta: 'nedostaje',
      nedostajeIgara: 5,
      metrika: 'prosjek_bodova',
      razdoblje: 'dnevno',
    })).toMatchObject({
      kratki: 'Još 5 troboja',
      puni: 'Još 5 troboja do poretka',
    });
  });
});
