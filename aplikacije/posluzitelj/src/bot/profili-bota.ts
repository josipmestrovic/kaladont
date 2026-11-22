/**
 * Verzionirani profili botova za Trening i Izazov (PR02).
 * Javna/privatna i dalje koriste globalni admin/env resolver — ovi profili ih ne diraju.
 */
import {
  jePoznatiProfilBota,
  nadimakProfilaBota,
  ZADANI_PROFIL_TRENINGA,
  type ProfilBotaIzazova,
} from 'zajednicko';
import {
  ZADANA_KONFIGURACIJA_BOTA,
  type KonfiguracijaBota,
} from './konfiguracija-bota.js';

export { nadimakProfilaBota, ZADANI_PROFIL_TRENINGA };

/** Verzija seta profilnih poluga; odvojena od VERZIJA_BOT_POLITIKE. */
export const VERZIJA_PROFILA_BOTA = 2;

/** Poluge iz speka 08 + Dokaži balans v2. */
export interface PolugeProfilaBota {
  vjerojatnostTaktickogPoteza: number;
  vjerojatnostNeznanjaUMalomSkupu: number;
  vjerojatnostPropustaKa: number;
  vjerojatnostOstavljanjaKa: number;
  maksimalnoOpcijaMalogSkupa: number;
  dokaziBudzetDetaljneProvjere: number;
  dokaziBudzetDodatneProvjere: number;
  vjerojatnostDokaziPreskokaPotvrde: number;
  dokaziFaktorPropusaPotvrde: number;
}

export const POLUGE_PROFILA_BOTA: Readonly<Record<ProfilBotaIzazova, PolugeProfilaBota>> = {
  pocetnik: {
    vjerojatnostTaktickogPoteza: 0.1,
    vjerojatnostNeznanjaUMalomSkupu: 0.4,
    vjerojatnostPropustaKa: 0.2,
    vjerojatnostOstavljanjaKa: 0.04,
    maksimalnoOpcijaMalogSkupa: 8,
    dokaziBudzetDetaljneProvjere: 4,
    dokaziBudzetDodatneProvjere: 4,
    vjerojatnostDokaziPreskokaPotvrde: 0.28,
    dokaziFaktorPropusaPotvrde: 0.55,
  },
  iskusni: {
    vjerojatnostTaktickogPoteza: 0.25,
    vjerojatnostNeznanjaUMalomSkupu: 0.18,
    vjerojatnostPropustaKa: 0.08,
    vjerojatnostOstavljanjaKa: 0.015,
    maksimalnoOpcijaMalogSkupa: 5,
    dokaziBudzetDetaljneProvjere: 8,
    dokaziBudzetDodatneProvjere: 8,
    vjerojatnostDokaziPreskokaPotvrde: 0.12,
    dokaziFaktorPropusaPotvrde: 0.3,
  },
  majstor: {
    vjerojatnostTaktickogPoteza: 0.5,
    vjerojatnostNeznanjaUMalomSkupu: 0.08,
    vjerojatnostPropustaKa: 0.04,
    vjerojatnostOstavljanjaKa: 0.008,
    maksimalnoOpcijaMalogSkupa: 3,
    dokaziBudzetDetaljneProvjere: 12,
    dokaziBudzetDodatneProvjere: 12,
    vjerojatnostDokaziPreskokaPotvrde: 0.04,
    dokaziFaktorPropusaPotvrde: 0.12,
  },
  velemajstor: {
    vjerojatnostTaktickogPoteza: 0.75,
    vjerojatnostNeznanjaUMalomSkupu: 0.03,
    vjerojatnostPropustaKa: 0.02,
    vjerojatnostOstavljanjaKa: 0.003,
    maksimalnoOpcijaMalogSkupa: 2,
    dokaziBudzetDetaljneProvjere: 12,
    dokaziBudzetDodatneProvjere: 16,
    vjerojatnostDokaziPreskokaPotvrde: 0,
    dokaziFaktorPropusaPotvrde: 0.05,
  },
};

export interface RazrijesenaKonfiguracijaBota {
  konfiguracija: KonfiguracijaBota;
  profileId: ProfilBotaIzazova;
  botProfileVersion: number;
}

export function razrijesiProfilBota(
  profileId: ProfilBotaIzazova,
  baza: KonfiguracijaBota = ZADANA_KONFIGURACIJA_BOTA,
): RazrijesenaKonfiguracijaBota {
  if (!jePoznatiProfilBota(profileId)) {
    throw new Error(`Nepoznat profil bota: ${String(profileId)}`);
  }
  const poluge = POLUGE_PROFILA_BOTA[profileId];
  const konfiguracija = structuredClone(baza);
  konfiguracija.vjerojatnostTaktickogPoteza = poluge.vjerojatnostTaktickogPoteza;
  konfiguracija.vjerojatnostNeznanjaUMalomSkupu = poluge.vjerojatnostNeznanjaUMalomSkupu;
  konfiguracija.vjerojatnostPropustaKa = poluge.vjerojatnostPropustaKa;
  konfiguracija.vjerojatnostOstavljanjaKa = poluge.vjerojatnostOstavljanjaKa;
  konfiguracija.maksimalnoOpcijaMalogSkupa = poluge.maksimalnoOpcijaMalogSkupa;
  konfiguracija.dokaziBudzetDetaljneProvjere = poluge.dokaziBudzetDetaljneProvjere;
  konfiguracija.dokaziBudzetDodatneProvjere = poluge.dokaziBudzetDodatneProvjere;
  konfiguracija.vjerojatnostDokaziPreskokaPotvrde = poluge.vjerojatnostDokaziPreskokaPotvrde;
  konfiguracija.dokaziFaktorPropusaPotvrde = poluge.dokaziFaktorPropusaPotvrde;
  return {
    konfiguracija,
    profileId,
    botProfileVersion: VERZIJA_PROFILA_BOTA,
  };
}

/** Stari klijent / izostanak → Iskusni. */
export function razrijesiProfilBotaIliZadani(
  profileId: ProfilBotaIzazova | undefined | null,
  baza: KonfiguracijaBota = ZADANA_KONFIGURACIJA_BOTA,
): RazrijesenaKonfiguracijaBota {
  const id = jePoznatiProfilBota(profileId) ? profileId : ZADANI_PROFIL_TRENINGA;
  return razrijesiProfilBota(id, baza);
}
