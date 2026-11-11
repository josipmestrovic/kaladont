import { describe, expect, it } from 'vitest';
import {
  DOPUSTENA_SLOVA_RIJECI,
  grafemi,
  jeDopustenOblikRijeci,
  prvaDva,
  zadnjaDva,
} from '../src/grafemi.js';

describe('jeDopustenOblikRijeci', () => {
  it('prihvaća hrvatske oblike', () => {
    expect(jeDopustenOblikRijeci('auto')).toBe(true);
    expect(jeDopustenOblikRijeci('kuća')).toBe(true);
  });

  it('odbija strana slova, crtice, brojke i velika slova', () => {
    expect(jeDopustenOblikRijeci('taxi')).toBe(false);
    expect(jeDopustenOblikRijeci('whisky')).toBe(false);
    expect(jeDopustenOblikRijeci('test-1')).toBe(false);
    expect(jeDopustenOblikRijeci('Foo')).toBe(false);
    expect(DOPUSTENA_SLOVA_RIJECI.test('Foo')).toBe(false);
  });
});

describe('grafemi', () => {
  it('parsira digraf nj pohlepno', () => {
    expect(grafemi('konj')).toEqual(['k', 'o', 'nj']);
  });

  it('parsira digraf lj pohlepno', () => {
    expect(grafemi('kralj')).toEqual(['k', 'r', 'a', 'lj']);
  });

  it('parsira digraf dž pohlepno', () => {
    expect(grafemi('bedž')).toEqual(['b', 'e', 'dž']);
  });

  it('koristi iznimku za injekciju (in, ne inj)', () => {
    expect(grafemi('injekcija')).toEqual(['i', 'n', 'j', 'e', 'k', 'c', 'i', 'j', 'a']);
  });

  it('zadnjaDva("kaladont") = nt (mrtav par)', () => {
    expect(zadnjaDva('kaladont')).toBe('nt');
  });

  it('zadnjaDva("kralj") = alj, poklapa se s prvaDva("aljkavost")', () => {
    expect(zadnjaDva('kralj')).toBe('alj');
    expect(prvaDva('aljkavost')).toBe('alj');
  });

  it('prvaDva("džamija") = dža', () => {
    expect(prvaDva('džamija')).toBe('dža');
  });

  it('prvaDva("ljubav") = lju', () => {
    expect(prvaDva('ljubav')).toBe('lju');
  });

  it('dvografemska riječ: zadnjaDva("uš") = uš', () => {
    expect(zadnjaDva('uš')).toBe('uš');
  });
});
