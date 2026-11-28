/**
 * Verzionirani profili botova za Trening i Izazov (PR02).
 * Javna Brza forsira Iskusni poluge (`konfiguracijaZaJavnuBrzu`); privatne sobe
 * i dalje koriste globalni admin/env resolver.
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
    vjerojatnostShielda: 0.6,
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

/**
 * Javna Brza: uvijek Iskusni poluge (agresivnost/Shield/prioritet/neznanje),
 * ostalo (tempo, popuna, …) ostaje iz admin/env baze.
 */
export function konfiguracijaZaJavnuBrzu(
  baza: KonfiguracijaBota = ZADANA_KONFIGURACIJA_BOTA,
): KonfiguracijaBota {
  return razrijesiProfilBota('iskusni', baza).konfiguracija;
}

/** Analitička klasifikacija: imenovani profil ili prilagođeno (bez lažnog defaulta na iskusni). */
export type ProfilAnalitikeBotova =
  | ProfilBotaIzazova
  | 'prilagodeno';

export interface SnimkaBotAnalitike {
  profil: ProfilAnalitikeBotova;
  verzijaPolitike: number;
  verzijaProfila: number | null;
}

/** Točno podudaranje pet poluga profila; inače prilagodeno. */
export function klasificirajProfilIzKonfiguracije(konfig: KonfiguracijaBota): SnimkaBotAnalitike {
  for (const [id, poluge] of Object.entries(POLUGE_PROFILA_BOTA) as Array<
    [ProfilBotaIzazova, PolugeProfilaBota]
  >) {
    if (
      poluge.vjerojatnostAgresivnosti === konfig.vjerojatnostAgresivnosti
      && poluge.vjerojatnostShielda === konfig.vjerojatnostShielda
      && poluge.prioritetPoolova === konfig.prioritetPoolova
      && poluge.vjerojatnostNeznanjaUMalomSkupu === konfig.vjerojatnostNeznanjaUMalomSkupu
      && poluge.maksimalnoOpcijaMalogSkupa === konfig.maksimalnoOpcijaMalogSkupa
    ) {
      return {
        profil: id,
        verzijaPolitike: konfig.verzija,
        verzijaProfila: VERZIJA_PROFILA_BOTA,
      };
    }
  }
  return {
    profil: 'prilagodeno',
    verzijaPolitike: konfig.verzija,
    verzijaProfila: null,
  };
}

export function snimkaBotAnalitikeIzRazrijesenog(
  razrijeseno: RazrijesenaKonfiguracijaBota,
): SnimkaBotAnalitike {
  return {
    profil: razrijeseno.profileId,
    verzijaPolitike: razrijeseno.konfiguracija.verzija,
    verzijaProfila: razrijeseno.botProfileVersion,
  };
}