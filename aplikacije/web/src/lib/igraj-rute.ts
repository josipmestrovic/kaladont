/**
 * URL-ovi i oznake za Igraj (Brza igra / Trening / privatna).
 * Javni ulaz: samo Brza igra (Troboj · Klasični). Trening zadržava pravilnik + botove.
 */
import type { ModPartije, PravilnikPartije, ProfilBotaIzazova } from 'zajednicko';
import {
  BRZA_IGRA,
  jeJavnaKombinacijaAktivna,
  jePoznatiMod,
  jePoznatiPravilnik,
  jePoznatiProfilBota,
  NAZIVI_PROFILA_BOTA,
  PROFILI_BOTA_IZAZOVA,
  ZADANI_PRAVILNIK,
  ZADANI_PROFIL_TRENINGA,
} from 'zajednicko';


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
  if (!jeJavnaKombinacijaAktivna(mod, pravila)) return BRZA_IGRA.putanja;
  return `/red?mod=${encodeURIComponent(mod)}&pravila=${encodeURIComponent(pravila)}`;
}

export function putanjaBrzeIgre(): string {
  return BRZA_IGRA.putanja;
}

/** Glavni UI Trening — pravila + broj botova (1–3) + profil. */
export function putanjaZagrijavanjaBotova(
  brojRacunala: 1 | 2 | 3,
  pravila: PravilnikPartije,
  profileId: ProfilBotaIzazova = ZADANI_PROFIL_TRENINGA,
): string {
  return `/zagrijavanje?pravila=${encodeURIComponent(pravila)}&botovi=${brojRacunala}&profil=${encodeURIComponent(profileId)}`;
}

/** Misije / Igraj opet — stari ulaz po pravilniku (klasični = 2 bota, zadani Iskusni). */
export function putanjaZagrijavanja(pravila: PravilnikPartije): string {
  return `/zagrijavanje?pravila=${encodeURIComponent(pravila)}`;
}

export function parsajProfilIzQuery(vrijednost: string | null | undefined): ProfilBotaIzazova {
  return jePoznatiProfilBota(vrijednost) ? vrijednost : ZADANI_PROFIL_TRENINGA;
}

/** Iz nadimka „Majstor” / „Majstor 2” → profileId (Trening imena po težini). */
export function profilIzNadimkaTreningBota(nadimak: string | null | undefined): ProfilBotaIzazova | null {
  if (!nadimak) return null;
  for (const id of PROFILI_BOTA_IZAZOVA) {
    const naziv = NAZIVI_PROFILA_BOTA[id];
    if (nadimak === naziv || nadimak.startsWith(`${naziv} `)) return id;
  }
  return null;
}

export function putanjaPrivatneKreacije(pravila: PravilnikPartije): string {
  return `/soba/kreiraj?pravila=${encodeURIComponent(pravila)}`;
}

/** Trening: mod = broj sudionika (čovjek + botovi) → broj botova 1–3. */
export function brojRacunalaIzTreningModa(mod: ModPartije | null | undefined): 1 | 2 | 3 {
  if (mod === 'dva_igraca') return 1;
  if (mod === 'tri_igraca') return 2;
  return 3;
}

/** Igraj opet / misije — javno uvijek Brza igra; Trening/privatna zadržavaju kontekst. */
export function putanjaPonovneIgre(
  mod: ModPartije | null | undefined,
  pravila: PravilnikPartije | null | undefined,
  kontekst?: 'javna' | 'privatna' | 'trening' | 'izazov' | null,
  profileId?: ProfilBotaIzazova | null,
): string {
  const p = jePoznatiPravilnik(pravila) ? pravila : ZADANI_PRAVILNIK;
  if (kontekst === 'trening') {
    return putanjaZagrijavanjaBotova(
      brojRacunalaIzTreningModa(mod),
      p,
      jePoznatiProfilBota(profileId) ? profileId : ZADANI_PROFIL_TRENINGA,
    );
  }
  if (kontekst === 'privatna') {
    return putanjaPrivatneKreacije(p);
  }
  return putanjaBrzeIgre();
}

export function parsajPravilnikIzQuery(vrijednost: string | null | undefined): PravilnikPartije {
  return jePoznatiPravilnik(vrijednost) ? vrijednost : ZADANI_PRAVILNIK;
}
