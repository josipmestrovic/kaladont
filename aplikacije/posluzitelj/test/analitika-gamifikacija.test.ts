/**
 * Integracijski testovi gamifikacije (zahtijevaju BAZA_URL + ANALITIKA_U_TESTU).
 * Ne pokretati prema razvojnoj bazi — namijenjeni izoliranom CI / lokalnoj testnoj bazi.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { agregirajGamifikaciju } from '../src/analitika/gamifikacija.js';
import { danasZagrebIso } from '../src/analitika/otvaranja.js';

describe('analitika gamifikacije — agregat', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  it('prazan raspon / daleko u budućnosti vraća nulte metrike razdoblja', async () => {
    const daleko = '2099-09-01';
    const agregat = await agregirajGamifikaciju({ odDan: daleko, doDan: daleko });
    expect(agregat.razdoblje.misije.dnevne.dodijeljene).toBe(0);
    expect(agregat.razdoblje.misije.tjedne.dodijeljene).toBe(0);
    expect(agregat.razdoblje.xpMisija.brojNagrada).toBe(0);
    expect(agregat.razdoblje.xpIzazova.prviUspjesi).toBe(0);
    expect(agregat.razdoblje.zamjene.ukupno).toBe(0);
    expect(agregat.trenutacniPresjek.oznaka).toBe('trenutacno');
    expect(agregat.vremenskaZona).toBe('Europe/Zagreb');
  });

  it('trenutačni presjek postoji neovisno o praznom razdoblju', async () => {
    const agregat = await agregirajGamifikaciju({
      odDan: '2099-09-01',
      doDan: '2099-09-01',
    });
    expect(agregat.trenutacniPresjek.bazaIgraca).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(agregat.trenutacniPresjek.xpRazine.poRasponu)).toBe(true);
    expect(Array.isArray(agregat.trenutacniPresjek.dostignuca.poDostignucu)).toBe(true);
    // Stabilan smoke: danasZagrebIso ne ovisi o UUID-u.
    expect(danasZagrebIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(randomUUID()).toBeTruthy();
  });
});
