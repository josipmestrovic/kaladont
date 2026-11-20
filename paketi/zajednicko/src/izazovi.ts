/**
 * Katalog Izazova v1 — linearna kampanja IZ01–IZ24.
 * Ugovori i definicije; motor/evaluator/nagrade dolaze u kasnijim PR-ovima.
 */
import { PRAGOVI_DULJINE } from './nagrada-za-rijec.js';
import type { ModPartije, PravilnikPartije } from './katalog-partije.js';
import { MODOVI_PARTIJE, PRAVILNICI_PARTIJE } from './katalog-partije.js';

/** Verzija kataloga definicija; balansi bumpaju ovo, ne otvaraju ponovno XP (rewardEpoch). */
export const VERZIJA_DEFINICIJE_IZAZOVA = 1;

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

export const ID_OVI_IZAZOVA = [
  'IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06',
  'IZ07', 'IZ08', 'IZ09', 'IZ10', 'IZ11', 'IZ12',
  'IZ13', 'IZ14', 'IZ15', 'IZ16', 'IZ17', 'IZ18',
  'IZ19', 'IZ20', 'IZ21', 'IZ22', 'IZ23', 'IZ24',
] as const;
export type IdIzazova = (typeof ID_OVI_IZAZOVA)[number];

/** Milestone skupovi za dostignuće Izazivač (zvjezdice); stabilni, ne oduzimaju se. */
export const MILESTONE_SKUPOVI_IZAZIVACA: readonly (readonly IdIzazova[])[] = [
  ['IZ01'],
  ['IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06'],
  ['IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06', 'IZ07', 'IZ08', 'IZ09', 'IZ10', 'IZ11', 'IZ12'],
  [
    'IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06',
    'IZ07', 'IZ08', 'IZ09', 'IZ10', 'IZ11', 'IZ12',
    'IZ13', 'IZ14', 'IZ15', 'IZ16', 'IZ17', 'IZ18',
  ],
  [...ID_OVI_IZAZOVA],
];

export interface CiljeviIzazova {
  /** Pobjeda čovjeka je uvijek obvezna; ovo su dodatni uvjeti. */
  bezPogreske?: boolean;
  dugeRijeci?: number;
  rijetkeRijeci?: number;
  /** IZ24: uspješan dokaz (uvjetno do release gatea). */
  uspjesanDokaz?: number;
}

/** Autoritativni napredak ciljeva u snimci / GET pokušaja (PR03). */
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
  /** Broj igrača za stolom (čovjek + botovi). */
  brojIgraca: 2 | 3 | 4;
  mod: ModPartije;
  pravila: PravilnikPartije;
  profileId: ProfilBotaIzazova;
  turnDurationMs: TrajanjePotezaIzazovaMs;
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

function def(
  id: IdIzazova,
  redniBroj: number,
  naziv: string,
  brojIgraca: 2 | 3 | 4,
  pravila: PravilnikPartije,
  profileId: ProfilBotaIzazova,
  sekundi: 15 | 30,
  ciljevi: CiljeviIzazova,
  xp: number,
  opisCilja: string,
): DefinicijaIzazova {
  return {
    id,
    redniBroj,
    naziv,
    brojIgraca,
    mod: modZaBroj(brojIgraca),
    pravila,
    profileId,
    turnDurationMs: (sekundi * 1000) as TrajanjePotezaIzazovaMs,
    ciljevi,
    xp,
    opisCilja,
  };
}

/** Autoritativni katalog nagrada i postava v1. */
export const KATALOG_IZAZOVA: readonly DefinicijaIzazova[] = [
  def('IZ01', 1, 'Prvi korak', 2, 'klasicni', 'pocetnik', 30, {}, 100, 'Pobijedi.'),
  def('IZ02', 2, 'Treće mjesto nije cilj', 3, 'klasicni', 'pocetnik', 30, {}, 120, 'Pobijedi.'),
  def('IZ03', 3, 'Za cijelim stolom', 4, 'klasicni', 'pocetnik', 30, {}, 150, 'Pobijedi.'),
  def('IZ04', 4, 'Precizan dvoboj', 2, 'klasicni', 'pocetnik', 30, { bezPogreske: true }, 180, 'Pobijedi bez pogreške.'),
  def('IZ05', 5, 'Mirna ruka', 3, 'klasicni', 'pocetnik', 30, { bezPogreske: true }, 220, 'Pobijedi bez pogreške.'),
  def('IZ06', 6, 'Čisti početak', 4, 'klasicni', 'pocetnik', 30, { bezPogreske: true }, 270, 'Pobijedi bez pogreške.'),
  def('IZ07', 7, 'Pazi kome ostavljaš KA', 3, 'ka_zna', 'iskusni', 30, {}, 330, 'Pobijedi.'),
  def('IZ08', 8, 'KA za četvero', 4, 'ka_zna', 'iskusni', 30, {}, 400, 'Pobijedi.'),
  def('IZ09', 9, 'Prvih petnaest', 3, 'ka_zna', 'iskusni', 15, {}, 490, 'Pobijedi (15 s po potezu).'),
  def('IZ10', 10, 'Duga priča', 2, 'klasicni', 'iskusni', 30, { dugeRijeci: 1 }, 600, 'Pobijedi i odigraj 1 dugu riječ.'),
  def('IZ11', 11, 'Dvije duge', 3, 'klasicni', 'iskusni', 30, { dugeRijeci: 2 }, 730, 'Pobijedi i odigraj 2 duge riječi.'),
  def('IZ12', 12, 'Riječi s karakterom', 4, 'ka_zna', 'iskusni', 30, { dugeRijeci: 1, rijetkeRijeci: 1 }, 890, 'Pobijedi uz 1 dugu i 1 rijetku riječ.'),
  def('IZ13', 13, 'Taktički dvoboj', 2, 'klasicni', 'majstor', 30, {}, 1090, 'Pobijedi.'),
  def('IZ14', 14, 'Brza odluka', 3, 'klasicni', 'majstor', 15, {}, 1330, 'Pobijedi (15 s po potezu).'),
  def('IZ15', 15, 'Majstorska preciznost', 4, 'klasicni', 'majstor', 30, { bezPogreske: true }, 1620, 'Pobijedi bez pogreške.'),
  def('IZ16', 16, 'KA pod pritiskom', 3, 'ka_zna', 'majstor', 15, {}, 1970, 'Pobijedi (15 s po potezu).'),
  def('IZ17', 17, 'Rijetka prilika', 3, 'ka_zna', 'majstor', 30, { rijetkeRijeci: 2 }, 2410, 'Pobijedi uz 2 rijetke riječi.'),
  def('IZ18', 18, 'Majstorski završetak', 4, 'ka_zna', 'majstor', 30, { dugeRijeci: 2, rijetkeRijeci: 2 }, 2940, 'Pobijedi uz 2 duge i 2 rijetke riječi.'),
  def('IZ19', 19, 'Velemajstorski dvoboj', 2, 'klasicni', 'velemajstor', 30, {}, 3580, 'Pobijedi.'),
  def('IZ20', 20, 'Četvero u petnaest', 4, 'klasicni', 'velemajstor', 15, {}, 4370, 'Pobijedi (15 s po potezu).'),
  def('IZ21', 21, 'Veliki rječnik', 4, 'ka_zna', 'velemajstor', 30, { dugeRijeci: 3, rijetkeRijeci: 3 }, 5340, 'Pobijedi uz 3 duge i 3 rijetke riječi.'),
  def('IZ22', 22, 'Pokaži nastavak', 2, 'dokazi_nastavak', 'majstor', 30, {}, 6510, 'Pobijedi (uvod u Dokaži).'),
  def('IZ23', 23, 'Dokaži precizno', 3, 'dokazi_nastavak', 'velemajstor', 30, { bezPogreske: true }, 7940, 'Pobijedi bez pogreške.'),
  def('IZ24', 24, 'Završni ispit', 4, 'dokazi_nastavak', 'velemajstor', 30, { uspjesanDokaz: 1 }, 9690, 'Pobijedi uz 1 uspješan dokaz.'),
];

const KATALOG_PO_IDU = new Map<IdIzazova, DefinicijaIzazova>(
  KATALOG_IZAZOVA.map((d) => [d.id, d]),
);

export function jeIdIzazova(vrijednost: unknown): vrijednost is IdIzazova {
  return typeof vrijednost === 'string' && (ID_OVI_IZAZOVA as readonly string[]).includes(vrijednost);
}

export function definicijaIzazova(id: IdIzazova): DefinicijaIzazova {
  const d = KATALOG_PO_IDU.get(id);
  if (!d) throw new Error(`Nepoznat izazov: ${id}`);
  return d;
}

export function prethodniIzazovId(id: IdIzazova): IdIzazova | null {
  const d = definicijaIzazova(id);
  if (d.redniBroj <= 1) return null;
  return KATALOG_IZAZOVA[d.redniBroj - 2]!.id;
}

export function brojBotovaZaIzazov(definicija: DefinicijaIzazova): 1 | 2 | 3 {
  return (definicija.brojIgraca - 1) as 1 | 2 | 3;
}

export type StatusOtkljucavanjaIzazova = 'zakljucan' | 'dostupan' | 'zavrsen';

export interface StavkaKatalogaIzazovaDto {
  id: IdIzazova;
  redniBroj: number;
  naziv: string;
  brojIgraca: 2 | 3 | 4;
  mod: ModPartije;
  pravila: PravilnikPartije;
  effectiveProfileId: ProfilBotaIzazova;
  turnDurationMs: TrajanjePotezaIzazovaMs;
  ciljevi: CiljeviIzazova;
  opisCilja: string;
  xp: number;
  definitionVersion: number;
  status: StatusOtkljucavanjaIzazova;
  /** Ako je zaključan, koji prethodni izazov nedostaje. */
  blockingChallengeId: IdIzazova | null;
  /** true kad je jednokratni XP već isplaćen. */
  xpOsvojen: boolean;
  awardedXp: number | null;
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
}

export interface OdgovorKatalogaIzazova {
  ok: true;
  omogucen: boolean;
  definitionVersion: number;
  katalog: StavkaKatalogaIzazovaDto[];
  napredak: NapredakIzazovaDto;
}

export function izgradiStavkuKataloga(
  definicija: DefinicijaIzazova,
  opcije: {
    zavrseni: ReadonlySet<string>;
    awardedXpPoId?: ReadonlyMap<string, number>;
  },
): StavkaKatalogaIzazovaDto {
  const prethodni = prethodniIzazovId(definicija.id);
  const zavrsen = opcije.zavrseni.has(definicija.id);
  const prethodnikOk = prethodni === null || opcije.zavrseni.has(prethodni);
  let status: StatusOtkljucavanjaIzazova;
  if (zavrsen) status = 'zavrsen';
  else if (prethodnikOk) status = 'dostupan';
  else status = 'zakljucan';

  const awardedXp = opcije.awardedXpPoId?.get(definicija.id) ?? null;
  return {
    id: definicija.id,
    redniBroj: definicija.redniBroj,
    naziv: definicija.naziv,
    brojIgraca: definicija.brojIgraca,
    mod: definicija.mod,
    pravila: definicija.pravila,
    effectiveProfileId: definicija.profileId,
    turnDurationMs: definicija.turnDurationMs,
    ciljevi: { ...definicija.ciljevi },
    opisCilja: definicija.opisCilja,
    xp: definicija.xp,
    definitionVersion: VERZIJA_DEFINICIJE_IZAZOVA,
    status,
    blockingChallengeId: status === 'zakljucan' ? prethodni : null,
    xpOsvojen: awardedXp !== null,
    awardedXp,
  };
}

/** Validacija cijelog kataloga (schema test / boot). Baca ako je nekonzistentan. */
export function validirajKatalogIzazova(katalog: readonly DefinicijaIzazova[] = KATALOG_IZAZOVA): void {
  if (katalog.length !== 24) {
    throw new Error(`Očekivano 24 izazova, dobiveno ${katalog.length}`);
  }
  const ids = new Set<string>();
  let prethodniRedni = 0;
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
    if (!(TRAJANJA_POTEZA_IZAZOVA_MS as readonly number[]).includes(d.turnDurationMs)) {
      throw new Error(`${d.id}: nepodržan turnDurationMs ${d.turnDurationMs}`);
    }
    if (d.mod !== modZaBroj(d.brojIgraca)) {
      throw new Error(`${d.id}: mod ne odgovara broju igrača`);
    }
    if (!Number.isInteger(d.xp) || d.xp <= 0) {
      throw new Error(`${d.id}: nevaljan XP`);
    }
    const c = d.ciljevi;
    if (c.dugeRijeci !== undefined && (!Number.isInteger(c.dugeRijeci) || c.dugeRijeci < 1)) {
      throw new Error(`${d.id}: nevaljan dugeRijeci`);
    }
    if (c.rijetkeRijeci !== undefined && (!Number.isInteger(c.rijetkeRijeci) || c.rijetkeRijeci < 1)) {
      throw new Error(`${d.id}: nevaljan rijetkeRijeci`);
    }
    if (c.uspjesanDokaz !== undefined && (!Number.isInteger(c.uspjesanDokaz) || c.uspjesanDokaz < 1)) {
      throw new Error(`${d.id}: nevaljan uspjesanDokaz`);
    }
  }
  for (const id of ID_OVI_IZAZOVA) {
    if (!ids.has(id)) throw new Error(`Nedostaje ${id}`);
  }
  const petnaest = katalog.filter((d) => d.turnDurationMs === 15_000);
  if (petnaest.length < 1) throw new Error('Katalog mora imati barem jednu 15-s razinu');
}

/** Broj zvjezdica Izazivača iz skupa završenih ID-eva. */
export function izracunajZvjezdiceIzazivaca(zavrseni: ReadonlySet<string>): 0 | 1 | 2 | 3 | 4 | 5 {
  let zvijezde = 0 as 0 | 1 | 2 | 3 | 4 | 5;
  for (let i = 0; i < MILESTONE_SKUPOVI_IZAZIVACA.length; i += 1) {
    const skup = MILESTONE_SKUPOVI_IZAZIVACA[i]!;
    if (skup.every((id) => zavrseni.has(id))) {
      zvijezde = (i + 1) as 0 | 1 | 2 | 3 | 4 | 5;
    } else {
      break;
    }
  }
  return zvijezde;
}
