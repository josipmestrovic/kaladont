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
  | 'tjedniPaketi';

export const ID_DOSTIGNUCA_STALNO_SI_TU = 'stalno_si_tu';
export const ID_DOSTIGNUCA_COVJEK_NA_MISIJI = 'covjek_na_misiji';
export const ID_DOSTIGNUCA_PRIVATNIK = 'privatnik';
export const ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM = 'tjedan_pod_kontrolom';

/** Brojači koji se ne smiju otključati kroz partijsku deltu. */
export const BROJACI_VAN_PARTIJSKE_DELTA: ReadonlySet<BrojacDostignuca> = new Set([
  'najboljiNizAktivnosti',
  'dovrseneMisije',
  'privatneIgre',
  'tjedniPaketi',
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
  { id: 'zavrsna_rijec', naziv: 'Završna riječ', opis: 'Pobijedi u javnoj partiji.', kategorija: 'igra', pragovi: [1, 5, 20, 50, 100], vrijediUPrivatnoj: false, brojac: 'javnePobjede' },
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
    // Servisna dostignuća (aktivni dani, misije, privatnik) ne idu kroz party deltu.
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
