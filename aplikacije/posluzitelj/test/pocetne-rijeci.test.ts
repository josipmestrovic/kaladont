import { describe, expect, it } from 'vitest';
import type { VrstaRijeci } from 'zajednicko';
import {
  nijeSistemskoOtvaranjeNaKa,
  odaberiRezervnuPocetnuRijec,
  odaberiSigurnuPocetnuRijec,
  POCETNI_SEED_SIGURNIH_RIJECI,
  SKUP_SIGURNIH_RIJECI,
} from '../src/rjecnik/pocetne-rijeci.js';

interface TestnaRijec {
  grupe: string[];
  vrste: VrstaRijeci[];
  prefiks: string;
}

function odaberi(
  rijeci: Record<string, TestnaRijec>,
  iskoristeneGrupe: ReadonlySet<string> = new Set(),
  dopusteneVrste?: ReadonlySet<VrstaRijeci>,
): string | null {
  return odaberiSigurnuPocetnuRijec({
    iskoristeneGrupe,
    dopusteneVrste,
    nasumicniPomak: 0,
    grupeZa: (rijec) => rijeci[rijec]?.grupe ?? [],
    vrsteZa: (rijec) => rijeci[rijec]?.vrste ?? [],
    rijeciNa: (prefiks) => Object.entries(rijeci).filter(([, podaci]) => podaci.prefiks === prefiks).map(([rijec]) => rijec),
    jeIgriva: (rijec, potrosene, vrste) => {
      const podaci = rijeci[rijec];
      return Boolean(
        podaci &&
        podaci.grupe.every((grupa) => !potrosene.has(grupa)) &&
        (!vrste || podaci.vrste.some((vrsta) => vrste.has(vrsta))),
      );
    },
  });
}

describe('skup sigurnih početnih riječi', () => {
  it('seed sadrži 52 odobrene riječi bez kruha i sluha', () => {
    expect(POCETNI_SEED_SIGURNIH_RIJECI).toHaveLength(52);
    expect(SKUP_SIGURNIH_RIJECI).toEqual(POCETNI_SEED_SIGURNIH_RIJECI);
    expect(POCETNI_SEED_SIGURNIH_RIJECI).not.toContain('kruh');
    expect(POCETNI_SEED_SIGURNIH_RIJECI).not.toContain('sluh');
    expect(POCETNI_SEED_SIGURNIH_RIJECI).toEqual(expect.arrayContaining([
      'velik',
      'lijep',
      'loš',
      'suh',
      'gluh',
      'duhovit',
      'jučer',
      'navečer',
      'prekjučer',
      'naprijed',
      'unaprijed',
      'još',
      'blizu',
      'noću',
    ]));
  });

  it('bira pridjev kada je njegova vrsta dopuštena', () => {
    const indeksVelikog = SKUP_SIGURNIH_RIJECI.indexOf('velik');
    const rezultat = odaberiSigurnuPocetnuRijec({
      iskoristeneGrupe: new Set(),
      dopusteneVrste: new Set(['imenica', 'pridjev']),
      nasumicniPomak: indeksVelikog,
      grupeZa: (rijec) => [`test:${rijec}`],
      vrsteZa: (rijec) => (rijec === 'velik' ? ['pridjev'] : rijec === 'ikona' || rijec === 'naranča' ? ['imenica'] : []),
      rijeciNa: (prefiks) => ({ ik: ['ikona'], na: ['naranča'] })[prefiks] ?? [],
      jeIgriva: (rijec, potrosene, vrste) => {
        const vrsta: VrstaRijeci | null = rijec === 'velik' ? 'pridjev' : rijec === 'ikona' || rijec === 'naranča' ? 'imenica' : null;
        return Boolean(vrsta && (!vrste || vrste.has(vrsta)) && !potrosene.has(`test:${rijec}`));
      },
    });

    expect(rezultat).toBe('velik');
  });

  it('bira kandidat kojem svaki prvi odgovor ima daljnji nastavak', () => {
    const rezultat = odaberi({
      šećer: { grupe: ['imenica:šećer'], vrste: ['imenica'], prefiks: 'še' },
      erupcija: { grupe: ['imenica:erupcija'], vrste: ['imenica'], prefiks: 'er' },
      jastuk: { grupe: ['imenica:jastuk'], vrste: ['imenica'], prefiks: 'ja' },
      erodirati: { grupe: ['glagol:erodirati'], vrste: ['glagol'], prefiks: 'er' },
      tipka: { grupe: ['imenica:tipka'], vrste: ['imenica'], prefiks: 'ti' },
    });

    expect(rezultat).toBe('šećer');
  });

  it('odbija kandidat ako jedan legalan prvi odgovor nema nastavak', () => {
    const rezultat = odaberi({
      šećer: { grupe: ['imenica:šećer'], vrste: ['imenica'], prefiks: 'še' },
      erupcija: { grupe: ['imenica:erupcija'], vrste: ['imenica'], prefiks: 'er' },
      jastuk: { grupe: ['imenica:jastuk'], vrste: ['imenica'], prefiks: 'ja' },
      erzz: { grupe: ['imenica:erzz'], vrste: ['imenica'], prefiks: 'er' },
    });

    expect(rezultat).toBeNull();
  });

  it('primjenjuje kategorije i ranije potrošene grupe', () => {
    const rijeci: Record<string, TestnaRijec> = {
      šećer: { grupe: ['imenica:šećer'], vrste: ['imenica'], prefiks: 'še' },
      erupcija: { grupe: ['imenica:erupcija'], vrste: ['imenica'], prefiks: 'er' },
      jastuk: { grupe: ['imenica:jastuk'], vrste: ['imenica'], prefiks: 'ja' },
      erodirati: { grupe: ['glagol:erodirati'], vrste: ['glagol'], prefiks: 'er' },
    };

    expect(odaberi(rijeci, new Set(), new Set(['imenica']))).toBe('šećer');
    expect(odaberi(rijeci, new Set(), new Set(['imenica', 'glagol']))).toBeNull();
    expect(odaberi(rijeci, new Set(['imenica:jastuk']), new Set(['imenica']))).toBeNull();
  });

  it('troši sve grupe višekategorijskog odgovora', () => {
    const rezultat = odaberi({
      šećer: { grupe: ['imenica:šećer'], vrste: ['imenica'], prefiks: 'še' },
      erodiranje: { grupe: ['imenica:erodiranje', 'glagol:erodirati'], vrste: ['imenica', 'glagol'], prefiks: 'er' },
      njiva: { grupe: ['glagol:erodirati'], vrste: ['imenica'], prefiks: 'nje' },
    });

    expect(rezultat).toBeNull();
  });

  it('dopušta sigurnu riječ dulju od šest znakova', () => {
    const prviDugi = SKUP_SIGURNIH_RIJECI.indexOf('sladoled');
    const rezultat = odaberiSigurnuPocetnuRijec({
      iskoristeneGrupe: new Set(),
      nasumicniPomak: prviDugi,
      grupeZa: (rijec) => [`imenica:${rijec}`],
      vrsteZa: (rijec) => (['sladoled', 'edamer', 'ersatz'].includes(rijec) ? ['imenica'] : []),
      rijeciNa: (prefiks) => ({ ed: ['edamer'], er: ['ersatz'] })[prefiks] ?? [],
      jeIgriva: (rijec, potrosene) => ['sladoled', 'edamer', 'ersatz'].includes(rijec) && !potrosene.has(`imenica:${rijec}`),
    });

    expect(rezultat).toBe('sladoled');
  });

  it('seed nema završetak „ka”', () => {
    for (const rijec of POCETNI_SEED_SIGURNIH_RIJECI) {
      expect(nijeSistemskoOtvaranjeNaKa(rijec), rijec).toBe(true);
    }
  });
});

describe('PR02 — sistemsko otvaranje bez „ka”', () => {
  it('nijeSistemskoOtvaranjeNaKa: šećer ok, jabuka/baka ne', () => {
    expect(nijeSistemskoOtvaranjeNaKa('šećer')).toBe(true);
    expect(nijeSistemskoOtvaranjeNaKa('jabuka')).toBe(false);
    expect(nijeSistemskoOtvaranjeNaKa('baka')).toBe(false);
    expect(nijeSistemskoOtvaranjeNaKa('BAKA')).toBe(false);
  });

  it('put 1: odobreni skup bira šećer, preskače baka (na „ka”)', () => {
    // 2-ply: šećer → er → erupcija → ja → jastuk; baka je na „ka” pa se preskače.
    const rezultat = odaberiSigurnuPocetnuRijec({
      iskoristeneGrupe: new Set(),
      nasumicniPomak: 0,
      kandidati: ['baka', 'šećer'],
      grupeZa: (rijec) => [`imenica:${rijec}`],
      vrsteZa: () => ['imenica'],
      rijeciNa: (prefiks) =>
        ({
          er: ['erupcija'],
          ja: ['jastuk'],
          ka: ['kamen'],
        })[prefiks] ?? [],
      jeIgriva: (rijec, potrosene) =>
        ['baka', 'šećer', 'erupcija', 'jastuk', 'kamen'].includes(rijec)
        && !potrosene.has(`imenica:${rijec}`),
    });
    expect(rezultat).toBe('šećer');
  });

  it('put 2: rezervni imenički preskače „ka” i uzima dopuštenog', () => {
    const rezultat = odaberiRezervnuPocetnuRijec({
      kandidati: ['baka', 'med', 'luka'],
      iskoristeneGrupe: new Set(),
      nasumicniPomak: 0,
      jeIgriva: (rijec) => ['baka', 'med', 'luka'].includes(rijec),
      imaSlobodanNastavak: (rijec) => rijec === 'med' || rijec === 'baka' || rijec === 'luka',
    });
    expect(rezultat).toBe('med');
  });

  it('put 3: samo riječi na „ka” → null (RS-27 ulaz)', () => {
    const rezultat = odaberiRezervnuPocetnuRijec({
      kandidati: ['baka', 'luka', 'ruka'],
      iskoristeneGrupe: new Set(),
      nasumicniPomak: 0,
      jeIgriva: () => true,
      imaSlobodanNastavak: () => true,
    });
    expect(rezultat).toBeNull();
  });
});
