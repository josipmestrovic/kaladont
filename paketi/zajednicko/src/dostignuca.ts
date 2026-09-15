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
  | 'javnePobjede';

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
  { id: 'kaladont', naziv: 'Kaladont!', opis: 'Izvedi Kaladont.', kategorija: 'kaladont', pragovi: [1, 3, 10, 25, 50], vrijediUPrivatnoj: false, brojac: 'kaladontIzvedbe' },
  { id: 'ka_zna', naziv: 'KA-zna', opis: 'Budi izbačen Kaladontom.', kategorija: 'kaladont', pragovi: [1, 5, 15, 25, 50], vrijediUPrivatnoj: false, brojac: 'kaladontZrtve' },
  { id: 'lovac_na_glave', naziv: 'Lovac na glave', opis: 'Izazovi eliminacije.', kategorija: 'igra', pragovi: [1, 10, 30, 75, 150], vrijediUPrivatnoj: false, brojac: 'izazvaneEliminacije' },
  { id: 'slijepa_ulica', naziv: 'Slijepa ulica', opis: 'Izazovi eliminacije mrtvim slovima.', kategorija: 'igra', pragovi: [1, 5, 15, 40, 100], vrijediUPrivatnoj: false, brojac: 'mrtvaSlovaEliminacije' },
  { id: 'zavrsna_rijec', naziv: 'Završna riječ', opis: 'Pobijedi u javnoj partiji.', kategorija: 'igra', pragovi: [1, 5, 20, 50, 100], vrijediUPrivatnoj: false, brojac: 'javnePobjede' },
] as const;

export const UKUPNO_ZVJEZDICA_DOSTIGNUCA = DEFINICIJE_DOSTIGNUCA.reduce((zbroj, definicija) => zbroj + definicija.pragovi.length, 0);

export function izracunajRazinuDostignuca(definicija: DefinicijaDostignuca, vrijednost: number): number {
  return definicija.pragovi.reduce((razina, prag, indeks) => (vrijednost >= prag ? indeks + 1 : razina), 0);
}

export function izracunajNovaDostignuca(
  trajniNapredak: Readonly<Record<string, number>>,
  delta: DeltaNapretkaDostignuca,
  razinaIskustva: number,
  jePrivatna: boolean,
): NovoDostignuce[] {
  return DEFINICIJE_DOSTIGNUCA.flatMap((definicija) => {
    if (jePrivatna && !definicija.vrijediUPrivatnoj) return [];
    const staraVrijednost = definicija.brojac === 'razina'
      ? (trajniNapredak[definicija.brojac] ?? 0)
      : (trajniNapredak[definicija.brojac] ?? 0);
    const novaVrijednost = definicija.brojac === 'razina'
      ? razinaIskustva
      : staraVrijednost + (delta[definicija.brojac] ?? 0);
    const staraRazina = izracunajRazinuDostignuca(definicija, staraVrijednost);
    const novaRazina = izracunajRazinuDostignuca(definicija, novaVrijednost);
    return novaRazina > staraRazina
      ? [{ id: definicija.id, novaRazina, maksimalnaRazina: definicija.pragovi.length }]
      : [];
  });
}

export function dohvatiDefinicijuDostignuca(id: string): DefinicijaDostignuca | undefined {
  return DEFINICIJE_DOSTIGNUCA.find((definicija) => definicija.id === id);
}
