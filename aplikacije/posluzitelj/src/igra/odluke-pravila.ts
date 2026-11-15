/**
 * Pure odluke pravila za motor partije (PR02).
 * Upravitelj izvršava timer, socket i upis; ovdje su samo identiteti i razlozi.
 */
import type { PravilnikPartije } from 'zajednicko';

/** Autor posljednje ljudske/bot riječi (ne sustavska). */
export type AutorRijeci = string | null;
/** Igrač kojem trenutačno teče rok. */
export type IgracNaPotezu = string;
/** Stvarna žrtva potvrđene eliminacije. */
export type Zrtva = string;
/** Sjedalo iza kojeg sustav sidri otvaranje runde. */
export type SidroNastavka = string;

export type SljedecaRadnja =
  | { vrsta: 'zakljuci'; razlog: 'jedan_ili_nula_aktivnih' }
  | { vrsta: 'otvoriRundu'; sidroId: SidroNastavka; razlog: string }
  | { vrsta: 'preskociSjedalo'; sljedeciId: string; razlog: string }
  | { vrsta: 'nista'; razlog: string };

/** Kružni prolaz po fiksiranom poretku sjedala, samo aktivni. */
export function sljedeciAktivniIza(
  poredak: readonly string[],
  aktivni: ReadonlySet<string>,
  trenutniId: string,
): string | null {
  const pocetniIndeks = poredak.indexOf(trenutniId);
  if (pocetniIndeks < 0) return null;
  for (let pomak = 1; pomak <= poredak.length; pomak += 1) {
    const kandidat = poredak[(pocetniIndeks + pomak) % poredak.length]!;
    if (aktivni.has(kandidat)) return kandidat;
  }
  return null;
}

/**
 * Meta posebne riječi (kaladont/kalodont).
 * PR02: samo KA-ZNA — žrtva je stvarni autor prethodne riječi.
 * // PR04: klasicni → prvi aktivni iza sayera (uz barem 3 aktivna prije poteza).
 */
export function odrediMetuPosebneRijeci(ulaz: {
  pravilnik: PravilnikPartije;
  autorPrethodneRijeci: AutorRijeci;
  sayerId: string;
  poredak: readonly string[];
  aktivni: ReadonlySet<string>;
}): Zrtva | null {
  // PR04: if (ulaz.pravilnik === 'klasicni') return sljedeciAktivniIza(...)
  void ulaz.pravilnik;
  void ulaz.sayerId;
  void ulaz.poredak;
  void ulaz.aktivni;
  return ulaz.autorPrethodneRijeci;
}

/**
 * Što upravitelj radi nakon potvrđene eliminacije (nakon svih obveznih prijelaza događaja).
 * // PR05: dokaz_nastavka može odgoditi potvrdu; završetak se i dalje provjerava tek nakon potvrde.
 */
export function odlukaNakonEliminacije(ulaz: {
  brojAktivnih: number;
  razlog: string;
  zrtvaId: string;
  uzrocnikId: string | null;
  naPotezuId: string;
  bioNaPotezu: boolean;
  jeSamoeliminacijaIzvanPoteza: boolean;
}): Omit<SljedecaRadnja, never> {
  if (ulaz.brojAktivnih <= 1) {
    return { vrsta: 'zakljuci', razlog: 'jedan_ili_nula_aktivnih' };
  }

  if (ulaz.razlog === 'prekid' && ulaz.naPotezuId === ulaz.zrtvaId) {
    return { vrsta: 'preskociSjedalo', sljedeciId: ulaz.zrtvaId, razlog: 'prekid_na_potezu' };
  }

  if (ulaz.jeSamoeliminacijaIzvanPoteza) {
    if (ulaz.naPotezuId === ulaz.zrtvaId) {
      return { vrsta: 'preskociSjedalo', sljedeciId: ulaz.zrtvaId, razlog: 'prekid_izvan_poteza_red_stigao' };
    }
    return { vrsta: 'nista', razlog: 'prekid_izvan_poteza' };
  }

  // Anchor: autor/uzročnik ili žrtva (bez napadača). Motor zatim radi sljedeciAktivni(sidro).
  const sidroId = ulaz.uzrocnikId ?? ulaz.zrtvaId;
  return { vrsta: 'otvoriRundu', sidroId, razlog: ulaz.razlog };
}
