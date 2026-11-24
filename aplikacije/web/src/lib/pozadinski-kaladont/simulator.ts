import { prvaDva, zadnjaDva } from 'zajednicko';
import {
  dohvatiIndeks,
  type IndeksiranaRijec,
  type IndeksPozadinskihRijeci,
} from './indeks-rijeci.js';
import { POSEDNA_RIJEC_KALADONT } from './rjecnik.js';

export type SlucajniBroj = () => number;

export interface StanjePozadinskePartije {
  idPartije: number;
  posljednjaRijec: string | null;
  iskoristeneRijeci: Set<string>;
  iskoristeneGrupe: Set<string>;
  brojPoteza: number;
  zavrsena: boolean;
}

export interface PotezPozadine {
  rijec: string;
  pocetak: string;
  nastavak: string;
  posebnaRijec: boolean;
  idPartije: number;
  brojPoteza: number;
  zavrsavaPartiju: boolean;
}

export interface OpcijeSimulatora {
  indeks?: IndeksPozadinskihRijeci;
  slucajniBroj?: SlucajniBroj;
  /** Zadano 1 — lanac uvijek završava kaladontom čim stigne na „ka”. */
  vjerojatnostKaladonta?: number;
  maksimalnaDuljinaRijeci?: number;
}

const ZADANA_VJEROJATNOST_KALADONTA = 1;

function zadaniSlucajni(): number {
  return Math.random();
}

function odaberi<T>(lista: readonly T[], slucajniBroj: SlucajniBroj): T | null {
  if (lista.length === 0) return null;
  const indeks = Math.floor(slucajniBroj() * lista.length);
  return lista[Math.min(indeks, lista.length - 1)] ?? null;
}

function imaSlobodnuGrupu(rijec: IndeksiranaRijec, iskoristeneGrupe: ReadonlySet<string>): boolean {
  return rijec.grupe.every((grupa) => !iskoristeneGrupe.has(grupa));
}

function oznaciPotrosnju(
  stanje: StanjePozadinskePartije,
  rijec: { rijec: string; grupe: readonly string[] },
): void {
  stanje.iskoristeneRijeci.add(rijec.rijec);
  for (const grupa of rijec.grupe) stanje.iskoristeneGrupe.add(grupa);
}

function kandidatiZaNastavak(
  indeks: IndeksPozadinskihRijeci,
  nastavak: string,
  stanje: StanjePozadinskePartije,
  maksimalnaDuljinaRijeci?: number,
  dopustiPonavljanje = false,
): IndeksiranaRijec[] {
  const baza = indeks.poPocetku.get(nastavak) ?? [];
  return baza.filter((kandidat) => {
    if (!dopustiPonavljanje && stanje.iskoristeneRijeci.has(kandidat.rijec)) return false;
    if (!dopustiPonavljanje && !imaSlobodnuGrupu(kandidat, stanje.iskoristeneGrupe)) return false;
    if (dopustiPonavljanje && kandidat.rijec === stanje.posljednjaRijec) return false;
    if (maksimalnaDuljinaRijeci !== undefined && kandidat.brojGrafema > maksimalnaDuljinaRijeci) {
      return false;
    }
    return true;
  });
}

function ostavljaNastavak(
  indeks: IndeksPozadinskihRijeci,
  kandidat: IndeksiranaRijec,
  stanje: StanjePozadinskePartije,
): boolean {
  if (kandidat.nastavak === 'ka') return true;
  const hipotetskeRijeci = new Set(stanje.iskoristeneRijeci);
  hipotetskeRijeci.add(kandidat.rijec);
  const hipotetskeGrupe = new Set(stanje.iskoristeneGrupe);
  for (const grupa of kandidat.grupe) hipotetskeGrupe.add(grupa);

  const sljedeci = indeks.poPocetku.get(kandidat.nastavak) ?? [];
  return sljedeci.some(
    (sljedeciKandidat) =>
      !hipotetskeRijeci.has(sljedeciKandidat.rijec) &&
      imaSlobodnuGrupu(sljedeciKandidat, hipotetskeGrupe),
  );
}

function imaDvaUzastopna(
  indeks: IndeksPozadinskihRijeci,
  kandidat: IndeksiranaRijec,
  maksimalnaDuljinaRijeci?: number,
): boolean {
  if (maksimalnaDuljinaRijeci !== undefined && kandidat.brojGrafema > maksimalnaDuljinaRijeci) {
    return false;
  }
  const privremeno: StanjePozadinskePartije = {
    idPartije: 0,
    posljednjaRijec: kandidat.rijec,
    iskoristeneRijeci: new Set([kandidat.rijec]),
    iskoristeneGrupe: new Set(kandidat.grupe),
    brojPoteza: 1,
    zavrsena: false,
  };
  return kandidatiZaNastavak(indeks, kandidat.nastavak, privremeno, maksimalnaDuljinaRijeci).length > 0;
}

function izgradiPotez(
  stanje: StanjePozadinskePartije,
  rijec: string,
  posebnaRijec: boolean,
  zavrsavaPartiju: boolean,
): PotezPozadine {
  return {
    rijec,
    pocetak: prvaDva(rijec),
    nastavak: zadnjaDva(rijec),
    posebnaRijec,
    idPartije: stanje.idPartije,
    brojPoteza: stanje.brojPoteza,
    zavrsavaPartiju,
  };
}

function odigrajKaladont(stanje: StanjePozadinskePartije): PotezPozadine {
  stanje.brojPoteza += 1;
  stanje.posljednjaRijec = POSEDNA_RIJEC_KALADONT;
  stanje.iskoristeneRijeci.add(POSEDNA_RIJEC_KALADONT);
  stanje.zavrsena = true;
  return izgradiPotez(stanje, POSEDNA_RIJEC_KALADONT, true, true);
}

/** Oslobodi potrošene riječi (osim trenutne) da lanac može nastaviti do kaladonta. */
function oslobodiPotroseno(stanje: StanjePozadinskePartije): void {
  const zadnja = stanje.posljednjaRijec;
  stanje.iskoristeneRijeci.clear();
  stanje.iskoristeneGrupe.clear();
  if (zadnja) {
    stanje.iskoristeneRijeci.add(zadnja);
    stanje.iskoristeneGrupe.add(`oblika:${zadnja}`);
  }
}

export function stvoriStanjePartije(idPartije: number): StanjePozadinskePartije {
  return {
    idPartije,
    posljednjaRijec: null,
    iskoristeneRijeci: new Set(),
    iskoristeneGrupe: new Set(),
    brojPoteza: 0,
    zavrsena: false,
  };
}

/** Odabire početnu riječ s barem jednim (po mogućnosti dva) uzastopna nastavka. */
export function odaberiPocetnuRijec(opcije: OpcijeSimulatora = {}): IndeksiranaRijec | null {
  const indeks = opcije.indeks ?? dohvatiIndeks();
  const slucajniBroj = opcije.slucajniBroj ?? zadaniSlucajni;
  const maksimalnaDuljinaRijeci = opcije.maksimalnaDuljinaRijeci;

  if (indeks.sve.length === 0) return null;

  const sDva = indeks.sve.filter((k) => imaDvaUzastopna(indeks, k, maksimalnaDuljinaRijeci));
  const sJednim =
    sDva.length > 0
      ? sDva
      : indeks.sve.filter((k) => {
          if (maksimalnaDuljinaRijeci !== undefined && k.brojGrafema > maksimalnaDuljinaRijeci) {
            return false;
          }
          return (indeks.poPocetku.get(k.nastavak) ?? []).some(
            (sljedeci) =>
              sljedeci.rijec !== k.rijec &&
              (maksimalnaDuljinaRijeci === undefined ||
                sljedeci.brojGrafema <= maksimalnaDuljinaRijeci),
          );
        });

  return odaberi(sJednim.length > 0 ? sJednim : indeks.sve, slucajniBroj);
}

export function odigrajPocetniPotez(
  stanje: StanjePozadinskePartije,
  opcije: OpcijeSimulatora = {},
): PotezPozadine | null {
  if (stanje.zavrsena || stanje.posljednjaRijec !== null) return null;
  const pocetna = odaberiPocetnuRijec(opcije);
  if (!pocetna) {
    stanje.zavrsena = true;
    return null;
  }

  stanje.brojPoteza += 1;
  stanje.posljednjaRijec = pocetna.rijec;
  oznaciPotrosnju(stanje, pocetna);
  return izgradiPotez(stanje, pocetna.rijec, false, false);
}

export function odigrajSljedeciPotez(
  stanje: StanjePozadinskePartije,
  opcije: OpcijeSimulatora = {},
): PotezPozadine | null {
  if (stanje.zavrsena) return null;
  if (stanje.posljednjaRijec === null) return odigrajPocetniPotez(stanje, opcije);

  const indeks = opcije.indeks ?? dohvatiIndeks();
  const slucajniBroj = opcije.slucajniBroj ?? zadaniSlucajni;
  const vjerojatnostKaladonta = opcije.vjerojatnostKaladonta ?? ZADANA_VJEROJATNOST_KALADONTA;
  const maksimalnaDuljinaRijeci = opcije.maksimalnaDuljinaRijeci;

  const nastavak = zadnjaDva(stanje.posljednjaRijec);

  // Na „ka” uvijek (zadano) završi kaladontom — jedini dopušteni kraj lanca.
  if (nastavak === 'ka') {
    if (slucajniBroj() < vjerojatnostKaladonta) {
      return odigrajKaladont(stanje);
    }
  }

  let kandidati = kandidatiZaNastavak(indeks, nastavak, stanje, maksimalnaDuljinaRijeci);
  if (kandidati.length === 0) {
    // Nikad ne prekidaj prije kaladonta: oslobodi potrošeno i nastavi.
    oslobodiPotroseno(stanje);
    kandidati = kandidatiZaNastavak(indeks, nastavak, stanje, maksimalnaDuljinaRijeci);
  }
  if (kandidati.length === 0) {
    // Posljednji rezervni izlaz: dopusti ponavljanje oblika (dekorativno).
    kandidati = kandidatiZaNastavak(indeks, nastavak, stanje, maksimalnaDuljinaRijeci, true);
  }
  if (kandidati.length === 0) {
    // Ako fond nema nijedan nastavak, nema što igrati — bez lažnog kaladonta.
    stanje.zavrsena = true;
    return null;
  }

  const doKa = kandidati.filter((k) => k.nastavak === 'ka');
  const sNastavkom = kandidati.filter((k) => ostavljaNastavak(indeks, k, stanje));

  // Nakon nekoliko poteza sve češće biraj put do „ka” (pa kaladont).
  const pragKa = Math.min(0.55, 0.12 + stanje.brojPoteza * 0.04);
  let izbor: IndeksiranaRijec | null = null;
  if (doKa.length > 0 && stanje.brojPoteza >= 4 && slucajniBroj() < pragKa) {
    izbor = odaberi(doKa, slucajniBroj);
  } else if (sNastavkom.length > 0) {
    izbor = odaberi(sNastavkom, slucajniBroj);
  } else if (doKa.length > 0) {
    izbor = odaberi(doKa, slucajniBroj);
  } else {
    izbor = odaberi(kandidati, slucajniBroj);
  }

  if (!izbor) {
    stanje.zavrsena = true;
    return null;
  }

  stanje.brojPoteza += 1;
  stanje.posljednjaRijec = izbor.rijec;
  oznaciPotrosnju(stanje, izbor);
  return izgradiPotez(stanje, izbor.rijec, false, false);
}

/** Generira N povezanih poteza unaprijed (inicijalno popunjavanje zone). */
export function generirajPocetnePoteze(
  broj: number,
  opcije: OpcijeSimulatora = {},
  idPartije = 1,
): { stanje: StanjePozadinskePartije; potezi: PotezPozadine[] } {
  const stanje = stvoriStanjePartije(idPartije);
  const potezi: PotezPozadine[] = [];
  for (let i = 0; i < broj; i += 1) {
    if (stanje.zavrsena) break;
    const potez = odigrajSljedeciPotez(stanje, opcije);
    if (!potez) break;
    potezi.push(potez);
  }
  return { stanje, potezi };
}

/** Deterministički generator iz cijelog broja (za testove). */
export function stvoriGeneratorIzSeeda(seed: number): SlucajniBroj {
  let stanje = seed >>> 0;
  return () => {
    stanje = (1664525 * stanje + 1013904223) >>> 0;
    return stanje / 0x100000000;
  };
}
