import { jeDostignuceVidljivo } from './dostupnost-igranja.js';
import { stanjeIskustva } from './iskustvo.js';

export type KategorijaDostignuca = 'napredak' | 'rijeci' | 'vjestina' | 'kaladont' | 'igra';

export type BrojacDostignuca =
  | 'razina'
  | 'valjaniPoteziUkupno'
  | 'rijetkeLeksemskeGrupe'
  | 'dugeRijeci'
  | 'najduziStreak'
  | 'kaladontIzvedbe'
  | 'kaladontZrtve'
  | 'izazvaneEliminacije'
  | 'mrtvaSlovaEliminacije'
  | 'javnePobjede'
  | 'treningPobjede'
  | 'povratneInformacije'
  | 'pohvaleNizUkupno'
  | 'pohvaleXpUkupno'
  /** Najbolji niz aktivnih dana; otključava se samo iz servisa aktivnog dana, ne iz party delte. */
  | 'najboljiNizAktivnosti'
  /** Dovršene dnevne i tjedne misije; samo servis dodjele. */
  | 'dovrseneMisije'
  /** Završene privatne igre s barem jednom prihvaćenom riječi; samo servis dodjele. */
  | 'privatneIgre'
  /** Potpuno dovršeni tjedni paketi; samo servis dodjele. */
  | 'tjedniPaketi'
  /** Dani s javnom pobjedom i u Dvoboju i u Četveroboju; samo servis dodjele. */
  | 'dvostrukeKrune'
  /** Javne pobjede bez pravog pogrešnog unosa i s barem pet riječi; samo servis dodjele. */
  | 'cistePetice'
  /** Javne igre u kojima su osvojene obje pohvale; samo servis dodjele. */
  | 'svePohvale'
  /** Različiti oblici koji su istodobno dugi i rijetki; samo servis dodjele. */
  | 'rijetkeGrdosije'
  /** Dani u kojima je dosegnut dnevni Top 10; samo servis dodjele. */
  | 'dnevneDesetke'
  /** Tjedni u kojima je dosegnut tjedni Top 10; samo servis dodjele. */
  | 'tjedneElite'
  /** Mjeseci u kojima je dosegnut mjesečni Top 10; samo servis dodjele. */
  | 'mjesecneElite'
  /** Razdoblja s Top 10 u bilo koja dva formata; samo servis dodjele. */
  | 'naDvijeFronte'
  /** Potvrđeni ispravci rječnika po prijavi; samo servis dodjele. */
  | 'jezicniDetektivi'
  /** Potvrđena uklanjanja računa zbog pogrdnog nadimka; samo servis dodjele. */
  | 'cinkarosi'
  /** HINT PR13: javne Troboj pobjede; samo servis dodjele (ne partijska delta). */
  | 'trobojPobjede'
  /** HINT PR13: različite javne igre s barem jednim uspješnim dokazom; max 1 / igra. */
  | 'igreSDokazom'
  /** HINT PR13: kaladont → sljedeći uz ≥3 aktivna u Klasičnom; više događaja / igra OK. */
  | 'kaladontSljedeci'
  /** HINT PR13: pobjede KA-ZNA u kojima je igrač izbacio autora „ka”; 1 / igra. */
  | 'staraSkolaPobjede'
  /** PR04: zvjezdice Izazivača (0–5) iz milestone skupova završenih izazova; samo servis. */
  | 'izazivacZvjezdice';

export const ID_DOSTIGNUCA_STALNO_SI_TU = 'stalno_si_tu';
export const ID_DOSTIGNUCA_IZAZIVAC = 'izazivac';
export const ID_DOSTIGNUCA_COVJEK_NA_MISIJI = 'covjek_na_misiji';
export const ID_DOSTIGNUCA_PRIVATNIK = 'privatnik';
export const ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM = 'tjedan_pod_kontrolom';
export const ID_DOSTIGNUCA_DVOSTRUKA_KRUNA = 'dvostruka_kruna';
export const ID_DOSTIGNUCA_CISTA_PETICA = 'cista_petica';
export const ID_DOSTIGNUCA_SVE_POHVALE = 'sve_pohvale';
export const ID_DOSTIGNUCA_RIJETKA_GRDOSIJA = 'rijetka_grdosija';
export const ID_DOSTIGNUCA_DNEVNA_DESETKA = 'dnevna_desetka';
export const ID_DOSTIGNUCA_TJEDNA_ELITA = 'tjedna_elita';
export const ID_DOSTIGNUCA_MJESECNA_ELITA = 'mjesecna_elita';
export const ID_DOSTIGNUCA_NA_DVIJE_FRONTE = 'na_dvije_fronte';
export const ID_DOSTIGNUCA_JEZICNI_DETEKTIV = 'jezicni_detektiv';
export const ID_DOSTIGNUCA_CINKAROS = 'cinkaros';
/** PR13 — ne miješati s katalogom `ka_zna` (žrtva kaladonta) ni pravilnikom `ka_zna`. */
export const ID_DOSTIGNUCA_TRECA_SRECA = 'treca_sreca';
export const ID_DOSTIGNUCA_IMAM_NASTAVAK = 'imam_nastavak';
export const ID_DOSTIGNUCA_SALJI_DALJE = 'salji_dalje';
export const ID_DOSTIGNUCA_STARA_SKOLA = 'stara_skola';

/** Brojači koji se ne smiju otključati kroz partijsku deltu. */
export const BROJACI_VAN_PARTIJSKE_DELTA: ReadonlySet<BrojacDostignuca> = new Set([
  'najboljiNizAktivnosti',
  'dovrseneMisije',
  'privatneIgre',
  'tjedniPaketi',
  'dvostrukeKrune',
  'cistePetice',
  'svePohvale',
  'rijetkeGrdosije',
  'dnevneDesetke',
  'tjedneElite',
  'mjesecneElite',
  'naDvijeFronte',
  'jezicniDetektivi',
  'cinkarosi',
  'trobojPobjede',
  'igreSDokazom',
  'kaladontSljedeci',
  'staraSkolaPobjede',
  'izazivacZvjezdice',
]);

export interface DefinicijaDostignuca {
  id: string;
  naziv: string;
  opis: string;
  kategorija: KategorijaDostignuca;
  pragovi: readonly number[];
  vrijediUPrivatnoj: boolean;
  brojac: BrojacDostignuca;
}

export interface NapredakDostignuca {
  razina: number;
  vrijednost: number;
}

export interface NovoDostignuce {
  id: string;
  novaRazina: number;
  maksimalnaRazina: number;
}

export type DeltaNapretkaDostignuca = Partial<Record<BrojacDostignuca, number>>;

export const DEFINICIJE_DOSTIGNUCA: readonly DefinicijaDostignuca[] = [
  { id: 'iskusnjara', naziv: 'Iskusnjara', opis: 'Dosegni razine iskustva.', kategorija: 'napredak', pragovi: [10, 20, 40, 70, 100], vrijediUPrivatnoj: false, brojac: 'razina' },
  { id: 'rijetkolovac', naziv: 'Rijetkolovac', opis: 'Otkrij rijetke riječi.', kategorija: 'rijeci', pragovi: [1, 5, 15, 40, 100], vrijediUPrivatnoj: true, brojac: 'rijetkeLeksemskeGrupe' },
  { id: 'dugometras', naziv: 'Dugometraš', opis: 'Odigraj duge riječi.', kategorija: 'rijeci', pragovi: [1, 10, 30, 75, 150], vrijediUPrivatnoj: true, brojac: 'dugeRijeci' },
  { id: 'jezik_u_plamenu', naziv: 'Jezik u plamenu', opis: 'Izgradi dugi niz prihvaćenih riječi.', kategorija: 'vjestina', pragovi: [3, 5, 7, 10, 15], vrijediUPrivatnoj: true, brojac: 'najduziStreak' },
  { id: 'vladar_niza', naziv: 'Vladar niza', opis: 'Osvoji pohvalu za najdulji niz u javnoj igri.', kategorija: 'vjestina', pragovi: [1, 15, 30, 60, 100], vrijediUPrivatnoj: false, brojac: 'pohvaleNizUkupno' },
  { id: 'xp_prvak', naziv: 'XP prvak', opis: 'Osvoji pohvalu za najviše XP-a u javnoj igri.', kategorija: 'napredak', pragovi: [1, 15, 30, 60, 100], vrijediUPrivatnoj: false, brojac: 'pohvaleXpUkupno' },
  { id: 'kaladont', naziv: 'Kaladont!', opis: 'Izvedi Kaladont.', kategorija: 'kaladont', pragovi: [1, 3, 10, 25, 50], vrijediUPrivatnoj: false, brojac: 'kaladontIzvedbe' },
  { id: 'ka_zna', naziv: 'KA-zna', opis: 'Budi izbačen Kaladontom.', kategorija: 'kaladont', pragovi: [1, 5, 15, 25, 50], vrijediUPrivatnoj: false, brojac: 'kaladontZrtve' },
  { id: 'lovac_na_glave', naziv: 'Lovac na glave', opis: 'Izazovi eliminacije.', kategorija: 'igra', pragovi: [1, 10, 30, 75, 150], vrijediUPrivatnoj: false, brojac: 'izazvaneEliminacije' },
  { id: 'slijepa_ulica', naziv: 'Slijepa ulica', opis: 'Izazovi eliminacije mrtvim slovima.', kategorija: 'igra', pragovi: [1, 5, 15, 40, 100], vrijediUPrivatnoj: false, brojac: 'mrtvaSlovaEliminacije' },
  { id: 'zavrsna_rijec', naziv: 'Završna riječ', opis: 'Pobijedi u javnoj igri.', kategorija: 'igra', pragovi: [1, 5, 20, 50, 100], vrijediUPrivatnoj: false, brojac: 'javnePobjede' },
  { id: 'glas_zajednice', naziv: 'Glas zajednice', opis: 'Pošalji povratnu informaciju o igri.', kategorija: 'igra', pragovi: [1, 2, 3, 4, 5], vrijediUPrivatnoj: false, brojac: 'povratneInformacije' },
  { id: 'zagrijan', naziv: 'Zagrijan', opis: 'Pobijedi u treningu protiv Računala.', kategorija: 'igra', pragovi: [1, 5, 20, 50, 100], vrijediUPrivatnoj: false, brojac: 'treningPobjede' },
  {
    id: ID_DOSTIGNUCA_STALNO_SI_TU,
    naziv: 'Stalno si tu',
    opis: 'Vraćaj se uzastopnih dana — dovoljno je otvoriti igru.',
    kategorija: 'napredak',
    pragovi: [2, 5, 10, 20, 30],
    vrijediUPrivatnoj: false,
    brojac: 'najboljiNizAktivnosti',
  },
  {
    id: ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
    naziv: 'Čovjek na misiji',
    opis: 'Dovršavaj dnevne i tjedne misije.',
    kategorija: 'napredak',
    pragovi: [1, 10, 50, 100, 250],
    vrijediUPrivatnoj: false,
    brojac: 'dovrseneMisije',
  },
  {
    id: ID_DOSTIGNUCA_PRIVATNIK,
    naziv: 'Privatnik',
    opis: 'Završi privatne igre i odigraj barem jednu prihvaćenu riječ u svakoj.',
    kategorija: 'igra',
    pragovi: [1, 5, 20, 50, 100],
    vrijediUPrivatnoj: true,
    brojac: 'privatneIgre',
  },
  {
    id: ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
    naziv: 'Tjedan pod kontrolom',
    opis: 'Dovrši sve tri tjedne misije iz istog paketa.',
    kategorija: 'napredak',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'tjedniPaketi',
  },
  {
    id: ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
    naziv: 'Dvostruka kruna',
    // HINT PR13: bilo koja dva različita formata 2/3/4 istog zagrebačkog dana.
    opis: 'Istoga dana pobijedi u bilo koja dva različita javna formata.',
    kategorija: 'igra',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'dvostrukeKrune',
  },
  {
    id: ID_DOSTIGNUCA_CISTA_PETICA,
    naziv: 'Čista petica',
    opis: 'Pobijedi u javnoj igri bez pogrešnog unosa, uz barem pet prihvaćenih riječi.',
    kategorija: 'vjestina',
    pragovi: [1, 5, 20, 50, 100],
    vrijediUPrivatnoj: false,
    brojac: 'cistePetice',
  },
  {
    id: ID_DOSTIGNUCA_SVE_POHVALE,
    naziv: 'Sve pohvale',
    opis: 'U istoj javnoj igri osvoji pohvalu za najdulji niz i najviše XP-a.',
    kategorija: 'vjestina',
    pragovi: [1, 5, 15, 30, 50],
    vrijediUPrivatnoj: false,
    brojac: 'svePohvale',
  },
  {
    id: ID_DOSTIGNUCA_RIJETKA_GRDOSIJA,
    naziv: 'Rijetka grdosija',
    opis: 'Odigraj različite riječi koje su istodobno duge i rijetke.',
    kategorija: 'rijeci',
    pragovi: [1, 5, 15, 40, 100],
    vrijediUPrivatnoj: true,
    brojac: 'rijetkeGrdosije',
  },
  {
    id: ID_DOSTIGNUCA_DNEVNA_DESETKA,
    naziv: 'Dnevna desetka',
    opis: 'Dosegni Top 10 na dnevnoj ljestvici u različitim danima.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'dnevneDesetke',
  },
  {
    id: ID_DOSTIGNUCA_TJEDNA_ELITA,
    naziv: 'Tjedna elita',
    opis: 'Dosegni Top 10 na tjednoj ljestvici u različitim tjednima.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'tjedneElite',
  },
  {
    id: ID_DOSTIGNUCA_MJESECNA_ELITA,
    naziv: 'Mjesečna elita',
    opis: 'Dosegni Top 10 na mjesečnoj ljestvici u različitim mjesecima.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'mjesecneElite',
  },
  {
    id: ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
    naziv: 'Na dvije fronte',
    // HINT PR13: Top 10 u bilo koja dva različita formata (2/3/4) za isto razdoblje.
    opis: 'U istom danu, tjednu ili mjesecu dosegni Top 10 u bilo koja dva različita formata.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'naDvijeFronte',
  },
  {
    id: ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
    naziv: 'Jezični detektiv',
    opis: 'Prijavi riječi i pomozi potvrđenim ispravcima rječnika.',
    kategorija: 'igra',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'jezicniDetektivi',
  },
  {
    id: ID_DOSTIGNUCA_CINKAROS,
    naziv: 'Cinkaroš',
    opis: 'Prijavi pogrdne nadimke zbog kojih administrator ukloni račun.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'cinkarosi',
  },
  // --- PR13: četiri nova dostignuća (servisna; kreću od novih događaja). ---
  {
    id: ID_DOSTIGNUCA_TRECA_SRECA,
    naziv: 'Treća sreća',
    opis: 'Pobijedi u javnim Trobojima.',
    kategorija: 'igra',
    pragovi: [1, 5, 15, 40, 100],
    vrijediUPrivatnoj: false,
    brojac: 'trobojPobjede',
  },
  {
    id: ID_DOSTIGNUCA_IMAM_NASTAVAK,
    naziv: 'Imam nastavak',
    opis: 'Uspješno dokaži nastavak u različitim javnim igrama.',
    kategorija: 'vjestina',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'igreSDokazom',
  },
  {
    id: ID_DOSTIGNUCA_SALJI_DALJE,
    naziv: 'Šalji dalje',
    opis: 'U Klasičnom izbaci sljedećeg kaladontom dok su u igri barem 3 igrača.',
    kategorija: 'kaladont',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'kaladontSljedeci',
  },
  {
    id: ID_DOSTIGNUCA_STARA_SKOLA,
    naziv: 'Stara škola',
    // HINT: odvojeno od dostignuća `ka_zna` (biti izbačen) i pravilnika `ka_zna`.
    opis: 'Pobijedi javnu igru KA-zna u kojoj si osobno izbacio autora „ka”.',
    kategorija: 'kaladont',
    pragovi: [1, 3, 10, 25, 50],
    vrijediUPrivatnoj: false,
    brojac: 'staraSkolaPobjede',
  },
  {
    id: ID_DOSTIGNUCA_IZAZIVAC,
    naziv: 'Izazivač',
    opis: 'Dovršavaj razine Izazova — zvjezdice prate milestone skupove.',
    kategorija: 'igra',
    pragovi: [1, 2, 3, 4, 5],
    vrijediUPrivatnoj: false,
    brojac: 'izazivacZvjezdice',
  },
] as const;

export const UKUPNO_ZVJEZDICA_DOSTIGNUCA = DEFINICIJE_DOSTIGNUCA.reduce((zbroj, definicija) => zbroj + definicija.pragovi.length, 0);

export function izracunajRazinuDostignuca(definicija: DefinicijaDostignuca, vrijednost: number): number {
  return definicija.pragovi.reduce((razina, prag, indeks) => (vrijednost >= prag ? indeks + 1 : razina), 0);
}

const PRIORITETI_ISTAKNUTIH_DOSTIGNUCA = [
  'iskusnjara',
  'glas_zajednice',
  'zagrijan',
  'kaladont',
  'rijetkolovac',
  'dugometras',
  'slijepa_ulica',
  'lovac_na_glave',
  'zavrsna_rijec',
  'ka_zna',
  'jezik_u_plamenu',
  'vladar_niza',
  'xp_prvak',
  ID_DOSTIGNUCA_STALNO_SI_TU,
  ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
  ID_DOSTIGNUCA_PRIVATNIK,
  ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
  ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
  ID_DOSTIGNUCA_CISTA_PETICA,
  ID_DOSTIGNUCA_SVE_POHVALE,
  ID_DOSTIGNUCA_RIJETKA_GRDOSIJA,
  ID_DOSTIGNUCA_DNEVNA_DESETKA,
  ID_DOSTIGNUCA_TJEDNA_ELITA,
  ID_DOSTIGNUCA_MJESECNA_ELITA,
  ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
  ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
  ID_DOSTIGNUCA_CINKAROS,
  ID_DOSTIGNUCA_TRECA_SRECA,
  ID_DOSTIGNUCA_IMAM_NASTAVAK,
  ID_DOSTIGNUCA_SALJI_DALJE,
  ID_DOSTIGNUCA_STARA_SKOLA,
  ID_DOSTIGNUCA_IZAZIVAC,
] as const;

export function odaberiIstaknutaDostignuca<T extends { id: string; razina: number }>(
  dostignuca: readonly T[],
  maksimalanBroj = 3,
): T[] {
  const prioritetPoId = new Map<string, number>(PRIORITETI_ISTAKNUTIH_DOSTIGNUCA.map((id, indeks) => [id, indeks]));
  const definicijaPoId = new Map(DEFINICIJE_DOSTIGNUCA.map((definicija) => [definicija.id, definicija]));

  return [...dostignuca]
    .filter((dostignuce) => {
      const definicija = definicijaPoId.get(dostignuce.id);
      return definicija !== undefined && Number.isInteger(dostignuce.razina) && dostignuce.razina >= 2 && dostignuce.razina <= definicija.pragovi.length;
    })
    .sort((prvo, drugo) => {
      const grupaPrvog = prvo.razina >= 4 ? 0 : prvo.id === 'iskusnjara' ? 1 : 2;
      const grupaDrugog = drugo.razina >= 4 ? 0 : drugo.id === 'iskusnjara' ? 1 : 2;
      return grupaPrvog - grupaDrugog || drugo.razina - prvo.razina || (prioritetPoId.get(prvo.id) ?? Infinity) - (prioritetPoId.get(drugo.id) ?? Infinity);
    })
    .slice(0, maksimalanBroj);
}

export function odaberiTopTriDostignuca<T extends { id: string; razina: number }>(dostignuca: readonly T[]): T[] {
  return odaberiIstaknutaDostignuca(dostignuca, 3);
}

export function izracunajNovaDostignuca(
  trajniNapredak: Readonly<Record<string, number>>,
  delta: DeltaNapretkaDostignuca,
  razinaIskustva: number,
  jePrivatna: boolean,
): NovoDostignuce[] {
  return DEFINICIJE_DOSTIGNUCA.flatMap((definicija) => {
    // Servisna dostignuća (aktivni dani, misije, privatnik, D02 kombinacije, Top 10, potvrđene prijave) ne idu kroz party deltu.
    if (definicija.id === ID_DOSTIGNUCA_STALNO_SI_TU || BROJACI_VAN_PARTIJSKE_DELTA.has(definicija.brojac)) return [];
    if (jePrivatna && !definicija.vrijediUPrivatnoj) return [];
    const staraVrijednost = definicija.brojac === 'razina'
      ? (trajniNapredak[definicija.brojac] ?? 0)
      : (trajniNapredak[definicija.brojac] ?? 0);
    const novaVrijednost = definicija.brojac === 'razina'
      ? razinaIskustva
      : definicija.brojac === 'najduziStreak'
        ? Math.max(staraVrijednost, delta[definicija.brojac] ?? 0)
      : staraVrijednost + (delta[definicija.brojac] ?? 0);
    const staraRazina = izracunajRazinuDostignuca(definicija, staraVrijednost);
    const novaRazina = izracunajRazinuDostignuca(definicija, novaVrijednost);
    return novaRazina > staraRazina
      ? [{ id: definicija.id, novaRazina, maksimalnaRazina: definicija.pragovi.length }]
      : [];
  });
}

export function jeDostignuceNovo(zadnjeOtkljucavanje: Date | string | null | undefined): boolean {
  if (!zadnjeOtkljucavanje) return false;
  const vrijeme = new Date(zadnjeOtkljucavanje).getTime();
  if (Number.isNaN(vrijeme)) return false;
  return Date.now() - vrijeme <= 24 * 60 * 60 * 1000;
}

export function dohvatiDefinicijuDostignuca(id: string): DefinicijaDostignuca | undefined {
  return DEFINICIJE_DOSTIGNUCA.find((definicija) => definicija.id === id);
}

/** Brojači i dinamičke vrijednosti za izračun razina (profil i ljestvica). */
export type BrojaciDostignucaZaIzracun = Partial<Record<BrojacDostignuca, number>> & {
  razina?: number;
  najboljiNizAktivnosti?: number;
};

/**
 * Ista formula kao profil: max(spremljena razina, dinamički izračun) po vidljivim dostignućima.
 * Koriste profil i ljestvica dostignuća.
 */
export function izracunajSazetakZvjezdicaDostignuca(ulaz: {
  iskustvoUkupno: number;
  najboljiNizAktivnosti: number;
  spremljeneRazine: ReadonlyMap<string, number>;
  brojac: BrojaciDostignucaZaIzracun | null | undefined;
}): { ukupnoZvjezdica: number; ukupnoOtkljucanih: number; maksimalnoZvjezdica: number } {
  const razinaIskustva = stanjeIskustva(ulaz.iskustvoUkupno).razina;
  const brojac = ulaz.brojac ?? {};
  const vidljive = DEFINICIJE_DOSTIGNUCA.filter((d) => jeDostignuceVidljivo(d.id));
  let ukupnoZvjezdica = 0;
  let ukupnoOtkljucanih = 0;
  for (const definicija of vidljive) {
    const vrijednost = definicija.brojac === 'razina'
      ? razinaIskustva
      : definicija.brojac === 'najboljiNizAktivnosti'
        ? ulaz.najboljiNizAktivnosti
        : Number(brojac[definicija.brojac] ?? 0);
    const izracunata = izracunajRazinuDostignuca(definicija, vrijednost);
    const razina = Math.max(ulaz.spremljeneRazine.get(definicija.id) ?? 0, izracunata);
    ukupnoZvjezdica += razina;
    if (razina > 0) ukupnoOtkljucanih += 1;
  }
  return {
    ukupnoZvjezdica,
    ukupnoOtkljucanih,
    maksimalnoZvjezdica: vidljive.reduce((z, d) => z + d.pragovi.length, 0),
  };
}
