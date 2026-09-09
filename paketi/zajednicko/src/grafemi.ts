/**
 * Parsiranje hrvatskih riječi na grafeme (slova) — dž, lj, nj broje se kao jedan grafem.
 * Vidi docs/02-pravila-igre/digrafi-i-grafemi.md i ADR-006.
 */

const DIGRAFI = ['dž', 'lj', 'nj'];

/**
 * Riječi kod kojih pohlepno parsiranje digrafa daje pogrešan rastav.
 * Lista se širi kroz prijave igrača i jezičnu provjeru pri uvozu rječnika.
 */
const IZNIMKE: Record<string, string[]> = {
  injekcija: ['i', 'n', 'j', 'e', 'k', 'c', 'i', 'j', 'a'],
  injektor: ['i', 'n', 'j', 'e', 'k', 't', 'o', 'r'],
  konjunkcija: ['k', 'o', 'n', 'j', 'u', 'n', 'k', 'c', 'i', 'j', 'a'],
  nadživljavanje: ['n', 'a', 'd', 'ž', 'i', 'v', 'lj', 'a', 'v', 'a', 'nj', 'e'],
  odžvakavanje: ['o', 'd', 'ž', 'v', 'a', 'k', 'a', 'v', 'a', 'nj', 'e'],
};

/** Rastavlja riječ na niz grafema, poštujući listu iznimaka digrafa. */
export function grafemi(rijec: string): string[] {
  const normalizirana = rijec.normalize('NFC').toLowerCase();
  const iznimka = IZNIMKE[normalizirana];
  if (iznimka) {
    return [...iznimka];
  }

  const rezultat: string[] = [];
  let i = 0;
  while (i < normalizirana.length) {
    const dva = normalizirana.slice(i, i + 2);
    if (DIGRAFI.includes(dva)) {
      rezultat.push(dva);
      i += 2;
    } else {
      rezultat.push(normalizirana[i]!);
      i += 1;
    }
  }
  return rezultat;
}

/** Zadnja dva grafema riječi — na njih mora počinjati sljedeći potez. */
export function zadnjaDva(rijec: string): string {
  return grafemi(rijec).slice(-2).join('');
}

/** Prva dva grafema riječi — uspoređuju se sa zadnjaDva() prethodne riječi. */
export function prvaDva(rijec: string): string {
  return grafemi(rijec).slice(0, 2).join('');
}
