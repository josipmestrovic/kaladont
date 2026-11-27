import { describe, expect, it } from 'vitest';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import {
  nadimakProfilaBota,
  POLUGE_PROFILA_BOTA,
  razrijesiProfilBota,
  razrijesiProfilBotaIliZadani,
  VERZIJA_PROFILA_BOTA,
} from '../src/bot/profili-bota.js';

describe('profili bota (PR02)', () => {
  it('profil v3 i Iskusni agresivnost/shield parity s ZADANA', () => {
    const { konfiguracija, profileId, botProfileVersion } = razrijesiProfilBota('iskusni');
    expect(profileId).toBe('iskusni');
    expect(botProfileVersion).toBe(VERZIJA_PROFILA_BOTA);
    expect(VERZIJA_PROFILA_BOTA).toBe(3);
    expect(konfiguracija.vjerojatnostAgresivnosti).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostAgresivnosti);
    expect(konfiguracija.vjerojatnostShielda).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostShielda);
    expect(POLUGE_PROFILA_BOTA.iskusni).toEqual({
      vjerojatnostAgresivnosti: 0.3,
      vjerojatnostShielda: 0.3,
      prioritetPoolova: 'p2_p1',
      vjerojatnostNeznanjaUMalomSkupu: 0.18,
      maksimalnoOpcijaMalogSkupa: 5,
    });
  });

  it('profili se razlikuju monotono i ne mutiraju ZADANA', () => {
    const prije = { ...ZADANA_KONFIGURACIJA_BOTA };
    const pocetnik = razrijesiProfilBota('pocetnik').konfiguracija;
    const iskusni = razrijesiProfilBota('iskusni').konfiguracija;
    const majstor = razrijesiProfilBota('majstor').konfiguracija;
    const velemajstor = razrijesiProfilBota('velemajstor').konfiguracija;

    expect(pocetnik.vjerojatnostAgresivnosti).toBe(0);
    expect(pocetnik.vjerojatnostShielda).toBe(0);
    expect(velemajstor.vjerojatnostAgresivnosti).toBe(1);
    expect(velemajstor.vjerojatnostShielda).toBe(1);
    expect(iskusni.prioritetPoolova).toBe('p2_p1');
    expect(majstor.prioritetPoolova).toBe('p1_p2');

    expect(pocetnik.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(iskusni.vjerojatnostNeznanjaUMalomSkupu);
    expect(iskusni.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(majstor.vjerojatnostNeznanjaUMalomSkupu);
    expect(majstor.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(velemajstor.vjerojatnostNeznanjaUMalomSkupu);

    expect(pocetnik.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(iskusni.maksimalnoOpcijaMalogSkupa);
    expect(iskusni.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(majstor.maksimalnoOpcijaMalogSkupa);
    expect(majstor.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(velemajstor.maksimalnoOpcijaMalogSkupa);

    expect(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostAgresivnosti).toBe(prije.vjerojatnostAgresivnosti);
    expect(pocetnik.trajanjePotezaBotaMs).toBe(ZADANA_KONFIGURACIJA_BOTA.trajanjePotezaBotaMs);
  });

  it('javni ZADANA nema uklonjena Dokaži polja', () => {
    expect('dokaziBudzetDetaljneProvjere' in ZADANA_KONFIGURACIJA_BOTA).toBe(false);
    expect('dokaziBudzetDodatneProvjere' in ZADANA_KONFIGURACIJA_BOTA).toBe(false);
    expect('vjerojatnostDokaziPreskokaPotvrde' in ZADANA_KONFIGURACIJA_BOTA).toBe(false);
    expect('dokaziFaktorPropusaPotvrde' in ZADANA_KONFIGURACIJA_BOTA).toBe(false);
  });

  it('izostanak profileId → Iskusni; nepoznat id baca', () => {
    expect(razrijesiProfilBotaIliZadani(undefined).profileId).toBe('iskusni');
    expect(razrijesiProfilBotaIliZadani(null).profileId).toBe('iskusni');
    expect(() => razrijesiProfilBota('nepoznat' as 'iskusni')).toThrow(/Nepoznat profil/);
  });

  it('nadimci: fiksna postava po težini i 1-based indeksu', () => {
    expect(nadimakProfilaBota('majstor', 1, 1)).toBe('BOTOKRAT');
    expect(nadimakProfilaBota('majstor', 1, 3)).toBe('BOTOKRAT');
    expect(nadimakProfilaBota('majstor', 2, 3)).toBe('SABOTER');
    expect(nadimakProfilaBota('pocetnik', 2, 2)).toBe('BOTULJAK');
    expect(nadimakProfilaBota('velemajstor', 3, 3)).toBe('BOTIVZAUBOJSTVO');
  });

  it('snapshot je neovisan o kasnijoj mutaciji baze', () => {
    const baza = structuredClone(ZADANA_KONFIGURACIJA_BOTA);
    const { konfiguracija } = razrijesiProfilBota('majstor', baza);
    baza.vjerojatnostAgresivnosti = 0.99;
    expect(konfiguracija.vjerojatnostAgresivnosti).toBe(0.6);
  });
});