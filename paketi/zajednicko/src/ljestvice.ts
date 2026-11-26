/**
 * Ljestvice igrača: vremenske (Troboj) i kumulativne (ukupni napredak), razdoblja, sažetak i API ugovor.
 * Izvor pravila: docs/02-pravila-igre/bodovanje-i-rangovi.md#vremenske-ljestvice.
 */
import type { AvatarConfigV1 } from './avatar.js';
import type { ModPartije } from './bodovanje.js';

export const ZONA_LJESTVICA = 'Europe/Zagreb';

/** Javne vremenske ljestvice Troboja (imaju razdoblja). */
export const METRIKE_VREMENSKE_LJESTVICA = [
  'prosjek_bodova',
  'niz_pobjeda',
  'najbrzi_igraci',
  'niz_rijeci',
] as const;

/** Kumulativne ljestvice ukupnog napretka (bez vremenskog filtera). */
export const METRIKE_NAPRETKA_LJESTVICA = [
  'iskustvo',
  'kolekcija',
  'izazovi',
  'dostignuca',
] as const;

/** Sve metrike vidljive u UI-ju i API-ju. Top 10 dostignuća koriste zaseban uski skup. */
export const METRIKE_LJESTVICA = [
  ...METRIKE_VREMENSKE_LJESTVICA,
  ...METRIKE_NAPRETKA_LJESTVICA,
] as const;

export const RAZDOBLJA_LJESTVICA = ['dnevno', 'tjedno', 'mjesecno', 'godisnje', 'svih_vremena'] as const;
/** Dulje razdoblje ima prednost pri izjednačenom mjestu u navigacijskom sažetku. */
export const REDOSLIJED_RAZDOBLJA_SAZETKA: readonly RazdobljeLjestvice[] = [
  'svih_vremena',
  'godisnje',
  'mjesecno',
  'tjedno',
  'dnevno',
];
/** Prioritet metrika pri istom mjestu u sažetku (niži indeks = veća prednost). */
export const REDOSLIJED_METRIKA_SAZETKA: readonly MetrikaLjestvice[] = [
  'prosjek_bodova',
  'niz_pobjeda',
  'najbrzi_igraci',
  'niz_rijeci',
  'iskustvo',
  'kolekcija',
  'izazovi',
  'dostignuca',
];
export const PRIKAZI_LJESTVICA = ['top', 'oko_mene'] as const;
export const VELICINA_PRIKAZA_LJESTVICE = 10;

export type MetrikaVremenskaLjestvice = (typeof METRIKE_VREMENSKE_LJESTVICA)[number];
export type MetrikaNapretkaLjestvice = (typeof METRIKE_NAPRETKA_LJESTVICA)[number];
export type MetrikaLjestvice = (typeof METRIKE_LJESTVICA)[number];
export type RazdobljeLjestvice = (typeof RAZDOBLJA_LJESTVICA)[number];
export type PrikazLjestvice = (typeof PRIKAZI_LJESTVICA)[number];
export type GrupaMetrikeLjestvice = 'troboj' | 'napredak';
export type VrstaMetrikeLjestvice = 'vremenska' | 'napredak';
export type SmjerRangiranjaLjestvice = 'desc' | 'asc';

export interface OpisMetrikeLjestvice {
  kljuc: MetrikaLjestvice;
  grupa: GrupaMetrikeLjestvice;
  vrsta: VrstaMetrikeLjestvice;
  naziv: string;
  kratkiNaziv: string;
  opis: string;
  smjer: SmjerRangiranjaLjestvice;
  imaRazdoblje: boolean;
}

export const REGISTAR_METRIKA_LJESTVICA: Record<MetrikaLjestvice, OpisMetrikeLjestvice> = {
  prosjek_bodova: {
    kljuc: 'prosjek_bodova',
    grupa: 'troboj',
    vrsta: 'vremenska',
    naziv: 'Prosjek bodova',
    kratkiNaziv: 'Bod.',
    opis: 'Najbolji učinak po partiji.',
    smjer: 'desc',
    imaRazdoblje: true,
  },
  niz_pobjeda: {
    kljuc: 'niz_pobjeda',
    grupa: 'troboj',
    vrsta: 'vremenska',
    naziv: 'Niz pobjeda',
    kratkiNaziv: 'Niz',
    opis: 'Najviše pobjeda zaredom.',
    smjer: 'desc',
    imaRazdoblje: true,
  },
  najbrzi_igraci: {
    kljuc: 'najbrzi_igraci',
    grupa: 'troboj',
    vrsta: 'vremenska',
    naziv: 'Najbrži igrači',
    kratkiNaziv: 'Brzina',
    opis: 'Najkraće prosječno vrijeme prihvaćenog poteza.',
    smjer: 'asc',
    imaRazdoblje: true,
  },
  niz_rijeci: {
    kljuc: 'niz_rijeci',
    grupa: 'troboj',
    vrsta: 'vremenska',
    naziv: 'Niz riječi',
    kratkiNaziv: 'Niz r.',
    opis: 'Najviše prihvaćenih riječi zaredom u jednoj partiji.',
    smjer: 'desc',
    imaRazdoblje: true,
  },
  iskustvo: {
    kljuc: 'iskustvo',
    grupa: 'napredak',
    vrsta: 'napredak',
    naziv: 'Iskustvo (XP)',
    kratkiNaziv: 'XP',
    opis: 'Najviše ukupno osvojenog iskustva.',
    smjer: 'desc',
    imaRazdoblje: false,
  },
  kolekcija: {
    kljuc: 'kolekcija',
    grupa: 'napredak',
    vrsta: 'napredak',
    naziv: 'Kolekcionari',
    kratkiNaziv: 'Kolek.',
    opis: 'Najveća kolekcija otključanih riječi.',
    smjer: 'desc',
    imaRazdoblje: false,
  },
  izazovi: {
    kljuc: 'izazovi',
    grupa: 'napredak',
    vrsta: 'napredak',
    naziv: 'Izazivači',
    kratkiNaziv: 'Izaz.',
    opis: 'Najviše uspješno završenih izazova.',
    smjer: 'desc',
    imaRazdoblje: false,
  },
  dostignuca: {
    kljuc: 'dostignuca',
    grupa: 'napredak',
    vrsta: 'napredak',
    naziv: 'Dostignuća',
    kratkiNaziv: 'Zvij.',
    opis: 'Najviše osvojenih zvjezdica.',
    smjer: 'desc',
    imaRazdoblje: false,
  },
};

export function jeVremenskaMetrika(metrika: MetrikaLjestvice): metrika is MetrikaVremenskaLjestvice {
  return REGISTAR_METRIKA_LJESTVICA[metrika].vrsta === 'vremenska';
}

export function jeNapredakMetrika(metrika: MetrikaLjestvice): metrika is MetrikaNapretkaLjestvice {
  return REGISTAR_METRIKA_LJESTVICA[metrika].vrsta === 'napredak';
}

export function jeMetrikaLjestvice(vrijednost: string | null | undefined): vrijednost is MetrikaLjestvice {
  return !!vrijednost && (METRIKE_LJESTVICA as readonly string[]).includes(vrijednost);
}

export type StatusPozicije =
  | 'rangiran'
  | 'nije_igrano'
  | 'nedovoljan_broj_igara'
  | 'nedovoljan_broj_poteza'
  | 'podaci_nepotpuni'
  | 'nema_rezultata'
  | 'zakljucano'
  | 'prijava_potrebna';

export interface PozicijaNaLjestvici {
  status: StatusPozicije;
  mjesto: number | null;
  odigraneIgre: number | null;
  minimumIgara: number;
  nedostajeIgara: number | null;
  /** Relevantno za brzinu; inače `null`. */
  prihvaceniPotezi?: number | null;
  minimumPoteza?: number | null;
  nedostajePoteza?: number | null;
}

export type VrijednostLjestvice =
  | { vrsta: 'prosjek_bodova'; prosjek: number; bodoviUkupno: number }
  | { vrsta: 'niz_pobjeda'; broj: number }
  | { vrsta: 'prosjek_brzine'; prosjekMs: number; prihvaceniPotezi: number }
  | { vrsta: 'niz_rijeci'; broj: number }
  | { vrsta: 'iskustvo'; iskustvoUkupno: number; razina: number }
  | { vrsta: 'kolekcija'; broj: number }
  | { vrsta: 'izazovi'; zavrseno: number; ukupno: number; nazivLevela: string | null }
  | { vrsta: 'dostignuca'; zvjezdice: number; otkljucano: number };

export interface RedakLjestvice {
  mjesto: number;
  igracId: string;
  nadimak: string;
  jeJavanProfil: boolean;
  jeJa: boolean;
  odigraneIgre: number;
  vrijednost: VrijednostLjestvice;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
}

export interface OpisRazdobljaLjestvice {
  vrsta: RazdobljeLjestvice;
  /** UTC ISO; početak obuhvata nakon reza `podaciOd`. */
  od: string;
  /** UTC ISO trenutak resetiranja; `null` za svih vremena. */
  do: string | null;
  podaciOd: string;
  stanje: 'aktivno' | 'zakljucano';
  otkljucavaSe: string | null;
}

interface OdgovorLjestviceBazni {
  ok: true;
  metrika: MetrikaLjestvice;
  prikaz: PrikazLjestvice;
  redci: RedakLjestvice[];
  /** Pun redak vlastite rangirane pozicije (i unutar i izvan Top 10); `null` ako nije rangiran. */
  mojRedak: RedakLjestvice | null;
  mojaPozicija: PozicijaNaLjestvici;
  izracunatoU: string;
}

export interface OdgovorVremenskeLjestvice extends OdgovorLjestviceBazni {
  vrstaOdgovora: 'vremenska';
  mod: ModPartije;
  metrika: MetrikaVremenskaLjestvice;
  razdoblje: OpisRazdobljaLjestvice;
  minimumIgara: number;
  minimumPoteza: number | null;
  pozicijePoRazdobljima: Record<RazdobljeLjestvice, PozicijaNaLjestvici>;
  svihVremenaOtkljucavaSe: string;
}

export interface OdgovorNapretkaLjestvice extends OdgovorLjestviceBazni {
  vrstaOdgovora: 'napredak';
  metrika: MetrikaNapretkaLjestvice;
  opisObuhvata: string;
}

export type OdgovorLjestvice = OdgovorVremenskeLjestvice | OdgovorNapretkaLjestvice;

export type StatusSazetkaLjestvice =
  | { vrsta: 'rangiran'; mjesto: number; metrika: MetrikaLjestvice; razdoblje: RazdobljeLjestvice | null }
  | { vrsta: 'nedostaje'; nedostajeIgara: number; metrika: MetrikaVremenskaLjestvice; razdoblje: RazdobljeLjestvice }
  | { vrsta: 'nema_rezultata'; metrika: MetrikaLjestvice; razdoblje: RazdobljeLjestvice | null }
  | { vrsta: 'neutralan' };

export interface KandidatSazetkaLjestvice {
  metrika: MetrikaLjestvice;
  /** `null` za kumulativne metrike. */
  razdoblje: RazdobljeLjestvice | null;
  pozicija: PozicijaNaLjestvici;
}

function indeksMetrikeSazetka(metrika: MetrikaLjestvice): number {
  const indeks = REDOSLIJED_METRIKA_SAZETKA.indexOf(metrika);
  return indeks >= 0 ? indeks : REDOSLIJED_METRIKA_SAZETKA.length;
}

function usporediKandidateSazetka(a: KandidatSazetkaLjestvice, b: KandidatSazetkaLjestvice): number {
  const metrika = indeksMetrikeSazetka(a.metrika) - indeksMetrikeSazetka(b.metrika);
  if (metrika !== 0) return metrika;
  if (a.razdoblje === null && b.razdoblje === null) return 0;
  if (a.razdoblje === null) return 1;
  if (b.razdoblje === null) return -1;
  return REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(a.razdoblje) - REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(b.razdoblje);
}

/** Najbolji navigacijski status: najmanje mjesto; pri izjednačenju prioritet metrika pa dulje razdoblje. */
export function odaberiSazetakLjestvice(kandidati: readonly KandidatSazetkaLjestvice[]): StatusSazetkaLjestvice {
  const rangirani = kandidati.filter(
    (k) => k.pozicija.status === 'rangiran' && k.pozicija.mjesto !== null && k.pozicija.mjesto > 0,
  );
  if (rangirani.length > 0) {
    const poredani = [...rangirani].sort((a, b) => {
      const mjesto = a.pozicija.mjesto! - b.pozicija.mjesto!;
      if (mjesto !== 0) return mjesto;
      return usporediKandidateSazetka(a, b);
    });
    const najbolji = poredani[0]!;
    return {
      vrsta: 'rangiran',
      mjesto: najbolji.pozicija.mjesto!,
      metrika: najbolji.metrika,
      razdoblje: najbolji.razdoblje,
    };
  }

  const doPoretka = kandidati.filter(
    (k) =>
      jeVremenskaMetrika(k.metrika)
      && k.razdoblje !== null
      && (k.pozicija.status === 'nedovoljan_broj_igara'
        || k.pozicija.status === 'nije_igrano'
        || k.pozicija.status === 'nedovoljan_broj_poteza')
      && k.pozicija.nedostajeIgara !== null
      && k.pozicija.nedostajeIgara > 0,
  );
  if (doPoretka.length > 0) {
    const poredani = [...doPoretka].sort((a, b) => {
      const nedostaje = a.pozicija.nedostajeIgara! - b.pozicija.nedostajeIgara!;
      if (nedostaje !== 0) return nedostaje;
      return usporediKandidateSazetka(a, b);
    });
    const najbolji = poredani[0]!;
    return {
      vrsta: 'nedostaje',
      nedostajeIgara: najbolji.pozicija.nedostajeIgara!,
      metrika: najbolji.metrika as MetrikaVremenskaLjestvice,
      razdoblje: najbolji.razdoblje!,
    };
  }

  const bezRezultata = kandidati.find((k) => k.pozicija.status === 'nema_rezultata');
  if (bezRezultata) {
    return {
      vrsta: 'nema_rezultata',
      metrika: bezRezultata.metrika,
      razdoblje: bezRezultata.razdoblje,
    };
  }

  return { vrsta: 'neutralan' };
}

export interface OdgovorSazetkaLjestvice {
  ok: true;
  status: StatusSazetkaLjestvice;
  izracunatoU: string;
}

export interface StavkaNajopasnijeRijeci {
  mjesto: number;
  rijec: string;
  brojEliminacija: number;
}

export interface OdgovorNajopasnijihRijeci {
  ok: true;
  rijeci: StavkaNajopasnijeRijeci[];
  imaJos: boolean;
}

/** PR11: dnevno 5, sva dulja razdoblja 10. Top 10 redaka i rang/DNK prag 10 ostaju odvojene konstante. */
export function minimumIgaraZaRazdoblje(razdoblje: RazdobljeLjestvice): number {
  return razdoblje === 'dnevno' ? 5 : 10;
}

/** Dodatni prag prihvaćenih poteza za ljestvicu brzine. */
export function minimumPrihvacenihPotezaZaRazdoblje(razdoblje: RazdobljeLjestvice): number {
  return razdoblje === 'dnevno' ? 30 : 50;
}

/** Deep link na točnu metriku (i razdoblje za vremenske). */
export function putanjaLjestvice(metrika: MetrikaLjestvice, razdoblje?: RazdobljeLjestvice | null): string {
  const params = new URLSearchParams({ kategorija: 'igraci', metrika });
  if (jeVremenskaMetrika(metrika)) {
    params.set('razdoblje', razdoblje && (RAZDOBLJA_LJESTVICA as readonly string[]).includes(razdoblje) ? razdoblje : 'dnevno');
  }
  return `/ljestvice?${params.toString()}`;
}

interface LokalniDatum {
  godina: number;
  mjesec: number;
  dan: number;
}

const formatZagreb = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_LJESTVICA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function dijeloviZagreb(trenutak: Date) {
  const dijelovi = Object.fromEntries(formatZagreb.formatToParts(trenutak).map((d) => [d.type, d.value]));
  return {
    godina: Number(dijelovi.year),
    mjesec: Number(dijelovi.month),
    dan: Number(dijelovi.day),
    sat: Number(dijelovi.hour),
    minuta: Number(dijelovi.minute),
    sekunda: Number(dijelovi.second),
  };
}

function pomakZagrebMs(trenutak: Date): number {
  const d = dijeloviZagreb(trenutak);
  const kaoUtc = Date.UTC(d.godina, d.mjesec - 1, d.dan, d.sat, d.minuta, d.sekunda);
  return kaoUtc - Math.floor(trenutak.getTime() / 1000) * 1000;
}

/** Lokalna zagrebačka ponoć zadanog datuma kao UTC trenutak (ponoć nikad ne pada u rupu promjene sata). */
export function zagrebackaPonoc(datum: LokalniDatum): Date {
  const naivno = Date.UTC(datum.godina, datum.mjesec - 1, datum.dan);
  let utc = naivno - pomakZagrebMs(new Date(naivno));
  utc = naivno - pomakZagrebMs(new Date(utc));
  return new Date(utc);
}

function pomakniDane(datum: LokalniDatum, dani: number): LokalniDatum {
  const d = new Date(Date.UTC(datum.godina, datum.mjesec - 1, datum.dan + dani));
  return { godina: d.getUTCFullYear(), mjesec: d.getUTCMonth() + 1, dan: d.getUTCDate() };
}

/** Kalendarske granice [od, do) razdoblja koje sadrži `trenutak`, bez reza na početak praćenja. */
export function kalendarskeGranice(
  razdoblje: Exclude<RazdobljeLjestvice, 'svih_vremena'>,
  trenutak: Date,
): { od: Date; do: Date } {
  const d = dijeloviZagreb(trenutak);
  const danas: LokalniDatum = { godina: d.godina, mjesec: d.mjesec, dan: d.dan };
  if (razdoblje === 'dnevno') {
    return { od: zagrebackaPonoc(danas), do: zagrebackaPonoc(pomakniDane(danas, 1)) };
  }
  if (razdoblje === 'tjedno') {
    const danUTjednu = (new Date(Date.UTC(d.godina, d.mjesec - 1, d.dan)).getUTCDay() + 6) % 7;
    const ponedjeljak = pomakniDane(danas, -danUTjednu);
    return { od: zagrebackaPonoc(ponedjeljak), do: zagrebackaPonoc(pomakniDane(ponedjeljak, 7)) };
  }
  if (razdoblje === 'mjesecno') {
    const sljedeci = d.mjesec === 12 ? { godina: d.godina + 1, mjesec: 1 } : { godina: d.godina, mjesec: d.mjesec + 1 };
    return {
      od: zagrebackaPonoc({ godina: d.godina, mjesec: d.mjesec, dan: 1 }),
      do: zagrebackaPonoc({ ...sljedeci, dan: 1 }),
    };
  }
  return {
    od: zagrebackaPonoc({ godina: d.godina, mjesec: 1, dan: 1 }),
    do: zagrebackaPonoc({ godina: d.godina + 1, mjesec: 1, dan: 1 }),
  };
}

/** Isti kalendarski dan i sat godinu kasnije u Zagrebu; 29. 2. prelazi u 28. 2. */
export function godisnjicaPocetka(pocetak: Date): Date {
  const d = dijeloviZagreb(pocetak);
  const godina = d.godina + 1;
  const dan = Math.min(d.dan, new Date(Date.UTC(godina, d.mjesec, 0)).getUTCDate());
  const ponoc = zagrebackaPonoc({ godina, mjesec: d.mjesec, dan });
  const naivno = ponoc.getTime() + ((d.sat * 60 + d.minuta) * 60 + d.sekunda) * 1000;
  return new Date(naivno - (pomakZagrebMs(new Date(naivno)) - pomakZagrebMs(ponoc)));
}

export interface GraniceRazdoblja {
  od: Date;
  do: Date | null;
  zakljucano: boolean;
  otkljucavaSe: Date | null;
}

/** Obuhvat razdoblja uz rez na početak praćenja; svih vremena je zaključano do prve godišnjice. */
export function graniceRazdoblja(razdoblje: RazdobljeLjestvice, trenutak: Date, pocetakPracenja: Date): GraniceRazdoblja {
  if (razdoblje === 'svih_vremena') {
    const otkljucavaSe = godisnjicaPocetka(pocetakPracenja);
    return { od: pocetakPracenja, do: null, zakljucano: trenutak < otkljucavaSe, otkljucavaSe };
  }
  const granice = kalendarskeGranice(razdoblje, trenutak);
  return {
    od: granice.od < pocetakPracenja ? pocetakPracenja : granice.od,
    do: granice.do,
    zakljucano: false,
    otkljucavaSe: null,
  };
}

/** Globalna mjesta [od, do] za prikaz „Oko mene": četiri iznad, pet ispod, nadopuna na rubovima. */
export function prozorOkoMjesta(mjesto: number, brojRangiranih: number): { od: number; do: number } {
  const velicina = VELICINA_PRIKAZA_LJESTVICE;
  const od = Math.max(1, Math.min(mjesto - 4, Math.max(1, brojRangiranih - velicina + 1)));
  return { od, do: Math.min(brojRangiranih, od + velicina - 1) };
}

/** Tekst odbrojavanja: ispod dana „HH:MM:SS", inače „X d Y h". */
export function formatirajOdbrojavanje(preostaloMs: number): string {
  const sekunde = Math.max(0, Math.floor(preostaloMs / 1000));
  const dani = Math.floor(sekunde / 86_400);
  const sati = Math.floor((sekunde % 86_400) / 3600);
  if (dani > 0) return `${dani} d ${sati} h`;
  const minute = Math.floor((sekunde % 3600) / 60);
  const s = sekunde % 60;
  return [sati, minute, s].map((broj) => String(broj).padStart(2, '0')).join(':');
}
