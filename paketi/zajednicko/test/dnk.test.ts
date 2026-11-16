import { describe, expect, it } from 'vitest';
import {
  izracunajDnkTier,
  izracunajKaladontDnk,
  izracunajOcjenuIgre,
  jeDnkOtkljucan,
  jeOcjenaIgreDostupna,
  nazivnikTaktike,
  vrijednostBrzineMs,
} from '../src/dnk.js';
import { izracunajRang, izracunajUniverzalniUcinak } from '../src/rangovi.js';

function bazaUlaza(overrides: Partial<Parameters<typeof izracunajKaladontDnk>[0]> = {}) {
  return {
    n2: 4,
    n3: 3,
    n4: 3,
    eliminacijeUkupno: 5,
    najduziStreak: 6,
    prihvaceniPotezi: 10,
    ukupnoTrajanjePrihvaceniPoteziMs: 90_000,
    ponderiraneDuge: 8,
    ponderiraneRijetke: 3,
    univerzalniUcinak: 100,
    ...overrides,
  };
}

describe('DNK zajednicko', () => {
  it('vraća ispravne granice tierova i vrijednosti', () => {
    expect(izracunajDnkTier(0, [{ min: 0, max: 10, naziv: 'A', oznaka: 'A' }])).toBe(1);
    expect(izracunajDnkTier(10, [{ min: 0, max: 10, naziv: 'A', oznaka: 'A' }])).toBe(1);
    expect(izracunajDnkTier(100, [{ min: 50, max: 100, naziv: 'B', oznaka: 'B' }])).toBe(1);
    expect(izracunajDnkTier(50, [{ min: 0, max: 50, naziv: 'A', oznaka: 'A' }, { min: 51, max: 100, naziv: 'B', oznaka: 'B' }])).toBe(1);
  });

  it('otkljucavanje DNK ovisi o ukupnom broju javnih partija', () => {
    expect(jeDnkOtkljucan(9)).toBe(false);
    expect(jeDnkOtkljucan(10)).toBe(true);
    expect(jeDnkOtkljucan(11)).toBe(true);
  });

  it('ocjena igre dostupna je u javnoj partiji bez obzira na XP', () => {
    expect(jeOcjenaIgreDostupna(0)).toBe(true);
    expect(jeOcjenaIgreDostupna(-1)).toBe(true);
    expect(jeOcjenaIgreDostupna(1)).toBe(true);
  });

  it('ocjena igre prati učinak partije i pobjedu', () => {
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 0, bodovi: 0, eliminacije: 0, iskustvo: 0 })).toBe(1);
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 1, bodovi: 0, eliminacije: 0, iskustvo: 5 })).toBe(2);
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 2, bodovi: 0, eliminacije: 0, iskustvo: 10 })).toBe(3);
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 5, bodovi: 0, eliminacije: 0, iskustvo: 25 })).toBe(4);
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 12, bodovi: 0, eliminacije: 0, iskustvo: 60 })).toBe(5);
    expect(izracunajOcjenuIgre({ pobjeda: false, prihvaceniPotezi: 1, bodovi: 3, eliminacije: 1, iskustvo: 5 })).toBe(4);
    expect(izracunajOcjenuIgre({ pobjeda: true, prihvaceniPotezi: 0, bodovi: 0, eliminacije: 0, iskustvo: 0 })).toBe(5);
  });

  it('4+3+3 otključava DNK; 4+3+2 još ne', () => {
    const otkljucan = izracunajKaladontDnk(bazaUlaza({ n2: 4, n3: 3, n4: 3 }));
    const zakljucan = izracunajKaladontDnk(bazaUlaza({ n2: 4, n3: 3, n4: 2 }));
    expect(otkljucan.odigrano).toBe(10);
    expect(otkljucan.otkljucan).toBe(true);
    expect(otkljucan.preostaloDoOtkljucavanja).toBe(0);
    expect(zakljucan.odigrano).toBe(9);
    expect(zakljucan.otkljucan).toBe(false);
    expect(zakljucan.preostaloDoOtkljucavanja).toBe(1);
    expect(zakljucan.osi.find((os) => os.kljuc === 'vjestina')?.vrijednost).toBe(0);
  });

  it('brzina: 2×5s + 8×10s → 9s; bez poteza nije savršena', () => {
    const ms = 2 * 5000 + 8 * 10000;
    expect(ms / 10).toBe(9000);
    const profil = izracunajKaladontDnk(bazaUlaza({
      prihvaceniPotezi: 10,
      ukupnoTrajanjePrihvaceniPoteziMs: ms,
    }));
    const brzina = profil.osi.find((os) => os.kljuc === 'brzina')!;
    expect(brzina.detalj).toContain('9.0 s');
    expect(vrijednostBrzineMs(9000)).toBeCloseTo(100 - (5000 / 11000) * 100, 5);
    expect(brzina.vrijednost).toBe(Math.round(vrijednostBrzineMs(9000)));

    const bezPoteza = izracunajKaladontDnk(bazaUlaza({
      prihvaceniPotezi: 0,
      ukupnoTrajanjePrihvaceniPoteziMs: 0,
    }));
    const brzinaPrazna = bezPoteza.osi.find((os) => os.kljuc === 'brzina')!;
    expect(brzinaPrazna.vrijednost).toBe(0);
    expect(brzinaPrazna.detalj).toBe('Nema dovoljno podataka');
  });

  it('fokus koristi max streak / 10 (nizovi 4 i 6 → 6)', () => {
    const profil = izracunajKaladontDnk(bazaUlaza({ najduziStreak: 6 }));
    expect(profil.osi.find((os) => os.kljuc === 'fokus')?.vrijednost).toBe(60);
  });

  it('ista Vještina za isti univerzalni učinak', () => {
    const a = izracunajKaladontDnk(bazaUlaza({ univerzalniUcinak: 89 }));
    const b = izracunajKaladontDnk(bazaUlaza({ univerzalniUcinak: 89, n2: 10, n3: 0, n4: 0 }));
    expect(a.osi.find((os) => os.kljuc === 'vjestina')?.vrijednost)
      .toBe(b.osi.find((os) => os.kljuc === 'vjestina')?.vrijednost);
    expect(a.osi.find((os) => os.kljuc === 'vjestina')?.vrijednost).toBe(Math.round((100 * 89) / 178));
  });

  it('taktika koristi ponderirani nazivnik N2/N3/N4', () => {
    const n2 = 4;
    const n3 = 3;
    const n4 = 3;
    const elim = 5;
    const profil = izracunajKaladontDnk(bazaUlaza({ n2, n3, n4, eliminacijeUkupno: elim }));
    const ocekivano = Math.round((100 * elim) / nazivnikTaktike(n2, n3, n4));
    expect(profil.osi.find((os) => os.kljuc === 'taktika')?.vrijednost).toBe(ocekivano);
  });

  it('taktika saturira na Agresivac kad je omjer visok', () => {
    const profil = izracunajKaladontDnk(bazaUlaza({
      n2: 1,
      n3: 0,
      n4: 0,
      eliminacijeUkupno: 100,
      // odigrano=1 → zaključan; forsiraj unlock većim N uz isti nazivnik omjer
    }));
    // 1 partija: zaključan vještina, ali taktika se i dalje računa
    expect(profil.osi.find((os) => os.kljuc === 'taktika')?.vrijednost).toBe(100);
    expect(profil.osi.find((os) => os.kljuc === 'taktika')?.oznaka).toBe('Agresivac');
  });

  it('osi su u rasponu 0–100', () => {
    const profil = izracunajKaladontDnk(bazaUlaza());
    expect(profil.osi).toHaveLength(6);
    expect(profil.osi.every((os) => os.vrijednost >= 0 && os.vrijednost <= 100)).toBe(true);
  });
});

describe('univerzalni rang (PR09)', () => {
  it('Kaladont na pragu 178; Piskaralo ispod 10 partija', () => {
    expect(izracunajRang(10, 178)).toBe('Kaladont');
    expect(izracunajRang(9, 200)).toBe('Piskaralo');
    expect(izracunajRang(10, 80)).toBe('Jezičar');
  });

  it('izracunajUniverzalniUcinak je ulaz Vještine', () => {
    const ucinak = izracunajUniverzalniUcinak(178 * 10 * 2520, 10);
    expect(ucinak).toBe(178);
    const profil = izracunajKaladontDnk(bazaUlaza({ univerzalniUcinak: ucinak }));
    expect(profil.osi.find((os) => os.kljuc === 'vjestina')?.vrijednost).toBe(100);
  });
});
