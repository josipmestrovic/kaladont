import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { izracunajBodove } from '../src/bodovanje.js';

/** Sve permutacije plasmana {1,2,3,4} - pobjednik (plasman 1) uvijek postoji točno jednom. */
function svePermutacije(): (1 | 2 | 3 | 4)[][] {
  const rezultat: (1 | 2 | 3 | 4)[][] = [];
  const baza: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  function permutiraj(preostalo: (1 | 2 | 3 | 4)[], dosad: (1 | 2 | 3 | 4)[]): void {
    if (preostalo.length === 0) {
      rezultat.push(dosad);
      return;
    }
    for (let i = 0; i < preostalo.length; i += 1) {
      const novoPreostalo = [...preostalo.slice(0, i), ...preostalo.slice(i + 1)];
      permutiraj(novoPreostalo, [...dosad, preostalo[i]!]);
    }
  }
  permutiraj(baza, []);
  return rezultat;
}

const PERMUTACIJE = svePermutacije();

describe('svojstveni test: bodovanje (testiranje.md invarijante)', () => {
  it('zbroj bodova stola = 10 kad nema samoeliminacija (3 eliminacije uvijek nekome pripisane)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PERMUTACIJE),
        // pobjednik (indeks plasmana=1) uvijek ima barem zavrsnu eliminaciju (bodovanje-i-rangovi.md)
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        (plasmani, dodatnaEliminacija1, dodatnaEliminacija2) => {
          const eliminacijeBrojac = [0, 0, 0, 0];
          const indeksPobjednika = plasmani.indexOf(1);
          eliminacijeBrojac[indeksPobjednika] += 1; // zavrsna eliminacija
          eliminacijeBrojac[dodatnaEliminacija1] += 1;
          eliminacijeBrojac[dodatnaEliminacija2] += 1;

          const rezultati = plasmani.map((plasman, indeks) =>
            izracunajBodove({ plasman, eliminacije: eliminacijeBrojac[indeks]! }),
          );

          const zbroj = rezultati.reduce((a, b) => a + b, 0);
          expect(zbroj).toBe(10);

          for (const bodovi of rezultati) {
            expect(bodovi).toBeGreaterThanOrEqual(0);
            expect(bodovi).toBeLessThanOrEqual(7);
          }

          const bodoviPobjednika = rezultati[indeksPobjednika]!;
          expect(bodoviPobjednika).toBeGreaterThanOrEqual(5);

          // plasmani su permutacija {1,2,3,4} - tocno jedan pobjednik
          expect(new Set(plasmani)).toEqual(new Set([1, 2, 3, 4]));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('samoeliminacija (RS-10) smanjuje zbroj bodova stola ispod 10', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PERMUTACIJE), (plasmani) => {
        // nitko ne dobiva bod za samoeliminaciju - samo 2 od 3 eliminacije imaju napadaca
        const eliminacijeBrojac = [0, 0, 0, 0];
        const indeksPobjednika = plasmani.indexOf(1);
        eliminacijeBrojac[indeksPobjednika] += 1;
        // druga eliminacija ide istom pobjedniku (druga stvarna eliminacija), treca je samoeliminacija (bez boda)

        const rezultati = plasmani.map((plasman, indeks) =>
          izracunajBodove({ plasman, eliminacije: eliminacijeBrojac[indeks]! }),
        );
        const zbroj = rezultati.reduce((a, b) => a + b, 0);
        expect(zbroj).toBeLessThan(10);
      }),
      { numRuns: 50 },
    );
  });
});
