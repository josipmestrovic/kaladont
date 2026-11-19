/**
 * URL-ovi i oznake za Igraj (način na naslovnici → pravilnik → format ili Računala).
 * HINT: Natjecateljski: 9 UI izbora → 8 serverskih redova (Klasični+KA-ZNA Dvoboj dijele `2-zajednicki`).
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
    opis: 'Ispada onaj igrač koji ne zna nastavak.',
  },
  ka_zna: {
    naziv: 'KA-zna',
    opis:
      'Ispada igrač koji ne zna nastavak, osim u slučaju kaladonta - tada ispada onaj koji ga je omogućio!',
  },
  dokazi_nastavak: {
    naziv: 'Dokaži nastavak',
    opis:
      'Ako protivnik zapne na tvojoj riječi, ti moraš napisati nastavak, inače ti ispadaš! Slijepa ulica (npr. kaladont) odmah izbacuje tebe.',
  },
};

export const REDOSLIJED_PRAVILNIKA: readonly PravilnikPartije[] = [
  'klasicni',
  'dokazi_nastavak',
  'ka_zna',
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

export function putanjaJavnogReda(mod: ModPartije, pravila: PravilnikPartije): string {
  return `/red?mod=${encodeURIComponent(mod)}&pravila=${encodeURIComponent(pravila)}`;
}

/** Glavni UI Zagrijavanje — pravila + broj Računala (1–3). */
export function putanjaZagrijavanjaBotova(
  brojRacunala: 1 | 2 | 3,
  pravila: PravilnikPartije,
): string {
  return `/zagrijavanje?pravila=${encodeURIComponent(pravila)}&botovi=${brojRacunala}`;
}

/** Misije / Igraj opet — stari ulaz po pravilniku (klasični = 2 Računala). */
export function putanjaZagrijavanja(pravila: PravilnikPartije): string {
  return `/zagrijavanje?pravila=${encodeURIComponent(pravila)}`;
}

export function putanjaPrivatneKreacije(pravila: PravilnikPartije): string {
  return `/soba/kreiraj?pravila=${encodeURIComponent(pravila)}`;
}

/** Trening: mod = broj sudionika (čovjek + Računala) → broj Računala 1–3. */
export function brojRacunalaIzTreningModa(mod: ModPartije | null | undefined): 1 | 2 | 3 {
  if (mod === 'dva_igraca') return 1;
  if (mod === 'tri_igraca') return 2;
  return 3;
}

/** Igraj opet / misije — zadrži mod+pravila; bez pravila → zadani KA-ZNA. */
export function putanjaPonovneIgre(
  mod: ModPartije | null | undefined,
  pravila: PravilnikPartije | null | undefined,
  kontekst?: 'javna' | 'privatna' | 'trening' | null,
): string {
  const p = jePoznatiPravilnik(pravila) ? pravila : ZADANI_PRAVILNIK;
  if (kontekst === 'trening') {
    return putanjaZagrijavanjaBotova(brojRacunalaIzTreningModa(mod), p);
  }
  if (kontekst === 'privatna') {
    return putanjaPrivatneKreacije(p);
  }
  const m = jePoznatiMod(mod) ? mod : 'cetiri_igraca';
  return putanjaJavnogReda(m, p);
}

export function parsajPravilnikIzQuery(vrijednost: string | null | undefined): PravilnikPartije {
  return jePoznatiPravilnik(vrijednost) ? vrijednost : ZADANI_PRAVILNIK;
}
