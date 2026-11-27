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
  type PrioritetPoolova,
} from './konfiguracija-bota.js';

export { nadimakProfilaBota, ZADANI_PROFIL_TRENINGA };

/** Verzija seta profilnih poluga; odvojena od VERZIJA_BOT_POLITIKE. */
export const VERZIJA_PROFILA_BOTA = 3;

/** Poluge iz speka Botovi V8 C10. */
export interface PolugeProfilaBota {
  vjerojatnostAgresivnosti: number;
  vjerojatnostShielda: number;
  prioritetPoolova: PrioritetPoolova;
  vjerojatnostNeznanjaUMalomSkupu: number;
  maksimalnoOpcijaMalogSkupa: number;
}

export const POLUGE_PROFILA_BOTA: Readonly<Record<ProfilBotaIzazova, PolugeProfilaBota>> = {
  pocetnik: {
    vjerojatnostAgresivnosti: 0,
    vjerojatnostShielda: 0,
    prioritetPoolova: 'p2_p1',
    vjerojatnostNeznanjaUMalomSkupu: 0.4,
    maksimalnoOpcijaMalogSkupa: 8,
  },
  iskusni: {
    vjerojatnostAgresivnosti: 0.3,
    vjerojatnostShielda: 0.3,
    prioritetPoolova: 'p2_p1',
    vjerojatnostNeznanjaUMalomSkupu: 0.18,
    maksimalnoOpcijaMalogSkupa: 5,
  },
  majstor: {
    vjerojatnostAgresivnosti: 0.6,
    vjerojatnostShielda: 0.75,
    prioritetPoolova: 'p1_p2',
    vjerojatnostNeznanjaUMalomSkupu: 0.08,
    maksimalnoOpcijaMalogSkupa: 3,
  },
  velemajstor: {
    vjerojatnostAgresivnosti: 1,
    vjerojatnostShielda: 1,
    prioritetPoolova: 'p1_p2',
    vjerojatnostNeznanjaUMalomSkupu: 0.03,
    maksimalnoOpcijaMalogSkupa: 2,
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
  konfiguracija.vjerojatnostAgresivnosti = poluge.vjerojatnostAgresivnosti;
  konfiguracija.vjerojatnostShielda = poluge.vjerojatnostShielda;
  konfiguracija.prioritetPoolova = poluge.prioritetPoolova;
  konfiguracija.vjerojatnostNeznanjaUMalomSkupu = poluge.vjerojatnostNeznanjaUMalomSkupu;
  konfiguracija.maksimalnoOpcijaMalogSkupa = poluge.maksimalnoOpcijaMalogSkupa;
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