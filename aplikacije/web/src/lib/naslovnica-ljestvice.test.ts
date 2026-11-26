import { describe, expect, it } from 'vitest';
import { oblikTroboja, tekstSazetkaLjestvice } from './naslovnica-ljestvice.js';

describe('naslovnica-ljestvice', () => {
  it('deklinira brzu igru', () => {
    expect(oblikTroboja(1)).toBe('brza igra');
    expect(oblikTroboja(2)).toBe('brze igre');
    expect(oblikTroboja(5)).toBe('brzih igara');
    expect(oblikTroboja(11)).toBe('brzih igara');
    expect(oblikTroboja(21)).toBe('brza igra');
  });

  it('formatira rangirani status ispod naslova', () => {
    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 4,
      metrika: 'prosjek_bodova',
      razdoblje: 'tjedno',
    })).toMatchObject({
      opis: '4. mjesto · Prosjek bodova · tjedno',
      rang: '4. mjesto',
      ostatak: ' · Prosjek bodova · tjedno',
      href: '/ljestvice?kategorija=igraci&metrika=prosjek_bodova&razdoblje=tjedno',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 1,
      metrika: 'niz_pobjeda',
      razdoblje: 'mjesecno',
    })).toMatchObject({
      opis: '1. mjesto · Niz pobjeda · mjesečno',
      rang: '1. mjesto',
      ostatak: ' · Niz pobjeda · mjesečno',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 3,
      metrika: 'kolekcija',
      razdoblje: null,
    })).toMatchObject({
      opis: '3. mjesto · Kolekcionari',
      rang: '3. mjesto',
      ostatak: ' · Kolekcionari',
      href: '/ljestvice?kategorija=igraci&metrika=kolekcija',
    });

    expect(tekstSazetkaLjestvice({
      vrsta: 'rangiran',
      mjesto: 5,
      metrika: 'najbrzi_igraci',
      razdoblje: 'tjedno',
    })).toMatchObject({
      opis: '5. mjesto · Najbrži igrači · tjedno',
      rang: '5. mjesto',
      ostatak: ' · Najbrži igrači · tjedno',
    });
  });

  it('bez ranga vraća null (default opis na kartici)', () => {
    expect(tekstSazetkaLjestvice({
      vrsta: 'nedostaje',
      nedostajeIgara: 5,
      metrika: 'prosjek_bodova',
      razdoblje: 'dnevno',
    })).toBeNull();

    expect(tekstSazetkaLjestvice({ vrsta: 'neutralan' })).toBeNull();
    expect(tekstSazetkaLjestvice({
      vrsta: 'nema_rezultata',
      metrika: 'niz_pobjeda',
      razdoblje: 'tjedno',
    })).toBeNull();
  });
});
