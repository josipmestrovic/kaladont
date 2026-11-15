import { describe, expect, it } from 'vitest';
import {
  BROJ_PARTIJA_ZA_KALIBRACIJU,
  doprinosIzJedinica,
  izracunajDoprinosRangJedinice,
  izracunajRang,
  izracunajRangIzAgregata,
  izracunajUniverzalniUcinak,
  jeNapredakUniverzalnogRanga,
  RANG_JEDINICA_PO_BODU,
} from '../src/rangovi.js';

describe('izracunajDoprinosRangJedinice (PR09)', () => {
  it('Dvoboj 1,0 → 200 i 0', () => {
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(2, 1, 1))).toBe(200);
    expect(izracunajDoprinosRangJedinice(2, 0, 1)).toBe(0);
  });

  it('Troboj 4,2,0 → 200, 100, 0', () => {
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(3, 4, 6))).toBe(200);
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(3, 2, 6))).toBe(100);
    expect(izracunajDoprinosRangJedinice(3, 0, 6)).toBe(0);
  });

  it('Četveroboj 7,2,1,0 → 280, 80, 40, 0', () => {
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(4, 7, 10))).toBe(280);
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(4, 2, 10))).toBe(80);
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(4, 1, 10))).toBe(40);
    expect(izracunajDoprinosRangJedinice(4, 0, 10)).toBe(0);
  });

  it('Troboj bez eliminacijskog kredita pobjednika 3,1,0 → 225, 75, 0', () => {
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(3, 3, 4))).toBe(225);
    expect(doprinosIzJedinica(izracunajDoprinosRangJedinice(3, 1, 4))).toBe(75);
    expect(izracunajDoprinosRangJedinice(3, 0, 4)).toBe(0);
  });

  it('S=0 daje doprinos 0 svima', () => {
    expect(izracunajDoprinosRangJedinice(3, 0, 0)).toBe(0);
  });

  it('svaki S=1…10 dijeli 2520 (egzaktan cjelobrojni doprinos)', () => {
    for (let s = 1; s <= 10; s++) {
      for (const n of [2, 3, 4]) {
        for (let b = 0; b <= 7; b++) {
          const jed = izracunajDoprinosRangJedinice(n, b, s);
          expect(Number.isInteger(jed)).toBe(true);
          expect(jed % 1).toBe(0);
          expect(jed).toBe((252000 * n * b) / s);
        }
      }
    }
  });
});

describe('izracunajUniverzalniUcinak / izracunajRang (PR09)', () => {
  it('prvih 10 partija je Piskaralo', () => {
    expect(izracunajRang(0, 200)).toBe('Piskaralo');
    expect(izracunajRang(9, 200)).toBe('Piskaralo');
    expect(BROJ_PARTIJA_ZA_KALIBRACIJU).toBe(10);
  });

  it('primjer 200+100+80 → prosjek 126.666… → Jezikoslovac na 10+ partija', () => {
    const j200 = izracunajDoprinosRangJedinice(2, 1, 1);
    const j100 = izracunajDoprinosRangJedinice(3, 2, 6);
    const j80 = izracunajDoprinosRangJedinice(4, 2, 10);
    const suma = j200 + j100 + j80;
    const ucinak = izracunajUniverzalniUcinak(suma, 3);
    expect(ucinak).toBeCloseTo(126.666, 2);
    // Manje od 10 → Piskaralo (spec primjer)
    expect(izracunajRang(3, ucinak)).toBe('Piskaralo');
    // Na 10 partija s istim prosjekom → Jezikoslovac (prag 122; Književnik je 108)
    expect(izracunajRang(10, ucinak)).toBe('Jezikoslovac');
  });

  it('5 pobjeda u 10 Dvoboja → učinak 100 → Lektor', () => {
    const suma = 5 * izracunajDoprinosRangJedinice(2, 1, 1) + 5 * 0;
    const ucinak = izracunajUniverzalniUcinak(suma, 10);
    expect(ucinak).toBe(100);
    expect(izracunajRang(10, ucinak)).toBe('Lektor');
  });

  it('točan prag i prva vrijednost ispod', () => {
    expect(izracunajRang(10, 94)).toBe('Lektor');
    expect(izracunajRang(10, 93.999)).toBe('Jezičar');
    expect(izracunajRang(10, 178)).toBe('Kaladont');
    expect(izracunajRang(10, 177.9)).toBe('Gospodar rječnika');
    expect(izracunajRang(10, 0)).toBe('Prvopisac');
  });

  it('izracunajRangIzAgregata koristi cjelobrojnu usporedbu na pragu Lektora (94)', () => {
    const pragLektor = BigInt(94 * 10 * RANG_JEDINICA_PO_BODU);
    expect(izracunajRangIzAgregata(pragLektor, 10)).toBe('Lektor');
    expect(izracunajRangIzAgregata(pragLektor - 1n, 10)).toBe('Jezičar');
  });

  it('zanemaruje stari mod argument', () => {
    expect(izracunajRang(10, 100, 'dva_igraca')).toBe('Lektor');
    expect(izracunajRang(10, 100, 'cetiri_igraca')).toBe('Lektor');
  });
});

describe('jeNapredakUniverzalnogRanga', () => {
  it('Piskaralo → Lektor je napredak; pad nije', () => {
    expect(jeNapredakUniverzalnogRanga('Piskaralo', 'Lektor')).toBe(true);
    expect(jeNapredakUniverzalnogRanga('Lektor', 'Jezičar')).toBe(false);
    expect(jeNapredakUniverzalnogRanga('Lektor', 'Lektor')).toBe(false);
  });
});
