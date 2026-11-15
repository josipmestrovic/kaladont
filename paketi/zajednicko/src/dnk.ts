/**
 * Kaladont DNK: jedan radar za sve javne Dvoboje, Troboje i Četveroboje (PR10).
 * Server je kanonski izvor izračuna; klijent prima gotov profil.
 *
 * HINT (lanac 0.2.0): N2/N3/N4 dolaze iz formatnih agregata; Vještina iz PR09
 * univerzalnog učinka (skala /178 = prag „Kaladont”). Ne koristiti igraci.dovrseneIgre.
 */

import type { ModPartije } from './katalog-partije.js';
import { BROJ_PARTIJA_ZA_KALIBRACIJU } from './rangovi.js';

/** @deprecated PR10: DNK više nije po formatu; ostaje za tipove koji još nose kontekst partije. */
export type ModDnk = ModPartije;

export type DnkKljuc =
  | 'vjestina'
  | 'taktika'
  | 'fokus'
  | 'brzina'
  | 'duge_rijeci'
  | 'rijetke_rijeci';

export interface DnkOs {
  kljuc: DnkKljuc;
  naziv: string;
  vrijednost: number;
  tier: number;
  oznaka: string;
  detalj: string;
}

export interface DnkProfil {
  /** Opcionalno: format više nije os DNK-a (PR10). */
  mod?: ModDnk;
  otkljucan: boolean;
  odigrano: number;
  preostaloDoOtkljucavanja: number;
  osi: DnkOs[];
}

/**
 * Ulaz zajedničkog DNK-a (PR10).
 * ponderiraneDuge/Rijetke = zbroj kategorija s ponderima 1/1,5/2 (ne prosjek po partiji).
 */
export interface DnkUlazZajednicki {
  n2: number;
  n3: number;
  n4: number;
  /** Potvrđene izazvane eliminacije (svih formata). */
  eliminacijeUkupno: number;
  najduziStreak: number;
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  ponderiraneDuge: number;
  ponderiraneRijetke: number;
  /** izracunajUniverzalniUcinak iz PR09; isti učinak → ista Vještina. */
  univerzalniUcinak: number;
}

/** @deprecated Koristi DnkUlazZajednicki. Zadržano ime kao alias za migraciju pozivatelja. */
export type DnkUlaz = DnkUlazZajednicki;

export interface DnkPrag {
  naziv: string;
  vrijednost: number;
  oznaka: string;
  min: number;
  max: number;
}

/** Gornja skala Vještine = prag ranga „Kaladont” (PR09 početni balans). */
export const DNK_VJESTINA_SKALA_UCINKA = 178;

/** Pojasevi 0–100 za oznake osi (osim brzine, koja zadržava vremenske oznake). */
export const DNK_POJASEVI_0_100: readonly DnkPrag[] = [
  { naziv: '1', vrijednost: 10, oznaka: '1', min: 0, max: 19.999 },
  { naziv: '2', vrijednost: 30, oznaka: '2', min: 20, max: 39.999 },
  { naziv: '3', vrijednost: 50, oznaka: '3', min: 40, max: 59.999 },
  { naziv: '4', vrijednost: 70, oznaka: '4', min: 60, max: 79.999 },
  { naziv: '5', vrijednost: 90, oznaka: '5', min: 80, max: 100 },
];

const OZNAKE_VJESTINA = ['Prvopisac', 'Riječarac', 'Jezičar', 'Lektor', 'Književnik'] as const;
const OZNAKE_TAKTIKA = ['Pacifist', 'Dobrica', 'Taktičar', 'Napadač', 'Agresivac'] as const;
const OZNAKE_FOKUS = ['Zagrijava se', 'Sabran', 'Usredotočen', 'Neuzdrman', 'Zen majstor'] as const;
const OZNAKE_DUGE = ['Sažet', 'Rječit', 'Dugorečiv', 'Rastezljivac', 'Majstor dugih riječi'] as const;
const OZNAKE_RIJETKE = ['Sigurne riječi', 'Tragač', 'Istraživač', 'Lovac na rijetkosti', 'Rječnički arheolog'] as const;

export const DNK_PRAGOVI = {
  brzina: {
    minMs: 4000,
    maxMs: 15000,
  },
} as const;

function izracunajPragZaVrijednost<T extends { min: number; max: number }>(vrijednost: number, pragovi: readonly T[]): T {
  const prvi = pragovi[0]!;
  const zadnji = pragovi[pragovi.length - 1]!;

  if (vrijednost <= prvi.min) return prvi;
  if (vrijednost >= zadnji.max) return zadnji;

  for (const prag of pragovi) {
    if (vrijednost >= prag.min && vrijednost <= prag.max) return prag;
  }

  return zadnji;
}

export function izracunajDnkTier(vrijednost: number, pragovi: readonly { min: number; max: number; naziv: string; oznaka: string }[]): number {
  const clipped = Math.max(0, Math.min(vrijednost, 100));
  const match = izracunajPragZaVrijednost(clipped, pragovi);
  return pragovi.findIndex((prag) => prag === match) + 1;
}

/** Otključavanje nakon 10 javnih partija ukupno (N2+N3+N4). */
export function jeDnkOtkljucan(odigrano: number): boolean {
  return odigrano >= BROJ_PARTIJA_ZA_KALIBRACIJU;
}

export function izracunajOcjenuDnk(osi: readonly DnkOs[]): number {
  if (osi.length === 0) return 0;
  const prosjek = osi.reduce((zbroj, os) => zbroj + os.vrijednost, 0) / osi.length;
  return Math.max(0, Math.min(5, Math.round(prosjek / 20)));
}

/** Javna partija uvijek ima ocjenu 1–5; XP više nije uvjet. */
export function jeOcjenaIgreDostupna(_iskustvo?: number): boolean {
  void _iskustvo;
  return true;
}

export interface UlazOcjeneIgre {
  pobjeda: boolean;
  prihvaceniPotezi: number;
  bodovi: number;
  eliminacije: number;
  /** XP partije prije bonusa ocjene. */
  iskustvo: number;
}

/** Ocjena 1–5 iz učinka te partije (ne iz DNK delte). Pobjeda ili jak učinak → 5. */
export function izracunajOcjenuIgre(ulaz: UlazOcjeneIgre): number {
  if (ulaz.pobjeda) return 5;
  const prihvaceniPotezi = Math.max(0, ulaz.prihvaceniPotezi);
  const bodovi = Math.max(0, ulaz.bodovi);
  const eliminacije = Math.max(0, ulaz.eliminacije);
  const iskustvo = Math.max(0, Number.isFinite(ulaz.iskustvo) ? ulaz.iskustvo : 0);
  const ucinak = iskustvo + bodovi * 8 + eliminacije * 12;
  if (ucinak >= 60) return 5;
  if (ucinak >= 25) return 4;
  if (ucinak >= 10) return 3;
  if (prihvaceniPotezi > 0 || bodovi > 0 || eliminacije > 0 || iskustvo > 0) return 2;
  return 1;
}

export function postotakXpZaOcjenu(ocjena: number): number {
  return Math.max(0, Math.min(20, Math.max(0, ocjena - 1) * 5));
}

function oznakaIzPojasa(vrijednost: number, oznake: readonly string[]): { oznaka: string; tier: number } {
  const clipped = Math.max(0, Math.min(100, vrijednost));
  const indeks = clipped < 20 ? 0 : clipped < 40 ? 1 : clipped < 60 ? 2 : clipped < 80 ? 3 : 4;
  return { oznaka: oznake[indeks]!, tier: indeks + 1 };
}

function ogranicenaOs(vrijednost: number): number {
  return Math.max(0, Math.min(100, Math.round(vrijednost)));
}

/** Nazivnici PR10 (početni balans). */
export function nazivnikTaktike(n2: number, n3: number, n4: number): number {
  return 0.8 * n2 + 1.15 * n3 + 1.5 * n4;
}

export function nazivnikDugih(n2: number, n3: number, n4: number): number {
  return 1.5 * n2 + 1.75 * n3 + 2 * n4;
}

export function nazivnikRijetkih(n2: number, n3: number, n4: number): number {
  return 0.5 * n2 + 0.625 * n3 + 0.75 * n4;
}

export function vrijednostBrzineMs(prosjekPrihvacenogPotezaMs: number): number {
  if (prosjekPrihvacenogPotezaMs <= 0) return 0;
  if (prosjekPrihvacenogPotezaMs <= 4000) return 100;
  if (prosjekPrihvacenogPotezaMs >= 15000) return 0;
  return 100 - ((prosjekPrihvacenogPotezaMs - 4000) / 11000) * 100;
}

/**
 * Jedan Kaladont DNK za sve javne formate.
 * HINT: n2/n3/n4 moraju biti stvarne odigrane javne partije (ne dovrseneIgre).
 */
export function izracunajKaladontDnk(ulaz: DnkUlazZajednicki): DnkProfil {
  const n2 = Math.max(0, ulaz.n2);
  const n3 = Math.max(0, ulaz.n3);
  const n4 = Math.max(0, ulaz.n4);
  const odigrano = n2 + n3 + n4;
  const otkljucan = jeDnkOtkljucan(odigrano);

  const eliminacijeUkupno = Math.max(0, ulaz.eliminacijeUkupno);
  const najduziStreak = Math.max(0, ulaz.najduziStreak);
  const prihvaceniPotezi = Math.max(0, ulaz.prihvaceniPotezi);
  const ukupnoMs = Math.max(0, ulaz.ukupnoTrajanjePrihvaceniPoteziMs);
  const prosjekPrihvacenogPotezaMs = prihvaceniPotezi > 0 ? ukupnoMs / prihvaceniPotezi : 0;
  const ponderiraneDuge = Math.max(0, ulaz.ponderiraneDuge);
  const ponderiraneRijetke = Math.max(0, ulaz.ponderiraneRijetke);
  const univerzalniUcinak = Math.max(0, ulaz.univerzalniUcinak);

  const nt = nazivnikTaktike(n2, n3, n4);
  const nd = nazivnikDugih(n2, n3, n4);
  const nr = nazivnikRijetkih(n2, n3, n4);

  const vrijednostVjestina = otkljucan
    ? Math.max(0, Math.min(100, (100 * univerzalniUcinak) / DNK_VJESTINA_SKALA_UCINKA))
    : 0;
  const vrijednostTaktika = nt > 0 ? Math.max(0, Math.min(100, (100 * eliminacijeUkupno) / nt)) : 0;
  const vrijednostFokus = Math.max(0, Math.min(100, (100 * najduziStreak) / 10));
  const vrijednostBrzina = vrijednostBrzineMs(prosjekPrihvacenogPotezaMs);
  const vrijednostDuge = nd > 0 ? Math.max(0, Math.min(100, (100 * ponderiraneDuge) / nd)) : 0;
  const vrijednostRijetke = nr > 0 ? Math.max(0, Math.min(100, (100 * ponderiraneRijetke) / nr)) : 0;

  const vjestina = ogranicenaOs(vrijednostVjestina);
  const taktika = ogranicenaOs(vrijednostTaktika);
  const fokus = ogranicenaOs(vrijednostFokus);
  const brzina = ogranicenaOs(vrijednostBrzina);
  const duge = ogranicenaOs(vrijednostDuge);
  const rijetke = ogranicenaOs(vrijednostRijetke);

  const ozV = oznakaIzPojasa(vjestina, OZNAKE_VJESTINA);
  const ozT = oznakaIzPojasa(taktika, OZNAKE_TAKTIKA);
  const ozF = oznakaIzPojasa(fokus, OZNAKE_FOKUS);
  const ozD = oznakaIzPojasa(duge, OZNAKE_DUGE);
  const ozR = oznakaIzPojasa(rijetke, OZNAKE_RIJETKE);

  let oznakaBrzina = 'Skupljamo podatke';
  let tierBrzina = 1;
  if (prosjekPrihvacenogPotezaMs > 0) {
    const sekunde = prosjekPrihvacenogPotezaMs / 1000;
    if (sekunde >= 15) {
      oznakaBrzina = 'Promišljen';
      tierBrzina = 1;
    } else if (sekunde > 10) {
      oznakaBrzina = 'Staloženi';
      tierBrzina = 2;
    } else if (sekunde > 7) {
      oznakaBrzina = 'Brzi';
      tierBrzina = 3;
    } else if (sekunde > 4) {
      oznakaBrzina = 'Brzopotezaš';
      tierBrzina = 4;
    } else {
      oznakaBrzina = 'Munjevit';
      tierBrzina = 5;
    }
  }

  const osi: DnkOs[] = [
    {
      kljuc: 'vjestina',
      naziv: 'Vještina',
      vrijednost: vjestina,
      tier: ozV.tier,
      oznaka: ozV.oznaka,
      detalj: `Univerzalni učinak: ${univerzalniUcinak.toFixed(1)}`,
    },
    {
      kljuc: 'taktika',
      naziv: 'Taktika',
      vrijednost: taktika,
      tier: ozT.tier,
      oznaka: ozT.oznaka,
      detalj: `Izazvane eliminacije: ${eliminacijeUkupno}`,
    },
    {
      kljuc: 'fokus',
      naziv: 'Fokus',
      vrijednost: fokus,
      tier: ozF.tier,
      oznaka: ozF.oznaka,
      detalj: `Niz prihvaćenih riječi: ${najduziStreak}`,
    },
    {
      kljuc: 'brzina',
      naziv: 'Brzina',
      vrijednost: brzina,
      tier: tierBrzina,
      oznaka: oznakaBrzina,
      detalj: prosjekPrihvacenogPotezaMs > 0
        ? `Prosjek prihvaćenog poteza: ${(prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s`
        : 'Nema dovoljno podataka',
    },
    {
      kljuc: 'duge_rijeci',
      naziv: 'Duge riječi',
      vrijednost: duge,
      tier: ozD.tier,
      oznaka: ozD.oznaka,
      detalj: '',
    },
    {
      kljuc: 'rijetke_rijeci',
      naziv: 'Rijetke riječi',
      vrijednost: rijetke,
      tier: ozR.tier,
      oznaka: ozR.oznaka,
      detalj: '',
    },
  ];

  return {
    otkljucan,
    odigrano,
    preostaloDoOtkljucavanja: Math.max(0, BROJ_PARTIJA_ZA_KALIBRACIJU - odigrano),
    osi,
  };
}
