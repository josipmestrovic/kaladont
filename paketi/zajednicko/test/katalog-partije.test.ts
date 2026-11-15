import { describe, expect, it } from 'vitest';
import {
  izracunajBodove,
  javnaSjedalaZaMod,
  jePodrzaniJavniRed,
  jePoznatiMod,
  jePoznatiPravilnik,
  kanonskaPravilaZaKljuc,
  KLJUCEVI_JAVNOG_REDA,
  kljucJavnogReda,
  MODOVI_PARTIJE,
  odbijNepodrzaniMod,
  PRAVILNICI_PARTIJE,
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

  it('javna sjedala i podržani red (PR06: Troboj je u javnom redu)', () => {
    expect(javnaSjedalaZaMod('dva_igraca')).toBe(2);
    expect(javnaSjedalaZaMod('tri_igraca')).toBe(3);
    expect(javnaSjedalaZaMod('cetiri_igraca')).toBe(4);
    expect(jePodrzaniJavniRed('dva_igraca')).toBe(true);
    expect(jePodrzaniJavniRed('tri_igraca')).toBe(true);
    expect(jePodrzaniJavniRed('cetiri_igraca')).toBe(true);
  });

  it('matrica 9 UI izbora → 8 ključeva reda', () => {
    const kljucevi = new Set<string>();
    for (const mod of MODOVI_PARTIJE) {
      for (const pravila of PRAVILNICI_PARTIJE) {
        kljucevi.add(kljucJavnogReda(mod, pravila));
      }
    }
    expect(kljucevi.size).toBe(8);
    expect([...kljucevi].sort()).toEqual([...KLJUCEVI_JAVNOG_REDA].sort());
    expect(kljucJavnogReda('dva_igraca', 'klasicni')).toBe('2-zajednicki');
    expect(kljucJavnogReda('dva_igraca', 'ka_zna')).toBe('2-zajednicki');
    expect(kljucJavnogReda('dva_igraca', 'dokazi_nastavak')).toBe('2-dokaz');
    expect(kanonskaPravilaZaKljuc('2-zajednicki')).toEqual({
      mod: 'dva_igraca',
      pravila: 'ka_zna',
      spojeniDvoboj: true,
    });
    expect(kanonskaPravilaZaKljuc('3-dokaz').spojeniDvoboj).toBe(false);
  });

  it('Troboj ima vlastito bodovanje; stari helper i dalje odbija Troboj van javnog reda', () => {
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'tri_igraca')).toBe(3);
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'dva_igraca')).toBe(1);
    expect(izracunajBodove({ plasman: 1, eliminacije: 0 }, 'cetiri_igraca')).toBe(4);
    expect(() => odbijNepodrzaniMod('tri_igraca', 'test')).toThrow(/Troboj/);
  });
});

