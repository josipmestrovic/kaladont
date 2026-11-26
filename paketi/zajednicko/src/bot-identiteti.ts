/**
 * Jedan izvor istine za javne botove V5, fiksnu Trening/Izazov postavu i
 * stabilne ključeve WebP ilustracija (datoteke u /avatari/botovi/).
 */

export const PROFILI_TEZINE_BOTA = ['pocetnik', 'iskusni', 'majstor', 'velemajstor'] as const;
export type ProfilTezineBota = (typeof PROFILI_TEZINE_BOTA)[number];

/** Ključevi postojećih WebP asseta (bez ekstenzije / putanje). */
export const KLJUCEVI_ILUSTRACIJA_BOTA = [
  '01-skafander',
  '02-pastoljub',
  '03-brko-na-struju',
  '04-disketas',
  '05-propelerko',
  '06-kvacica',
  '07-burek-na-vezi',
  '08-ronilac-na-suhom',
  '09-lektorka',
  '10-smetalo',
  '11-kazetko',
  '12-spavalica',
  '13-ekspres-lonac',
  '14-harmonikas',
  '15-periskop',
  '16-trubimir',
  '17-jednooki-signal',
  '18-magnetko',
  '19-carapa-na-anteni',
  '20-gramofonko',
] as const;
export type KljucIlustracijeBota = (typeof KLJUCEVI_ILUSTRACIJA_BOTA)[number];

/** Inicijalnih 46 javnih botova V5 — stabilan redoslijed seed ključeva. */
export const NADIMCI_JAVNIH_BOTOVA_V5 = [
  'BOTINA',
  'BOTINI',
  'BOTANIČAR',
  'BOTOKSIĆ',
  'BOTULIZAM',
  'BOTULJAK',
  'BOTIVACIJA',
  'BOTENCIJAL',
  'BOTENTAN',
  'BOTERAPIJA',
  'BOTOPIJA',
  'BOTEMATIKA',
  'BOTETIKA',
  'BOTOVNIK',
  'BOTOLOG',
  'BOTOPED',
  'BOTOGRAF',
  'BOTOGENIČAN',
  'BOTOKRAT',
  'BOTONOMIJA',
  'BOTOMAT',
  'BOTOMANIJA',
  'BOTOTRES',
  'BOTOKALIPSA',
  'BOTNADO',
  'BOTENSTEIN',
  'BOTREBA',
  'BOTVRDA',
  'BOTROŠAČ',
  'BOTRAGA',
  'BOTKAZ',
  'BOTICAJ',
  'BOTDSJETNIK',
  'BOTOVNICA',
  'SABOTER',
  'SUBOTA',
  'BOTONJA',
  'BOTARA',
  'BOTARELLA',
  'BOTATOUILLE',
  'BOTERDAM',
  'BOTODROM',
  'BOTOSLAV',
  'BOTOMIR',
  'BOTOLJUB',
  'KALABOT',
] as const;
export type NadimakJavnogBotaV5 = (typeof NADIMCI_JAVNIH_BOTOVA_V5)[number];

export const BROJ_JAVNIH_BOTOVA_V5 = NADIMCI_JAVNIH_BOTOVA_V5.length;

/** Rezervni odobreni nadimak pri koliziji javnog seeda (nije u inicijalnih 46). */
export const REZERVNI_NADIMAK_JAVNOG_FONDA_V5 = 'BOTZILLA' as const;

/**
 * Fiksna postava Trening/Izazov: 4 težine × 3 mjesta (1-based indeks u helperu).
 * BOTIVZAUBOJSTVO i BOTZILLA su namjerno izvan javnih 46.
 */
export const POSTAVA_TRENING_IZAZOV: Readonly<Record<ProfilTezineBota, readonly [string, string, string]>> = {
  pocetnik: ['BOTINI', 'BOTULJAK', 'BOTONJA'],
  iskusni: ['BOTANIČAR', 'BOTOGRAF', 'BOTOVNIK'],
  majstor: ['BOTOKRAT', 'SABOTER', 'BOTENSTEIN'],
  velemajstor: ['BOTZILLA', 'BOTOKALIPSA', 'BOTIVZAUBOJSTVO'],
};

/** Svi odobreni bot nadimci (javni + fiksni izvan fonda) → ključ ilustracije. */
export const ILUSTRACIJE_BOTOVA: Readonly<Record<string, KljucIlustracijeBota>> = {
  BOTINA: '03-brko-na-struju',
  BOTINI: '05-propelerko',
  BOTANIČAR: '09-lektorka',
  BOTOKSIĆ: '08-ronilac-na-suhom',
  BOTULIZAM: '01-skafander',
  BOTULJAK: '12-spavalica',
  BOTIVACIJA: '14-harmonikas',
  BOTENCIJAL: '15-periskop',
  BOTENTAN: '16-trubimir',
  BOTERAPIJA: '20-gramofonko',
  BOTOPIJA: '03-brko-na-struju',
  BOTEMATIKA: '09-lektorka',
  BOTETIKA: '06-kvacica',
  BOTOVNIK: '11-kazetko',
  BOTOLOG: '04-disketas',
  BOTOPED: '18-magnetko',
  BOTOGRAF: '04-disketas',
  BOTOGENIČAN: '02-pastoljub',
  BOTOKRAT: '07-burek-na-vezi',
  BOTONOMIJA: '11-kazetko',
  BOTOMAT: '18-magnetko',
  BOTOMANIJA: '14-harmonikas',
  BOTOTRES: '10-smetalo',
  BOTOKALIPSA: '17-jednooki-signal',
  BOTNADO: '10-smetalo',
  BOTENSTEIN: '18-magnetko',
  BOTREBA: '19-carapa-na-anteni',
  BOTVRDA: '01-skafander',
  BOTROŠAČ: '07-burek-na-vezi',
  BOTRAGA: '15-periskop',
  BOTKAZ: '06-kvacica',
  BOTICAJ: '16-trubimir',
  BOTDSJETNIK: '08-ronilac-na-suhom',
  BOTOVNICA: '12-spavalica',
  SABOTER: '06-kvacica',
  SUBOTA: '16-trubimir',
  BOTONJA: '19-carapa-na-anteni',
  BOTARA: '03-brko-na-struju',
  BOTARELLA: '20-gramofonko',
  BOTATOUILLE: '13-ekspres-lonac',
  BOTERDAM: '08-ronilac-na-suhom',
  BOTODROM: '05-propelerko',
  BOTOSLAV: '01-skafander',
  BOTOMIR: '12-spavalica',
  BOTOLJUB: '14-harmonikas',
  KALABOT: '02-pastoljub',
  BOTZILLA: '02-pastoljub',
  BOTIVZAUBOJSTVO: '10-smetalo',
};

const PROFIL_PO_NADIMKU: ReadonlyMap<string, ProfilTezineBota> = (() => {
  const mapa = new Map<string, ProfilTezineBota>();
  for (const profil of PROFILI_TEZINE_BOTA) {
    for (const nadimak of POSTAVA_TRENING_IZAZOV[profil]) {
      mapa.set(nadimak.toLocaleUpperCase('hr-HR'), profil);
    }
  }
  return mapa;
})();

const ODOBRENI_NADIMCI_SET = new Set(
  [...NADIMCI_JAVNIH_BOTOVA_V5, REZERVNI_NADIMAK_JAVNOG_FONDA_V5, 'BOTIVZAUBOJSTVO'].map((n) =>
    n.toLocaleUpperCase('hr-HR'),
  ),
);

/** Jedan bot: prvi iz postave; više: prva N imena istim redoslijedom (indeks 1-based). */
export function nadimakProfilaBota(
  profileId: ProfilTezineBota,
  indeks: number,
  ukupno: number,
): string {
  const postava = POSTAVA_TRENING_IZAZOV[profileId];
  const broj = Math.min(Math.max(ukupno, 1), postava.length);
  const mjesto = Math.min(Math.max(indeks, 1), broj);
  return postava[mjesto - 1]!;
}

export function kljucIlustracijeBota(nadimak: string | null | undefined): KljucIlustracijeBota | null {
  if (!nadimak) return null;
  return ILUSTRACIJE_BOTOVA[nadimak] ?? ILUSTRACIJE_BOTOVA[nadimak.toLocaleUpperCase('hr-HR')] ?? null;
}

export function putanjaIlustracijeBota(nadimak: string | null | undefined): string | null {
  const kljuc = kljucIlustracijeBota(nadimak);
  return kljuc ? `/avatari/botovi/${kljuc}.webp` : null;
}

export function profilIzNadimkaFiksnogBota(nadimak: string | null | undefined): ProfilTezineBota | null {
  if (!nadimak) return null;
  return PROFIL_PO_NADIMKU.get(nadimak.toLocaleUpperCase('hr-HR')) ?? null;
}

export function jeOdobrenNadimakBota(nadimak: string | null | undefined): boolean {
  if (!nadimak) return false;
  return ODOBRENI_NADIMCI_SET.has(nadimak.toLocaleUpperCase('hr-HR'));
}

export function jeNadimakJavnogFondaV5(nadimak: string | null | undefined): boolean {
  if (!nadimak) return false;
  const gornji = nadimak.toLocaleUpperCase('hr-HR');
  return (NADIMCI_JAVNIH_BOTOVA_V5 as readonly string[]).some(
    (n) => n.toLocaleUpperCase('hr-HR') === gornji,
  );
}

/** Prikaz: „BOT” velikim, ostatak malim (npr. BOTINA → BOTina, SABOTER → saBOTer). */
export type DijeloviNadimkaBota = { prije: string; bot: 'BOT'; poslije: string };

export function dijeloviNadimkaBota(nadimak: string | null | undefined): DijeloviNadimkaBota | null {
  if (!nadimak) return null;
  const indeks = nadimak.toLocaleUpperCase('hr-HR').indexOf('BOT');
  if (indeks < 0) return null;
  return {
    prije: nadimak.slice(0, indeks).toLocaleLowerCase('hr-HR'),
    bot: 'BOT',
    poslije: nadimak.slice(indeks + 3).toLocaleLowerCase('hr-HR'),
  };
}

export function formatirajNadimakBota(nadimak: string | null | undefined): string {
  const dijelovi = dijeloviNadimkaBota(nadimak);
  if (!dijelovi) return nadimak ?? '';
  return `${dijelovi.prije}${dijelovi.bot}${dijelovi.poslije}`;
}
