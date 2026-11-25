import { describe, expect, it } from 'vitest';
import {
  dogadajPripadaAktivnojPartiji,
  klijentSmijeZakljucitiIzBrojaAktivnih,
  trebamJednokratniEfekt,
  trebaPrimijenitiSnimku,
} from './verzija-stanja-partije.js';

describe('trebaPrimijenitiSnimku', () => {
  it('C01: odbacuje stariju verziju iste partije', () => {
    expect(
      trebaPrimijenitiSnimku({
        aktivnaPartijaId: 'p1',
        snimkaPartijaId: 'p1',
        lokalnaVerzija: 5,
        snimkaVerzija: 3,
      }),
    ).toBe('odbaci_staru');
  });

  it('C04: odbacuje snimku druge partije', () => {
    expect(
      trebaPrimijenitiSnimku({
        aktivnaPartijaId: 'p1',
        snimkaPartijaId: 'p2',
        lokalnaVerzija: 1,
        snimkaVerzija: 9,
      }),
    ).toBe('odbaci_stranu');
  });

  it('C05: ista verzija ne diraju puni kanon (unos ostaje)', () => {
    expect(
      trebaPrimijenitiSnimku({
        aktivnaPartijaId: 'p1',
        snimkaPartijaId: 'p1',
        lokalnaVerzija: 2,
        snimkaVerzija: 2,
      }),
    ).toBe('ista_verzija');
  });

  it('prihvaća noviju verziju', () => {
    expect(
      trebaPrimijenitiSnimku({
        aktivnaPartijaId: 'p1',
        snimkaPartijaId: 'p1',
        lokalnaVerzija: 2,
        snimkaVerzija: 3,
      }),
    ).toBe('primijeni');
  });
});

describe('trebamJednokratniEfekt', () => {
  it('C02: različiti dogadajId iste verzije — oba efekta', () => {
    const vidjeni = new Set<string>();
    expect(trebamJednokratniEfekt(vidjeni, 'a')).toBe(true);
    expect(trebamJednokratniEfekt(vidjeni, 'b')).toBe(true);
  });

  it('C03: duplikat dogadajId — bez drugog efekta', () => {
    const vidjeni = new Set<string>();
    expect(trebamJednokratniEfekt(vidjeni, 'x')).toBe(true);
    expect(trebamJednokratniEfekt(vidjeni, 'x')).toBe(false);
  });
});

describe('dogadajPripadaAktivnojPartiji', () => {
  it('C04: zakašnjeli događaj prethodne partije se ignorira', () => {
    expect(dogadajPripadaAktivnojPartiji('p-nova', 'p-stara')).toBe(false);
    expect(dogadajPripadaAktivnojPartiji('p1', 'p1')).toBe(true);
  });
});

describe('klijentSmijeZakljucitiIzBrojaAktivnih', () => {
  it('E01: jedan aktivan lokalno ne završava partiju', () => {
    expect(klijentSmijeZakljucitiIzBrojaAktivnih(1)).toBe(false);
    expect(klijentSmijeZakljucitiIzBrojaAktivnih(0)).toBe(false);
  });
});
