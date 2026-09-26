import type { ModPartije } from './bodovanje.js';

export type StatusForme = 'nema_podataka' | 'prikupljanje' | 'pocetna_procjena' | 'puna_procjena';
export type SmjerTrenda = 'gore' | 'dolje' | 'isto';
export type RazinaVatre = 0 | 1 | 2 | 3;

export interface RezultatForme {
  partijaId: string;
  kraj: string;
  plasman: number;
  bodovi: number;
  eliminacije: number;
}

export interface PobjednickiNiz {
  trenutniNiz: number;
  najboljiNiz: number;
  zadnjaObradenaPartijaId: string | null;
}

export interface TrendForme {
  smjer: SmjerTrenda;
  razlika: number;
  prethodnaVrijednost: number;
}

export interface FormaIgraca {
  status: StatusForme;
  naziv: string | null;
  razina: number | null;
  vrijednost: number | null;
  brojPobjeda: number;
  brojPartija: number;
  trend: TrendForme | null;
  rezultati: readonly RezultatForme[];
}

interface PragForme {
  naziv: string;
  donjiPrag: number;
}

const PRAGOVI_1V1: readonly PragForme[] = [
  { naziv: 'Loša', donjiPrag: 0 },
  { naziv: 'Slaba', donjiPrag: 0.1 },
  { naziv: 'Prolazna', donjiPrag: 0.2 },
  { naziv: 'Dobra', donjiPrag: 0.3 },
  { naziv: 'Odlična', donjiPrag: 0.5 },
  { naziv: 'Izvanredna', donjiPrag: 0.7 },
  { naziv: 'Sjajna', donjiPrag: 0.8 },
  { naziv: 'Top forma', donjiPrag: 0.9 },
];

const PRAGOVI_4P: readonly PragForme[] = [
  { naziv: 'Loša', donjiPrag: 0 },
  { naziv: 'Slaba', donjiPrag: 0.75 },
  { naziv: 'Prolazna', donjiPrag: 1.25 },
  { naziv: 'Dobra', donjiPrag: 1.75 },
  { naziv: 'Odlična', donjiPrag: 2.5 },
  { naziv: 'Izvanredna', donjiPrag: 3.25 },
  { naziv: 'Sjajna', donjiPrag: 4 },
  { naziv: 'Top forma', donjiPrag: 5 },
];

function odrediPrag(vrijednost: number, pragovi: readonly PragForme[]): { naziv: string; razina: number } {
  let odabrani = pragovi[0]!;
  let razina = 1;
  for (let indeks = 0; indeks < pragovi.length; indeks += 1) {
    const prag = pragovi[indeks]!;
    if (vrijednost >= prag.donjiPrag) {
      odabrani = prag;
      razina = indeks + 1;
    }
  }
  return { naziv: odabrani.naziv, razina };
}

function vrijednostZaRezultate(rezultati: readonly RezultatForme[], mod: ModPartije): number {
  if (rezultati.length === 0) return 0;
  if (mod === 'dva_igraca') return rezultati.filter((rezultat) => rezultat.plasman === 1).length / rezultati.length;
  return rezultati.reduce((zbroj, rezultat) => zbroj + rezultat.bodovi, 0) / rezultati.length;
}

function brojPobjeda(rezultati: readonly RezultatForme[]): number {
  return rezultati.filter((rezultat) => rezultat.plasman === 1).length;
}

function izracunajTrend(rezultati: readonly RezultatForme[], mod: ModPartije): TrendForme | null {
  if (rezultati.length < 20) return null;
  const trenutni = rezultati.slice(0, 10);
  const prethodni = rezultati.slice(10, 20);
  if (prethodni.length < 10) return null;
  const trenutnaVrijednost = vrijednostZaRezultate(trenutni, mod);
  const prethodnaVrijednost = vrijednostZaRezultate(prethodni, mod);
  const razlika = trenutnaVrijednost - prethodnaVrijednost;
  return {
    smjer: razlika > 0 ? 'gore' : razlika < 0 ? 'dolje' : 'isto',
    razlika,
    prethodnaVrijednost,
  };
}

export function izracunajFormu(rezultatiUlaz: readonly RezultatForme[], mod: ModPartije): FormaIgraca {
  const rezultati = rezultatiUlaz.slice(0, 20);
  const brojPartija = Math.min(rezultati.length, 10);
  const prozor = rezultati.slice(0, brojPartija);
  const pobjede = brojPobjeda(prozor);
  const status: StatusForme = brojPartija === 0
    ? 'nema_podataka'
    : brojPartija < 5
      ? 'prikupljanje'
      : brojPartija < 10
        ? 'pocetna_procjena'
        : 'puna_procjena';
  const vrijednost = brojPartija === 0 ? null : vrijednostZaRezultate(prozor, mod);
  const prag = vrijednost === null ? null : odrediPrag(vrijednost, mod === 'dva_igraca' ? PRAGOVI_1V1 : PRAGOVI_4P);
  return {
    status,
    naziv: status === 'nema_podataka' || status === 'prikupljanje' ? null : prag!.naziv,
    razina: status === 'nema_podataka' || status === 'prikupljanje' ? null : prag!.razina,
    vrijednost,
    brojPobjeda: pobjede,
    brojPartija,
    trend: izracunajTrend(rezultati, mod),
    rezultati: prozor,
  };
}

export function bonusPobjednickogNiza(niz: number, mod: ModPartije): number {
  if (niz <= 1) return 0;
  const korak = mod === 'dva_igraca' ? 5 : 10;
  return Math.min(100, (niz - 1) * korak);
}

export function azurirajPobjednickiNiz(
  prethodni: PobjednickiNiz,
  partijaId: string,
  jePobjeda: boolean,
): PobjednickiNiz {
  if (prethodni.zadnjaObradenaPartijaId === partijaId) return prethodni;
  const trenutniNiz = jePobjeda ? prethodni.trenutniNiz + 1 : 0;
  return {
    trenutniNiz,
    najboljiNiz: Math.max(prethodni.najboljiNiz, trenutniNiz),
    zadnjaObradenaPartijaId: partijaId,
  };
}

export function razinaVatre(niz: number, mod: ModPartije): RazinaVatre {
  if (mod === 'dva_igraca') {
    if (niz >= 14) return 3;
    if (niz >= 8) return 2;
    if (niz >= 4) return 1;
    return 0;
  }
  if (niz >= 8) return 3;
  if (niz >= 5) return 2;
  if (niz >= 3) return 1;
  return 0;
}
