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
  it('profil v2 i Iskusni KA/taktika parity s ZADANA', () => {
    const { konfiguracija, profileId, botProfileVersion } = razrijesiProfilBota('iskusni');
    expect(profileId).toBe('iskusni');
    expect(botProfileVersion).toBe(VERZIJA_PROFILA_BOTA);
    expect(VERZIJA_PROFILA_BOTA).toBe(2);
    expect(konfiguracija.vjerojatnostTaktickogPoteza).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostTaktickogPoteza);
    expect(konfiguracija.vjerojatnostPropustaKa).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostPropustaKa);
    expect(konfiguracija.vjerojatnostOstavljanjaKa).toBe(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostOstavljanjaKa);
    expect(POLUGE_PROFILA_BOTA.iskusni).toEqual({
      vjerojatnostTaktickogPoteza: 0.25,
      vjerojatnostNeznanjaUMalomSkupu: 0.18,
      vjerojatnostPropustaKa: 0.08,
      vjerojatnostOstavljanjaKa: 0.015,
      maksimalnoOpcijaMalogSkupa: 5,
      dokaziBudzetDetaljneProvjere: 8,
      dokaziBudzetDodatneProvjere: 8,
      vjerojatnostDokaziPreskokaPotvrde: 0.12,
      dokaziFaktorPropusaPotvrde: 0.3,
    });
  });

  it('profili se razlikuju monotono i ne mutiraju ZADANA', () => {
    const prije = { ...ZADANA_KONFIGURACIJA_BOTA };
    const pocetnik = razrijesiProfilBota('pocetnik').konfiguracija;
    const iskusni = razrijesiProfilBota('iskusni').konfiguracija;
    const majstor = razrijesiProfilBota('majstor').konfiguracija;
    const velemajstor = razrijesiProfilBota('velemajstor').konfiguracija;

    expect(pocetnik.vjerojatnostTaktickogPoteza).toBe(0.1);
    expect(velemajstor.vjerojatnostTaktickogPoteza).toBe(0.75);

    expect(pocetnik.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(iskusni.vjerojatnostNeznanjaUMalomSkupu);
    expect(iskusni.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(majstor.vjerojatnostNeznanjaUMalomSkupu);
    expect(majstor.vjerojatnostNeznanjaUMalomSkupu).toBeGreaterThan(velemajstor.vjerojatnostNeznanjaUMalomSkupu);

    expect(pocetnik.dokaziFaktorPropusaPotvrde).toBeGreaterThan(iskusni.dokaziFaktorPropusaPotvrde);
    expect(iskusni.dokaziFaktorPropusaPotvrde).toBeGreaterThan(majstor.dokaziFaktorPropusaPotvrde);
    expect(majstor.dokaziFaktorPropusaPotvrde).toBeGreaterThan(velemajstor.dokaziFaktorPropusaPotvrde);

    expect(pocetnik.vjerojatnostDokaziPreskokaPotvrde).toBeGreaterThan(iskusni.vjerojatnostDokaziPreskokaPotvrde);
    expect(iskusni.vjerojatnostDokaziPreskokaPotvrde).toBeGreaterThan(majstor.vjerojatnostDokaziPreskokaPotvrde);
    expect(majstor.vjerojatnostDokaziPreskokaPotvrde).toBeGreaterThan(velemajstor.vjerojatnostDokaziPreskokaPotvrde);

    expect(pocetnik.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(iskusni.maksimalnoOpcijaMalogSkupa);
    expect(iskusni.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(majstor.maksimalnoOpcijaMalogSkupa);
    expect(majstor.maksimalnoOpcijaMalogSkupa).toBeGreaterThan(velemajstor.maksimalnoOpcijaMalogSkupa);

    expect(pocetnik.dokaziBudzetDetaljneProvjere).toBeLessThan(iskusni.dokaziBudzetDetaljneProvjere);
    expect(iskusni.dokaziBudzetDetaljneProvjere).toBeLessThanOrEqual(majstor.dokaziBudzetDetaljneProvjere);

    expect(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostTaktickogPoteza).toBe(prije.vjerojatnostTaktickogPoteza);
    expect(pocetnik.maksimalnoTaktickihKandidata).toBe(12);
    expect(velemajstor.maksimalnoTaktickihKandidata).toBe(12);
    expect(pocetnik.trajanjePotezaBotaMs).toBe(ZADANA_KONFIGURACIJA_BOTA.trajanjePotezaBotaMs);
  });

  it('javni ZADANA ostaje strog na Dokaži polugama', () => {
    expect(ZADANA_KONFIGURACIJA_BOTA.vjerojatnostDokaziPreskokaPotvrde).toBe(0);
    expect(ZADANA_KONFIGURACIJA_BOTA.dokaziFaktorPropusaPotvrde).toBe(0);
    expect(ZADANA_KONFIGURACIJA_BOTA.dokaziBudzetDetaljneProvjere).toBe(12);
    expect(ZADANA_KONFIGURACIJA_BOTA.dokaziBudzetDodatneProvjere).toBe(12);
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
