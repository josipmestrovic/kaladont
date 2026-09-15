/**
 * Kaladont DNK: stil igre i profilni pregled za javne partije.
 * Server je kanonski izvor izračuna; klijent prima gotov profil.
 */

export type ModDnk = 'cetiri_igraca' | 'dva_igraca';

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
  mod: ModDnk;
  otkljucan: boolean;
  odigrano: number;
  preostaloDoOtkljucavanja: number;
  osi: DnkOs[];
}

export interface DnkUlaz {
  mod: ModDnk;
  odigrano: number;
  prosjekBodova?: number;
  eliminacijePoPartiji?: number;
  najduziStreak?: number;
  prosjekPrihvacenogPotezaMs?: number;
  ponderiraneDuge?: number;
  ponderiraneRijetke?: number;
}

export interface DnkPrag {
  naziv: string;
  vrijednost: number;
  oznaka: string;
  min: number;
  max: number;
}

export const DNK_PRAGOVI = {
  vjestina: {
    4: { min: 0, max: 100 },
    1: { min: 0, max: 100 },
  },
  taktika: {
    cetiri_igraca: [
      { naziv: 'Pacifist', vrijednost: 0, oznaka: 'Pacifist', min: 0, max: 0.24 },
      { naziv: 'Dobrica', vrijednost: 0.25, oznaka: 'Dobrica', min: 0.25, max: 0.49 },
      { naziv: 'Taktičar', vrijednost: 0.5, oznaka: 'Taktičar', min: 0.5, max: 0.84 },
      { naziv: 'Napadač', vrijednost: 0.85, oznaka: 'Napadač', min: 0.85, max: 1.19 },
      { naziv: 'Agresivac', vrijednost: 1.2, oznaka: 'Agresivac', min: 1.2, max: 1.5 },
    ],
    dva_igraca: [
      { naziv: 'Pacifist', vrijednost: 0, oznaka: 'Pacifist', min: 0, max: 0.09 },
      { naziv: 'Dobrica', vrijednost: 0.1, oznaka: 'Dobrica', min: 0.1, max: 0.24 },
      { naziv: 'Taktičar', vrijednost: 0.25, oznaka: 'Taktičar', min: 0.25, max: 0.44 },
      { naziv: 'Napadač', vrijednost: 0.45, oznaka: 'Napadač', min: 0.45, max: 0.64 },
      { naziv: 'Agresivac', vrijednost: 0.65, oznaka: 'Agresivac', min: 0.65, max: 0.8 },
    ],
  },
  fokus: {
    cetiri_igraca: [
      { naziv: 'Zagrijava se', vrijednost: 0, oznaka: 'Zagrijava se', min: 0, max: 1 },
      { naziv: 'Sabran', vrijednost: 2, oznaka: 'Sabran', min: 2, max: 4 },
      { naziv: 'Usredotočen', vrijednost: 5, oznaka: 'Usredotočen', min: 5, max: 7 },
      { naziv: 'Neuzdrman', vrijednost: 8, oznaka: 'Neuzdrman', min: 8, max: 11 },
      { naziv: 'Zen majstor', vrijednost: 12, oznaka: 'Zen majstor', min: 12, max: 100 },
    ],
    dva_igraca: [
      { naziv: 'Zagrijava se', vrijednost: 0, oznaka: 'Zagrijava se', min: 0, max: 1 },
      { naziv: 'Sabran', vrijednost: 2, oznaka: 'Sabran', min: 2, max: 3 },
      { naziv: 'Usredotočen', vrijednost: 4, oznaka: 'Usredotočen', min: 4, max: 5 },
      { naziv: 'Neuzdrman', vrijednost: 6, oznaka: 'Neuzdrman', min: 6, max: 7 },
      { naziv: 'Zen majstor', vrijednost: 8, oznaka: 'Zen majstor', min: 8, max: 100 },
    ],
  },
  brzina: {
    minMs: 4000,
    maxMs: 14000,
  },
  duge_rijeci: {
    cetiri_igraca: [
      { naziv: 'Sažet', vrijednost: 0.1, oznaka: 'Sažet', min: 0, max: 0.24 },
      { naziv: 'Rječit', vrijednost: 0.25, oznaka: 'Rječit', min: 0.25, max: 0.69 },
      { naziv: 'Dugorečiv', vrijednost: 0.7, oznaka: 'Dugorečiv', min: 0.7, max: 1.19 },
      { naziv: 'Rastezljivac', vrijednost: 1.2, oznaka: 'Rastezljivac', min: 1.2, max: 1.99 },
      { naziv: 'Majstor dugih riječi', vrijednost: 2, oznaka: 'Majstor dugih riječi', min: 2, max: 100 },
    ],
    dva_igraca: [
      { naziv: 'Sažet', vrijednost: 0.1, oznaka: 'Sažet', min: 0, max: 0.14 },
      { naziv: 'Rječit', vrijednost: 0.15, oznaka: 'Rječit', min: 0.15, max: 0.49 },
      { naziv: 'Dugorečiv', vrijednost: 0.5, oznaka: 'Dugorečiv', min: 0.5, max: 0.89 },
      { naziv: 'Rastezljivac', vrijednost: 0.9, oznaka: 'Rastezljivac', min: 0.9, max: 1.49 },
      { naziv: 'Majstor dugih riječi', vrijednost: 1.5, oznaka: 'Majstor dugih riječi', min: 1.5, max: 100 },
    ],
  },
  rijetke_rijeci: {
    cetiri_igraca: [
      { naziv: 'Sigurne riječi', vrijednost: 0.05, oznaka: 'Sigurne riječi', min: 0, max: 0.04 },
      { naziv: 'Tragač', vrijednost: 0.05, oznaka: 'Tragač', min: 0.05, max: 0.19 },
      { naziv: 'Istraživač', vrijednost: 0.2, oznaka: 'Istraživač', min: 0.2, max: 0.39 },
      { naziv: 'Lovac na rijetkosti', vrijednost: 0.4, oznaka: 'Lovac na rijetkosti', min: 0.4, max: 0.74 },
      { naziv: 'Rječnički arheolog', vrijednost: 0.75, oznaka: 'Rječnički arheolog', min: 0.75, max: 100 },
    ],
    dva_igraca: [
      { naziv: 'Sigurne riječi', vrijednost: 0.05, oznaka: 'Sigurne riječi', min: 0, max: 0.04 },
      { naziv: 'Tragač', vrijednost: 0.05, oznaka: 'Tragač', min: 0.05, max: 0.14 },
      { naziv: 'Istraživač', vrijednost: 0.15, oznaka: 'Istraživač', min: 0.15, max: 0.29 },
      { naziv: 'Lovac na rijetkosti', vrijednost: 0.3, oznaka: 'Lovac na rijetkosti', min: 0.3, max: 0.49 },
      { naziv: 'Rječnički arheolog', vrijednost: 0.5, oznaka: 'Rječnički arheolog', min: 0.5, max: 100 },
    ],
  },
} as const;

export function izracunajDnkTier(vrijednost: number, pragovi: readonly { min: number; max: number; naziv: string; oznaka: string }[]): number {
  const clipped = Math.max(0, Math.min(vrijednost, 100));
  for (let i = pragovi.length - 1; i >= 0; i -= 1) {
    const prag = pragovi[i]!;
    if (clipped >= prag.min && clipped <= prag.max) return i + 1;
  }
  return 1;
}

export function jeDnkOtkljucan(odigrano: number): boolean {
  return odigrano >= 10;
}

export function izracunajOcjenuDnk(osi: readonly DnkOs[]): number {
  if (osi.length === 0) return 0;
  const prosjek = osi.reduce((zbroj, os) => zbroj + os.vrijednost, 0) / osi.length;
  return Math.max(0, Math.min(5, Math.round(prosjek / 20)));
}

export function izracunajOcjenuIgre(
  prije: readonly DnkOs[],
  poslije: readonly DnkOs[],
  pobjeda: boolean,
): number {
  const deltaProsjek = poslije.length === 0
    ? 0
    : poslije.reduce((zbroj, os) => zbroj + (os.vrijednost - (prije.find((staro) => staro.kljuc === os.kljuc)?.vrijednost ?? os.vrijednost)), 0) / poslije.length;
  const osnovneZvjezdice = Math.max(0, Math.min(4, Math.round((deltaProsjek + 20) / 10)));
  return Math.max(0, Math.min(5, osnovneZvjezdice + (pobjeda ? 1 : 0)));
}

export function postotakXpZaOcjenu(ocjena: number): number {
  return Math.max(0, Math.min(20, Math.max(0, ocjena - 1) * 5));
}

export function izracunajKaladontDnk(ulaz: DnkUlaz): DnkProfil {
  const otkljucan = jeDnkOtkljucan(ulaz.odigrano);
  const prosjekBodova = ulaz.prosjekBodova ?? 0;
  const eliminacijePoPartiji = ulaz.eliminacijePoPartiji ?? 0;
  const najduziStreak = ulaz.najduziStreak ?? 0;
  const prosjekPrihvacenogPotezaMs = ulaz.prosjekPrihvacenogPotezaMs ?? 0;
  const ponderiraneDuge = ulaz.ponderiraneDuge ?? 0;
  const ponderiraneRijetke = ulaz.ponderiraneRijetke ?? 0;

  const vrijednostVjestina = otkljucan ? Math.max(10, Math.min(100, (prosjekBodova / 5.7) * 100)) : 0;
  const vrijednostTaktika = Math.max(0, Math.min(100, (eliminacijePoPartiji / (ulaz.mod === 'dva_igraca' ? 0.8 : 1.5)) * 100));
  const vrijednostFokus = Math.max(0, Math.min(100, (najduziStreak / (ulaz.mod === 'dva_igraca' ? 8 : 12)) * 100));
  const vrijednostBrzina = Math.max(0, Math.min(100, prosjekPrihvacenogPotezaMs <= 4000 ? 100 : 100 - ((prosjekPrihvacenogPotezaMs - 4000) / 11000) * 100));
  const vrijednostDuge = Math.max(0, Math.min(100, (ponderiraneDuge / (ulaz.mod === 'dva_igraca' ? 1.5 : 2)) * 100));
  const vrijednostRijetke = Math.max(0, Math.min(100, (ponderiraneRijetke / (ulaz.mod === 'dva_igraca' ? 0.5 : 0.75)) * 100));

  const osi: DnkOs[] = [
    { kljuc: 'vjestina', naziv: 'Vještina', vrijednost: Math.round(vrijednostVjestina), tier: 1, oznaka: 'N/A', detalj: `Prosjek bodova: ${prosjekBodova.toFixed(2)}` },
    { kljuc: 'taktika', naziv: 'Taktika', vrijednost: Math.round(vrijednostTaktika), tier: 1, oznaka: 'Taktičar', detalj: `Eliminacije po partiji: ${eliminacijePoPartiji.toFixed(2)}` },
    { kljuc: 'fokus', naziv: 'Fokus', vrijednost: Math.round(vrijednostFokus), tier: 1, oznaka: 'Sabran', detalj: `Niz prihvaćenih riječi: ${najduziStreak}` },
    { kljuc: 'brzina', naziv: 'Brzina', vrijednost: Math.round(vrijednostBrzina), tier: 1, oznaka: 'Skupljamo podatke', detalj: prosjekPrihvacenogPotezaMs > 0 ? `Prosjek prihvaćenog poteza: ${(prosjekPrihvacenogPotezaMs / 1000).toFixed(1)} s` : 'Nema dovoljno podataka' },
    { kljuc: 'duge_rijeci', naziv: 'Duge riječi', vrijednost: Math.round(vrijednostDuge), tier: 1, oznaka: 'Sažet', detalj: '' },
    { kljuc: 'rijetke_rijeci', naziv: 'Rijetke riječi', vrijednost: Math.round(vrijednostRijetke), tier: 1, oznaka: 'Sigurne riječi', detalj: '' },
  ];

  const vjestinaPrag: readonly DnkPrag[] = ulaz.mod === 'dva_igraca' ? [
    { min: 0, max: 0.29, naziv: 'Prvopisac', oznaka: 'Prvopisac', vrijednost: 0 },
    { min: 0.3, max: 0.39, naziv: 'Riječarac', oznaka: 'Riječarac', vrijednost: 0.35 },
    { min: 0.4, max: 0.46, naziv: 'Jezičar', oznaka: 'Jezičar', vrijednost: 0.43 },
    { min: 0.47, max: 0.53, naziv: 'Lektor', oznaka: 'Lektor', vrijednost: 0.5 },
    { min: 0.54, max: 0.6, naziv: 'Književnik', oznaka: 'Književnik', vrijednost: 0.57 },
    { min: 0.61, max: 0.67, naziv: 'Jezikoslovac', oznaka: 'Jezikoslovac', vrijednost: 0.64 },
    { min: 0.68, max: 0.74, naziv: 'Doktor riječi', oznaka: 'Doktor riječi', vrijednost: 0.71 },
    { min: 0.75, max: 0.81, naziv: 'Jezični maestro', oznaka: 'Jezični maestro', vrijednost: 0.78 },
    { min: 0.82, max: 0.88, naziv: 'Gospodar rječnika', oznaka: 'Gospodar rječnika', vrijednost: 0.85 },
    { min: 0.89, max: 1, naziv: 'Kaladont', oznaka: 'Kaladont', vrijednost: 0.95 },
  ] : [
    { min: 0, max: 1.49, naziv: 'Prvopisac', oznaka: 'Prvopisac', vrijednost: 0 },
    { min: 1.5, max: 2.09, naziv: 'Riječarac', oznaka: 'Riječarac', vrijednost: 1.8 },
    { min: 2.1, max: 2.49, naziv: 'Jezičar', oznaka: 'Jezičar', vrijednost: 2.3 },
    { min: 2.5, max: 2.89, naziv: 'Lektor', oznaka: 'Lektor', vrijednost: 2.7 },
    { min: 2.9, max: 3.29, naziv: 'Književnik', oznaka: 'Književnik', vrijednost: 3.1 },
    { min: 3.3, max: 3.79, naziv: 'Jezikoslovac', oznaka: 'Jezikoslovac', vrijednost: 3.5 },
    { min: 3.8, max: 4.39, naziv: 'Doktor riječi', oznaka: 'Doktor riječi', vrijednost: 4.1 },
    { min: 4.4, max: 4.99, naziv: 'Jezični maestro', oznaka: 'Jezični maestro', vrijednost: 4.7 },
    { min: 5.0, max: 5.69, naziv: 'Gospodar rječnika', oznaka: 'Gospodar rječnika', vrijednost: 5.3 },
    { min: 5.7, max: 10, naziv: 'Kaladont', oznaka: 'Kaladont', vrijednost: 7.5 },
  ];

  for (let i = 0; i < osi.length; i += 1) {
    const os = osi[i]!;
    if (os.kljuc === 'vjestina') {
      let match: DnkPrag = vjestinaPrag[0]!;
      for (const prag of vjestinaPrag) {
        if (prosjekBodova >= prag.min && prosjekBodova <= prag.max) match = prag;
      }
      os.oznaka = match.oznaka;
      os.detalj = `Prosjek bodova: ${prosjekBodova.toFixed(2)}`;
      os.vrijednost = Math.max(10, Math.min(100, Math.round((prosjekBodova / (ulaz.mod === 'dva_igraca' ? 0.89 : 5.7)) * 100)));
      os.tier = Math.max(1, Math.min(10, Math.round(os.vrijednost / 10)));
      continue;
    }
    if (os.kljuc === 'taktika') {
      const pragovi: readonly DnkPrag[] = DNK_PRAGOVI.taktika[ulaz.mod];
      let match: DnkPrag = pragovi[0]!;
      for (const prag of pragovi) {
        if (eliminacijePoPartiji >= prag.min && eliminacijePoPartiji <= prag.max) match = prag;
      }
      os.oznaka = match.oznaka;
      os.tier = Math.max(1, Math.min(5, pragovi.findIndex((prag) => prag.oznaka === match.oznaka) + 1));
      continue;
    }
    if (os.kljuc === 'fokus') {
      const pragovi: readonly DnkPrag[] = DNK_PRAGOVI.fokus[ulaz.mod];
      let match: DnkPrag = pragovi[0]!;
      for (const prag of pragovi) {
        if (najduziStreak >= prag.min && najduziStreak <= prag.max) match = prag;
      }
      os.oznaka = match.oznaka;
      os.tier = Math.max(1, Math.min(5, pragovi.findIndex((prag) => prag.oznaka === match.oznaka) + 1));
      continue;
    }
    if (os.kljuc === 'brzina') {
      if (prosjekPrihvacenogPotezaMs <= 0) {
        os.oznaka = 'Skupljamo podatke';
        os.vrijednost = 0;
        os.tier = 1;
        continue;
      }
      const sekunde = prosjekPrihvacenogPotezaMs / 1000;
      if (sekunde > 14) os.oznaka = 'Promišljen';
      else if (sekunde > 10) os.oznaka = 'Staloženi';
      else if (sekunde > 7) os.oznaka = 'Brzi';
      else if (sekunde > 4) os.oznaka = 'Brzopotezaš';
      else os.oznaka = 'Munjevit';
      os.tier = sekunde <= 4 ? 5 : sekunde <= 7 ? 4 : sekunde <= 10 ? 3 : sekunde <= 14 ? 2 : 1;
      continue;
    }
    if (os.kljuc === 'duge_rijeci') {
      const pragovi: readonly DnkPrag[] = DNK_PRAGOVI.duge_rijeci[ulaz.mod];
      let match: DnkPrag = pragovi[0]!;
      for (const prag of pragovi) {
        if (ponderiraneDuge >= prag.min && ponderiraneDuge <= prag.max) match = prag;
      }
      os.oznaka = match.oznaka;
      os.tier = Math.max(1, Math.min(5, pragovi.findIndex((prag) => prag.oznaka === match.oznaka) + 1));
      continue;
    }
    if (os.kljuc === 'rijetke_rijeci') {
      const pragovi: readonly DnkPrag[] = DNK_PRAGOVI.rijetke_rijeci[ulaz.mod];
      let match: DnkPrag = pragovi[0]!;
      for (const prag of pragovi) {
        if (ponderiraneRijetke >= prag.min && ponderiraneRijetke <= prag.max) match = prag;
      }
      os.oznaka = match.oznaka;
      os.tier = Math.max(1, Math.min(5, pragovi.findIndex((prag) => prag.oznaka === match.oznaka) + 1));
    }
  }

  return {
    mod: ulaz.mod,
    otkljucan,
    odigrano: ulaz.odigrano,
    preostaloDoOtkljucavanja: Math.max(0, 10 - ulaz.odigrano),
    osi,
  };
}
