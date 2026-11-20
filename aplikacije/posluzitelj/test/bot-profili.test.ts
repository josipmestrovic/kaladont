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
  it('Iskusni je parity s ZADANA na četiri poluge', () => {
    const { konfiguracija, profileId, botProfileVersion } = razrijesiProfilBota('iskusni');
    expect(profileId).toBe('iskusni');
    expect(botProfileVersion).toBe(VERZIJA_PROFILA_BOTA);
    expect(konfiguracija.vjerojatnostTaktickogPoteza).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostTaktickogPoteza);
    expect(konfiguracija.vjerojatnostNeznanjaUMalomSkupu).toBe(
      ZADANA_KONFIGURACIJA_BOTA.vjerojatnostNeznanjaUMalomSkupu,
    );
    expect(konfiguracija.vjerojatnostPropustaKa).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostPropustaKa);
    expect(konfiguracija.vjerojatnostOstavljanjaKa).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostOstavljanjaKa);
    expect(POLUGE_PROFILA_BOTA.iskusni).toEqual({
      vjerojatnostTaktickogPoteza: 0.25,
      vjerojatnostNeznanjaUMalomSkupu: 0.1,
      vjerojatnostPropustaKa: 0.08,
      vjerojatnostOstavljanjaKa: 0.015,
    });
  });

  it('profili se razlikuju i ne mutiraju ZADANA', () => {
    const prije = { ...ZADANA_KONFIGURACIJA_BOTA };
    const pocetnik = razrijesiProfilBota('pocetnik').konfiguracija;
    const velemajstor = razrijesiProfilBota('velemajstor').konfiguracija;
    expect(pocetnik.vjerojatnostTaktickogPoteza).toBe(0.1);
    expect(velemajstor.vjerojatnostTaktickogPoteza).toBe(0.75);
    expect(pocetnik.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(
      velemajstor.vjerojatnostNeznanjaUMalomSkupu,
    );
    expect(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostTaktickogPoteza).toBe(prije.vjerojatnostTaktickogPoteza);
    // Compute limiti ostaju isti.
    expect(pocetnik.maksimalnoTaktickihKandidata).toBe(12);
    expect(velemajstor.maksimalnoTaktickihKandidata).toBe(12);
    expect(pocetnik.trajanjePotezaBotaMs).toBe(ZADANA_KONFIGURACIJA_BOTA.trajanjePotezaBotaMs);
  });

  it('izostanak profileId → Iskusni; nepoznat id baca', () => {
    expect(razrijesiProfilBotaIliZadani(undefined).profileId).toBe('iskusni');
    expect(razrijesiProfilBotaIliZadani(null).profileId).toBe('iskusni');
    expect(() => razrijesiProfilBota('nepoznat' as 'iskusni')).toThrow(/Nepoznat profil/);
  });

  it('nadimci: jedan bez broja, više s brojem', () => {
    expect(nadimakProfilaBota('majstor', 1, 1)).toBe('Majstor');
    expect(nadimakProfilaBota('majstor', 1, 3)).toBe('Majstor 1');
    expect(nadimakProfilaBota('pocetnik', 2, 2)).toBe('Početnik 2');
  });

  it('snapshot je neovisan o kasnijoj mutaciji baze', () => {
    const baza = structuredClone(ZADANA_KONFIGURACIJA_BOTA);
    const { konfiguracija } = razrijesiProfilBota('majstor', baza);
    baza.vjerojatnostTaktickogPoteza = 0.99;
    expect(konfiguracija.vjerojatnostTaktickogPoteza).toBe(0.5);
  });
});
