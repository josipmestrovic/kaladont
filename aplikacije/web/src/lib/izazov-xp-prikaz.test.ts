import { describe, expect, it } from 'vitest';
import type { KrajPartije } from 'zajednicko';
import { izazovXpPrikaz } from './izazov-xp-prikaz.js';

function kraj(preko: Partial<KrajPartije> = {}): KrajPartije {
  return {
    partijaId: 'p1',
    plasmani: [],
    mojNoviProsjek: 0,
    mojRang: null,
    mojeIskustvo: null,
    mojaOcjenaIgre: null,
    bonusOcjenaIgre: 0,
    novaDostignuca: [],
    kontekst: 'izazov',
    ...preko,
  };
}

describe('izazovXpPrikaz', () => {
  it('zbraja tri disjunktna izvora: 80 + 300 + 200 = 580', () => {
    const p = izazovXpPrikaz(
      kraj({
        mojeIskustvo: {
          prije: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 },
          poslije: { razina: 1, ukupno: 80, uRazini: 80, doIduce: 100 },
          stavke: [],
          najboljiStreak: 0,
          mnoziteljStreaka: 1,
          brutoIskustvo: 80,
          osvojenoIskustvo: 80,
          bonusOcjenaIgre: 0,
        },
        ukupnoIskustvo: {
          prije: { razina: 1, ukupno: 80, uRazini: 80, doIduce: 100 },
          nakonPartije: { razina: 2, ukupno: 380, uRazini: 80, doIduce: 150 },
          poslije: { razina: 3, ukupno: 580, uRazini: 80, doIduce: 200 },
          partijskiXpStvarno: 300,
          misijskiXpNominalno: 200,
          misijskiXpStvarno: 200,
          ukupnoXpStvarno: 500,
        },
        izazovSettlement: {
          firstCompletion: true,
          challengeXp: { nominal: 300, awarded: 300 },
          missionXp: { nominal: 200, awarded: 200 },
          izazivac: { zvjezdice: 1, novaRazina: 1 },
          settlementState: 'spremljeno',
          novaDostignuca: [],
        },
      }),
    );
    expect(p.xpIgre).toBe(80);
    expect(p.xpIzazova).toBe(300);
    expect(p.xpMisija).toBe(200);
    expect(p.ukupno).toBe(580);
    expect(p.konacno?.ukupno).toBe(580);
  });

  it('ne broji misije dvaput kad settlement i ukupno imaju isti awarded', () => {
    const p = izazovXpPrikaz(
      kraj({
        mojeIskustvo: {
          prije: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 },
          poslije: { razina: 1, ukupno: 90, uRazini: 90, doIduce: 100 },
          stavke: [],
          najboljiStreak: 0,
          mnoziteljStreaka: 1,
          brutoIskustvo: 90,
          osvojenoIskustvo: 90,
          bonusOcjenaIgre: 0,
        },
        ukupnoIskustvo: {
          prije: { razina: 1, ukupno: 90, uRazini: 90, doIduce: 100 },
          nakonPartije: { razina: 1, ukupno: 90, uRazini: 90, doIduce: 100 },
          poslije: { razina: 2, ukupno: 290, uRazini: 90, doIduce: 150 },
          partijskiXpStvarno: 0,
          misijskiXpNominalno: 200,
          misijskiXpStvarno: 200,
          ukupnoXpStvarno: 200,
        },
        izazovSettlement: {
          firstCompletion: false,
          challengeXp: { nominal: 300, awarded: 0 },
          missionXp: { nominal: 200, awarded: 200 },
          izazivac: { zvjezdice: 1, novaRazina: 0 },
          settlementState: 'spremljeno',
          novaDostignuca: [],
        },
      }),
    );
    expect(p.ukupno).toBe(290);
    expect(p.xpIzazova).toBe(0);
  });

  it('ne koristi ukupno.partijski kao XP od igre', () => {
    const p = izazovXpPrikaz(
      kraj({
        mojeIskustvo: null,
        ukupnoIskustvo: {
          prije: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 },
          nakonPartije: { razina: 1, ukupno: 300, uRazini: 0, doIduce: 100 },
          poslije: { razina: 1, ukupno: 300, uRazini: 0, doIduce: 100 },
          partijskiXpStvarno: 300,
          misijskiXpNominalno: 0,
          misijskiXpStvarno: 0,
          ukupnoXpStvarno: 300,
        },
        izazovSettlement: {
          firstCompletion: true,
          challengeXp: { nominal: 300, awarded: 300 },
          missionXp: { nominal: 0, awarded: 0 },
          izazivac: { zvjezdice: 1, novaRazina: 1 },
          settlementState: 'spremljeno',
          novaDostignuca: [],
        },
      }),
    );
    expect(p.xpIgre).toBe(0);
    expect(p.xpIzazova).toBe(300);
    expect(p.ukupno).toBe(300);
  });

  it('pending ne izmišlja nagrade', () => {
    const p = izazovXpPrikaz(
      kraj({
        izazovSettlement: {
          firstCompletion: false,
          challengeXp: { nominal: 100, awarded: 0 },
          missionXp: { nominal: 0, awarded: 0 },
          izazivac: { zvjezdice: 0, novaRazina: 0 },
          settlementState: 'spremanje_u_tijeku',
          novaDostignuca: [],
        },
      }),
    );
    expect(p.pending).toBe(true);
    expect(p.ukupno).toBe(0);
  });
});
