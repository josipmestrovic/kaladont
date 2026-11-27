import { describe, expect, it } from 'vitest';
import { prvaDva, zadnjaDva } from 'zajednicko';
import {
  izgradiSnimkuPoolova,
  jeClanBiloKojegPoola,
  kandidatiPoola,
} from '../src/bot/poolovi-indeks.js';
import { normalizirajPoolRijec, pripremiSeedClanove, validirajBezPreklapanjaPoolova } from '../src/bot/poolovi.js';
import { OCEKIVANI_BROJ_POOL1, OCEKIVANI_BROJ_POOL2 } from '../src/bot/poolovi-seed.js';

describe('taktički poolovi riječi', () => {
  it('seed ima 221 + 174 jedinstvenih normiranih riječi', () => {
    const { pool1, pool2 } = pripremiSeedClanove();
    expect(pool1).toHaveLength(OCEKIVANI_BROJ_POOL1);
    expect(pool2).toHaveLength(OCEKIVANI_BROJ_POOL2);
    expect(OCEKIVANI_BROJ_POOL1).toBe(221);
    expect(OCEKIVANI_BROJ_POOL2).toBe(174);
  });

  it('digrafi: gležanj, imidž, konj nakon normalizacije', () => {
    const gležanj = normalizirajPoolRijec('gležanj');
    const imidž = normalizirajPoolRijec('imidž');
    const konj = normalizirajPoolRijec('konj');

    expect(prvaDva(gležanj)).toBe('gl');
    expect(zadnjaDva(gležanj)).toBe('anj');
    expect(zadnjaDva(imidž)).toBe('idž');
    expect(zadnjaDva(konj)).toBe('onj');
  });

  it('baca ako se poolovi preklapaju nakon normalizacije', () => {
    expect(() => validirajBezPreklapanjaPoolova(['ab'], ['ab'])).toThrow(/pool_1 i pool_2/);
    expect(() => validirajBezPreklapanjaPoolova(['a'], ['b'])).not.toThrow();
  });

  it('izgradiSnimkuPoolova isključuje nerazriješene i neaktivne', () => {
    const snimka = izgradiSnimkuPoolova({
      clanovi: [
        { rijec: 'videa', kategorija: 'pool_1', stanje: 'razrijeseno' },
        { rijec: 'student', kategorija: 'pool_1', stanje: 'nerazrijeseno' },
        { rijec: 'konj', kategorija: 'pool_2', stanje: 'razrijeseno' },
        { rijec: 'pištolj', kategorija: 'pool_2', stanje: 'razrijeseno' },
      ],
      jeAktivnaURjecnika: (rijec) => rijec !== 'pištolj',
      verzijaRjecnika: 3,
      generacija: 1,
    });

    expect(snimka.clanovi.has('videa')).toBe(true);
    expect(snimka.clanovi.has('student')).toBe(false);
    expect(snimka.clanovi.has('konj')).toBe(true);
    expect(snimka.clanovi.has('pištolj')).toBe(false);
    expect(kandidatiPoola(snimka, 'vi', 'pool_1')).toContain('videa');
    expect(kandidatiPoola(snimka, 'ko', 'pool_2')).toContain('konj');
  });

  it('jeClanBiloKojegPoola prati aktivne razriješene članove', () => {
    const snimka = izgradiSnimkuPoolova({
      clanovi: [
        { rijec: 'videa', kategorija: 'pool_1', stanje: 'razrijeseno' },
        { rijec: 'konj', kategorija: 'pool_2', stanje: 'razrijeseno' },
      ],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    expect(jeClanBiloKojegPoola(snimka, 'videa')).toBe(true);
    expect(jeClanBiloKojegPoola(snimka, 'Konj')).toBe(true);
    expect(jeClanBiloKojegPoola(snimka, 'nema')).toBe(false);
  });
});