import { grafemi } from './grafemi.js';
import { PRAGOVI_DULJINE } from './nagrada-za-rijec.js';

export const MAKSIMALNA_RAZINA = 100;
export const ISKUSTVO_PRIHVACENA_RIJEC = 5;
export const ISKUSTVO_KALADONT = 100;
export const ISKUSTVO_ELIMINACIJA = 25;
export const ISKUSTVO_POBJEDA = 50;

export type TierDuljineIskustva = 'duga' | 'srednje_duga' | 'jako_duga';
export type TierRijetkostiIskustva = 'rijetka' | 'srednje_rijetka' | 'jako_rijetka';

export interface StanjeIskustva {
  razina: number;
  ukupno: number;
  uRazini: number;
  doIduce: number | null;
}

export interface StavkaIskustva {
  vrsta: 'potezi' | 'duge_rijeci' | 'rijetke_rijeci' | 'kaladont' | 'eliminacije' | 'pobjeda' | 'streak';
  naziv: string;
  kolicina: number;
  poStavci: number | null;
  iskustvo: number;
}

export interface ObracunIskustva {
  prije: StanjeIskustva;
  poslije: StanjeIskustva;
  stavke: StavkaIskustva[];
  najboljiStreak: number;
  mnoziteljStreaka: number;
  brutoIskustvo: number;
  osvojenoIskustvo: number;
}

export function iskustvoDoIduceRazina(razina: number): number | null {
  if (razina >= MAKSIMALNA_RAZINA) return null;
  if (razina <= 1) return 100;
  if (razina === 2) return 150;

  let potrebno = 150;
  for (let trenutnaRazina = 3; trenutnaRazina <= razina; trenutnaRazina += 1) {
    potrebno = Math.round(potrebno * (1 + 2.793322033 / trenutnaRazina ** 1.4));
  }
  return potrebno;
}

export function ukupnoIskustvoZaRazinu(razina: number): number {
  const ciljnaRazina = Math.min(Math.max(1, Math.floor(razina)), MAKSIMALNA_RAZINA);
  let ukupno = 0;
  for (let trenutnaRazina = 1; trenutnaRazina < ciljnaRazina; trenutnaRazina += 1) {
    ukupno += iskustvoDoIduceRazina(trenutnaRazina)!;
  }
  return ukupno;
}

export const MAKSIMALNO_ISKUSTVO = ukupnoIskustvoZaRazinu(MAKSIMALNA_RAZINA);

export function stanjeIskustva(ukupnoIskustvo: number): StanjeIskustva {
  const ukupno = Math.min(Math.max(0, Math.round(ukupnoIskustvo)), MAKSIMALNO_ISKUSTVO);
  if (ukupno >= MAKSIMALNO_ISKUSTVO) {
    return { razina: MAKSIMALNA_RAZINA, ukupno, uRazini: 0, doIduce: null };
  }

  let razina = 1;
  let pragSljedece = iskustvoDoIduceRazina(razina)!;
  let pragTrenutne = 0;
  while (ukupno >= pragTrenutne + pragSljedece) {
    pragTrenutne += pragSljedece;
    razina += 1;
    pragSljedece = iskustvoDoIduceRazina(razina)!;
  }
  return { razina, ukupno, uRazini: ukupno - pragTrenutne, doIduce: pragSljedece };
}

export function tierDuljineIskustva(rijec: string): TierDuljineIskustva | null {
  const brojGrafema = grafemi(rijec).length;
  if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) return 'jako_duga';
  if (brojGrafema >= PRAGOVI_DULJINE.srednjeDuga) return 'srednje_duga';
  if (brojGrafema >= PRAGOVI_DULJINE.duga) return 'duga';
  return null;
}

export function tierRijetkostiIskustva(frekvencija: number | null | undefined, brojGrafema: number): TierRijetkostiIskustva | null {
  if (frekvencija === 0 && brojGrafema >= 4) return 'jako_rijetka';
  if (frekvencija !== undefined && frekvencija !== null && frekvencija >= 1 && frekvencija <= 9) return 'srednje_rijetka';
  if (frekvencija !== undefined && frekvencija !== null && frekvencija >= 10 && frekvencija <= 99) return 'rijetka';
  return null;
}

export function iskustvoZaDuljinu(tier: TierDuljineIskustva | null): number {
  return tier === 'jako_duga' ? 35 : tier === 'srednje_duga' ? 20 : tier === 'duga' ? 10 : 0;
}

export function iskustvoZaRijetkost(tier: TierRijetkostiIskustva | null): number {
  return tier === 'jako_rijetka' ? 50 : tier === 'srednje_rijetka' ? 30 : tier === 'rijetka' ? 15 : 0;
}

export function mnoziteljZaStreak(najboljiStreak: number): number {
  if (najboljiStreak >= 9) return 2;
  if (najboljiStreak === 8) return 1.9;
  if (najboljiStreak === 7) return 1.75;
  if (najboljiStreak === 6) return 1.6;
  if (najboljiStreak === 5) return 1.4;
  if (najboljiStreak === 4) return 1.25;
  if (najboljiStreak === 3) return 1.1;
  return 1;
}

export function izracunajObracunIskustva(
  ukupnoPrije: number,
  stavkeBezStreaka: StavkaIskustva[],
  najboljiStreak: number,
): ObracunIskustva {
  const prije = stanjeIskustva(ukupnoPrije);
  const subtotal = stavkeBezStreaka.reduce((zbroj, stavka) => zbroj + stavka.iskustvo, 0);
  const mnoziteljStreaka = mnoziteljZaStreak(najboljiStreak);
  const brutoIskustvo = Math.round(subtotal * mnoziteljStreaka);
  const osvojenoIskustvo = Math.max(0, Math.min(brutoIskustvo, MAKSIMALNO_ISKUSTVO - prije.ukupno));
  const bonusStreaka = brutoIskustvo - subtotal;
  const stavke: StavkaIskustva[] = bonusStreaka > 0
    ? [...stavkeBezStreaka, { vrsta: 'streak', naziv: `Streak ${najboljiStreak} x${mnoziteljStreaka.toFixed(2)}`, kolicina: najboljiStreak, poStavci: null, iskustvo: bonusStreaka }]
    : stavkeBezStreaka;
  return { prije, poslije: stanjeIskustva(prije.ukupno + osvojenoIskustvo), stavke, najboljiStreak, mnoziteljStreaka, brutoIskustvo, osvojenoIskustvo };
}