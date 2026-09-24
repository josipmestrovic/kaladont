import { describe, expect, it } from 'vitest';
import { OgranicivacDogadaja } from '../src/sigurnost/socket-ogranicenja.js';

describe('socket ograničenja', () => {
  it('dopušta najviše zadan broj događaja u prozoru', () => {
    const ogranicivac = new OgranicivacDogadaja(1_000);

    expect(ogranicivac.dopusti('igrac:stanje', 2, 10)).toBe(true);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 20)).toBe(true);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 30)).toBe(false);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 1_011)).toBe(true);
  });
});