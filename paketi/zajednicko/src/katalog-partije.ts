/**
 * Zajednički katalog formata stola i pravilnika (Kaladont 0.2.0).
 * Format, pravilnik i kontekst (javna/privatna/trening) tri su odvojene osi.
 */

export const MODOVI_PARTIJE = ['dva_igraca', 'tri_igraca', 'cetiri_igraca'] as const;
export type ModPartije = (typeof MODOVI_PARTIJE)[number];

export const PRAVILNICI_PARTIJE = ['klasicni', 'ka_zna', 'dokazi_nastavak'] as const;
export type PravilnikPartije = (typeof PRAVILNICI_PARTIJE)[number];

/** Zadani pravilnik za stare klijente, povijest i izostavljeno polje. */
export const ZADANI_PRAVILNIK: PravilnikPartije = 'ka_zna';

export function jePoznatiMod(vrijednost: unknown): vrijednost is ModPartije {
  return typeof vrijednost === 'string' && (MODOVI_PARTIJE as readonly string[]).includes(vrijednost);
}

export function jePoznatiPravilnik(vrijednost: unknown): vrijednost is PravilnikPartije {
  return typeof vrijednost === 'string' && (PRAVILNICI_PARTIJE as readonly string[]).includes(vrijednost);
}

export function zadaniPravilnik(vrijednost?: unknown): PravilnikPartije {
  if (vrijednost === undefined || vrijednost === null) return ZADANI_PRAVILNIK;
  if (jePoznatiPravilnik(vrijednost)) return vrijednost;
  throw new Error(`Nepoznat pravilnik: ${String(vrijednost)}`);
}

/** Broj javnih sjedala za format; privatna soba nije vezana uz ovu tablicu. */
export function javnaSjedalaZaMod(mod: ModPartije): 2 | 3 | 4 {
  switch (mod) {
    case 'dva_igraca':
      return 2;
    case 'tri_igraca':
      return 3;
    case 'cetiri_igraca':
      return 4;
    default: {
      const _nevazeci: never = mod;
      throw new Error(`Nepoznat mod: ${String(_nevazeci)}`);
    }
  }
}

/**
 * Javni redovi PR01 podržavaju samo Dvoboj i Četveroboj.
 * Troboj se odbija do PR06 — nikad ne smije pasti u Četveroboj granu.
 */
export function jePodrzaniJavniRed(mod: ModPartije): mod is 'dva_igraca' | 'cetiri_igraca' {
  return mod === 'dva_igraca' || mod === 'cetiri_igraca';
}

/**
 * Za putove koji još ne podržavaju Troboj (javni red do PR06, trening do PR08, profilni DNK do PR10).
 * Bodovanje, forma, rang i završni DNK snimke za Troboj su otključani u PR03.
 */
export function odbijNepodrzaniMod(mod: ModPartije, kontekst: string): asserts mod is 'dva_igraca' | 'cetiri_igraca' {
  if (mod === 'tri_igraca') {
    throw new Error(`${kontekst}: Troboj (tri_igraca) još nije podržan.`);
  }
}
