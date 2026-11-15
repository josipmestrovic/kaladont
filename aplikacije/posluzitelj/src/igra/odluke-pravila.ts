/**
 * Pure odluke pravila za motor partije (PR02/PR04/PR05).
 * Upravitelj izvršava timer, socket i upis; ovdje su samo identiteti i razlozi.
 *
 * // PR05: samo dokazi_nastavak mijenja mrtva-žrtvu i odgađa „Ne znam”/istek u dokaz.
 * // PR05: klasik/ka_zna ne ulaze u grane dokaza — ostaju netaknuti.
 * // PR05→PR07: bot čita fazu iz snimke; ne emitiraj ispadanje čekača prije potvrde.
 * // PR05→PR12/13: uspješan dokaz = jedan prihvat + jedna izazvana eliminacija; propali nije Lovac/Slijepa.
 */
import type { PravilnikPartije } from 'zajednicko';

/** Autor posljednje ljudske/bot riječi (ne sustavska). */
export type AutorRijeci = string | null;
/** Igrač kojem trenutačno teče rok. */
export type IgracNaPotezu = string;
/** Stvarna žrtva potvrđene eliminacije. */
export type Zrtva = string;
/** Sjedalo iza kojeg sustav sidri otvaranje runde. */
export type SidroNastavka = string;

/** Meta posebne riječi: prethodni autor (KA-ZNA) ili sljedeći u krugu (Klasični). */
export type VrstaMetePosebneRijeci = 'prethodni' | 'sljedeci';

export type IshodMetePosebneRijeci = {
  zrtvaId: Zrtva | null;
  vrstaMete: VrstaMetePosebneRijeci | null;
};

export type SljedecaRadnja =
  | { vrsta: 'zakljuci'; razlog: 'jedan_ili_nula_aktivnih' }
  | { vrsta: 'otvoriRundu'; sidroId: SidroNastavka; razlog: string }
  | { vrsta: 'preskociSjedalo'; sljedeciId: string; razlog: string }
  | { vrsta: 'nista'; razlog: string };

/** Kružni prolaz po fiksiranom poretku sjedala, samo aktivni. */
export function sljedeciAktivniIza(
  poredak: readonly string[],
  aktivni: ReadonlySet<string>,
  trenutniId: string,
): string | null {
  const pocetniIndeks = poredak.indexOf(trenutniId);
  if (pocetniIndeks < 0) return null;
  for (let pomak = 1; pomak <= poredak.length; pomak += 1) {
    const kandidat = poredak[(pocetniIndeks + pomak) % poredak.length]!;
    if (aktivni.has(kandidat)) return kandidat;
  }
  return null;
}

/**
 * Meta posebne riječi (kaladont/kalodont) na OBIČNOM potezu.
 * Klasični → prvi aktivni iza sayera (i uz 2 aktivna = protivnik).
 * KA-ZNA i Dokaži nastavak (običan potez) → stvarni autor prethodne riječi.
 *
 * // PR05: kaladont KAO DOKAZ nije ova funkcija — dokaz ne pokreće ponovnu KA-ZNA obradu.
 */
export function odrediMetuPosebneRijeci(ulaz: {
  pravilnik: PravilnikPartije;
  autorPrethodneRijeci: AutorRijeci;
  sayerId: string;
  poredak: readonly string[];
  aktivni: ReadonlySet<string>;
}): IshodMetePosebneRijeci {
  if (ulaz.pravilnik === 'klasicni') {
    const zrtvaId = sljedeciAktivniIza(ulaz.poredak, ulaz.aktivni, ulaz.sayerId);
    return { zrtvaId, vrstaMete: zrtvaId ? 'sljedeci' : null };
  }

  // ka_zna i dokazi_nastavak (običan potez): žrtva je stvarni autor.
  const autor = ulaz.autorPrethodneRijeci;
  if (!autor) return { zrtvaId: null, vrstaMete: null };
  return { zrtvaId: autor, vrstaMete: 'prethodni' };
}

/**
 * Žrtva mrtvih slova nakon prihvaćene obične riječi.
 * // PR05: mrtva slova != dokaz; cement pada odmah.
 * // klasik/ka_zna → sljedeći (RS-02/03); dokazi_nastavak → autor (bez kredita).
 */
export function zrtvaMrtvihSlova(ulaz: {
  pravilnik: PravilnikPartije;
  autorId: string;
  sljedeciId: string | null;
}): { zrtvaId: string | null; uzrocnikId: string | null } {
  if (ulaz.pravilnik === 'dokazi_nastavak') {
    // Autor je sam otvorio mrtav nastavak — Bruno ne pada, nitko nema eliminacijski bod.
    return { zrtvaId: ulaz.autorId, uzrocnikId: null };
  }
  // klasik / ka_zna: postojeće RS-02/03 — sljedeći ispada, autor dobiva kredit.
  return { zrtvaId: ulaz.sljedeciId, uzrocnikId: ulaz.sljedeciId ? ulaz.autorId : null };
}

/**
 * Treba li „Ne znam”/istek/napusti-na-potezu otvoriti dokaz umjesto odmah eliminirati čekača.
 * // PR05: Ne znam != napusti — oba mogu otvoriti dokaz, ali napusti prvo potvrdi Brunin prekid.
 * // Sustavska riječ (nema autora) ili već ispao autor → redovna eliminacija, bez dokaza.
 */
export function trebaOtvoritiDokaz(ulaz: {
  pravilnik: PravilnikPartije;
  fazaJeObicanPotez: boolean;
  autorId: AutorRijeci;
  autorJosAktivan: boolean;
  igracNaPotezuId: string;
  dogadajIgracId: string;
}): boolean {
  if (ulaz.pravilnik !== 'dokazi_nastavak') return false;
  if (!ulaz.fazaJeObicanPotez) return false;
  if (ulaz.dogadajIgracId !== ulaz.igracNaPotezuId) return false;
  if (!ulaz.autorId) return false;
  if (!ulaz.autorJosAktivan) return false;
  // Autor ne dokazuje vlastiti „Ne znam” — to je redovna samoeliminacija.
  if (ulaz.autorId === ulaz.dogadajIgracId) return false;
  return true;
}

export type IshodZatvaranjaDokaza =
  | {
      vrsta: 'uspjeh';
      /** Čekač (Bruno) — ako već nije ispao napuštanjem. */
      zrtvaId: string | null;
      uzrocnikId: string;
      sidroNoveRundeId: string;
    }
  | {
      vrsta: 'neuspjeh';
      /** Autor/dokazivač (Ana). */
      zrtvaId: string;
      uzrocnikId: null;
      sidroNoveRundeId: string;
    };

/**
 * Konačna odluka jednog izazova dokaza.
 * Jedan izazov → jedan završetak (zapisnik, botovi, analitika, PR12/13).
 */
export function ishodDokaza(ulaz: {
  uspjeh: boolean;
  autorId: string;
  cekateljId: string;
  cekateljVecIspao: boolean;
}): IshodZatvaranjaDokaza {
  if (ulaz.uspjeh) {
    return {
      vrsta: 'uspjeh',
      // Ako je Bruno već potvrđen napuštanjem, nema druge eliminacije — samo Anin kredit.
      zrtvaId: ulaz.cekateljVecIspao ? null : ulaz.cekateljId,
      uzrocnikId: ulaz.autorId,
      // Nova sistemska ide prvom aktivnom iza Brunе (sidro = čekač), ne nastavak s dokazane riječi.
      sidroNoveRundeId: ulaz.cekateljId,
    };
  }
  return {
    vrsta: 'neuspjeh',
    zrtvaId: ulaz.autorId,
    uzrocnikId: null,
    sidroNoveRundeId: ulaz.autorId,
  };
}

/**
 * Što upravitelj radi nakon potvrđene eliminacije (nakon svih obveznih prijelaza događaja).
 * // PR05: dokaz_nastavka odgađa potvrdu Brunе na „Ne znam”; završetak tek nakon potvrde.
 * // PR05: kad Bruno napusti na potezu pa se otvara dokaz, motor NE smije odmah otvoriti rundu
 * //       iz `prekid_na_potezu` — umjesto toga zadrži stol u dokazu (vidi motor).
 */
export function odlukaNakonEliminacije(ulaz: {
  brojAktivnih: number;
  razlog: string;
  zrtvaId: string;
  uzrocnikId: string | null;
  naPotezuId: string;
  bioNaPotezu: boolean;
  jeSamoeliminacijaIzvanPoteza: boolean;
  /** PR05: potvrda Brunе prije dokaza — ne otvaraj rundu/preskoči; dokaz slijedi. */
  odgodiNastavakRadiDokaza?: boolean;
}): SljedecaRadnja {
  if (ulaz.brojAktivnih <= 1) {
    return { vrsta: 'zakljuci', razlog: 'jedan_ili_nula_aktivnih' };
  }

  // Bruno napustio na potezu, Ana još mora dokazati — stol stoji u dokazu, bez nove runde.
  if (ulaz.odgodiNastavakRadiDokaza) {
    return { vrsta: 'nista', razlog: 'odgoda_radi_dokaza' };
  }

  if (ulaz.razlog === 'prekid' && ulaz.naPotezuId === ulaz.zrtvaId) {
    return { vrsta: 'preskociSjedalo', sljedeciId: ulaz.zrtvaId, razlog: 'prekid_na_potezu' };
  }

  if (ulaz.jeSamoeliminacijaIzvanPoteza) {
    if (ulaz.naPotezuId === ulaz.zrtvaId) {
      return { vrsta: 'preskociSjedalo', sljedeciId: ulaz.zrtvaId, razlog: 'prekid_izvan_poteza_red_stigao' };
    }
    return { vrsta: 'nista', razlog: 'prekid_izvan_poteza' };
  }

  // Anchor: autor/uzročnik ili žrtva (bez napadača). Motor zatim radi sljedeciAktivni(sidro).
  const sidroId = ulaz.uzrocnikId ?? ulaz.zrtvaId;
  return { vrsta: 'otvoriRundu', sidroId, razlog: ulaz.razlog };
}
