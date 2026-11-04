import { describe, expect, it } from 'vitest';
import {
  ISKUSTVO_KALADONT,
  MAKSIMALNO_ISKUSTVO,
  MAKSIMALNA_RAZINA,
  izracunajObracunIskustva,
  iskustvoDoIduceRazina,
  mnoziteljZaStreak,
  stanjeIskustva,
  tierDuljineIskustva,
  tierRijetkostiIskustva,
} from '../src/iskustvo.js';

describe('iskustvo', () => {
  it('određuje prve razine i plafon razine 100', () => {
    expect(stanjeIskustva(0)).toMatchObject({ razina: 1, uRazini: 0, doIduce: 100 });
    expect(stanjeIskustva(100)).toMatchObject({ razina: 2, uRazini: 0, doIduce: 150 });
    expect(stanjeIskustva(250)).toMatchObject({ razina: 3, uRazini: 0, doIduce: 240 });
    expect(stanjeIskustva(MAKSIMALNO_ISKUSTVO + 1)).toEqual({ razina: MAKSIMALNA_RAZINA, ukupno: MAKSIMALNO_ISKUSTVO, uRazini: 0, doIduce: null });
    expect(iskustvoDoIduceRazina(3)).toBe(240);
  });

  it('računa grafemske i frekvencijske tierove', () => {
    expect(tierDuljineIskustva('nadživljavanje')).toBe('srednje_duga');
    expect(tierRijetkostiIskustva(0, 3)).toBeNull();
    expect(tierRijetkostiIskustva(0, 4)).toBe('jako_rijetka');
    expect(tierRijetkostiIskustva(9, 2)).toBe('srednje_rijetka');
    expect(tierRijetkostiIskustva(99, 2)).toBe('rijetka');
  });

  it('PR02-01: duljinski pragovi po grafemima uključuju nj/lj/dž', () => {
    expect(tierDuljineIskustva('abcdefghi')).toBeNull(); // 9
    expect(tierDuljineIskustva('abcdefghij')).toBe('duga'); // 10
    expect(tierDuljineIskustva('abcdefghijk')).toBe('duga'); // 11
    expect(tierDuljineIskustva('abcdefghijkl')).toBe('srednje_duga'); // 12
    expect(tierDuljineIskustva('abcdefghijklmn')).toBe('srednje_duga'); // 14
    expect(tierDuljineIskustva('abcdefghijklmno')).toBe('jako_duga'); // 15
    // digrafi broje kao jedan grafem: 9×nj → null, 10×nj → duga
    expect(tierDuljineIskustva('njnjnjnjnjnjnjnjnj')).toBeNull();
    expect(tierDuljineIskustva('njnjnjnjnjnjnjnjnjnj')).toBe('duga');
    expect(tierDuljineIskustva('ljljljljljljljljljlj')).toBe('duga');
    expect(tierDuljineIskustva('dždždždždždždždždždž')).toBe('duga');
  });

  it('PR02-02: rijetkost ne laže za freq 0 uz <4 grafema', () => {
    expect(tierRijetkostiIskustva(null, 5)).toBeNull();
    expect(tierRijetkostiIskustva(undefined, 5)).toBeNull();
    expect(tierRijetkostiIskustva(0, 3)).toBeNull();
    expect(tierRijetkostiIskustva(0, 4)).toBe('jako_rijetka');
    expect(tierRijetkostiIskustva(1, 2)).toBe('srednje_rijetka');
    expect(tierRijetkostiIskustva(9, 2)).toBe('srednje_rijetka');
    expect(tierRijetkostiIskustva(10, 2)).toBe('rijetka');
    expect(tierRijetkostiIskustva(99, 2)).toBe('rijetka');
    expect(tierRijetkostiIskustva(100, 2)).toBeNull();
  });

  it('razdvaja osnovni XP poteza od bonusa rijetke riječi', () => {
    const obracun = izracunajObracunIskustva(0, [
      { vrsta: 'potezi', naziv: 'Pogođena riječ', kolicina: 1, poStavci: 5, iskustvo: 5 },
      { vrsta: 'rijetke_rijeci', naziv: 'Rijetka riječ', kolicina: 1, poStavci: 15, iskustvo: 15 },
    ], 1);
    expect(obracun.stavke).toEqual([
      expect.objectContaining({ naziv: 'Pogođena riječ', iskustvo: 5 }),
      expect.objectContaining({ naziv: 'Rijetka riječ', iskustvo: 15 }),
    ]);
    expect(obracun.osvojenoIskustvo).toBe(20);
  });

  it('množi subtotal streakom i ograničava ga na plafon', () => {
    const obracun = izracunajObracunIskustva(0, [
      { vrsta: 'potezi', naziv: 'Potezi', kolicina: 5, poStavci: 5, iskustvo: 25 },
      { vrsta: 'duge_rijeci', naziv: 'Duge riječi', kolicina: 2, poStavci: 10, iskustvo: 20 },
      { vrsta: 'rijetke_rijeci', naziv: 'Rijetka riječ', kolicina: 1, poStavci: 15, iskustvo: 15 },
      { vrsta: 'eliminacije', naziv: 'Eliminacije', kolicina: 2, poStavci: 25, iskustvo: 50 },
      { vrsta: 'pobjeda', naziv: 'Pobjeda', kolicina: 1, poStavci: 50, iskustvo: 50 },
    ], 6);
    expect(mnoziteljZaStreak(6)).toBe(1.6);
    expect(obracun.brutoIskustvo).toBe(256);
    expect(obracun.osvojenoIskustvo).toBe(256);
    expect(obracun.stavke.at(-1)).toEqual(
      expect.objectContaining({ naziv: 'Prihvaćene riječi za redom +60 %', iskustvo: 96 }),
    );
    expect(ISKUSTVO_KALADONT).toBe(100);

    const naMaksimumu = izracunajObracunIskustva(MAKSIMALNO_ISKUSTVO - 10, [{ vrsta: 'kaladont', naziv: 'Kaladont', kolicina: 1, poStavci: 100, iskustvo: 100 }], 1);
    expect(naMaksimumu.osvojenoIskustvo).toBe(10);
  });
});