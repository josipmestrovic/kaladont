/**
 * Tipovi svih Socket.IO poruka - jedini ugovor između klijenta i poslužitelja.
 * Vidi docs/03-arhitektura/protokol-poruka.md.
 */
import type { VrstaRijeci } from './pravila.js';
import type { ObracunIskustva, StavkaIskustva } from './iskustvo.js';
import type { DnkOs } from './dnk.js';
import type { AvatarConfigV1 } from './avatar.js';

export interface PodaciVeze {
  /** Opaque guest token ILI sesijski token registriranog igrača. */
  token: string;
}

export type BrzaPoruka = 'pozdrav' | 'sorry' | 'dobro-odigrano' | 'najjaci';

export type KodRazlogaVeze = 'SESIJA_ISTEKLA' | 'NEVALJAN_TOKEN' | 'DRUGA_KARTICA' | 'SERVIS_NEDOSTUPAN';

export interface ZatvaranjeVeze {
  kod: KodRazlogaVeze;
  poruka: string;
}

// Klijent -> poslužitelj

export interface PayloadPotezRijec {
  rijec: string;
}

export interface PayloadReakcijaPosalji {
  poruka: BrzaPoruka;
}

export interface PayloadAvatarAzuriraj {
  avatarConfig: AvatarConfigV1;
  avatarRevision: number;
}

// Poslužitelj -> klijent

export interface StanjeReda {
  mojIgracId: string;
  mod: 'cetiri_igraca' | 'dva_igraca';
  mjesta: ({
    igracId: string;
    nadimak: string;
    avatarId: number;
    avatarConfig: AvatarConfigV1 | null;
    avatarRevision: number;
    rang: string | null;
    razina: number;
    odigrane: number;
    prosjekBodova: number;
    postotakPobjeda: number;
  } | null)[];
  prosjekCekanjaSek: number;
}

// Privatne sobe (postavke, clanovi, stanje)

export interface PostavkePrivatneSobe {
  trajanjePotezaSek: number; // 15, 30, 60, ili 0 za bez timera
  dopusteneVrste: VrstaRijeci[]; // filter dopuštenih vrsta riječi
  eliminacijskiBodovi: boolean; // +1 bod po eliminaciji
}

export interface ClanSobe {
  igracId: string;
  nadimak: string;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  rang: string | null;
  razina: number;
  jeVlasnik: boolean;
  pobjedeUSobi: number;
  bodoviUSobi: number;
}

export interface StanjePrivatneSobe {
  kod: string;
  mojIgracId: string;
  postavke: PostavkePrivatneSobe;
  vlasnikId: string;
  clanovi: ClanSobe[];
  partijaId: string | null;
  status: 'cekanje' | 'u_tijeku' | 'zavrsena';
}

export interface PayloadStvoriSobu {
  postavke: PostavkePrivatneSobe;
}

export interface PayloadUdjiUSobu {
  kod: string;
}

export interface PocetakPartije {
  partijaId: string;
  mojIgracId: string;
  /** Kada partija stvarno kreće (poslužitelj je sat) — čekaonica odbrojava do ovog trenutka. */
  pocetakIso: string;
  sjedala: { igracId: string; nadimak: string; avatarId: number; avatarConfig: AvatarConfigV1 | null; avatarRevision: number; rang: string | null; razina: number }[];
  mod?: 'cetiri_igraca' | 'dva_igraca';
  jePrivatna?: boolean;
  kodSobe?: string;
}

export interface StanjePartije {
  partijaId: string;
  mojIgracId: string;
  sjedala: PocetakPartije['sjedala'];
  naPotezuId: string;
  trazenaSlova: string | null;
  istekPotezaIso: string;
  serverVrijemeIso: string;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
  zadnjaRijec: string | null;
  zadnjaRijecIgracId: string | null;
  zadnjaRijecVrsta: 'rijec' | 'sustav_rijec' | null;
  zavrsena: boolean;
  statusSpremanja: 'nije_zavrsena' | 'spremanje_rezultata' | 'rezultati_spremljeni';
  mod?: 'cetiri_igraca' | 'dva_igraca';
  jePrivatna?: boolean;
  kodSobe?: string;
  trajanjePotezaSek?: number;
  dopusteneVrste?: VrstaRijeci[];
}

export interface PrihvacenPotez {
  igracId: string;
  rijec: string;
  trazenaSlova: string;
  sljedeciId: string;
  istekPotezaIso: string;
  serverVrijemeIso: string;
  brojIskoristenih: number;
  streak: number;
  nagrada: NagradaZaRijec | null;
  /** Autoritativne XP stavke koje je autor poteza upravo ostvario; nema konačnog obračuna. */
  iskustvo?: StavkaIskustva[];
}

export interface NagradaZaRijec {
  intenzitet: 'mali' | 'srednji' | 'veliki';
  rijetkost: 'rijetka' | 'srednje_rijetka' | 'jako_rijetka' | null;
  duljina: 'duga' | 'srednje_duga' | 'jako_duga' | null;
  tekst: string;
  kategorija: 'rijetke' | 'duge' | null;
  otkljucano: number | null;
  ukupno: number | null;
}

export interface OdbijenPotez {
  kod:
    | 'RIJEC_NE_POSTOJI'
    | 'KRIVA_SLOVA'
    | 'RIJEC_ISKORISTENA'
    | 'NIJE_TVOJ_POTEZ'
    | 'SUSTAV_BIRA_RIJEC'
    | 'NEDOPUSTENA_VRSTA'
    | 'NIJE_OSNOVNI_OBLIK'
    | 'PREKRATKA_RIJEC';
  poruka: string;
}

export type RazlogEliminacije =
  | 'ne_znam'
  | 'istek'
  | 'mrtva_slova_baza'
  | 'mrtva_slova_iskoristeno'
  | 'prekid'
  | 'kaladont';

export interface Eliminacija {
  igracId: string;
  plasman: number;
  razlog: RazlogEliminacije;
  bodZa: string | null;
  slova: string | null;
  /** Riječ koja je izazvala mrtva slova (za obrazloženje na klijentu); null za ostale razloge. */
  rijecUzrok: string | null;
  iskustvo?: StavkaIskustva | null;
}

export interface KrajPartije {
  partijaId: string;
  plasmani: {
    igracId: string;
    plasman: number;
    bodovi: number;
    eliminacije: number;
  }[];
  mojNoviProsjek: number;
  mojRang: string | null;
  mojeIskustvo: ObracunIskustva | null;
  mojaOcjenaIgre?: number | null;
  bonusOcjenaIgre?: number;
  novaDostignuca: { id: string; novaRazina: number; maksimalnaRazina: number }[];
  mojDnk?: {
    odigrano: number;
    preostaloDoOtkljucavanja: number;
    otkljucan: boolean;
    upravoOtkljucan: boolean;
    prije: DnkOs[];
    poslije: DnkOs[];
  };
  mod?: 'cetiri_igraca' | 'dva_igraca';
  jePrivatna?: boolean;
  kodSobe?: string;
}

/** Privatni obračun eliminiranog igrača; trajni upis slijedi pri završetku partije. */
export interface ObracunIskustvaTijekomPartije {
  partijaId: string;
  mojeIskustvo: ObracunIskustva;
}

export interface SpremanjeRezultataPartije {
  partijaId: string;
  poruka: string;
}

export interface PonistenaPartija {
  partijaId: string;
  poruka: string;
}

/** Sustav je pocelo birati rijec za otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta). */
export interface SustavBiraRijec {
  istekIzboraIso: string;
}

/** Sustav je otkrio nasumicno odabranu rijec; sljedeci igrac na potezu na nju odgovara kao normalan nastavak. */
export interface RundaOtvorena {
  rijec: string;
  trazenaSlova: string;
  naPotezuId: string;
  istekPotezaIso: string;
  serverVrijemeIso: string;
  runda: number;
}

export type KodGreske =
  | 'NEVALJAN_PAYLOAD'
  | 'PREBRZO'
  | 'NISI_U_PARTIJI'
  | 'VEC_U_REDU'
  | 'INTERNA'
  | 'SOBA_NE_POSTOJI'
  | 'SOBA_U_TIJEKU'
  | 'SOBA_PUNA'
  | 'NISI_VLASNIK'
  | 'NEDOVOLJNO_IGRACA'
  | 'VEC_U_PARTIJI'
  | 'VEC_U_SOBI'
  | 'PREVISE_SOBA'
  | 'PREVISE_PARTIJA'
  | 'UPIS_PARTIJE_NEUSPJEO';

export interface PayloadGreska {
  kod: KodGreske;
  poruka: string;
}

// REST (javne rute)

/** Odgovor GET /rjecnik/statistika — broj oblika po kategoriji, sortirano silazno (naslovnica). */
export interface StatistikaRjecnika {
  ukupno: number;
  kategorije: { vrsta: VrstaRijeci; brojOblika: number }[];
}

export interface PayloadUdjiURed {
  mod?: 'cetiri_igraca' | 'dva_igraca';
}

export type PotvrdaUlaskaURed = (stanje: StanjeReda | null) => void;

/** Mapa svih događaja klijent -> poslužitelj, za tipiziranu upotrebu Socket.IO. */
export interface DogadajiKlijentPoslužitelj {
  'red:udji': (payload: PayloadUdjiURed | undefined, potvrda?: PotvrdaUlaskaURed) => void;
  'red:stanje': (payload?: PayloadUdjiURed) => void;
  'red:izadji': () => void;
  'partija:izadji': () => void;
  'partija:stanje': () => void;
  'potez:rijec': (payload: PayloadPotezRijec) => void;
  'potez:ne-znam': () => void;
  'reakcija:posalji': (payload: PayloadReakcijaPosalji) => void;
  'igrac:avatar-azuriraj': (payload: PayloadAvatarAzuriraj) => void;
  'soba:stvori': (payload: PayloadStvoriSobu) => void;
  'soba:udji': (payload: PayloadUdjiUSobu) => void;
  'soba:izadji': () => void;
  'soba:stanje': () => void;
  'soba:pokreni': () => void;
}

/** Mapa svih događaja poslužitelj -> klijent, za tipiziranu upotrebu Socket.IO. */
export interface DogadajiPosluziteljKlijent {
  'red:stanje': (payload: StanjeReda) => void;
  'partija:pocetak': (payload: PocetakPartije) => void;
  'partija:stanje': (payload: StanjePartije) => void;
  'potez:prihvacen': (payload: PrihvacenPotez) => void;
  'potez:odbijen': (payload: OdbijenPotez) => void;
  'partija:eliminacija': (payload: Eliminacija) => void;
  'partija:sustav-bira-rijec': (payload: SustavBiraRijec) => void;
  'partija:runda-otvorena': (payload: RundaOtvorena) => void;
  'partija:spremanje-rezultata': (payload: SpremanjeRezultataPartije) => void;
  'partija:ponistena': (payload: PonistenaPartija) => void;
  'partija:kraj': (payload: KrajPartije) => void;
  'iskustvo:obracun': (payload: ObracunIskustvaTijekomPartije) => void;
  'reakcija:nova': (payload: { igracId: string; poruka: BrzaPoruka }) => void;
  'soba:stvorena': (payload: { kod: string }) => void;
  'soba:stanje': (payload: StanjePrivatneSobe) => void;
  'soba:vlasnik-napustio': (payload: { kod: string }) => void;
  'veza:zatvorena': (payload: ZatvaranjeVeze) => void;
  greska: (payload: PayloadGreska) => void;
}
