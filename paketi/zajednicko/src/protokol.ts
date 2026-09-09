/**
 * Tipovi svih Socket.IO poruka - jedini ugovor između klijenta i poslužitelja.
 * Vidi docs/03-arhitektura/protokol-poruka.md.
 */
import type { VrstaRijeci } from './pravila.js';

export interface PodaciVeze {
  /** UUID gosta iz localStoragea ILI sesijski token registriranog igrača. */
  token: string;
}

export type BrzaPoruka = 'pozdrav' | 'sorry' | 'dobro-odigrano' | 'najjaci';

// Klijent -> poslužitelj

export interface PayloadPotezRijec {
  rijec: string;
}

export interface PayloadReakcijaPosalji {
  poruka: BrzaPoruka;
}

// Poslužitelj -> klijent

export interface StanjeReda {
  mjesta: ({
    nadimak: string;
    avatarId: number;
    rang: string | null;
    prosjekBodova: number;
    postotakPobjeda: number;
  } | null)[];
  prosjekCekanjaSek: number;
}

export interface PocetakPartije {
  partijaId: string;
  mojIgracId: string;
  /** Kada partija stvarno kreće (poslužitelj je sat) — čekaonica odbrojava do ovog trenutka. */
  pocetakIso: string;
  sjedala: { igracId: string; nadimak: string; avatarId: number; rang: string | null }[];
}

export interface StanjePartije {
  partijaId: string;
  mojIgracId: string;
  sjedala: PocetakPartije['sjedala'];
  naPotezuId: string;
  trazenaSlova: string | null;
  istekPotezaIso: string;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
}

export interface PrihvacenPotez {
  igracId: string;
  rijec: string;
  trazenaSlova: string;
  sljedeciId: string;
  istekPotezaIso: string;
  brojIskoristenih: number;
}

export interface OdbijenPotez {
  kod: 'RIJEC_NE_POSTOJI' | 'KRIVA_SLOVA' | 'RIJEC_ISKORISTENA' | 'NIJE_TVOJ_POTEZ';
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
  plasman: 2 | 3 | 4;
  razlog: RazlogEliminacije;
  bodZa: string | null;
  slova: string | null;
  /** Riječ koja je izazvala mrtva slova (za obrazloženje na klijentu); null za ostale razloge. */
  rijecUzrok: string | null;
}

export interface KrajPartije {
  plasmani: {
    igracId: string;
    plasman: 1 | 2 | 3 | 4;
    bodovi: number;
    eliminacije: number;
  }[];
  mojNoviProsjek: number;
  mojRang: string | null;
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
  runda: number;
}

export type KodGreske = 'PREBRZO' | 'NISI_U_PARTIJI' | 'VEC_U_REDU' | 'INTERNA';

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

/** Mapa svih događaja klijent -> poslužitelj, za tipiziranu upotrebu Socket.IO. */
export interface DogadajiKlijentPoslužitelj {
  'red:udji': () => void;
  'red:izadji': () => void;
  'partija:stanje': () => void;
  'potez:rijec': (payload: PayloadPotezRijec) => void;
  'potez:ne-znam': () => void;
  'reakcija:posalji': (payload: PayloadReakcijaPosalji) => void;
  'partija:izadji': () => void;
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
  'partija:kraj': (payload: KrajPartije) => void;
  'reakcija:nova': (payload: { igracId: string; poruka: BrzaPoruka }) => void;
  greska: (payload: PayloadGreska) => void;
}
