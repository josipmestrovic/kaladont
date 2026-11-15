import { describe, expect, it } from 'vitest';
import {
  izracunajBodove,
  javnaSjedalaZaMod,
  jePodrzaniJavniRed,
  jePoznatiMod,
  jePoznatiPravilnik,
  odbijNepodrzaniMod,
  zadaniPravilnik,
  ZADANI_PRAVILNIK,
} from '../src/bodovanje.js';

describe('katalog-partije', () => {
  it('prepoznaje mode i pravilnike', () => {
    expect(jePoznatiMod('tri_igraca')).toBe(true);
    expect(jePoznatiMod('pet_igraca')).toBe(false);
    expect(jePoznatiPravilnik('ka_zna')).toBe(true);
    expect(jePoznatiPravilnik('nepoznato')).toBe(false);
  });

  it('zadani pravilnik je ka_zna i serijalizacija DTO-a ga čuva', () => {
    expect(ZADANI_PRAVILNIK).toBe('ka_zna');
    expect(zadaniPravilnik(undefined)).toBe('ka_zna');
    const dto = { mod: 'dva_igraca' as const, pravila: zadaniPravilnik() };
    expect(JSON.parse(JSON.stringify(dto))).toEqual({ mod: 'dva_igraca', pravila: 'ka_zna' });
  });

  it('javna sjedala i podržani red', () => {
    expect(javnaSjedalaZaMod('dva_igraca')).toBe(2);
    expect(javnaSjedalaZaMod('tri_igraca')).toBe(3);
    expect(javnaSjedalaZaMod('cetiri_igraca')).toBe(4);
    expect(jePodrzaniJavniRed('dva_igraca')).toBe(true);
    expect(jePodrzaniJavniRed('tri_igraca')).toBe(false);
  });

  it('Troboj ima vlastito bodovanje; javni red i stari helper i dalje odbijaju', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'tri_igraca')).toBe(3);
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'dva_igraca')).toBe(1);
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'cetiri_igraca')).toBe(4);
    expect(() => odbijNepodrzaniMod('tri_igraca', 'test')).toThrow(/Troboj/);
  });
});

