import { PORUKE } from './poruke.js';
import { prvaDva } from './grafemi.js';

/** Posebne rijeci s jedinstvenim efektom (pravila-igre.md) - izuzete od provjere postojanja u bazi i od potrosnje leksemskih grupa. */
export const RIJECI_KALADONT: ReadonlySet<string> = new Set(['kaladont', 'kalodont']);

/** Kategorije rijeci u igri (ADR-013). */
export type VrstaRijeci =
  | 'imenica'
  | 'glagol'
  | 'pridjev'
  | 'prilog'
  | 'zamjenica'
  | 'broj'
  | 'prijedlog'
  | 'veznik'
  | 'cestica'
  | 'uzvik';

export const SVE_VRSTE_RIJECI: readonly VrstaRijeci[] = [
  'imenica',
  'glagol',
  'pridjev',
  'prilog',
  'zamjenica',
  'broj',
  'prijedlog',
  'veznik',
  'cestica',
  'uzvik',
];

export type StupanjRijeci = 'poz' | 'komp' | 'sup';

/** Kljuc leksemske grupe (ADR-013): vrsta:lema, za pridjeve i priloge vrsta:lema:stupanj. */
export function kljucGrupe(vrsta: VrstaRijeci, lema: string, stupanj?: StupanjRijeci): string {
  if (vrsta === 'pridjev' || vrsta === 'prilog') {
    return `${vrsta}:${lema}:${stupanj ?? 'poz'}`;
  }
  return `${vrsta}:${lema}`;
}

/** Sučelje prema rječniku - implementira ga poslužitelj (strukture u memoriji, ADR-007 + ADR-013). */
export interface RjecnikSucelje {
  /** Postoji li riječ u bazi (aktivna, neovisno o potrošenosti u partiji). */
  jePostojecaRijec(rijec: string): boolean;
  /** Leksemske grupe kojima oblik pripada; prazan niz ako riječ nije u bazi. */
  grupeZa(rijec: string): readonly string[];
  /** Vrste riječi kojima oblik pripada (npr. ['imenica']). */
  vrsteZa?(rijec: string): readonly VrstaRijeci[];
  /** Je li riječ osnovni oblik (nominativ imenice/pridjeva/zamjenice/broja ili infinitiv glagola). */
  jeOsnovniOblik?(rijec: string): boolean;
  /** Postoji li ikoja aktivna riječ u bazi koja počinje na ova dva grafema. */
  postojeRijeciNa(dvaGrafema: string): boolean;
  /** Postoji li još igriva riječ (nijedna njena grupa potrošena) koja počinje na ova dva grafema. */
  imaSlobodnuRijecNa(
    dvaGrafema: string,
    iskoristeneGrupe: ReadonlySet<string>,
    dopusteneVrste?: ReadonlySet<VrstaRijeci>,
    samoOsnovniOblici?: boolean,
    minDuljinaRijeci?: number,
  ): boolean;
  /** Nasumična igriva imenička lema u nominativu kraća od 6 znakova sa slobodnim nastavkom (otvaranje runde). */
  nasumicnaPocetnaImenickaRijec(
    iskoristeneGrupe: ReadonlySet<string>,
    dopusteneVrste?: ReadonlySet<VrstaRijeci>,
    samoOsnovniOblici?: boolean,
    minDuljinaRijeci?: number,
  ): string | null;
}

export type KodOdbijenogPoteza =
  | 'RIJEC_NE_POSTOJI'
  | 'KRIVA_SLOVA'
  | 'RIJEC_ISKORISTENA'
  | 'NEDOPUSTENA_VRSTA'
  | 'NIJE_OSNOVNI_OBLIK'
  | 'PREKRATKA_RIJEC';

export interface RezultatValidacije {
  valjano: boolean;
  kod?: KodOdbijenogPoteza;
  poruka?: string;
}

export interface ParametriValidacije {
  rijec: string;
  trazenaSlova: string;
  /** Leksemske grupe potrošene u ovoj partiji (RS-28/RS-29). */
  iskoristeneGrupe: ReadonlySet<string>;
  /** Grupa -> oblik koji ju je potrošio (za specifičnu poruku odbijanja). */
  potrosioGrupu: ReadonlyMap<string, string>;
  /** Prilagođeni skup dopuštenih vrsta riječi u privatnoj sobi. Ako nije zadan, dopuštene su sve. */
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  samoOsnovniOblici?: boolean;
  minDuljinaRijeci?: number;
  rjecnik: RjecnikSucelje;
}

/** Validira potez prema pravilima igre (pravila-igre.md). Server je jedini autoritet. */
export function validirajPotez(params: ParametriValidacije): RezultatValidacije {
  const rijecNormalizirana = params.rijec.normalize('NFC').trim().toLowerCase();
  const jePosebnaRijec = RIJECI_KALADONT.has(rijecNormalizirana);

  if (!jePosebnaRijec && !params.rjecnik.jePostojecaRijec(rijecNormalizirana)) {
    return { valjano: false, kod: 'RIJEC_NE_POSTOJI', poruka: PORUKE.rijecNePostoji };
  }

  if (prvaDva(rijecNormalizirana) !== params.trazenaSlova) {
    return { valjano: false, kod: 'KRIVA_SLOVA', poruka: PORUKE.krivaSlova(params.trazenaSlova) };
  }

  if (!jePosebnaRijec) {
    if (params.minDuljinaRijeci && params.minDuljinaRijeci > 0) {
      if (rijecNormalizirana.length < params.minDuljinaRijeci) {
        return {
          valjano: false,
          kod: 'PREKRATKA_RIJEC',
          poruka: PORUKE.prekratkaRijec(params.minDuljinaRijeci),
        };
      }
    }

    if (params.dopusteneVrste && params.rjecnik.vrsteZa) {
      const vrste = params.rjecnik.vrsteZa(rijecNormalizirana);
      if (vrste.length > 0 && !vrste.some((v) => params.dopusteneVrste!.has(v))) {
        return { valjano: false, kod: 'NEDOPUSTENA_VRSTA', poruka: PORUKE.nedopustenaVrsta };
      }
    }

    if (params.samoOsnovniOblici && params.rjecnik.jeOsnovniOblik) {
      if (!params.rjecnik.jeOsnovniOblik(rijecNormalizirana)) {
        return { valjano: false, kod: 'NIJE_OSNOVNI_OBLIK', poruka: PORUKE.nijeOsnovniOblik };
      }
    }

    for (const grupa of params.rjecnik.grupeZa(rijecNormalizirana)) {
      if (params.iskoristeneGrupe.has(grupa)) {
        const potroseniOblik = params.potrosioGrupu.get(grupa);
        const poruka =
          !potroseniOblik || potroseniOblik === rijecNormalizirana
            ? PORUKE.rijecIskoristena
            : PORUKE.rijecIskoristenaOblik(potroseniOblik);
        return { valjano: false, kod: 'RIJEC_ISKORISTENA', poruka };
      }
    }
  }

  return { valjano: true };
}

export type RazlogMrtvihSlova = 'mrtva_slova_baza' | 'mrtva_slova_iskoristeno';

/**
 * Nakon prihvaćenog poteza provjerava ima li sljedeći igrač uopće moguć nastavak.
 * Razlikuje RS-02 (rupa u bazi, prijavljivo) od RS-03 (regularna taktička pobjeda).
 */
export function odrediRazlogMrtvihSlova(
  dvaGrafema: string,
  iskoristeneGrupe: ReadonlySet<string>,
  rjecnik: RjecnikSucelje,
  dopusteneVrste?: ReadonlySet<VrstaRijeci>,
  samoOsnovniOblici?: boolean,
  minDuljinaRijeci?: number,
): RazlogMrtvihSlova | null {
  if (rjecnik.imaSlobodnuRijecNa(dvaGrafema, iskoristeneGrupe, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) {
    return null;
  }
  return rjecnik.postojeRijeciNa(dvaGrafema) ? 'mrtva_slova_iskoristeno' : 'mrtva_slova_baza';
}
