import { describe, expect, it } from 'vitest';
import { jeDopustenaTestnaIp, OgranicivacDogadaja } from '../src/sigurnost/socket-ogranicenja.js';

describe('socket ograničenja', () => {
  it('dopušta najviše zadan broj događaja u prozoru', () => {
    const ogranicivac = new OgranicivacDogadaja(1_000);

    expect(ogranicivac.dopusti('igrac:stanje', 2, 10)).toBe(true);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 20)).toBe(true);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 30)).toBe(false);
    expect(ogranicivac.dopusti('igrac:stanje', 2, 1_011)).toBe(true);
  });

  it('dopušta testnu IP adresu samo u stagingu i uz točno podudaranje', () => {
    expect(jeDopustenaTestnaIp('staging', '203.0.113.10', '203.0.113.10')).toBe(true);
    expect(jeDopustenaTestnaIp('production', '203.0.113.10', '203.0.113.10')).toBe(false);
    expect(jeDopustenaTestnaIp('staging', '203.0.113.10', '203.0.113.11')).toBe(false);
    expect(jeDopustenaTestnaIp('staging', '', '203.0.113.10')).toBe(false);
  });
});