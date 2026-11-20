/**
 * Tipovi svih Socket.IO poruka - jedini ugovor između klijenta i poslužitelja.
 * Vidi docs/03-arhitektura/protokol-poruka.md.
 */
import type { VrstaRijeci } from './pravila.js';
import type { ObracunIskustva, StavkaIskustva } from './iskustvo.js';
import type { OznakeNoveRijeci } from './oznake-novih-rijeci.js';
import type { DnkOs } from './dnk.js';
import type { AvatarConfigV1 } from './avatar.js';
import type { FormaIgraca } from './forma.js';
import type { PohvalaIgre } from './pohvale-igre.js';
import type { PromjenaMisije, UkupnoIskustvoIshoda } from './misije.js';
import type { ModPartije, PravilnikPartije } from './katalog-partije.js';

export interface PodaciVeze {
  /** Opaque guest token ILI sesijski token registriranog igrača. */
  token: string;
}

/** Brze poruke stolova. Ljudski picker šalje samo prve četiri; botovi smiju i micro-flavour kodove. */
export type BrzaPoruka =
  | 'pozdrav'
  | 'sorry'
  | 'dobro-odigrano'
  | 'najjaci'
  | 'cao'
  | 'hej'
  | 'oprosi'
  | 'svaka-cast';

/** Kodovi koje smije poslati ljudski `reakcija:posalji`. */
export const LJUDSKE_BRZE_PORUKE = ['pozdrav', 'sorry', 'dobro-odigrano', 'najjaci'] as const;
export type LjudskaBrzaPoruka = (typeof LJUDSKE_BRZE_PORUKE)[number];

export type KodRazlogaVeze = 'SESIJA_ISTEKLA' | 'NEVALJAN_TOKEN' | 'DRUGA_KARTICA' | 'SERVIS_NEDOSTUPAN';

export interface ZatvaranjeVeze {
  kod: KodRazlogaVeze;
  poruka: string;
}

// Klijent -> poslužitelj

export interface PayloadPotezRijec {
  rijec: string;
  turnToken?: string;
}

export interface PayloadNeznam {
  turnToken?: string;
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
  mod: ModPartije;
  /** Izvršni / odabrani pravilnik ulaza; izostanak na starom payloadu = ka_zna. */
  pravila?: PravilnikPartije;
  mjesta: ({
    igracId: string;
    nadimak: string;
    jeGost: boolean;
    jeBot: boolean;
    avatarId: number;
    avatarConfig: AvatarConfigV1 | null;
    avatarRevision: number;
    rang: string | null;
    razina: number;
    odigrane: number;
    prosjekBodova: number;
    postotakPobjeda: number;
    trenutniNiz: number;
    razinaVatre: 0 | 1 | 2 | 3;
    odabranaPravila?: PravilnikPartije;
  } | null)[];
  prosjekCekanjaSek: number;
}

// Privatne sobe (postavke, clanovi, stanje)

export interface PostavkePrivatneSobe {
  trajanjePotezaSek: number; // 15, 30, 60, ili 0 za bez timera
  dopusteneVrste: VrstaRijeci[]; // filter dopuštenih vrsta riječi
  eliminacijskiBodovi: boolean; // +1 bod po eliminaciji
  /** Izostanak = ka_zna (kompatibilnost starih klijenata). */
  pravila?: PravilnikPartije;
}

export interface ClanSobe {
  igracId: string;
  nadimak: string;
  jeGost: boolean;
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

export interface PayloadIzbaciIzSobe {
  igracId: string;
}

/**
 * Javna partija (bodovi, rang, XP), privatna soba, trening ili kampanjski Izazov.
 * Kampanjski challengeId ≠ dokaz `izazovId`.
 */
export type KontekstPartije = 'javna' | 'privatna' | 'trening' | 'izazov';

export interface PocetakPartije {
  partijaId: string;
  mojIgracId: string;
  /** Kada partija stvarno kreće (poslužitelj je sat) — čekaonica odbrojava do ovog trenutka. */
  pocetakIso: string;
  sjedala: {
    igracId: string;
    nadimak: string;
    jeGost: boolean;
    jeBot: boolean;
    avatarId: number;
    avatarConfig: AvatarConfigV1 | null;
    avatarRevision: number;
    rang: string | null;
    razina: number;
    trenutniNiz: number;
    razinaVatre: 0 | 1 | 2 | 3;
    odabranaPravila?: PravilnikPartije;
  }[];
  mod?: ModPartije;
  /** Izvršeni pravilnik stola; izostanak = ka_zna. */
  pravila?: PravilnikPartije;
  /** Zajednički javni Dvoboj (Klasični+KA-ZNA); u PR01 uvijek false. */
  spojeniDvoboj?: boolean;
  kontekst?: KontekstPartije;
  jePrivatna?: boolean;
  kodSobe?: string;
  /** 0 = bez limitu (ONEMOGUCI_TIMER / privatno / trening); izostanak = klijent drži null. */
  trajanjePotezaSek?: number;
}

/**
 * Eksplicitna faza poteza (PR05).
 * Izostanak na starom payloadu = izvedi iz `sustavBiraRijec` + zavrsena (običan potez).
 * // PR05→PR14: UI ne sudi lokalno — čita faza/dokaz iz snimke.
 * // PR05→PR07: bot planira najviše jednu odluku po (partijaId, igracId, turnToken); novi token za dokaz dopušta drugi potez.
 */
export type FazaPoteza = 'obican_potez' | 'dokaz_nastavka' | 'sustav_bira' | 'zavrsena';

/** Zašto je otvoren dokaz nastavka (samo dokazi_nastavak). */
export type RazlogOtvaranjaDokaza = 'ne_znam' | 'istek' | 'prekid_na_potezu';

/**
 * Snimka aktivnog izazova dokaza.
 * Bruno koji je samo kliknuo „Ne znam” NIJE ispao (`cekateljVecIspao=false`);
 * Bruno koji je napustio na potezu JEST potvrđen (`cekateljVecIspao=true`) — Ana dokazuje za kredit.
 * // PR05: Ne znam != napusti; Ne znam ne upisuje rani poraz.
 */
export interface SnimkaDokaza {
  izazovId: string;
  izvornaRijec: string;
  trazenaSlova: string;
  autorId: string;
  cekateljId: string;
  razlogOtvaranja: RazlogOtvaranjaDokaza;
  /** true kad je čekač već potvrđen (napusti/prekid); false dok čeka odluku nakon „Ne znam”/isteka. */
  cekateljVecIspao: boolean;
  pocetakIso: string;
  istekPotezaIso: string;
}

export interface StanjePartije {
  partijaId: string;
  mojIgracId: string;
  sjedala: PocetakPartije['sjedala'];
  turnToken: string;
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
  mod?: ModPartije;
  pravila?: PravilnikPartije;
  spojeniDvoboj?: boolean;
  kontekst?: KontekstPartije;
  jePrivatna?: boolean;
  kodSobe?: string;
  trajanjePotezaSek?: number;
  dopusteneVrste?: VrstaRijeci[];
  treningNeaktivnost?: { upozorenjeIso: string; zatvaraIso: string; upozorenje: boolean };
  /** PR05 aditivno; stari klijent ignorira. */
  faza?: FazaPoteza;
  /** PR05: popunjeno samo dok traje dokaz_nastavka. */
  dokaz?: SnimkaDokaza | null;
  /** PR03: napredak ciljeva kampanjskog Izazova (samo kontekst izazov). */
  goalProgress?: import('./izazovi.js').GoalProgressIzazova | null;
  /** PR03: terminalni ishod pokušaja ako je već CAS-an (reconnect / refresh). */
  izazovTerminal?: {
    status: import('./izazovi.js').StatusPokusajaIzazova;
    reason: import('./izazovi.js').RazlogNeuspjehaIzazova | null;
    resultsVisibleAtIso: string | null;
    gameWon: boolean | null;
  } | null;
}

/**
 * Motor je otvorio dokaz autoru (PR05). Emitira se ODVOJENO od eliminacije —
 * Bruno još nije ispao ako je samo „Ne znam”.
 * // PR05→PR14: „Ana dokazuje nastavak…” bez oznake „Ispao si” za Brunu.
 */
export interface DokazZatrazen {
  partijaId: string;
  izazovId: string;
  autorId: string;
  cekateljId: string;
  izvornaRijec: string;
  trazenaSlova: string;
  razlogOtvaranja: RazlogOtvaranjaDokaza;
  cekateljVecIspao: boolean;
  turnToken: string;
  istekPotezaIso: string;
  serverVrijemeIso: string;
  naPotezuId: string;
}

export interface TreningNeaktivnost {
  partijaId: string;
  upozorenjeIso: string;
  zatvaraIso: string;
  upozorenje: boolean;
}

export interface PrihvacenPotez {
  igracId: string;
  rijec: string;
  trazenaSlova: string;
  sljedeciId: string;
  turnToken: string;
  istekPotezaIso: string;
  serverVrijemeIso: string;
  brojIskoristenih: number;
  streak: number;
  nagrada: NagradaZaRijec | null;
  /** Autoritativne XP stavke koje je autor poteza upravo ostvario; nema konačnog obračuna. */
  iskustvo?: StavkaIskustva[];
}

export interface OtkljucavanjeRijeci {
  partijaId: string;
  oblik: string;
  osnovneRijeci: string[];
  novaOsnovnaRijec: boolean;
  dugaKategorija: 'duga' | 'srednje_duga' | 'jako_duga' | null;
  rijetkaKategorija: 'rijetka' | 'srednje_rijetka' | 'jako_rijetka' | null;
  noviDugiOblik: boolean;
  noviRijetkiOblik: boolean;
  iskustvo: StavkaIskustva[];
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
    | 'VLASTITO_IME'
    | 'KRIVA_SLOVA'
    | 'RIJEC_ISKORISTENA'
    | 'NIJE_TVOJ_POTEZ'
    | 'STARI_TURN_TOKEN'
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

export type NacinIspadanja = RazlogEliminacije | 'mrtva_slova' | 'pobjednik';

export interface PlasmanPartije {
  igracId: string;
  nadimak: string;
  plasman: number;
  bodovi: number;
  eliminacije: number;
  nacinIspadanja: NacinIspadanja | null;
  /** true ako je registriran/admin (nije gost ni bot) — može se otvoriti javni profil. */
  javniProfil: boolean;
  /** true ako je računalni protivnik. */
  jeBot?: boolean;
  /** Ocjena igre (1–5); null ako nije dostupna (privatna / trening). */
  ocjenaIgre?: number | null;
}

export interface ArhivaPartije {
  partijaId: string;
  mod: ModPartije;
  pravila?: PravilnikPartije;
  spojeniDvoboj?: boolean;
  pocetak: string;
  kraj: string;
  plasmani: PlasmanPartije[];
}

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
  prikazRezultataOdIso?: string;
  plasmani: PlasmanPartije[];
  mojNoviProsjek: number;
  mojRang: string | null;
  mojeIskustvo: ObracunIskustva | null;
  mojaOcjenaIgre?: number | null;
  bonusOcjenaIgre?: number;
  novaDostignuca: { id: string; novaRazina: number; maksimalnaRazina: number }[];
  /** Usporedne pohvale ove javne igre za primatelja; prazno ako nema. */
  pohvale?: PohvalaIgre[];
  mojNiz?: { prije: number; poslije: number; najbolji: number };
  mojaForma?: FormaIgraca;
  mojDnk?: {
    odigrano: number;
    preostaloDoOtkljucavanja: number;
    otkljucan: boolean;
    upravoOtkljucan: boolean;
    prije: DnkOs[];
    poslije: DnkOs[];
  };
  kolekcija?: {
    dodaneKategorije: { vrsta: VrstaRijeci | 'pridjev_prilog'; broj: number; rijeci: string[] }[];
    /** Oznake duljine/rijetkosti uz novootključane osnovne riječi; opcionalno radi kompatibilnosti. */
    oznakeNovihRijeci?: OznakeNoveRijeci[];
    ukupnoOtkljucano: number;
    ukupnoDostupno: number;
    trenutnaRazina: string;
    sljedecaRazina: string | null;
    doSljedece: number | null;
  };
  /** Osobne promjene misija ovog završetka; nema tuđih misija. */
  promjeneMisija?: PromjenaMisije[];
  /** Konačno iskustvo nakon partijskog + misijskog XP-a. */
  ukupnoIskustvo?: UkupnoIskustvoIshoda;
  misijeStanjeVerzija?: number;
  mod?: ModPartije;
  pravila?: PravilnikPartije;
  spojeniDvoboj?: boolean;
  kontekst?: KontekstPartije;
  jePrivatna?: boolean;
  kodSobe?: string;
  /** PR04: rezultat settlementa Izazova (nakon commit-a). */
  izazovSettlement?: import('./izazovi.js').SettlementIzazovaDto;
}

export interface NovoDostignuceTijekomPartije {
  partijaId: string;
  dostignuca: { id: string; naziv: string; novaRazina: number; maksimalnaRazina: number }[];
}

/** Trajna osobna obavijest o novoj razini dostignuća (D01 i kasniji sandučić). */
export interface ObavijestOtkljucanogDostignuca {
  id: string;
  dostignuceId: string;
  naziv: string;
  novaRazina: number;
  maksimalnaRazina: number;
  izvor: string | null;
}

export interface NovostiDostignuca {
  obavijesti: ObavijestOtkljucanogDostignuca[];
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
  turnToken: string;
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
  | 'IZBACEN_IZ_SOBE'
  | 'NISI_VLASNIK'
  | 'NEDOVOLJNO_IGRACA'
  | 'VEC_U_PARTIJI'
  | 'VEC_U_SOBI'
  | 'EMAIL_NIJE_POTVRDEN'
  | 'UVJETI_NISU_PRIHVACENI'
  | 'PREVISE_SOBA'
  | 'PREVISE_PARTIJA'
  | 'UPIS_PARTIJE_NEUSPJEO'
  | 'TRENING_NEDOSTUPAN'
  | 'IZAZOV_NEDOSTUPAN'
  | 'IZAZOV_ZAKLJUCAN'
  | 'IZAZOV_AKTIVAN';

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
  mod?: ModPartije;
  /** Izostanak = ka_zna (stari klijent / stari link). */
  pravila?: PravilnikPartije;
}

export interface PayloadTreningZapocni {
  /** Izostanak = ka_zna (ili klasicni ako je brojRacunala ≥ 2). */
  pravila?: PravilnikPartije;
  /** 1 = Dvoboj, 2 = Troboj, 3 = Četveroboj. Izostanak → iz pravilnika (klasični = 2, ostalo = 1). */
  brojRacunala?: 1 | 2 | 3;
  /** PR02: Početnik/Iskusni/Majstor/Velemajstor. Izostanak = Iskusni (stari klijent). */
  profileId?: import('./izazovi.js').ProfilBotaIzazova;
}

export type PotvrdaUlaskaURed = (stanje: StanjeReda | null) => void;

/** Potvrda pokretanja treninga: partija kreće kroz redovne `partija:*` događaje. */
export type PotvrdaTreninga = (ishod: { pokrenut: true } | { pokrenut: false; kod: KodGreske; poruka: string }) => void;

/** Start kampanjskog Izazova; challengeId ≠ dokaz izazovId. */
export interface PayloadIzazovZapocni {
  challengeId: import('./izazovi.js').IdIzazova;
  requestId: string;
}

export type PotvrdaIzazova = (ishod:
  | {
    rezerviran: true;
    attemptId: string;
    challengeId: import('./izazovi.js').IdIzazova;
    /** true kad je motor stvarno pokrenuo partiju (PR03+). */
    pokrenut: boolean;
    partijaId: string | null;
    status: import('./izazovi.js').StatusPokusajaIzazova;
  }
  | { rezerviran: false; kod: KodGreske; poruka: string }
) => void;

/** Mapa svih događaja klijent -> poslužitelj, za tipiziranu upotrebu Socket.IO. */
export interface DogadajiKlijentPoslužitelj {
  'red:udji': (payload: PayloadUdjiURed | undefined, potvrda?: PotvrdaUlaskaURed) => void;
  /** Stari klijent šalje samo callback; novi može poslati `{ pravila }` pa callback. */
  'trening:zapocni': (payloadIliPotvrda?: PayloadTreningZapocni | PotvrdaTreninga, potvrda?: PotvrdaTreninga) => void;
  'trening:nastavi': (payload: Record<string, never>) => void;
  'izazov:zapocni': (payload: PayloadIzazovZapocni, potvrda?: PotvrdaIzazova) => void;
  'red:stanje': (payload?: PayloadUdjiURed) => void;
  'red:izadji': () => void;
  'partija:izadji': () => void;
  'partija:stanje': () => void;
  'potez:rijec': (payload: PayloadPotezRijec) => void;
  'potez:ne-znam': (payload?: PayloadNeznam) => void;
  'reakcija:posalji': (payload: PayloadReakcijaPosalji) => void;
  'igrac:avatar-azuriraj': (payload: PayloadAvatarAzuriraj) => void;
  'soba:stvori': (payload: PayloadStvoriSobu) => void;
  'soba:udji': (payload: PayloadUdjiUSobu) => void;
  'soba:izadji': () => void;
  'soba:stanje': () => void;
  'soba:pokreni': () => void;
  'soba:izbaci': (payload: PayloadIzbaciIzSobe) => void;
}

/** Mapa svih događaja poslužitelj -> klijent, za tipiziranu upotrebu Socket.IO. */
export interface DogadajiPosluziteljKlijent {
  'red:stanje': (payload: StanjeReda) => void;
  'partija:pocetak': (payload: PocetakPartije) => void;
  'partija:stanje': (payload: StanjePartije) => void;
  'potez:prihvacen': (payload: PrihvacenPotez) => void;
  'rijec:otkljucana': (payload: OtkljucavanjeRijeci) => void;
  'potez:odbijen': (payload: OdbijenPotez) => void;
  'partija:eliminacija': (payload: Eliminacija) => void;
  /** PR05: odgođena eliminacija — dokaz zatražen; stari klijent ignorira nepoznati događaj. */
  'dokaz:zatrazen': (payload: DokazZatrazen) => void;
  'partija:sustav-bira-rijec': (payload: SustavBiraRijec) => void;
  'partija:runda-otvorena': (payload: RundaOtvorena) => void;
  'partija:spremanje-rezultata': (payload: SpremanjeRezultataPartije) => void;
  'partija:ponistena': (payload: PonistenaPartija) => void;
  'trening:neaktivnost': (payload: TreningNeaktivnost) => void;
  'partija:kraj': (payload: KrajPartije) => void;
  'dostignuce:otkljucano': (payload: NovoDostignuceTijekomPartije) => void;
  'dostignuca:novosti': (payload: NovostiDostignuca) => void;
  'sanducic:promjena': (payload: import('./sanducic.js').SanducicPromjena) => void;
  'iskustvo:obracun': (payload: ObracunIskustvaTijekomPartije) => void;
  'reakcija:nova': (payload: { igracId: string; poruka: BrzaPoruka }) => void;
  'soba:stvorena': (payload: { kod: string }) => void;
  'soba:stanje': (payload: StanjePrivatneSobe) => void;
  'soba:vlasnik-napustio': (payload: { kod: string }) => void;
  'soba:izbacen': (payload: { kod: string }) => void;
  'veza:zatvorena': (payload: ZatvaranjeVeze) => void;
  greska: (payload: PayloadGreska) => void;
}
