/**
 * Vremenske ljestvice: razdoblja po zagrebačkom kalendaru, minimumi, prozor „Oko mene" i ugovor API-ja.
 * Izvor pravila: docs/02-pravila-igre/bodovanje-i-rangovi.md#vremenske-ljestvice.
 */
import type { AvatarConfigV1 } from './avatar.js';
import type { ModPartije } from './bodovanje.js';

export const ZONA_LJESTVICA = 'Europe/Zagreb';
export const METRIKE_LJESTVICA = ['prosjek_bodova', 'niz_pobjeda'] as const;
export const RAZDOBLJA_LJESTVICA = ['dnevno', 'tjedno', 'mjesecno', 'godisnje', 'svih_vremena'] as const;
/** Dulje razdoblje ima prednost pri izjednačenom mjestu u navigacijskom sažetku. */
export const REDOSLIJED_RAZDOBLJA_SAZETKA: readonly RazdobljeLjestvice[] = [
  'svih_vremena',
  'godisnje',
  'mjesecno',
  'tjedno',
  'dnevno',
];
export const PRIKAZI_LJESTVICA = ['top', 'oko_mene'] as const;
export const VELICINA_PRIKAZA_LJESTVICE = 10;

export type MetrikaLjestvice = (typeof METRIKE_LJESTVICA)[number];
export type RazdobljeLjestvice = (typeof RAZDOBLJA_LJESTVICA)[number];
export type PrikazLjestvice = (typeof PRIKAZI_LJESTVICA)[number];

export type StatusPozicije =
  | 'rangiran'
  | 'nije_igrano'
  | 'nedovoljan_broj_igara'
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
}

export type VrijednostLjestvice =
  | { vrsta: 'prosjek_bodova'; prosjek: number; bodoviUkupno: number }
  | { vrsta: 'niz_pobjeda'; broj: number };

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

export interface OdgovorLjestvice {
  ok: true;
  mod: ModPartije;
  metrika: MetrikaLjestvice;
  prikaz: PrikazLjestvice;
  razdoblje: OpisRazdobljaLjestvice;
  minimumIgara: number;
  redci: RedakLjestvice[];
  /** Pun redak vlastite rangirane pozicije (i unutar i izvan Top 10); `null` ako nije rangiran. */
  mojRedak: RedakLjestvice | null;
  mojaPozicija: PozicijaNaLjestvici;
  pozicijePoRazdobljima: Record<RazdobljeLjestvice, PozicijaNaLjestvici>;
  svihVremenaOtkljucavaSe: string;
  izracunatoU: string;
}

export type StatusSazetkaLjestvice =
  | { vrsta: 'rangiran'; mjesto: number; metrika: MetrikaLjestvice; razdoblje: RazdobljeLjestvice }
  | { vrsta: 'nedostaje'; nedostajeIgara: number; metrika: MetrikaLjestvice; razdoblje: RazdobljeLjestvice }
  | { vrsta: 'nema_rezultata'; metrika: MetrikaLjestvice; razdoblje: RazdobljeLjestvice }
  | { vrsta: 'neutralan' };

export interface KandidatSazetkaLjestvice {
  metrika: MetrikaLjestvice;
  razdoblje: RazdobljeLjestvice;
  pozicija: PozicijaNaLjestvici;
}

/** Najbolji navigacijski status: najmanje mjesto; pri izjednačenju prosjek pa dulje razdoblje; inače najmanji nedostajeIgara. */
export function odaberiSazetakLjestvice(kandidati: readonly KandidatSazetkaLjestvice[]): StatusSazetkaLjestvice {
  const rangirani = kandidati.filter(
    (k) => k.pozicija.status === 'rangiran' && k.pozicija.mjesto !== null && k.pozicija.mjesto > 0,
  );
  if (rangirani.length > 0) {
    const poredani = [...rangirani].sort((a, b) => {
      const mjesto = a.pozicija.mjesto! - b.pozicija.mjesto!;
      if (mjesto !== 0) return mjesto;
      const metrika =
        (a.metrika === 'prosjek_bodova' ? 0 : 1) - (b.metrika === 'prosjek_bodova' ? 0 : 1);
      if (metrika !== 0) return metrika;
      return REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(a.razdoblje) - REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(b.razdoblje);
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
      (k.pozicija.status === 'nedovoljan_broj_igara' || k.pozicija.status === 'nije_igrano')
      && k.pozicija.nedostajeIgara !== null
      && k.pozicija.nedostajeIgara > 0,
  );
  if (doPoretka.length > 0) {
    const poredani = [...doPoretka].sort((a, b) => {
      const nedostaje = a.pozicija.nedostajeIgara! - b.pozicija.nedostajeIgara!;
      if (nedostaje !== 0) return nedostaje;
      const metrika =
        (a.metrika === 'prosjek_bodova' ? 0 : 1) - (b.metrika === 'prosjek_bodova' ? 0 : 1);
      if (metrika !== 0) return metrika;
      return REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(a.razdoblje) - REDOSLIJED_RAZDOBLJA_SAZETKA.indexOf(b.razdoblje);
    });
    const najbolji = poredani[0]!;
    return {
      vrsta: 'nedostaje',
      nedostajeIgara: najbolji.pozicija.nedostajeIgara!,
      metrika: najbolji.metrika,
      razdoblje: najbolji.razdoblje,
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
