import type { KontekstPartije } from 'zajednicko';

/**
 * Što partija smije trajno upisati i nagraditi (ADR-017). Odabire se pri stvaranju stola;
 * klijent je ne može promijeniti.
 */
export interface PolitikaUcinkaPartije {
  kontekst: KontekstPartije;
  /** partije, sudionici_partije, potezi i završni upis u bazu */
  zapisujePovijest: boolean;
  /** XP, bodovi, rang, forma, nizovi, rani poraz, DNK i obavijesti o napretku */
  dajeNapredak: boolean;
  /** kolekcije riječi i dostignuća (javna, privatna, trening, izazov; bez ljestvičnog XP) */
  dajeDostignucaIKolekcije: boolean;
  /** Ako true, registrirani ljudski trening-sudionik trajno sprema vlastite riječi (legacy; kolekcija ide preko dajeDostignucaIKolekcije). */
  zapisujeKolekcijuTreninga: boolean;
}

const POLITIKE: Record<KontekstPartije, PolitikaUcinkaPartije> = {
  javna: { kontekst: 'javna', zapisujePovijest: true, dajeNapredak: true, dajeDostignucaIKolekcije: true, zapisujeKolekcijuTreninga: false },
  privatna: { kontekst: 'privatna', zapisujePovijest: true, dajeNapredak: false, dajeDostignucaIKolekcije: true, zapisujeKolekcijuTreninga: false },
  trening: { kontekst: 'trening', zapisujePovijest: false, dajeNapredak: false, dajeDostignucaIKolekcije: true, zapisujeKolekcijuTreninga: false },
  /**
   * Pokušaji/završeci Izazova su autoritet za challenge XP (PR04).
   * zapisujePovijest: partije+potezi radi prijave riječi (FK).
   * Kolekcija i opća dostignuća riječi (Dugometraš/Rijetkolovac…) uključeni; bez ljestvičnog XP/ranga.
   */
  izazov: { kontekst: 'izazov', zapisujePovijest: true, dajeNapredak: false, dajeDostignucaIKolekcije: true, zapisujeKolekcijuTreninga: false },
};

export function politikaZaKontekst(kontekst: KontekstPartije): PolitikaUcinkaPartije {
  return POLITIKE[kontekst];
}

export type RezultatPokretanja = 'pokrenuta' | 'limit' | 'zaustavljanje' | 'greska';

export type RezultatNaredbe =
  | { ishod: 'prihvacen' }
  | { ishod: 'odbijen'; kod: import('zajednicko').OdbijenPotez['kod']; poruka: string }
  | { ishod: 'ignoriran'; razlog: 'nema_partije' | 'zavrsena' | 'nije_na_potezu' | 'sustav_bira' | 'nije_sudionik' };

/** Snimka poteza za promatrače motora (bot kontroler). `iskoristeneGrupe` je živi skup partije: samo čitati. */
export interface DogadajPoteza {
  partijaId: string;
  kontekst: KontekstPartije;
  zavrsena: boolean;
  izborUToku: boolean;
  /**
   * PR05: eksplicitna faza. Bot (PR07) planira jednu odluku po tokenu;
   * novi token u dokaz_nastavka dopušta isti bot da odigra dokaz nakon vlastite riječi.
   */
  faza?: import('zajednicko').FazaPoteza;
  /** PR05: pravilnik stola — bot bira politiku „ka” / dokaza po pravilniku. */
  pravila?: import('zajednicko').PravilnikPartije;
  naPotezuId: string | null;
  turnToken: string;
  trazenaSlova: string | null;
  zadnjaRijec: string | null;
  istekPotezaMs: number | null;
  pocetakPotezaMs: number;
  trajanjePotezaMs: number;
  iskoristeneGrupe: ReadonlySet<string>;
  dopusteneVrste?: ReadonlySet<import('zajednicko').VrstaRijeci>;
  sudionici: readonly { igracId: string; upravljac: 'covjek' | 'bot'; aktivan: boolean }[];
  /** PR05: tko dokazuje / tko čeka — bot ne emitira ispadanje čekača prije potvrde. */
  dokaz?: {
    autorId: string;
    cekateljId: string;
    cekateljVecIspao: boolean;
  } | null;
}
