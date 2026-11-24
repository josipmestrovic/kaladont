import { describe, expect, it } from 'vitest';
import { prvaDva, zadnjaDva } from 'zajednicko';
import { izgradiIndeks } from './indeks-rijeci.js';
import { POSEDNA_RIJEC_KALADONT, type PozadinskaRijec } from './rjecnik.js';
import {
  generirajPocetnePoteze,
  odigrajSljedeciPotez,
  stvoriGeneratorIzSeeda,
  stvoriStanjePartije,
} from './simulator.js';

function unos(rijec: string): PozadinskaRijec {
  const n = rijec.normalize('NFC').toLowerCase();
  return { rijec: n, grupe: [`oblika:${n}`] };
}

describe('pozadinski simulator', () => {
  it('svaki sljedeći potez počinje nastavkom prethodnog', () => {
    const { potezi } = generirajPocetnePoteze(12, {
      slucajniBroj: stvoriGeneratorIzSeeda(42),
    });
    expect(potezi.length).toBeGreaterThan(1);
    for (let i = 1; i < potezi.length; i += 1) {
      const prethodni = potezi[i - 1]!;
      const trenutni = potezi[i]!;
      if (trenutni.posebnaRijec) {
        expect(zadnjaDva(prethodni.rijec)).toBe('ka');
        expect(trenutni.rijec).toBe(POSEDNA_RIJEC_KALADONT);
      } else {
        expect(prvaDva(trenutni.rijec)).toBe(zadnjaDva(prethodni.rijec));
      }
    }
  });

  it('ne ponavlja običnu riječ ni grupu unutar partije', () => {
    const { potezi } = generirajPocetnePoteze(40, {
      slucajniBroj: stvoriGeneratorIzSeeda(7),
    });
    const obicne = potezi.filter((p) => !p.posebnaRijec).map((p) => p.rijec);
    expect(new Set(obicne).size).toBe(obicne.length);
  });

  it('potrošene grupe jedne partije ne utječu na drugu', () => {
    const rng = stvoriGeneratorIzSeeda(99);
    const a = generirajPocetnePoteze(8, { slucajniBroj: rng }, 1);
    const b = generirajPocetnePoteze(8, { slucajniBroj: stvoriGeneratorIzSeeda(99) }, 2);
    expect(a.potezi[0]?.rijec).toBe(b.potezi[0]?.rijec);
    expect(a.stanje.idPartije).not.toBe(b.stanje.idPartije);
  });

  it('kaladont se pojavljuje samo na nastavak ka i završava lanac', () => {
    const fond: PozadinskaRijec[] = [
      unos('jabuka'),
      unos('kapa'),
      unos('patka'),
      unos('kava'),
    ];
    const indeks = izgradiIndeks(fond);
    const stanje = stvoriStanjePartije(1);
    stanje.posljednjaRijec = 'jabuka';
    stanje.brojPoteza = 1;
    stanje.iskoristeneRijeci.add('jabuka');
    stanje.iskoristeneGrupe.add('oblika:jabuka');

    const potez = odigrajSljedeciPotez(stanje, {
      indeks,
      slucajniBroj: () => 0.99,
    });
    expect(potez?.rijec).toBe(POSEDNA_RIJEC_KALADONT);
    expect(potez?.posebnaRijec).toBe(true);
    expect(potez?.zavrsavaPartiju).toBe(true);
    expect(stanje.zavrsena).toBe(true);
  });

  it('na nastavak ka uvijek igra kaladont (nema običnog nastavka umjesto njega)', () => {
    const fond: PozadinskaRijec[] = [unos('jabuka'), unos('kapa'), unos('kamera')];
    const indeks = izgradiIndeks(fond);
    const stanje = stvoriStanjePartije(1);
    stanje.posljednjaRijec = 'jabuka';
    stanje.brojPoteza = 3;
    stanje.iskoristeneRijeci.add('jabuka');
    stanje.iskoristeneGrupe.add('oblika:jabuka');

    for (let i = 0; i < 20; i += 1) {
      const lokalno = stvoriStanjePartije(i + 1);
      lokalno.posljednjaRijec = 'jabuka';
      lokalno.brojPoteza = 3;
      lokalno.iskoristeneRijeci.add('jabuka');
      lokalno.iskoristeneGrupe.add('oblika:jabuka');
      const potez = odigrajSljedeciPotez(lokalno, {
        indeks,
        slucajniBroj: stvoriGeneratorIzSeeda(i * 17),
      });
      expect(potez?.rijec).toBe(POSEDNA_RIJEC_KALADONT);
    }
  });

  it('kaladont se ne može igrati ako nastavak nije ka', () => {
    const fond: PozadinskaRijec[] = [unos('more'), unos('remen'), unos('energija')];
    const indeks = izgradiIndeks(fond);
    const stanje = stvoriStanjePartije(1);
    stanje.posljednjaRijec = 'more';
    stanje.brojPoteza = 1;
    stanje.iskoristeneRijeci.add('more');
    stanje.iskoristeneGrupe.add('oblika:more');

    const potez = odigrajSljedeciPotez(stanje, {
      indeks,
      slucajniBroj: () => 0,
      vjerojatnostKaladonta: 1,
    });
    expect(potez?.rijec).not.toBe(POSEDNA_RIJEC_KALADONT);
  });

  it('prazan fond završava bez beskonačne petlje', () => {
    const indeks = izgradiIndeks([]);
    const { stanje, potezi } = generirajPocetnePoteze(5, { indeks }, 1);
    expect(potezi).toEqual([]);
    expect(stanje.zavrsena).toBe(true);
  });

  it('nova partija resetira samo vlastito logičko stanje', () => {
    const prva = generirajPocetnePoteze(5, { slucajniBroj: stvoriGeneratorIzSeeda(3) }, 1);
    const druga = stvoriStanjePartije(2);
    expect(druga.iskoristeneRijeci.size).toBe(0);
    expect(druga.brojPoteza).toBe(0);
    expect(prva.stanje.brojPoteza).toBeGreaterThan(0);
  });

  it('inicijalni potezi ostaju kronološki povezani', () => {
    const { potezi } = generirajPocetnePoteze(6, {
      slucajniBroj: stvoriGeneratorIzSeeda(11),
    });
    for (let i = 1; i < potezi.length; i += 1) {
      const prethodni = potezi[i - 1]!;
      const trenutni = potezi[i]!;
      expect(trenutni.brojPoteza).toBe(prethodni.brojPoteza + 1);
      if (!trenutni.posebnaRijec) {
        expect(prvaDva(trenutni.rijec)).toBe(zadnjaDva(prethodni.rijec));
      }
    }
  });

  it('10_000 poteza kroz više partija ne proizvodi nevaljane nastavke', () => {
    let ukupno = 0;
    let partije = 0;
    let kratke = 0;
    const duljine: number[] = [];

    for (let seed = 0; ukupno < 10_000; seed += 1) {
      const rng = stvoriGeneratorIzSeeda(seed * 97 + 13);
      const stanje = stvoriStanjePartije(seed + 1);
      let duljina = 0;
      let prethodna: string | null = null;
      while (!stanje.zavrsena && ukupno < 10_000) {
        const potez = odigrajSljedeciPotez(stanje, { slucajniBroj: rng });
        if (!potez) break;
        if (prethodna !== null) {
          if (potez.posebnaRijec) {
            expect(zadnjaDva(prethodna)).toBe('ka');
          } else {
            expect(prvaDva(potez.rijec)).toBe(zadnjaDva(prethodna));
          }
        }
        prethodna = potez.rijec;
        duljina += 1;
        ukupno += 1;
      }
      partije += 1;
      duljine.push(duljina);
      if (duljina < 3) kratke += 1;
      // Zaštita od zaglavljivanja ako fond ne može proizvoditi poteze.
      expect(seed).toBeLessThan(5000);
    }

    expect(ukupno).toBeGreaterThanOrEqual(10_000);
    const prosjek = duljine.reduce((a, b) => a + b, 0) / duljine.length;
    const sortirane = [...duljine].sort((a, b) => a - b);
    const medijan = sortirane[Math.floor(sortirane.length / 2)] ?? 0;
    expect(prosjek).toBeGreaterThan(3);
    expect(medijan).toBeGreaterThan(2);
    expect(kratke / partije).toBeLessThan(0.5);
  });
});
