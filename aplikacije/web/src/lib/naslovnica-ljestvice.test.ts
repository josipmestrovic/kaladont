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
      href: '/ljestvice?kategorija=igraci&metrika=prosjek_bodova&razdoblje=tjedno',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 1,
      metrika: 'niz_pobjeda',
      razdoblje: 'mjesecno',
    })?.kratki).toBe('1. mjesečno · Niz pobjeda');

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 3,
      metrika: 'kolekcija',
      razdoblje: null,
    })).toMatchObject({
      kratki: '3. među kolekcionarima',
      href: '/ljestvice?kategorija=igraci&metrika=kolekcija',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 5,
      metrika: 'najbrzi_igraci',
      razdoblje: 'tjedno',
    })?.puni).toBe('5. najbrži igrač ovog tjedna');

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
