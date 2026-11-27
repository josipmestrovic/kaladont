/** Sažetak napretka izazova za karticu na naslovnici. */
import {
  BROJ_AKTIVNIH_IZAZOVA,
  type NaslovnicaIzazoviSazetak,
  type OdgovorKatalogaIzazova,
} from 'zajednicko';

export type PrikazIzazovaKartice =
  | { vrsta: 'default'; opis: string }
  | {
      vrsta: 'napredak';
      opis: string;
      zavrseno: number;
      ukupno: number;
      postotak: number;
      sveZavrseno: boolean;
    };

export function defaultOpisIzazova(ukupno = BROJ_AKTIVNIH_IZAZOVA): string {
  return `Svladavaj ${ukupno} sve težih izazova.`;
}

function izracunajPrikazBrojeva(
  omogucen: boolean,
  zavrsenoSirovo: number,
  ukupnoSirovo: number,
): PrikazIzazovaKartice {
  const defaultOpis = defaultOpisIzazova();
  if (!omogucen || ukupnoSirovo <= 0) {
    return { vrsta: 'default', opis: defaultOpis };
  }

  const ukupno = ukupnoSirovo;
  const omeđeno = Math.min(Math.max(0, zavrsenoSirovo), ukupno);
  const sveZavrseno = omeđeno >= ukupno;

  return {
    vrsta: 'napredak',
    opis: sveZavrseno
      ? 'Svi izazovi završeni!'
      : omeđeno === 0
        ? defaultOpisIzazova(ukupno)
        : 'Nastavi tamo gdje si stao.',
    zavrseno: omeđeno,
    ukupno,
    postotak: Math.min(100, Math.max(0, (100 * omeđeno) / ukupno)),
    sveZavrseno,
  };
}

export function izracunajPrikazIzazovaIzSazetka(
  sazetak: NaslovnicaIzazoviSazetak | null | undefined,
): PrikazIzazovaKartice {
  if (!sazetak) return { vrsta: 'default', opis: defaultOpisIzazova() };
  return izracunajPrikazBrojeva(sazetak.omogucen, sazetak.zavrseno, sazetak.ukupno);
}

export function izracunajPrikazIzazova(
  odgovor: OdgovorKatalogaIzazova | null | undefined,
): PrikazIzazovaKartice {
  if (!odgovor || !odgovor.katalog?.length) {
    return { vrsta: 'default', opis: defaultOpisIzazova() };
  }
  const zavrseno = odgovor.napredak.leveli.reduce((zbroj, level) => zbroj + level.zavrseno, 0);
  return izracunajPrikazBrojeva(odgovor.omogucen, zavrseno, odgovor.katalog.length);
}
