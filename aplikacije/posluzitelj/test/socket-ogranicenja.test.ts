import { describe, expect, it } from 'vitest';
import { dohvatiIpKlijenta, jeDopustenaTestnaIp, OgranicivacDogadaja } from '../src/sigurnost/socket-ogranicenja.js';
import { obradiLeaseStaginga } from '../src/sigurnost/staging-opterecenja.js';

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

  it('ignorira testno IP zaglavlje u produkciji i bez pouzdanog proxyja', () => {
    expect(dohvatiIpKlijenta('production', '203.0.113.99', '203.0.113.10', '10.0.0.2')).toBe('203.0.113.10');
    expect(dohvatiIpKlijenta('production', '203.0.113.99', undefined, '10.0.0.2')).toBe('10.0.0.2');
    expect(dohvatiIpKlijenta('test', '203.0.113.99', '203.0.113.99', '10.0.0.2')).toBe('10.0.0.2');
    expect(dohvatiIpKlijenta('staging', '203.0.113.10', '10.0.0.2', '172.20.0.3')).toBe('203.0.113.10');
  });

  it('štiti staging lease od drugog runId-a i dopušta preuzimanje nakon isteka', () => {
    const prvi = obradiLeaseStaginga(null, { akcija: 'acquire', runId: 'run-a' }, 1_000, 30_000);
    expect(prvi.lease?.istjeceU).toBe(31_000);

    const drugiPokusaj = obradiLeaseStaginga(prvi.lease, { akcija: 'acquire', runId: 'run-b' }, 2_000, 30_000);
    expect(drugiPokusaj.uspio).toBe(false);
    expect(drugiPokusaj.zauzet).toBe(true);

    const tudjeOslobadanje = obradiLeaseStaginga(prvi.lease, { akcija: 'release', runId: 'run-b' }, 2_000, 30_000);
    expect(tudjeOslobadanje.lease?.runId).toBe('run-a');

    const nakonIsteka = obradiLeaseStaginga(prvi.lease, { akcija: 'acquire', runId: 'run-b' }, 31_001, 30_000);
    expect(nakonIsteka.lease?.runId).toBe('run-b');
  });
});