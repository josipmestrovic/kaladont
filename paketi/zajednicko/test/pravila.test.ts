import { describe, expect, it } from 'vitest';
import { PORUKE } from '../src/poruke.js';
import { kljucGrupe, validirajPotez, odrediRazlogMrtvihSlova } from '../src/pravila.js';
import { stvoriTestniRjecnik } from './rjecnik-test.js';

const BEZ_POTROSNJE = { iskoristeneGrupe: new Set<string>(), potrosioGrupu: new Map<string, string>() };

describe('kljucGrupe', () => {
  it('imenica i glagol: vrsta:lema', () => {
    expect(kljucGrupe('imenica', 'kuća')).toBe('imenica:kuća');
    expect(kljucGrupe('glagol', 'pisati')).toBe('glagol:pisati');
  });

  it('pridjev i prilog nose stupanj (default poz)', () => {
    expect(kljucGrupe('pridjev', 'dobar')).toBe('pridjev:dobar:poz');
    expect(kljucGrupe('prilog', 'brzo', 'komp')).toBe('prilog:brzo:komp');
  });
});

describe('validirajPotez', () => {
  const rjecnik = stvoriTestniRjecnik();

  it('odbija nepostojecu rijec', () => {
    const rezultat = validirajPotez({
      rijec: 'nepostojecarijec',
      trazenaSlova: 'ne',
      ...BEZ_POTROSNJE,
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_NE_POSTOJI');
    expect(rezultat.poruka).toBe('nepostojecarijec ne postoji u našoj bazi.');
  });

  it('odbija poznato vlastito ime posebnom porukom', () => {
    const rjecnikSImenom = {
      ...rjecnik,
      jeVlastitoIme: (rijec: string) => rijec === 'italija',
      grupeZa: (rijec: string) => rijec === 'italija' ? ['vlastito_ime:italija'] : rjecnik.grupeZa(rijec),
    };
    const rezultat = validirajPotez({
      rijec: 'italija',
      trazenaSlova: 'it',
      ...BEZ_POTROSNJE,
      rjecnik: rjecnikSImenom,
    });
    expect(rezultat.kod).toBe('VLASTITO_IME');
    expect(rezultat.poruka).toBe(PORUKE.vlastitoImeNijeDopusteno('italija'));
  });

  it('prihvaca preklopljenu rijec ako postoji i kao dopustena opca rijec', () => {
    const rjecnikSPreklapanjem = {
      ...rjecnik,
      jeVlastitoIme: (rijec: string) => rijec === 'kula',
    };
    const rezultat = validirajPotez({
      rijec: 'kula',
      trazenaSlova: 'ku',
      ...BEZ_POTROSNJE,
      rjecnik: rjecnikSPreklapanjem,
    });
    expect(rezultat.valjano).toBe(true);
  });

  it('PROPN padezni oblik dijeli grupu s osnovnim oblikom', () => {
    const rezultat = validirajPotez({
      rijec: 'ana',
      trazenaSlova: 'an',
      iskoristeneGrupe: new Set(['vlastito_ime:ana']),
      potrosioGrupu: new Map([['vlastito_ime:ana', 'ane']]),
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_ISKORISTENA');
    expect(rezultat.poruka).toBe(PORUKE.rijecIskoristenaOblik('ane'));
  });

  it('PROPN oblik s dvije leme trosi obje grupe', () => {
    const rezultat = validirajPotez({
      rijec: 'ivanu',
      trazenaSlova: 'iv',
      iskoristeneGrupe: new Set(['vlastito_ime:ivan']),
      potrosioGrupu: new Map([['vlastito_ime:ivan', 'ivan']]),
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_ISKORISTENA');

    const nakonIvane = new Set(['vlastito_ime:ivan', 'vlastito_ime:ivana']);
    const rezultatNakonIvane = validirajPotez({
      rijec: 'ivan',
      trazenaSlova: 'iv',
      iskoristeneGrupe: nakonIvane,
      potrosioGrupu: new Map([
        ['vlastito_ime:ivan', 'ivana'],
        ['vlastito_ime:ivana', 'ivana'],
      ]),
      rjecnik,
    });
    expect(rezultatNakonIvane.kod).toBe('RIJEC_ISKORISTENA');
  });

  it('odbija rijec koja ne pocinje na trazena slova', () => {
    const rezultat = validirajPotez({
      rijec: 'kula',
      trazenaSlova: 'va',
      ...BEZ_POTROSNJE,
      rjecnik,
    });
    expect(rezultat.kod).toBe('KRIVA_SLOVA');
  });

  it('odbija istu rijec genericnom porukom', () => {
    const rezultat = validirajPotez({
      rijec: 'kula',
      trazenaSlova: 'ku',
      iskoristeneGrupe: new Set(['test:kula']),
      potrosioGrupu: new Map([['test:kula', 'kula']]),
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_ISKORISTENA');
    expect(rezultat.poruka).toBe(PORUKE.rijecIskoristena);
  });

  it('RS-28: drugi oblik potrosene grupe odbijen s porukom koja navodi potroseni oblik', () => {
    const rezultat = validirajPotez({
      rijec: 'dobra',
      trazenaSlova: 'do',
      iskoristeneGrupe: new Set(['pridjev:dobar:poz']),
      potrosioGrupu: new Map([['pridjev:dobar:poz', 'dobar']]),
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_ISKORISTENA');
    expect(rezultat.poruka).toBe(PORUKE.rijecIskoristenaOblik('dobar'));
  });

  it('RS-28: komparativ je zasebna grupa - "bolji" prolazi nakon "dobar"', () => {
    const rezultat = validirajPotez({
      rijec: 'bolji',
      trazenaSlova: 'bo',
      iskoristeneGrupe: new Set(['pridjev:dobar:poz']),
      potrosioGrupu: new Map([['pridjev:dobar:poz', 'dobar']]),
      rjecnik,
    });
    expect(rezultat.valjano).toBe(true);
  });

  it('RS-28: glagolski vid razdvaja grupe - "napisati" prolazi nakon "pisati"', () => {
    const rezultat = validirajPotez({
      rijec: 'napisati',
      trazenaSlova: 'na',
      iskoristeneGrupe: new Set(['glagol:pisati']),
      potrosioGrupu: new Map([['glagol:pisati', 'pisati']]),
      rjecnik,
    });
    expect(rezultat.valjano).toBe(true);
  });

  it('RS-29: visekategorijski oblik "dobro" blokira i pridjev "dobra"', () => {
    // "dobro" je odigran i potrosio je sve tri svoje grupe
    const iskoristeneGrupe = new Set(['pridjev:dobar:poz', 'prilog:dobro:poz', 'imenica:dobro']);
    const potrosioGrupu = new Map([
      ['pridjev:dobar:poz', 'dobro'],
      ['prilog:dobro:poz', 'dobro'],
      ['imenica:dobro', 'dobro'],
    ]);
    const rezultat = validirajPotez({
      rijec: 'dobra',
      trazenaSlova: 'do',
      iskoristeneGrupe,
      potrosioGrupu,
      rjecnik,
    });
    expect(rezultat.kod).toBe('RIJEC_ISKORISTENA');
    expect(rezultat.poruka).toBe(PORUKE.rijecIskoristenaOblik('dobro'));
  });

  it('RS-06: rijec jednaka trazenim grafemima je valjana', () => {
    const rezultat = validirajPotez({
      rijec: 'uš',
      trazenaSlova: 'uš',
      ...BEZ_POTROSNJE,
      rjecnik,
    });
    expect(rezultat.valjano).toBe(true);
  });

  it('strogi dijakritici: cesta ne prolazi kad se trazi česta', () => {
    const rezultat = validirajPotez({
      rijec: 'cesta',
      trazenaSlova: 'če',
      ...BEZ_POTROSNJE,
      rjecnik,
    });
    expect(rezultat.valjano).toBe(false);
  });

  it('kaladont je izuzet od potrosnje grupa', () => {
    const rezultat = validirajPotez({
      rijec: 'kaladont',
      trazenaSlova: 'ka',
      iskoristeneGrupe: new Set(['test:kaladont']),
      potrosioGrupu: new Map([['test:kaladont', 'kaladont']]),
      rjecnik,
    });
    expect(rezultat.valjano).toBe(true);
  });
});

describe('odrediRazlogMrtvihSlova', () => {
  const rjecnik = stvoriTestniRjecnik();

  it('RS-02: mrtav par u bazi vraca mrtva_slova_baza', () => {
    expect(odrediRazlogMrtvihSlova('nt', new Set(), rjecnik)).toBe('mrtva_slova_baza');
  });

  it('RS-03: sve grupe potrosene vraca mrtva_slova_iskoristeno', () => {
    expect(odrediRazlogMrtvihSlova('uš', new Set(['test:uš']), rjecnik)).toBe(
      'mrtva_slova_iskoristeno',
    );
  });

  it('RS-29: nastavak potrosen grupom drugog oblika (dobro blokira dobra)', () => {
    // jedini nastavci na "do" su dobar/dobra/dobro - sve tri dijele pridjevsku grupu
    expect(
      odrediRazlogMrtvihSlova(
        'do',
        new Set(['pridjev:dobar:poz', 'prilog:dobro:poz', 'imenica:dobro']),
        rjecnik,
      ),
    ).toBe('mrtva_slova_iskoristeno');
  });

  it('vraca null kad postoji slobodan nastavak', () => {
    expect(odrediRazlogMrtvihSlova('ku', new Set(), rjecnik)).toBeNull();
  });
});
