import { zadnjaDva, type VrstaRijeci } from 'zajednicko';

/**
 * Sustav nikad ne otvara riječju koja završava na „ka” (PR02).
 * Igračev potez na „ka” ostaje legalan — ovo vrijedi samo za sistemski odabir.
 */
export function nijeSistemskoOtvaranjeNaKa(rijec: string): boolean {
  const normalizirana = rijec.normalize('NFC').trim().toLowerCase();
  return zadnjaDva(normalizirana) !== 'ka';
}

/** Početni seed odobrenog skupa (migracija + testovi). Runtime izvor je tablica `sigurne_pocetne_rijeci`. */
export const POCETNI_SEED_SIGURNIH_RIJECI = [
  'šećer',
  'biser',
  'bager',
  'bunker',
  'laser',
  'trener',
  'frizer',
  'jezik',
  'učenik',
  'radnik',
  'dnevnik',
  'putnik',
  'med',
  'led',
  'sladoled',
  'ured',
  'razred',
  'pogled',
  'raspored',
  'rep',
  'džep',
  'čep',
  'zid',
  'papir',
  'sir',
  'krumpir',
  'leptir',
  'šešir',
  'orah',
  'okvir',
  'svemir',
  'klavir',
  'mir',
  'automobil',
  'krokodil',
  'miš',
  'slatkiš',
  'nož',
  'velik',
  'lijep',
  'loš',
  'suh',
  'gluh',
  'duhovit',
  'jučer',
  'navečer',
  'prekjučer',
  'naprijed',
  'unaprijed',
  'još',
  'blizu',
  'noću',
] as const;

/** @deprecated Koristi `POCETNI_SEED_SIGURNIH_RIJECI` ili runtime listu iz baze. */
export const SKUP_SIGURNIH_RIJECI = POCETNI_SEED_SIGURNIH_RIJECI;

interface OpcijeSigurnogOdabira {
  iskoristeneGrupe: ReadonlySet<string>;
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  grupeZa(rijec: string): readonly string[];
  vrsteZa(rijec: string): readonly VrstaRijeci[];
  rijeciNa(prefiks: string): readonly string[];
  jeIgriva(rijec: string, iskoristeneGrupe: ReadonlySet<string>, dopusteneVrste?: ReadonlySet<VrstaRijeci>): boolean;
  nasumicniPomak?: number;
  /** Runtime kandidati; default seed (za unit testove bez baze). */
  kandidati?: readonly string[];
}

function dodajGrupe(iskoristeneGrupe: ReadonlySet<string>, grupe: readonly string[]): Set<string> {
  const rezultat = new Set(iskoristeneGrupe);
  for (const grupa of grupe) rezultat.add(grupa);
  return rezultat;
}

export function odaberiSigurnuPocetnuRijec(opcije: OpcijeSigurnogOdabira): string | null {
  const kandidati = opcije.kandidati ?? POCETNI_SEED_SIGURNIH_RIJECI;
  const brojKandidata = kandidati.length;
  if (brojKandidata === 0) return null;
  const pomak = opcije.nasumicniPomak ?? Math.floor(Math.random() * brojKandidata);

  for (let indeks = 0; indeks < brojKandidata; indeks += 1) {
    const kandidat = kandidati[(pomak + indeks) % brojKandidata]!;
    // Već spremljen nedopušten kandidat (završetak „ka”) se preskače.
    if (!nijeSistemskoOtvaranjeNaKa(kandidat)) continue;
    if (!opcije.jeIgriva(kandidat, opcije.iskoristeneGrupe, opcije.dopusteneVrste)) continue;

    const nakonKandidata = dodajGrupe(opcije.iskoristeneGrupe, opcije.grupeZa(kandidat));
    const odgovori = opcije
      .rijeciNa(zadnjaDva(kandidat))
      .filter((rijec) => opcije.jeIgriva(rijec, nakonKandidata, opcije.dopusteneVrste));
    if (odgovori.length === 0) continue;

    const svakiOdgovorImaNastavak = odgovori.every((odgovor) => {
      const nakonOdgovora = dodajGrupe(nakonKandidata, opcije.grupeZa(odgovor));
      return opcije
        .rijeciNa(zadnjaDva(odgovor))
        .some((rijec) => opcije.jeIgriva(rijec, nakonOdgovora, opcije.dopusteneVrste));
    });

    if (svakiOdgovorImaNastavak) return kandidat;
  }

  return null;
}

interface OpcijeRezervnogOdabira {
  kandidati: readonly string[];
  iskoristeneGrupe: ReadonlySet<string>;
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  jeIgriva: (rijec: string, iskoristeneGrupe: ReadonlySet<string>, dopusteneVrste?: ReadonlySet<VrstaRijeci>) => boolean;
  imaSlobodanNastavak: (rijec: string) => boolean;
  nasumicniPomak?: number;
}

/**
 * Rezervni put (imenice ili kratke riječi): 1-ply nastavak, bez završetka „ka”.
 * Koriste ga oba rezervna puta u `nasumicnaPocetnaRijec`.
 */
export function odaberiRezervnuPocetnuRijec(opcije: OpcijeRezervnogOdabira): string | null {
  const broj = opcije.kandidati.length;
  if (broj === 0) return null;
  const pomak = opcije.nasumicniPomak ?? Math.floor(Math.random() * broj);

  for (let indeks = 0; indeks < broj; indeks += 1) {
    const kandidat = opcije.kandidati[(pomak + indeks) % broj]!;
    if (!nijeSistemskoOtvaranjeNaKa(kandidat)) continue;
    if (!opcije.jeIgriva(kandidat, opcije.iskoristeneGrupe, opcije.dopusteneVrste)) continue;
    if (!opcije.imaSlobodanNastavak(kandidat)) continue;
    return kandidat;
  }
  return null;
}
