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
  const omeđeno = Math.min(Math.max(0, zavrseno), ukupno);
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
