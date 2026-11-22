/**
 * Katalog Izazova v2 — matrica 4 levela × 3 formata × 5 varijanti (60).
 */
import { PRAGOVI_DULJINE } from './nagrada-za-rijec.js';
import type { ModPartije, PravilnikPartije } from './katalog-partije.js';
import { MODOVI_PARTIJE, PRAVILNICI_PARTIJE } from './katalog-partije.js';

/** Verzija kataloga definicija; balansi bumpaju ovo, ne otvaraju ponovno XP (rewardEpoch). */
export const VERZIJA_DEFINICIJE_IZAZOVA = 2;

/** Ukupni nominalni fond challenge XP (2× starih 53.270). */
export const UKUPNI_NOMINALNI_XP_IZAZOVA = 106_540;

/** Prag „duge riječi” za ciljeve Izazova = postojeći shared prag (≥10 grafema). */
export const PRAG_DUGE_RIJECI_IZAZOVA = PRAGOVI_DULJINE.duga;

export const PROFILI_BOTA_IZAZOVA = ['pocetnik', 'iskusni', 'majstor', 'velemajstor'] as const;
export type ProfilBotaIzazova = (typeof PROFILI_BOTA_IZAZOVA)[number];

/** Zadani profil Treninga / stari klijent bez profileId (= trenutna ZADANA politika). */
export const ZADANI_PROFIL_TRENINGA: ProfilBotaIzazova = 'iskusni';

/** Prikazna imena (Trening + Izazov); ne javni rang. */
export const NAZIVI_PROFILA_BOTA: Readonly<Record<ProfilBotaIzazova, string>> = {
  pocetnik: 'Početnik',
  iskusni: 'Iskusni',
  majstor: 'Majstor',
  velemajstor: 'Velemajstor',
};

export const NAZIVI_LEVELA_IZAZOVA: Readonly<Record<1 | 2 | 3 | 4, string>> = {
  1: 'Početnik',
  2: 'Iskusni',
  3: 'Majstor',
  4: 'Velemajstor',
};

export function jePoznatiProfilBota(vrijednost: unknown): vrijednost is ProfilBotaIzazova {
  return typeof vrijednost === 'string' && (PROFILI_BOTA_IZAZOVA as readonly string[]).includes(vrijednost);
}

/** Jedan bot: „Majstor”; više: „Majstor 1”, „Majstor 2”, … */
export function nadimakProfilaBota(
  profileId: ProfilBotaIzazova,
  indeks: number,
  ukupno: number,
): string {
  const baza = NAZIVI_PROFILA_BOTA[profileId];
  return ukupno <= 1 ? baza : `${baza} ${indeks}`;
}

export const TRAJANJA_POTEZA_IZAZOVA_MS = [15_000, 30_000] as const;
export type TrajanjePotezaIzazovaMs = (typeof TRAJANJA_POTEZA_IZAZOVA_MS)[number];

export const STATUSI_POKUSAJA_IZAZOVA = [
  'rezerviran',
  'u_tijeku',
  'uspjeh',
  'neuspjeh',
  'tehnicki_prekinuto',
] as const;
export type StatusPokusajaIzazova = (typeof STATUSI_POKUSAJA_IZAZOVA)[number];

export const RAZLOZI_NEUSPJEHA_IZAZOVA = [
  'cilj_neispunjen',
  'eliminiran',
  'nevaljana_rijec',
  'odustao',
  'prekid_veze',
] as const;
export type RazlogNeuspjehaIzazova = (typeof RAZLOZI_NEUSPJEHA_IZAZOVA)[number];

export const STATUSI_SPREMANJA_IZAZOVA = [
  'nije_potrebno',
  'spremanje_u_tijeku',
  'spremljeno',
] as const;
export type StatusSpremanjaIzazova = (typeof STATUSI_SPREMANJA_IZAZOVA)[number];

export type LevelIzazova = 1 | 2 | 3 | 4;
export type FormatIzazova = 'DV' | 'TR' | 'CE';
export type VarijantaIzazova = 'obicni' | 'brzi' | 'bez_pogreske' | 'dokazi' | 'zavrsni';

export const LEVELOVI_IZAZOVA = [1, 2, 3, 4] as const satisfies readonly LevelIzazova[];
export const FORMATI_IZAZOVA = ['DV', 'TR', 'CE'] as const satisfies readonly FormatIzazova[];
export const VARIJANTE_IZAZOVA = [
  'obicni',
  'brzi',
  'bez_pogreske',
  'dokazi',
  'zavrsni',
] as const satisfies readonly VarijantaIzazova[];

export const NAZIVI_FORMATA_IZAZOVA: Readonly<Record<FormatIzazova, string>> = {
  DV: 'Dvoboj',
  TR: 'Troboj',
  CE: 'Četveroboj',
};

export const NAZIVI_VARIJANTI_IZAZOVA: Readonly<Record<VarijantaIzazova, string>> = {
  obicni: 'Obični',
  brzi: 'Brzi',
  bez_pogreske: 'Bez pogreške',
  dokazi: 'Dokaži nastavak',
  zavrsni: 'Završni izazov',
};

function brojIgracaZaFormat(format: FormatIzazova): 2 | 3 | 4 {
  if (format === 'DV') return 2;
  if (format === 'TR') return 3;
  return 4;
}

function profilZaLevel(level: LevelIzazova): ProfilBotaIzazova {
  return PROFILI_BOTA_IZAZOVA[level - 1]!;
}

function idIzazova(level: LevelIzazova, format: FormatIzazova, red: 1 | 2 | 3 | 4 | 5): string {
  return `IZ-L${level}-${format}-0${red}`;
}

/** Generirani stabilni ID-jevi (60). */
export const ID_OVI_IZAZOVA = LEVELOVI_IZAZOVA.flatMap((level) =>
  FORMATI_IZAZOVA.flatMap((format) =>
    ([1, 2, 3, 4, 5] as const).map((red) => idIzazova(level, format, red)),
  ),
) as unknown as readonly [
  string, string, ...string[],
];
export type IdIzazova = (typeof ID_OVI_IZAZOVA)[number];

/**
 * Nominalni XP ×2 (osnovna tablica iz redizajn speca).
 * Indeks: [level-1][formatIndex][varijanta-1]
 */
const XP_MATRICA_2X: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>> = [
  // Level 1 — fond 2×1040
  [
    [108, 130, 130, 130, 196],
    [108, 130, 130, 130, 196],
    [108, 130, 130, 130, 194],
  ],
  // Level 2 — fond 2×3440
  [
    [358, 430, 430, 430, 646],
    [358, 430, 430, 430, 646],
    [358, 430, 430, 430, 644],
  ],
  // Level 3 — fond 2×11360
  [
    [1184, 1420, 1420, 1420, 2130],
    [1184, 1420, 1420, 1420, 2130],
    [1182, 1420, 1420, 1420, 2130],
  ],
  // Level 4 — fond 2×37430
  [
    [3900, 4680, 4680, 4678, 7018],
    [3900, 4678, 4678, 4678, 7018],
    [3900, 4678, 4678, 4678, 7018],
  ],
];

export interface CiljeviIzazova {
  /** Pobjeda čovjeka je uvijek obvezna; ovo su dodatni uvjeti. */
  bezPogreske?: boolean;
  dugeRijeci?: number;
  rijetkeRijeci?: number;
  /** Stari katalog / evaluator; novi katalog ne koristi. */
  uspjesanDokaz?: number;
}

/** Autoritativni napredak ciljeva u snimci / GET pokušaja. */
export interface StavkaNapretkaCiljaIzazova {
  required: number;
  current: number;
  met: boolean;
}

export interface GoalProgressIzazova {
  bezPogreske: { required: boolean; met: boolean };
  dugeRijeci: StavkaNapretkaCiljaIzazova;
  rijetkeRijeci: StavkaNapretkaCiljaIzazova;
  uspjesanDokaz: StavkaNapretkaCiljaIzazova;
  sviCiljeviIspunjeni: boolean;
}

export interface DefinicijaIzazova {
  id: IdIzazova;
  redniBroj: number;
  naziv: string;
  level: LevelIzazova;
  format: FormatIzazova;
  varijanta: VarijantaIzazova;
  redoslijedUFormatu: 1 | 2 | 3 | 4 | 5;
  /** Broj igrača za stolom (čovjek + botovi). */
  brojIgraca: 2 | 3 | 4;
  mod: ModPartije;
  pravila: PravilnikPartije;
  profileId: ProfilBotaIzazova;
  /** Rok ČOVJEKA (ms). */
  turnDurationMs: TrajanjePotezaIzazovaMs;
  /** Rok bota (ms); u v2 uvijek 30_000. */
  botTurnDurationMs: TrajanjePotezaIzazovaMs;
  ciljevi: CiljeviIzazova;
  xp: number;
  /** Kratki ljudski opis dodatnih ciljeva (bez pobjede). */
  opisCilja: string;
}

function modZaBroj(brojIgraca: 2 | 3 | 4): ModPartije {
  if (brojIgraca === 2) return 'dva_igraca';
  if (brojIgraca === 3) return 'tri_igraca';
  return 'cetiri_igraca';
}

function predlozakVarijante(varijanta: VarijantaIzazova): {
  pravila: PravilnikPartije;
  sekundiCovjek: 15 | 30;
  ciljevi: CiljeviIzazova;
  opisCilja: string;
} {
  switch (varijanta) {
    case 'obicni':
      return { pravila: 'klasicni', sekundiCovjek: 30, ciljevi: {}, opisCilja: 'Pobijedi.' };
    case 'brzi':
      return {
        pravila: 'klasicni',
        sekundiCovjek: 15,
        ciljevi: {},
        opisCilja: 'Pobijedi (15 s po tvom potezu).',
      };
    case 'bez_pogreske':
      return {
        pravila: 'klasicni',
        sekundiCovjek: 30,
        ciljevi: { bezPogreske: true },
        opisCilja: 'Pobijedi bez pogrešne riječi.',
      };
    case 'dokazi':
      return {
        pravila: 'dokazi_nastavak',
        sekundiCovjek: 30,
        ciljevi: {},
        opisCilja: 'Pobijedi (pravila Dokaži nastavak).',
      };
    case 'zavrsni':
      return {
        pravila: 'dokazi_nastavak',
        sekundiCovjek: 15,
        ciljevi: { bezPogreske: true },
        opisCilja: 'Pobijedi bez pogrešne riječi (15 s, Dokaži nastavak).',
      };
  }
}

function izgradiKatalog(): DefinicijaIzazova[] {
  const rezultat: DefinicijaIzazova[] = [];
  let redniBroj = 0;
  for (const level of LEVELOVI_IZAZOVA) {
    const profileId = profilZaLevel(level);
    for (let fi = 0; fi < FORMATI_IZAZOVA.length; fi += 1) {
      const format = FORMATI_IZAZOVA[fi]!;
      const brojIgraca = brojIgracaZaFormat(format);
      for (let vi = 0; vi < VARIJANTE_IZAZOVA.length; vi += 1) {
        const varijanta = VARIJANTE_IZAZOVA[vi]!;
        const redoslijedUFormatu = (vi + 1) as 1 | 2 | 3 | 4 | 5;
        redniBroj += 1;
        const pred = predlozakVarijante(varijanta);
        const xp = XP_MATRICA_2X[level - 1]![fi]![vi]!;
        rezultat.push({
          id: idIzazova(level, format, redoslijedUFormatu) as IdIzazova,
          redniBroj,
          naziv: NAZIVI_VARIJANTI_IZAZOVA[varijanta],
          level,
          format,
          varijanta,
          redoslijedUFormatu,
          brojIgraca,
          mod: modZaBroj(brojIgraca),
          pravila: pred.pravila,
          profileId,
          turnDurationMs: (pred.sekundiCovjek * 1000) as TrajanjePotezaIzazovaMs,
          botTurnDurationMs: 30_000,
          ciljevi: { ...pred.ciljevi },
          xp,
          opisCilja: pred.opisCilja,
        });
      }
    }
  }
  return rezultat;
}

/** Autoritativni katalog nagrada i postava v2. */
export const KATALOG_IZAZOVA: readonly DefinicijaIzazova[] = izgradiKatalog();

const KATALOG_PO_IDU = new Map<string, DefinicijaIzazova>(
  KATALOG_IZAZOVA.map((d) => [d.id, d]),
);

/** ID-jevi po levelu (15). */
export function idEviLevela(level: LevelIzazova): readonly IdIzazova[] {
  return KATALOG_IZAZOVA.filter((d) => d.level === level).map((d) => d.id);
}

/** ID-jevi formata unutar levela (5). */
export function idEviFormata(level: LevelIzazova, format: FormatIzazova): readonly IdIzazova[] {
  return KATALOG_IZAZOVA.filter((d) => d.level === level && d.format === format).map((d) => d.id);
}

/** Preduvjeti završnog izazova (varijante 1–4 istog formata). */
export function preduvjetiFinala(definicija: DefinicijaIzazova): readonly IdIzazova[] {
  if (definicija.redoslijedUFormatu !== 5) return [];
  return idEviFormata(definicija.level, definicija.format).filter((id) => id !== definicija.id);
}

export function jeIdIzazova(vrijednost: unknown): vrijednost is IdIzazova {
  return typeof vrijednost === 'string' && KATALOG_PO_IDU.has(vrijednost);
}

export function definicijaIzazova(id: IdIzazova): DefinicijaIzazova {
  const d = KATALOG_PO_IDU.get(id);
  if (!d) throw new Error(`Nepoznat izazov: ${id}`);
  return d;
}

/** Siguran lookup — null za stari IZ01–IZ24 ili nepoznat ID. */
export function pokusajDefinicijuIzazova(id: string): DefinicijaIzazova | null {
  return KATALOG_PO_IDU.get(id) ?? null;
}

export function brojBotovaZaIzazov(definicija: DefinicijaIzazova): 1 | 2 | 3 {
  return (definicija.brojIgraca - 1) as 1 | 2 | 3;
}

export type StatusOtkljucavanjaIzazova = 'zakljucan' | 'dostupan' | 'zavrsen';

export type RazlogZakljucavanja =
  | { vrsta: 'prethodni_level'; level: LevelIzazova; nedostaje: IdIzazova[] }
  | { vrsta: 'prethodni_izazovi_formata'; nedostaje: IdIzazova[] };

export interface RezultatDostupnostiIzazova {
  status: StatusOtkljucavanjaIzazova;
  razlog: RazlogZakljucavanja | null;
}

function filterAktivnihZavrsenih(zavrseni: ReadonlySet<string>): Set<IdIzazova> {
  const s = new Set<IdIzazova>();
  for (const id of zavrseni) {
    if (jeIdIzazova(id)) s.add(id);
  }
  return s;
}

export function levelZavrsen(level: LevelIzazova, zavrseni: ReadonlySet<string>): boolean {
  return idEviLevela(level).every((id) => zavrseni.has(id));
}

export function levelDostupan(level: LevelIzazova, zavrseni: ReadonlySet<string>): boolean {
  if (level === 1) return true;
  for (let L = 1 as LevelIzazova; L < level; L = (L + 1) as LevelIzazova) {
    if (!levelZavrsen(L as LevelIzazova, zavrseni)) return false;
  }
  return true;
}

/** Jedna funkcija za DTO i serverski start. Stari IZ* ID-jevi ne ulaze u napredak. */
export function dostupnostIzazova(
  definicija: DefinicijaIzazova,
  zavrseniSirovi: ReadonlySet<string>,
): RezultatDostupnostiIzazova {
  const zavrseni = filterAktivnihZavrsenih(zavrseniSirovi);
  if (zavrseni.has(definicija.id)) {
    return { status: 'zavrsen', razlog: null };
  }
  if (!levelDostupan(definicija.level, zavrseni)) {
    const prethodni = (definicija.level - 1) as LevelIzazova;
    const nedostaje = idEviLevela(prethodni).filter((id) => !zavrseni.has(id));
    return {
      status: 'zakljucan',
      razlog: { vrsta: 'prethodni_level', level: prethodni, nedostaje },
    };
  }
  if (definicija.redoslijedUFormatu === 5) {
    const preduvjeti = preduvjetiFinala(definicija);
    const nedostaje = preduvjeti.filter((id) => !zavrseni.has(id));
    if (nedostaje.length > 0) {
      return {
        status: 'zakljucan',
        razlog: { vrsta: 'prethodni_izazovi_formata', nedostaje },
      };
    }
  }
  return { status: 'dostupan', razlog: null };
}

export interface StavkaKatalogaIzazovaDto {
  id: IdIzazova;
  redniBroj: number;
  naziv: string;
  level: LevelIzazova;
  format: FormatIzazova;
  varijanta: VarijantaIzazova;
  redoslijedUFormatu: 1 | 2 | 3 | 4 | 5;
  brojIgraca: 2 | 3 | 4;
  mod: ModPartije;
  pravila: PravilnikPartije;
  effectiveProfileId: ProfilBotaIzazova;
  turnDurationMs: TrajanjePotezaIzazovaMs;
  botTurnDurationMs: TrajanjePotezaIzazovaMs;
  ciljevi: CiljeviIzazova;
  opisCilja: string;
  xp: number;
  definitionVersion: number;
  status: StatusOtkljucavanjaIzazova;
  razlogZakljucavanja: RazlogZakljucavanja | null;
  /** Izvedeno: prvi nedostajući ID (kompatibilnost). */
  blockingChallengeId: IdIzazova | null;
  /** true kad je jednokratni XP već isplaćen. */
  xpOsvojen: boolean;
  awardedXp: number | null;
}

export interface AgregatFormataIzazovaDto {
  format: FormatIzazova;
  naziv: string;
  zavrseno: number;
  ukupno: 5;
  status: 'zakljucan' | 'dostupan' | 'zavrsen';
}

export interface AgregatLevelaIzazovaDto {
  level: LevelIzazova;
  naziv: string;
  profileId: ProfilBotaIzazova;
  zavrseno: number;
  ukupno: 15;
  status: 'zakljucan' | 'dostupan' | 'zavrsen';
  formati: AgregatFormataIzazovaDto[];
}

export interface NapredakIzazovaDto {
  zavrseniChallengeIds: IdIzazova[];
  aktivniPokusaj: {
    attemptId: string;
    challengeId: IdIzazova;
    status: StatusPokusajaIzazova;
    partijaId: string | null;
  } | null;
  izazivacZvjezdice: 0 | 1 | 2 | 3 | 4 | 5;
  leveli: AgregatLevelaIzazovaDto[];
}

/** Metadata kampanje na partija:pocetak / partija:stanje (autoritativno). */
export interface IzazovPartijaMeta {
  challengeId: IdIzazova;
  level: LevelIzazova;
  format: FormatIzazova;
  varijanta: VarijantaIzazova;
  naziv: string;
  profileId: ProfilBotaIzazova;
  humanTurnDurationMs: number;
  botTurnDurationMs: number;
}

/** Settlement payload na GET pokušaja / partija:kraj. */
export interface SettlementIzazovaDto {
  firstCompletion: boolean;
  challengeXp: { nominal: number; awarded: number };
  missionXp: { nominal: number; awarded: number };
  izazivac: { zvjezdice: number; novaRazina: number };
  settlementState: StatusSpremanjaIzazova;
  novaDostignuca: { id: string; novaRazina: number; maksimalnaRazina: number }[];
}

export interface OdgovorKatalogaIzazova {
  ok: true;
  omogucen: boolean;
  definitionVersion: number;
  katalog: StavkaKatalogaIzazovaDto[];
  napredak: NapredakIzazovaDto;
}

export function izgradiAgregateLevela(
  zavrseniSirovi: ReadonlySet<string>,
): AgregatLevelaIzazovaDto[] {
  const zavrseni = filterAktivnihZavrsenih(zavrseniSirovi);
  return LEVELOVI_IZAZOVA.map((level) => {
    const ids = idEviLevela(level);
    const zavrseno = ids.filter((id) => zavrseni.has(id)).length;
    let status: AgregatLevelaIzazovaDto['status'];
    if (zavrseno === 15) status = 'zavrsen';
    else if (levelDostupan(level, zavrseni)) status = 'dostupan';
    else status = 'zakljucan';
    const formati: AgregatFormataIzazovaDto[] = FORMATI_IZAZOVA.map((format) => {
      const fIds = idEviFormata(level, format);
      const fZav = fIds.filter((id) => zavrseni.has(id)).length;
      let fStatus: AgregatFormataIzazovaDto['status'];
      if (status === 'zakljucan') fStatus = 'zakljucan';
      else if (fZav === 5) fStatus = 'zavrsen';
      else fStatus = 'dostupan';
      return {
        format,
        naziv: NAZIVI_FORMATA_IZAZOVA[format],
        zavrseno: fZav,
        ukupno: 5,
        status: fStatus,
      };
    });
    return {
      level,
      naziv: NAZIVI_LEVELA_IZAZOVA[level],
      profileId: profilZaLevel(level),
      zavrseno,
      ukupno: 15 as const,
      status,
      formati,
    };
  });
}

export function izgradiStavkuKataloga(
  definicija: DefinicijaIzazova,
  opcije: {
    zavrseni: ReadonlySet<string>;
    awardedXpPoId?: ReadonlyMap<string, number>;
  },
): StavkaKatalogaIzazovaDto {
  const { status, razlog } = dostupnostIzazova(definicija, opcije.zavrseni);
  const awardedXp = opcije.awardedXpPoId?.get(definicija.id) ?? null;
  const blockingChallengeId =
    razlog && razlog.nedostaje.length > 0 ? razlog.nedostaje[0]! : null;
  return {
    id: definicija.id,
    redniBroj: definicija.redniBroj,
    naziv: definicija.naziv,
    level: definicija.level,
    format: definicija.format,
    varijanta: definicija.varijanta,
    redoslijedUFormatu: definicija.redoslijedUFormatu,
    brojIgraca: definicija.brojIgraca,
    mod: definicija.mod,
    pravila: definicija.pravila,
    effectiveProfileId: definicija.profileId,
    turnDurationMs: definicija.turnDurationMs,
    botTurnDurationMs: definicija.botTurnDurationMs,
    ciljevi: { ...definicija.ciljevi },
    opisCilja: definicija.opisCilja,
    xp: definicija.xp,
    definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
    status,
    razlogZakljucavanja: razlog,
    blockingChallengeId,
    xpOsvojen: awardedXp !== null,
    awardedXp,
  };
}

/** Validacija cijelog kataloga (schema test / boot). Baca ako je nekonzistentan. */
export function validirajKatalogIzazova(katalog: readonly DefinicijaIzazova[] = KATALOG_IZAZOVA): void {
  if (katalog.length !== 60) {
    throw new Error(`Očekivano 60 izazova, dobiveno ${katalog.length}`);
  }
  const ids = new Set<string>();
  let prethodniRedni = 0;
  let zbrojXp = 0;
  for (const d of katalog) {
    if (!jeIdIzazova(d.id)) throw new Error(`Nevaljan id: ${d.id}`);
    if (ids.has(d.id)) throw new Error(`Duplikat id: ${d.id}`);
    ids.add(d.id);
    if (d.redniBroj !== prethodniRedni + 1) {
      throw new Error(`Redni broj nije monoton: ${d.id} (${d.redniBroj})`);
    }
    prethodniRedni = d.redniBroj;
    if (!(MODOVI_PARTIJE as readonly string[]).includes(d.mod)) {
      throw new Error(`${d.id}: nepoznat mod ${d.mod}`);
    }
    if (!(PRAVILNICI_PARTIJE as readonly string[]).includes(d.pravila)) {
      throw new Error(`${d.id}: nepoznat pravilnik ${d.pravila}`);
    }
    if (!(PROFILI_BOTA_IZAZOVA as readonly string[]).includes(d.profileId)) {
      throw new Error(`${d.id}: nepoznat profil ${d.profileId}`);
    }
    if (d.profileId !== profilZaLevel(d.level)) {
      throw new Error(`${d.id}: profil ne odgovara levelu`);
    }
    if (!(TRAJANJA_POTEZA_IZAZOVA_MS as readonly number[]).includes(d.turnDurationMs)) {
      throw new Error(`${d.id}: nepodržan turnDurationMs ${d.turnDurationMs}`);
    }
    if (d.botTurnDurationMs !== 30_000) {
      throw new Error(`${d.id}: botTurnDurationMs mora biti 30000`);
    }
    if (d.mod !== modZaBroj(d.brojIgraca)) {
      throw new Error(`${d.id}: mod ne odgovara broju igrača`);
    }
    if (d.brojIgraca !== brojIgracaZaFormat(d.format)) {
      throw new Error(`${d.id}: format/broj igrača`);
    }
    if (!Number.isInteger(d.xp) || d.xp <= 0) {
      throw new Error(`${d.id}: nevaljan XP`);
    }
    zbrojXp += d.xp;
    const pred = predlozakVarijante(d.varijanta);
    if (d.pravila !== pred.pravila) throw new Error(`${d.id}: pravilnik ≠ predložak`);
    if (d.turnDurationMs !== pred.sekundiCovjek * 1000) throw new Error(`${d.id}: timer ≠ predložak`);
    if (Boolean(d.ciljevi.bezPogreske) !== Boolean(pred.ciljevi.bezPogreske)) {
      throw new Error(`${d.id}: cilj bezPogreske ≠ predložak`);
    }
    if (d.ciljevi.dugeRijeci !== undefined || d.ciljevi.rijetkeRijeci !== undefined
      || d.ciljevi.uspjesanDokaz !== undefined) {
      throw new Error(`${d.id}: novi katalog ne smije imati duge/rijetke/uspjesanDokaz`);
    }
  }
  for (const id of ID_OVI_IZAZOVA) {
    if (!ids.has(id)) throw new Error(`Nedostaje ${id}`);
  }
  for (const level of LEVELOVI_IZAZOVA) {
    for (const format of FORMATI_IZAZOVA) {
      const uFormatu = katalog.filter((d) => d.level === level && d.format === format);
      if (uFormatu.length !== 5) throw new Error(`L${level} ${format}: očekivano 5`);
      const varijante = new Set(uFormatu.map((d) => d.varijanta));
      if (varijante.size !== 5) throw new Error(`L${level} ${format}: duplicirane varijante`);
    }
  }
  if (zbrojXp !== UKUPNI_NOMINALNI_XP_IZAZOVA) {
    throw new Error(`XP zbroj ${zbrojXp} ≠ ${UKUPNI_NOMINALNI_XP_IZAZOVA}`);
  }
  const petnaest = katalog.filter((d) => d.turnDurationMs === 15_000);
  if (petnaest.length < 1) throw new Error('Katalog mora imati barem jednu 15-s razinu');
}

/**
 * Zvjezdice Izazivača:
 * 1★ — bilo koji aktivni završetak; 2★ L1; 3★ L1+L2; 4★ L1–L3; 5★ svih 60.
 * Stari IZ* ID-jevi se zanemaruju.
 */
export function izracunajZvjezdiceIzazivaca(zavrseni: ReadonlySet<string>): 0 | 1 | 2 | 3 | 4 | 5 {
  const aktivni = filterAktivnihZavrsenih(zavrseni);
  if (aktivni.size === 0) return 0;
  let zvijezde: 0 | 1 | 2 | 3 | 4 | 5 = 1;
  if (levelZavrsen(1, aktivni)) zvijezde = 2;
  if (levelZavrsen(1, aktivni) && levelZavrsen(2, aktivni)) zvijezde = 3;
  if (levelZavrsen(1, aktivni) && levelZavrsen(2, aktivni) && levelZavrsen(3, aktivni)) zvijezde = 4;
  if (
    levelZavrsen(1, aktivni) && levelZavrsen(2, aktivni)
    && levelZavrsen(3, aktivni) && levelZavrsen(4, aktivni)
  ) {
    zvijezde = 5;
  }
  return zvijezde;
}

/**
 * @deprecated Linearni prethodnik uklonjen u v2. Zadržano kao stub za eventualne stare importe —
 * vraća null. Koristiti `dostupnostIzazova`.
 */
export function prethodniIzazovId(_id: IdIzazova): IdIzazova | null {
  return null;
}
