import { describe, expect, it } from 'vitest';
import {
  MAKSIMALNO_ZVJEZDICA_NASLOVNICA,
  ariaBadgaDostignuca,
  labelaZvjezdicaDostignuca,
  natpisBadgaDostignuca,
  normalizirajZvjezdiceDostignuca,
} from './naslovnica-dostignuca.js';

describe('naslovnica-dostignuca', () => {
  it('ima pozitivni maksimum vidljivih zvjezdica', () => {
    expect(MAKSIMALNO_ZVJEZDICA_NASLOVNICA).toBeGreaterThan(0);
  });

  it('normalizira API sažetak i pada na default maksimum', () => {
    expect(normalizirajZvjezdiceDostignuca({ ukupnoZvjezdica: 3, maksimalnoZvjezdica: 140 })).toEqual({
      ukupno: 3,
      maksimalno: 140,
    });
    expect(normalizirajZvjezdiceDostignuca({})).toEqual({
      ukupno: 0,
      maksimalno: MAKSIMALNO_ZVJEZDICA_NASLOVNICA,
    });
  });

  it('formatira badge i labelu', () => {
    const prikaz = { ukupno: 0, maksimalno: 140 };
    expect(natpisBadgaDostignuca(prikaz)).toBe('0/140');
    expect(labelaZvjezdicaDostignuca(prikaz)).toBe('0/140 zvjezdica');
    expect(ariaBadgaDostignuca(prikaz)).toBe('0 od 140 zvjezdica');
  });
});
