import { describe, expect, it } from 'vitest';
import {
  gostImaXp,
  izracunajPrikazXp,
  postotakXpTrake,
  tekstRegistracijeGosta,
} from './naslovnica-napredak.js';

describe('postotakXpTrake', () => {
  it('računa postotak unutar 0–100', () => {
    expect(postotakXpTrake({ razina: 3, ukupno: 90, uRazini: 90, doIduce: 240 })).toBe(37.5);
  });

  it('vraća 100 za maksimalnu razinu', () => {
    expect(postotakXpTrake({ razina: 99, ukupno: 1, uRazini: 0, doIduce: null })).toBe(100);
  });
});

describe('izracunajPrikazXp', () => {
  it('neutralni fallback dok nema podataka', () => {
    expect(izracunajPrikazXp(null, 'ucitavanje')).toEqual({
      vrsta: 'neutralan',
      natpis: 'Moj napredak',
    });
  });

  it('prikazuje rang, razinu i XP', () => {
    const prikaz = izracunajPrikazXp(
      {
        rang: 'Piskaralo',
        iskustvo: { razina: 3, ukupno: 330, uRazini: 90, doIduce: 240 },
      },
      'spreman',
    );
    expect(prikaz).toMatchObject({
      vrsta: 'napredak',
      rang: 'Piskaralo',
      razina: 3,
      maksimalna: false,
    });
  });

  it('koristi Piskaralo kad rang nedostaje', () => {
    const prikaz = izracunajPrikazXp(
      { rang: null, iskustvo: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 240 } },
      'spreman',
    );
    expect(prikaz.vrsta === 'napredak' && prikaz.rang).toBe('Piskaralo');
  });
});

describe('tekstRegistracijeGosta', () => {
  it('prednost daje izazovima pred XP-om', () => {
    expect(tekstRegistracijeGosta({ imaXp: true, imaZavrseneIzazove: true })).toBe(
      'Sačuvaj napredak u izazovima.',
    );
  });

  it('koristi XP tekst kad nema izazova', () => {
    expect(tekstRegistracijeGosta({ imaXp: true, imaZavrseneIzazove: false })).toBe(
      'Sačuvaj svoje iskustvo.',
    );
  });

  it('koristi default bez napretka', () => {
    expect(tekstRegistracijeGosta({ imaXp: false, imaZavrseneIzazove: false })).toBe(
      'Sačuvaj svoj napredak.',
    );
  });
});

describe('gostImaXp', () => {
  it('prepoznaje ukupni XP', () => {
    expect(gostImaXp({ razina: 2, ukupno: 10, uRazini: 0, doIduce: 100 })).toBe(true);
  });

  it('vraća false bez iskustva', () => {
    expect(gostImaXp(undefined)).toBe(false);
    expect(gostImaXp({ razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 })).toBe(false);
  });
});
