/**
 * PR14 — URL-ovi i oznake za dvokoračni Igraj modal.
 * HINT: 9 UI izbora → 8 serverskih redova (Klasični+KA-ZNA Dvoboj dijele `2-zajednicki`).
 * HINT: Troboj ikona dolazi naknadno — kartica je tekstualna („Troboj · 3 igrača”).
 */
import type { ModPartije, PravilnikPartije } from 'zajednicko';
import { jePoznatiMod, jePoznatiPravilnik, ZADANI_PRAVILNIK } from 'zajednicko';

/** Doslovni tekstovi kartica pravilnika (pregled + PR14). */
export const TEKSTOVI_PRAVILNIKA: Readonly<
  Record<PravilnikPartije, { naziv: string; opis: string }>
> = {
  klasicni: {
    naziv: 'Klasični Kaladont',
    opis: 'Kad kažeš „kaladont”, ispada igrač koji je sljedeći na redu.',
  },
  ka_zna: {
    naziv: 'KA-ZNA',
    opis: 'Pazi kome ostavljaš „ka” jer ti se može vratiti i izbaciti te.',
  },
  dokazi_nastavak: {
    naziv: 'Dokaži nastavak',
    opis:
      'Protivnik je zapeo na tvojoj riječi? U tome slučaju moraš napisati nastavak na vlastitu riječ, inače ti ispadaš!',
  },
};

export const REDOSLIJED_PRAVILNIKA: readonly PravilnikPartije[] = [
  'klasicni',
  'ka_zna',
  'dokazi_nastavak',
];

export function nazivPravilnika(pravila: PravilnikPartije): string {
  return TEKSTOVI_PRAVILNIKA[pravila].naziv;
}

export function nazivFormata(mod: ModPartije): string {
  switch (mod) {
    case 'dva_igraca':
      return 'Dvoboj';
    case 'tri_igraca':
      return 'Troboj';
    case 'cetiri_igraca':
      return 'Četveroboj';
    default: {
      const _nevazeci: never = mod;
      return String(_nevazeci);
    }
  }
}

export function opisFormata(mod: ModPartije): string {
  switch (mod) {
    case 'dva_igraca':
      return '2 igrača';
    case 'tri_igraca':
      // HINT PR14: bez privremenog asseta — tekstualni placeholder dok vlasnik ne dostavi ikonu.
      return 'Troboj · 3 igrača';
    case 'cetiri_igraca':
      return '4 igrača';
    default: {
      const _nevazeci: never = mod;
      return String(_nevazeci);
    }
  }
}

/** Opis Zagrijavanja ovisi o odabranom pravilniku (klasični = 2 Računala). */
export function opisZagrijavanja(pravila: PravilnikPartije): string {
  if (pravila === 'klasicni') return 'Igraj s dva Računala.';
  return 'Igraj dvoboj protiv Računala.';
}

export function putanjaJavnogReda(mod: ModPartije, pravila: PravilnikPartije): string {
  return `/red?mod=${encodeURIComponent(mod)}&pravila=${encodeURIComponent(pravila)}`;
}

export function putanjaZagrijavanja(pravila: PravilnikPartije): string {
  return `/zagrijavanje?pravila=${encodeURIComponent(pravila)}`;
}

export function putanjaPrivatneKreacije(pravila: PravilnikPartije): string {
  return `/soba/kreiraj?pravila=${encodeURIComponent(pravila)}`;
}

/** Igraj opet / misije — zadrži mod+pravila; bez pravila → zadani KA-ZNA. */
export function putanjaPonovneIgre(
  mod: ModPartije | null | undefined,
  pravila: PravilnikPartije | null | undefined,
  kontekst?: 'javna' | 'privatna' | 'trening' | null,
): string {
  if (kontekst === 'trening') {
    return putanjaZagrijavanja(jePoznatiPravilnik(pravila) ? pravila : ZADANI_PRAVILNIK);
  }
  if (kontekst === 'privatna') {
    return putanjaPrivatneKreacije(jePoznatiPravilnik(pravila) ? pravila : ZADANI_PRAVILNIK);
  }
  const m = jePoznatiMod(mod) ? mod : 'cetiri_igraca';
  const p = jePoznatiPravilnik(pravila) ? pravila : ZADANI_PRAVILNIK;
  return putanjaJavnogReda(m, p);
}

export function parsajPravilnikIzQuery(vrijednost: string | null | undefined): PravilnikPartije {
  return jePoznatiPravilnik(vrijednost) ? vrijednost : ZADANI_PRAVILNIK;
}
