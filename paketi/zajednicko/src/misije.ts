import type { StanjeIskustva } from './iskustvo.js';
import type { ModPartije, PravilnikPartije } from './katalog-partije.js';

export type VrstaMisije = 'dnevna' | 'tjedna';
export type StatusDodjeleMisije = 'aktivna' | 'dovrsena' | 'zamijenjena' | 'istekla';
export type KontekstMisije = 'javna' | 'trening' | 'izazov';
/** HINT PR12: `tri_igraca` za Troboj; `oba` = sva tri javna formata (2/3/4) nakon otključavanja. */
export type ModMisije = 'oba' | 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca';
export type SlotMisije = 1 | 2 | 3;
/** DB enum već ima `izazov` (PR01); TS matcher PR04. */
export type KontekstIzvoraMisije = 'javna' | 'trening' | 'izazov';

export type ObiteljMisije =
  | 'aktivnost'
  | 'kolicina_rijeci'
  | 'niz'
  | 'ucinak_partije'
  | 'duljina'
  | 'rijetkost'
  | 'plasman'
  | 'trening'
  | 'oba_moda'
  | 'taktika'
  | 'spoj_rijeci'
  | 'raznolikost'
  | 'razliciti_dani'
  | 'izazov';

export type MetrikaMisije =
  | 'partije'
  | 'pobjede'
  | 'trening_pobjede'
  | 'rijeci'
  | 'niz_max'
  | 'rijeci_u_partiji_max'
  | 'partije_s_nizom'
  | 'partije_s_rijecima'
  | 'duge'
  | 'jako_duge'
  | 'rijetke'
  | 'jako_rijetke'
  | 'duge_i_rijetke'
  | 'eliminacije'
  | 'kaladont'
  | 'razliciti_poceci'
  | 'dani'
  | 'oba_moda'
  /** PR12 W22: +1 po javnoj igri s barem jednim uspješnim dokazom (max 1 doprinos / igra). */
  | 'partije_s_dokazom'
  /** PR12 W23: +1 po igri s barem jednim kaladontom na sljedećeg uz ≥3 aktivna prije poteza. */
  | 'kaladont_sljedeci'
  /** PR04: +1 po kvalificiranom pokušaju Izazova (uspjeh ili igrački neuspjeh uz ≥1 riječ). */
  | 'izazov_pokusaji';

export interface PodciljDefinicijeMisije {
  kljuc: string;
  naziv: string;
  cilj: number;
}

export interface DefinicijaMisije {
  predlozakId: string;
  vrsta: VrstaMisije;
  verzijaDefinicije: number;
  naziv: string;
  opis: string;
  metrika: MetrikaMisije;
  cilj: number;
  /** Prag unutar jedne igre (npr. niz ≥5, riječi ≥3); inače nedostaje. */
  pragMetrike?: number;
  podciljevi?: readonly PodciljDefinicijeMisije[];
  xp: number;
  obitelj: ObiteljMisije;
  zahtjevnija: boolean;
  kontekst: KontekstMisije;
  mod: ModMisije;
  /**
   * PR12: skup formata (npr. D23 Troboj|Četveroboj). Kad postoji, matcher koristi članstvo
   * umjesto točnog `mod` (osim što `mod` ostaje u snapshotu za DTO/stare klijente).
   */
  modovi?: readonly ModPartije[];
  /** PR12: filtriraj po pravilniku; u spojenom Dvoboju gleda se odabranaPravila igrača. */
  pravilnik?: PravilnikPartije;
  aktivna: boolean;
}

export interface PodciljMisijeDto {
  kljuc: string;
  naziv: string;
  napredak: number;
  cilj: number;
}

export interface MisijaDto {
  dodjelaId: string;
  slot: SlotMisije;
  vrsta: VrstaMisije;
  predlozakId: string;
  verzijaDefinicije: number;
  status: 'aktivna' | 'dovrsena';
  naziv: string;
  opis: string;
  metrika: MetrikaMisije;
  kontekst: KontekstMisije;
  mod: ModMisije;
  napredak: number;
  cilj: number;
  podciljevi?: PodciljMisijeDto[];
  xpNagrada: number;
  dostupnaOdIso: string;
  istjeceU: string | null;
  zavrsenaU: string | null;
  nagrada: null | {
    xpNominalno: number;
    xpStvarnoDodijeljeno: number;
    dodijeljenaU: string;
  };
  zamjena: { dopustena: boolean; razlog: string | null };
}

export interface StanjeMisijaDto {
  ok: true;
  stanjeVerzija: number;
  serverVrijemeIso: string;
  vremenskaZona: 'Europe/Zagreb';
  obracunUTijeku: boolean;
  novosti: { dnevne: boolean; tjedne: boolean };
  dnevne: {
    kapacitet: 3;
    aktivne: MisijaDto[];
    danasDovrsene: MisijaDto[];
    sljedeciDotokU: string;
  };
  tjedne: {
    pocetakIso: string;
    krajIso: string;
    misije: MisijaDto[];
  };
  zamjene: Record<VrstaMisije, {
    preostalo: 0 | 1;
    obnovaU: string;
  }>;
}

export interface MetrikeMisijaIgre {
  izvorId: string;
  kontekst: KontekstIzvoraMisije;
  /** PR08: trening smije biti tri_igraca; filtri misija za trening i dalje ignorišu mod. */
  mod: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca';
  igracId: string;
  zavrsenoU: Date;
  plasman: number;
  nacinIspadanja: string;
  prihvaceneRijeci: number;
  najduziNiz: number;
  dugeRijeci: number;
  jakoDugeRijeci: number;
  rijetkeRijeci: number;
  jakoRijetkeRijeci: number;
  dugeIRijetkeRijeci: number;
  eliminacije: number;
  kaladontIzvedbe: number;
  razlicitiPoceci: string[];
  /**
   * PR12: izvršni pravilnik stola. U spojenom Dvoboju stol igra ka_zna;
   * za misije izbora koristi `odabranaPravila` (vidi `pravilaZaMisijskiFilter`).
   */
  pravila: PravilnikPartije;
  /** PR12: UI izbor igrača (kartica); u spojenom Dvoboju odlučuje za D24/W24/D23… */
  odabranaPravila: PravilnikPartije;
  /** PR12: true = zajednički javni Dvoboj (KA-ZNA + Klasični na istom stolu). */
  spojeniDvoboj: boolean;
  /**
   * PR12 W22 / D22: broj uspješnih dokaza ovog igrača u ovoj igri.
   * HINT: uspješan dokaz već broji i kao prihvaćena riječ; ovo je zasebna činjenica.
   */
  uspjesniDokazi: number;
  /**
   * PR12 W23: broj običnih kaladonta s metom „sljedeći”, stvarnom žrtvom i ≥3 aktivna prije poteza.
   * HINT: dokaz koji glasi kaladont NE ide ovim putem (motor zaobilazi KA-ZNA/klasični efekt).
   */
  kaladontSljedeciUzTriPlus: number;
}

/**
 * PR12: pravilnik koji misija smije usporediti s `snapshot.pravilnik`.
 * Spojeni Dvoboj → kartica igrača; svi ostali stolovi → stvarni pravilnik.
 */
export function pravilaZaMisijskiFilter(metrike: MetrikeMisijaIgre): PravilnikPartije {
  return metrike.spojeniDvoboj ? metrike.odabranaPravila : metrike.pravila;
}

export interface PromjenaMisije {
  dodjelaId: string;
  predlozakId: string;
  vrsta: VrstaMisije;
  naziv: string;
  opis: string;
  opisNapretka: string;
  prije: number;
  poslije: number;
  cilj: number;
  podciljeviPoslije?: PodciljMisijeDto[];
  upravoDovrsena: boolean;
  xpNominalno: number;
  xpStvarnoDodijeljeno: number;
}

export interface UkupnoIskustvoIshoda {
  prije: StanjeIskustva;
  nakonPartije: StanjeIskustva;
  poslije: StanjeIskustva;
  partijskiXpStvarno: number;
  misijskiXpNominalno: number;
  misijskiXpStvarno: number;
  ukupnoXpStvarno: number;
}

export const XP_DNEVNA_MISIJA = 200;
export const XP_TJEDNA_MISIJA = 2000;
export const KAPACITET_DNEVNIH_MISIJA = 3;
export const KAPACITET_TJEDNIH_MISIJA = 3;
export const PRISTUPACNE_TJEDNE_MISIJE = ['W01', 'W02', 'W10', 'W11', 'W20'] as const;

type OpcijeDefinicijeMisije = {
  zahtjevnija?: boolean;
  kontekst?: KontekstMisije;
  mod?: ModMisije;
  modovi?: readonly ModPartije[];
  pravilnik?: PravilnikPartije;
  pragMetrike?: number;
  podciljevi?: readonly PodciljDefinicijeMisije[];
  /** Soft-delete iz poola novih dodjela; zadano true. */
  aktivna?: boolean;
};

function dnevna(
  predlozakId: string,
  naziv: string,
  opis: string,
  metrika: MetrikaMisije,
  cilj: number,
  obitelj: ObiteljMisije,
  opts: OpcijeDefinicijeMisije = {},
): DefinicijaMisije {
  return {
    predlozakId,
    vrsta: 'dnevna',
    verzijaDefinicije: 1,
    naziv,
    opis,
    metrika,
    cilj,
    pragMetrike: opts.pragMetrike,
    podciljevi: opts.podciljevi,
    xp: XP_DNEVNA_MISIJA,
    obitelj,
    zahtjevnija: opts.zahtjevnija ?? false,
    kontekst: opts.kontekst ?? 'javna',
    mod: opts.mod ?? 'oba',
    modovi: opts.modovi,
    pravilnik: opts.pravilnik,
    aktivna: opts.aktivna ?? true,
  };
}

function tjedna(
  predlozakId: string,
  naziv: string,
  opis: string,
  metrika: MetrikaMisije,
  cilj: number,
  obitelj: ObiteljMisije,
  opts: OpcijeDefinicijeMisije = {},
): DefinicijaMisije {
  return {
    predlozakId,
    vrsta: 'tjedna',
    verzijaDefinicije: 1,
    naziv,
    opis,
    metrika,
    cilj,
    pragMetrike: opts.pragMetrike,
    podciljevi: opts.podciljevi,
    xp: XP_TJEDNA_MISIJA,
    obitelj,
    zahtjevnija: opts.zahtjevnija ?? false,
    kontekst: opts.kontekst ?? 'javna',
    mod: opts.mod ?? 'oba',
    modovi: opts.modovi,
    pravilnik: opts.pravilnik,
    aktivna: opts.aktivna ?? true,
  };
}

export const DEFINICIJE_MISIJA: readonly DefinicijaMisije[] = [
  dnevna('D01', 'Dvije igre', 'Završi 2 javne igre.', 'partije', 2, 'aktivnost'),
  dnevna('D02', 'Riječ po riječ', 'Odigraj ukupno 10 prihvaćenih riječi.', 'rijeci', 10, 'kolicina_rijeci'),
  dnevna('D03', 'Uhvati niz', 'U jednoj igri ostvari niz 3 prihvaćene riječi bez pogreške.', 'niz_max', 3, 'niz'),
  dnevna('D04', 'Pet u jednoj', 'U jednoj igri odigraj 5 prihvaćenih riječi.', 'rijeci_u_partiji_max', 5, 'ucinak_partije'),
  dnevna('D05', 'Duge riječi', 'Odigraj 2 riječi s najmanje 10 slova.', 'duge', 2, 'duljina'),
  dnevna('D06', 'Rijetko otkriće', 'Odigraj 1 riječ bilo kojeg postojećeg tiera rijetkosti.', 'rijetke', 1, 'rijetkost'),
  dnevna('D07', 'Za stolom četvorice', 'Završi 1 Četveroboj.', 'partije', 1, 'aktivnost', { mod: 'cetiri_igraca', aktivna: false }),
  dnevna('D08', 'Pobjednik Četveroboja', 'Pobijedi u 1 javnom Četveroboju.', 'pobjede', 1, 'plasman', { mod: 'cetiri_igraca', aktivna: false }),
  dnevna('D09', 'Tri dvobojske pobjede', 'Pobijedi u 3 javna Dvoboja.', 'pobjede', 3, 'plasman', { mod: 'dva_igraca', aktivna: false }),
  dnevna('D10', 'Pobjeda za zagrijavanje', 'Završi i pobijedi u 1 treningu.', 'trening_pobjede', 1, 'trening', { kontekst: 'trening', mod: 'dva_igraca' }),
  dnevna('D11', 'Dvobojski ritam', 'Završi 3 Dvoboja.', 'partije', 3, 'aktivnost', { mod: 'dva_igraca', aktivna: false }),
  dnevna('D12', 'Oba lica Kaladonta', 'Završi 1 Dvoboj i 1 Četveroboj.', 'oba_moda', 2, 'oba_moda', {
    aktivna: false,
    podciljevi: [
      { kljuc: 'dva_igraca', naziv: 'Dvoboji', cilj: 1 },
      { kljuc: 'cetiri_igraca', naziv: 'Četveroboji', cilj: 1 },
    ],
  }),
  dnevna('D13', 'Izazov 2 eliminacije', 'Izazov 2 eliminacije.', 'eliminacije', 2, 'taktika'),
  dnevna('D14', 'Kaladont potez', 'Izvedi 1 uspješan Kaladont prema pravilima motora.', 'kaladont', 1, 'taktika', { zahtjevnija: true }),
  dnevna('D15', 'Baš duga riječ', 'Odigraj 1 riječ s najmanje 15 slova.', 'jako_duge', 1, 'duljina', { zahtjevnija: true }),
  dnevna('D16', 'Skriveno blago', 'Odigraj 1 riječ označenu kao „jako rijetka”.', 'jako_rijetke', 1, 'rijetkost', { zahtjevnija: true }),
  dnevna('D17', 'Dvostruki pogodak', 'Odigraj 1 riječ koja je istodobno duga (≥10 slova) i rijetka (bilo koji tier).', 'duge_i_rijetke', 1, 'spoj_rijeci', { zahtjevnija: true }),
  dnevna('D18', 'Pet početaka', 'Odigraj riječi s 5 različitih početaka od dva hrvatska slova.', 'razliciti_poceci', 5, 'raznolikost'),
  dnevna('D19', 'Među najboljima', 'Završi 1 Četveroboj na 1. ili 2. mjestu.', 'pobjede', 1, 'plasman', { mod: 'cetiri_igraca', aktivna: false }),
  dnevna('D20', 'Dvije dobre igre', 'U 2 različite igre odigraj barem 3 prihvaćene riječi po igri.', 'partije_s_rijecima', 2, 'ucinak_partije', { pragMetrike: 3 }),

  // --- PR12: četiri nova dnevna (pool 20→24). Copy: „igra”, nikad „partija”. ---
  // HINT: trening/privatno ne napreduju ovih 8 (kontekst javna + filter).
  dnevna(
    'D21',
    'Za stolom troje',
    'Završi jedan javni Troboj i odigraj barem jednu prihvaćenu riječ.',
    'partije',
    1,
    'aktivnost',
    { mod: 'tri_igraca' },
  ),
  // HINT D22: maksimum unutar jedne igre (rijeci_u_partiji_max), ne zbroj između igara.
  // Uspješan dokaz broji kao jedan prihvat.
  dnevna(
    'D22',
    'Stojim iza riječi',
    'U jednoj javnoj igri Dokaži nastavak odigraj 3 prihvaćene riječi.',
    'rijeci_u_partiji_max',
    3,
    'ucinak_partije',
    { pravilnik: 'dokazi_nastavak', aktivna: false },
  ),
  // HINT D23: početni format 3 ili 4 + Klasični; Dvoboj ne broji.
  dnevna(
    'D23',
    'Idući na redu',
    'Završi jedan javni klasični Troboj ili Četveroboj i odigraj barem jednu prihvaćenu riječ.',
    'partije',
    1,
    'aktivnost',
    {
      mod: 'oba',
      modovi: ['tri_igraca', 'cetiri_igraca'],
      pravilnik: 'klasicni',
    },
  ),
  // HINT D24: zbraja riječi između igara; u spojenom Dvoboju vrijedi odabranaPravila.
  dnevna(
    'D24',
    'Po starom',
    'Odigraj ukupno 4 prihvaćene riječi u javnim igrama KA-zna.',
    'rijeci',
    4,
    'kolicina_rijeci',
    { pravilnik: 'ka_zna', aktivna: false },
  ),

  tjedna('W01', 'Redoviti igrač', 'Završi 15 javnih igara.', 'partije', 15, 'aktivnost'),
  tjedna('W02', 'Sto riječi', 'Odigraj ukupno 100 prihvaćenih riječi.', 'rijeci', 100, 'kolicina_rijeci'),
  tjedna('W03', 'Tri dobra niza', 'U 3 različite igre ostvari niz od barem 5 prihvaćenih riječi bez pogreške.', 'partije_s_nizom', 3, 'niz', { pragMetrike: 5 }),
  tjedna('W04', 'Čuvar dugih riječi', 'Odigraj 15 riječi s najmanje 10 slova.', 'duge', 15, 'duljina'),
  tjedna('W05', 'Lovac na rijetke', 'Odigraj 10 rijetkih riječi, bilo kojeg postojećeg tiera.', 'rijetke', 10, 'rijetkost'),
  tjedna('W06', 'Tri dana igre', 'Završi barem 1 javnu igru u 3 različita dana ovog tjedna.', 'dani', 3, 'razliciti_dani'),
  tjedna('W07', 'Osam dobrih igara', 'U 8 različitih igara odigraj barem 5 prihvaćenih riječi po igri.', 'partije_s_rijecima', 8, 'ucinak_partije', { pragMetrike: 5 }),
  tjedna('W08', 'Pet četverobojnih pobjeda', 'Pobijedi u 5 Četveroboja.', 'pobjede', 5, 'plasman', { zahtjevnija: true, mod: 'cetiri_igraca', aktivna: false }),
  tjedna('W09', 'Dvobojski pobjednik', 'Pobijedi u 20 javnih Dvoboja.', 'pobjede', 20, 'plasman', { zahtjevnija: true, mod: 'dva_igraca', aktivna: false }),
  tjedna('W10', 'Trening tjedan', 'Završi i pobijedi u 3 različita treninga.', 'trening_pobjede', 3, 'trening', { kontekst: 'trening', mod: 'dva_igraca' }),
  tjedna('W11', 'Četverobojni tjedan', 'Završi 10 Četveroboja.', 'partije', 10, 'aktivnost', { mod: 'cetiri_igraca', aktivna: false }),
  tjedna('W12', 'Dvobojski maraton', 'Završi 25 Dvoboja.', 'partije', 25, 'aktivnost', { mod: 'dva_igraca', aktivna: false }),
  tjedna('W13', 'Taktičar', 'Izazov 10 eliminacija.', 'eliminacije', 10, 'taktika'),
  tjedna('W14', 'Kaladont majstor', 'Izvedi 5 uspješnih Kaladonta.', 'kaladont', 5, 'taktika', { zahtjevnija: true }),
  tjedna('W15', 'Velike riječi', 'Odigraj 5 riječi s najmanje 15 slova.', 'jako_duge', 5, 'duljina', { zahtjevnija: true }),
  tjedna('W16', 'Rijetka zbirka', 'Odigraj 5 riječi označenih kao „jako rijetke”.', 'jako_rijetke', 5, 'rijetkost', { zahtjevnija: true }),
  tjedna('W17', 'Dugi i rijetki', 'Odigraj 5 riječi koje su svaka istodobno duge (≥10 slova) i rijetke.', 'duge_i_rijetke', 5, 'spoj_rijeci', { zahtjevnija: true }),
  tjedna('W18', 'Dvadeset početaka', 'Odigraj riječi s 20 različitih početaka od dva hrvatska slova.', 'razliciti_poceci', 20, 'raznolikost'),
  tjedna('W19', 'Stalno pri vrhu', 'Završi 10 Četveroboja na 1. ili 2. mjestu.', 'pobjede', 10, 'plasman', { mod: 'cetiri_igraca', aktivna: false }),
  tjedna('W20', 'Svestrani igrač', 'Završi 5 Dvoboja i 5 Četveroboja.', 'oba_moda', 10, 'oba_moda', {
    aktivna: false,
    podciljevi: [
      { kljuc: 'dva_igraca', naziv: 'Dvoboji', cilj: 5 },
      { kljuc: 'cetiri_igraca', naziv: 'Četveroboji', cilj: 5 },
    ],
  }),

  // --- PR12: četiri nova tjedna. W21–W24 nisu u PRISTUPACNE_TJEDNE_MISIJE. ---
  tjedna(
    'W21',
    'Tri puta prvi',
    'Pobijedi u 3 javna Troboja.',
    'pobjede',
    3,
    'plasman',
    { mod: 'tri_igraca' },
  ),
  // HINT W22: max 1 doprinos po igri čak i uz više uspješnih dokaza.
  tjedna(
    'W22',
    'Riječ na provjeri',
    'Uspješno dokaži vlastiti nastavak u 2 različite javne igre.',
    'partije_s_dokazom',
    2,
    'taktika',
    { zahtjevnija: true, aktivna: false },
  ),
  // HINT W23: ≥3 aktivna neposredno prije poteza; stvarna sljedeća žrtva; max 1 / igra.
  tjedna(
    'W23',
    'Dvije dobre zamke',
    'U 2 različite javne klasične igre izbaci sljedećeg igrača kaladontom dok su u igri barem 3 igrača.',
    'kaladont_sljedeci',
    2,
    'taktika',
    { zahtjevnija: true, pravilnik: 'klasicni' },
  ),
  tjedna(
    'W24',
    'Stara škola pobjeđuje',
    'Pobijedi u 5 javnih igara KA-zna.',
    'pobjede',
    5,
    'plasman',
    { pravilnik: 'ka_zna', aktivna: false },
  ),

  // --- PR04: Izazov pool (nisu obvezna dodatna dodjela; ulaze u postojeći pool). ---
  dnevna(
    'D25',
    'Tri izazova',
    'Završi 3 pokušaja Izazova (uspjeh ili igrački neuspjeh uz barem jednu riječ).',
    'izazov_pokusaji',
    3,
    'izazov',
    { kontekst: 'izazov', mod: 'oba' },
  ),
  tjedna(
    'W25',
    'Deset izazova',
    'Završi 10 pokušaja Izazova (uspjeh ili igrački neuspjeh uz barem jednu riječ).',
    'izazov_pokusaji',
    10,
    'izazov',
    { kontekst: 'izazov', mod: 'oba' },
  ),
] as const;

const poId = new Map(DEFINICIJE_MISIJA.map((d) => [d.predlozakId, d]));

export function definicijaMisije(predlozakId: string): DefinicijaMisije | undefined {
  return poId.get(predlozakId);
}

export function definicijeMisijaPoVrsti(vrsta: VrstaMisije): DefinicijaMisije[] {
  return DEFINICIJE_MISIJA.filter((d) => d.vrsta === vrsta && d.aktivna);
}

/** D19/W19: top-2 samo u Četveroboju (metrika i dalje `pobjede`, poseban prag plasmana). */
export function jeTopDvaCetverobojMisija(predlozakId: string): boolean {
  return predlozakId === 'D19' || predlozakId === 'W19';
}

export function jePristupacnaTjedna(predlozakId: string): boolean {
  return (PRISTUPACNE_TJEDNE_MISIJE as readonly string[]).includes(predlozakId);
}
