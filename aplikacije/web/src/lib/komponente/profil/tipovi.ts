import type { AvatarConfigV1, BrojacDostignuca, DnkProfil, ModPartije } from 'zajednicko';

export interface StatistikaRijeci {
  najduziStreak: number;
  otkriveneJakoRijetkeGrupe: number;
  otkriveneSrednjeRijetkeGrupe: number;
  otkriveneRijetkeGrupe: number;
  upisaneDugeRijeci: number;
  upisaneSrednjeDugeRijeci: number;
  upisaneJakoDugeRijeci: number;
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
}

export interface FormaProfil {
  status: 'nema_podataka' | 'prikupljanje' | 'pocetna_procjena' | 'puna_procjena';
  naziv: string | null;
  razina: number | null;
  vrijednost: number | null;
  brojPobjeda: number;
  brojPartija: number;
  trend: { smjer: 'gore' | 'dolje' | 'isto'; razlika: number; prethodnaVrijednost: number } | null;
  rezultati: { partijaId: string; kraj: string; plasman: number; bodovi: number; eliminacije: number }[];
  trenutniNiz: number;
  najboljiNiz: number;
  razinaVatre: 0 | 1 | 2 | 3;
  sljedeciBonusPostotak: number;
}

export interface DnkMetrike {
  eliminacijePoPartiji: number;
  nizPrihvacenihRijeci: number;
  prosjekPrihvacenogPotezaMs: number;
  dugeRijeciPoPartiji: number;
  rijetkeRijeciPoPartiji: number;
}

export interface Dostignuce {
  id: string;
  naziv: string;
  opis: string;
  kategorija: 'napredak' | 'rijeci' | 'vjestina' | 'kaladont' | 'igra';
  pragovi: readonly number[];
  vrijediUPrivatnoj: boolean;
  brojac: BrojacDostignuca;
  razina: number;
  vrijednost: number;
  sljedeciPrag: number | null;
  novo?: boolean;
}

export interface OsobniRekordi {
  najboljiNizPobjeda: number;
  nizPrihvacenihRijeci: number;
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najbrziPrihvaceniPotezMs: number | null;
}

export interface NapredakIzazovaProfil {
  trenutniLevel: number;
  zavrseniIzazovi: number;
  zvjezdice: 0 | 1 | 2 | 3 | 4 | 5;
  napredakDoSljedeceg: { zavrseno: number; ukupno: number } | null;
}

export interface FormatStatistika {
  odigrane: number;
  pobjede: number;
  eliminacije: number;
  bodovi: number;
  prosjekBodova: number;
  forma: FormaProfil;
}

/** Zajednički javni dio profila (vlastiti i javni). */
export interface JavniDioProfila {
  igracId: string;
  nadimak: string;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarSlikaHash?: string | null;
  odigrane: number;
  pobjede: number;
  eliminacijeUkupno: number;
  bodoviUkupno: number;
  prosjekBodova: number;
  rang: string;
  odigrane1v1: number;
  pobjede1v1: number;
  eliminacije1v1: number;
  bodovi1v1: number;
  prosjekBodova1v1: number;
  rang1v1: string;
  rangBrojPartija?: number;
  rangUcinak?: number;
  odigraneJavne?: number;
  pobjedeJavne?: number;
  eliminacijeJavne?: number;
  dnk: DnkProfil & { metrike: DnkMetrike };
  formati?: Record<ModPartije, FormatStatistika>;
  forma: { cetiriIgraca: FormaProfil; triIgraca?: FormaProfil; dvaIgraca: FormaProfil };
  prosjecnaOcjenaIgre: number | null;
  iskustvo: { razina: number; ukupno: number; uRazini: number; doIduce: number | null };
  stilIgre: 'agresivan' | 'uravnotežen' | 'dobrica' | 'neodređen';
  statistikaRijeci: StatistikaRijeci | null;
  ciljeviRijeci: { rijetke: { ukupno: number }; duge: { ukupno: number } };
  dostignuca: {
    ukupnoZvjezdica: number;
    maksimalnoZvjezdica: number;
    ukupnoOtkljucanih: number;
    dostignuca: Dostignuce[];
  };
  osobniRekordi?: OsobniRekordi;
  napredakIzazova?: NapredakIzazovaProfil;
}

export interface VlastitiProfil extends JavniDioProfila {
  vrsta: 'gost' | 'registriran' | 'admin';
  email: string | null;
  emailPotvrdjen: boolean;
  aktivnostDana?: { trenutniNiz: number; najboljiNiz: number; zadnjiAktivniDatum: string | null };
}

export interface JavniProfil extends JavniDioProfila {
  mozeVidjetiAktivnost?: boolean;
  jeBot?: boolean;
}

export type PogledProfila = 'pregled' | 'dostignuca' | 'rijeci' | 'povijest';

export function pogledIzHasha(hash: string): PogledProfila | null {
  const cisti = hash.replace(/^#/, '');
  if (cisti === 'pregled' || cisti === 'opcenito' || cisti === 'statistika') return 'pregled';
  if (cisti === 'dostignuca' || cisti === 'rijeci' || cisti === 'povijest') return cisti;
  return null;
}

export function hashZaPogled(pogled: PogledProfila): string {
  return `#${pogled}`;
}

export function formaTroboja(profil: JavniDioProfila): FormaProfil | null {
  if (profil.formati) return profil.formati.tri_igraca?.forma ?? null;
  return profil.forma.triIgraca ?? null;
}

export function formatirajTrajanjeMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '—';
  const sekunde = ms / 1000;
  return `${sekunde.toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}
