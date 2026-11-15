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
 * Devet UI izbora (3 formata × 3 pravilnika) mapira se na osam serverskih redova.
 * Spojeni je samo javni Dvoboj Klasični+KA-ZNA: u 2p je protivnik i prethodni i sljedeći,
 * a sustav nikad ne otvara na „ka”, pa su ta dva pravilnika ekvivalentna pri uparivanju.
 * Troboj/Četveroboj i Dvoboj-dokaz ostaju zasebni redovi.
 */
export const KLJUCEVI_JAVNOG_REDA = [
  '2-zajednicki',
  '2-dokaz',
  '3-klasicni',
  '3-ka-zna',
  '3-dokaz',
  '4-klasicni',
  '4-ka-zna',
  '4-dokaz',
] as const;
export type KljucJavnogReda = (typeof KLJUCEVI_JAVNOG_REDA)[number];

/** Sva tri javna formata (Dvoboj, Troboj, Četveroboj) ulaze u red od PR06. */
export function jePodrzaniJavniRed(mod: ModPartije): mod is ModPartije {
  return jePoznatiMod(mod);
}

/**
 * 9 UI izbora → 8 ključeva. Klasični i KA-ZNA Dvoboj dijele `2-zajednicki`.
 */
export function kljucJavnogReda(mod: ModPartije, pravila: PravilnikPartije): KljucJavnogReda {
  if (mod === 'dva_igraca') {
    return pravila === 'dokazi_nastavak' ? '2-dokaz' : '2-zajednicki';
  }
  if (mod === 'tri_igraca') {
    if (pravila === 'klasicni') return '3-klasicni';
    if (pravila === 'dokazi_nastavak') return '3-dokaz';
    return '3-ka-zna';
  }
  if (pravila === 'klasicni') return '4-klasicni';
  if (pravila === 'dokazi_nastavak') return '4-dokaz';
  return '4-ka-zna';
}

/**
 * Kanonska izvedba stola iz ključa reda.
 * U spojenom Dvoboju partija uvijek igra `ka_zna`; UI odabir ostaje na sudioniku (`odabranaPravila`).
 */
export function kanonskaPravilaZaKljuc(kljuc: KljucJavnogReda): {
  mod: ModPartije;
  pravila: PravilnikPartije;
  spojeniDvoboj: boolean;
} {
  switch (kljuc) {
    case '2-zajednicki':
      return { mod: 'dva_igraca', pravila: 'ka_zna', spojeniDvoboj: true };
    case '2-dokaz':
      return { mod: 'dva_igraca', pravila: 'dokazi_nastavak', spojeniDvoboj: false };
    case '3-klasicni':
      return { mod: 'tri_igraca', pravila: 'klasicni', spojeniDvoboj: false };
    case '3-ka-zna':
      return { mod: 'tri_igraca', pravila: 'ka_zna', spojeniDvoboj: false };
    case '3-dokaz':
      return { mod: 'tri_igraca', pravila: 'dokazi_nastavak', spojeniDvoboj: false };
    case '4-klasicni':
      return { mod: 'cetiri_igraca', pravila: 'klasicni', spojeniDvoboj: false };
    case '4-ka-zna':
      return { mod: 'cetiri_igraca', pravila: 'ka_zna', spojeniDvoboj: false };
    case '4-dokaz':
      return { mod: 'cetiri_igraca', pravila: 'dokazi_nastavak', spojeniDvoboj: false };
    default: {
      const _nevazeci: never = kljuc;
      throw new Error(`Nepoznat ključ javnog reda: ${String(_nevazeci)}`);
    }
  }
}

/**
 * Za putove koji još ne podržavaju Troboj (trening do PR08, profilni DNK do PR10).
 * Bodovanje, forma, rang, javni red i završni DNK snimke za Troboj su otključani.
 */
export function odbijNepodrzaniMod(mod: ModPartije, kontekst: string): asserts mod is 'dva_igraca' | 'cetiri_igraca' {
  if (mod === 'tri_igraca') {
    throw new Error(`${kontekst}: Troboj (tri_igraca) još nije podržan.`);
  }
}
