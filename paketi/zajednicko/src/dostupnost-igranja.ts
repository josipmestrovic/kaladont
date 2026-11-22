/**
 * Politika aktivnih javnih redova (Brza igra).
 * Katalog 8 ključeva ostaje u katalog-partije; ovdje je samo što je trenutačno javno dostupno.
 */
import {
  jePoznatiMod,
  jePoznatiPravilnik,
  kljucJavnogReda,
  type KljucJavnogReda,
  type ModPartije,
  type PravilnikPartije,
} from './katalog-partije.js';

/** Jedini javni red u produkciji: Troboj + Klasični. */
export const AKTIVNI_JAVNI_REDOVI = ['3-klasicni'] as const satisfies readonly KljucJavnogReda[];
export type AktivniJavniRed = (typeof AKTIVNI_JAVNI_REDOVI)[number];

/** Kanonski ulaz „Brza igra” — brz spoj, ne kraći potez (timer ostaje 30 s). */
export const BRZA_IGRA = {
  mod: 'tri_igraca',
  pravila: 'klasicni',
  kljucReda: '3-klasicni',
  putanja: '/red?mod=tri_igraca&pravila=klasicni',
} as const satisfies {
  mod: ModPartije;
  pravila: PravilnikPartije;
  kljucReda: AktivniJavniRed;
  putanja: string;
};

export function jeAktivanJavniKljuc(kljuc: KljucJavnogReda): kljuc is AktivniJavniRed {
  return (AKTIVNI_JAVNI_REDOVI as readonly string[]).includes(kljuc);
}

/** Puni katalog + aktivna podskupina: kombinacija mora biti podržana i trenutačno javna. */
export function jeJavnaKombinacijaAktivna(mod: ModPartije, pravila: PravilnikPartije): boolean {
  if (!jePoznatiMod(mod) || !jePoznatiPravilnik(pravila)) return false;
  return jeAktivanJavniKljuc(kljucJavnogReda(mod, pravila));
}

/** Javni ljestvični format: samo Troboj. Ostali se normaliziraju. */
export function kanonskiModLjestvice(mod: unknown): 'tri_igraca' {
  void mod;
  return 'tri_igraca';
}

/**
 * Dostignuća koja nisu ostvariva kroz jedini javni red (Brza igra).
 * Katalog i DB zapisi ostaju; UI i nove dodjele ih skrivaju.
 * `ka_zna` (žrtva Kaladonta) NIJE ovdje — ostaje ostvarivo u Klasičnom Troboju.
 */
export const NEDOSTIZNA_DOSTIGNUCA = [
  'dvostruka_kruna',
  'na_dvije_fronte',
  'imam_nastavak',
  'stara_skola',
] as const;

const NEDOSTIZNA_DOSTIGNUCA_SET = new Set<string>(NEDOSTIZNA_DOSTIGNUCA);

/** Definicija ostaje poznata; nije vidljiva u korisničkom UI-ju. */
export function jeDostignuceVidljivo(id: string): boolean {
  return !NEDOSTIZNA_DOSTIGNUCA_SET.has(id);
}

/** Nove dodjele/popupovi samo za ostvariva. */
export function jeDostignuceOstvarivo(id: string): boolean {
  return jeDostignuceVidljivo(id);
}
