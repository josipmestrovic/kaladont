/** Sažetak napretka izazova za karticu na naslovnici. */
import { BROJ_AKTIVNIH_IZAZOVA, type OdgovorKatalogaIzazova } from 'zajednicko';

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

export function izracunajPrikazIzazova(
  odgovor: OdgovorKatalogaIzazova | null | undefined,
): PrikazIzazovaKartice {
  const defaultOpis = defaultOpisIzazova();
  if (!odgovor || !odgovor.omogucen || !odgovor.katalog?.length) {
    return { vrsta: 'default', opis: defaultOpis };
  }

  const ukupno = odgovor.katalog.length;
  const zavrseno = odgovor.napredak.leveli.reduce((zbroj, level) => zbroj + level.zavrseno, 0);

  if (zavrseno <= 0) {
    return { vrsta: 'default', opis: defaultOpisIzazova(ukupno) };
  }

  const sveZavrseno = zavrseno >= ukupno;
  return {
    vrsta: 'napredak',
    opis: sveZavrseno ? 'Svi izazovi završeni!' : 'Nastavi tamo gdje si stao.',
    zavrseno: Math.min(zavrseno, ukupno),
    ukupno,
    postotak: Math.min(100, Math.max(0, (100 * zavrseno) / ukupno)),
    sveZavrseno,
  };
}
