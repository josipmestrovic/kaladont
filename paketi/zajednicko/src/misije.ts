import type { StanjeIskustva } from './iskustvo.js';

export type VrstaMisije = 'dnevna' | 'tjedna';
export type StatusDodjeleMisije = 'aktivna' | 'dovrsena' | 'zamijenjena' | 'istekla';
export type KontekstMisije = 'javna' | 'trening';
export type ModMisije = 'oba' | 'dva_igraca' | 'cetiri_igraca';
export type SlotMisije = 1 | 2 | 3;
export type KontekstIzvoraMisije = 'javna' | 'trening';

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
  | 'razliciti_dani';

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
  | 'oba_moda';

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
  mod: 'dva_igraca' | 'cetiri_igraca';
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
}

export interface PromjenaMisije {
  dodjelaId: string;
  predlozakId: string;
  vrsta: VrstaMisije;
  naziv: string;
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

function dnevna(
  predlozakId: string,
  naziv: string,
  opis: string,
  metrika: MetrikaMisije,
  cilj: number,
  obitelj: ObiteljMisije,
  opts: {
    zahtjevnija?: boolean;
    kontekst?: KontekstMisije;
    mod?: ModMisije;
    pragMetrike?: number;
    podciljevi?: readonly PodciljDefinicijeMisije[];
  } = {},
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
    aktivna: true,
  };
}

function tjedna(
  predlozakId: string,
  naziv: string,
  opis: string,
  metrika: MetrikaMisije,
  cilj: number,
  obitelj: ObiteljMisije,
  opts: {
    zahtjevnija?: boolean;
    kontekst?: KontekstMisije;
    mod?: ModMisije;
    pragMetrike?: number;
    podciljevi?: readonly PodciljDefinicijeMisije[];
  } = {},
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
    aktivna: true,
  };
}

export const DEFINICIJE_MISIJA: readonly DefinicijaMisije[] = [
  dnevna('D01', 'Dvije partije', 'Završi 2 javne partije.', 'partije', 2, 'aktivnost'),
  dnevna('D02', 'Riječ po riječ', 'Odigraj ukupno 10 prihvaćenih riječi.', 'rijeci', 10, 'kolicina_rijeci'),
  dnevna('D03', 'Uhvati niz', 'U jednoj partiji ostvari niz 3 prihvaćene riječi bez pogreške.', 'niz_max', 3, 'niz'),
  dnevna('D04', 'Pet u jednoj', 'U jednoj partiji odigraj 5 prihvaćenih riječi.', 'rijeci_u_partiji_max', 5, 'ucinak_partije'),
  dnevna('D05', 'Duge riječi', 'Odigraj 2 riječi s najmanje 10 grafema.', 'duge', 2, 'duljina'),
  dnevna('D06', 'Rijetko otkriće', 'Odigraj 1 riječ bilo kojeg postojećeg tiera rijetkosti.', 'rijetke', 1, 'rijetkost'),
  dnevna('D07', 'Za stolom četvorice', 'Završi 1 Četveroboj.', 'partije', 1, 'aktivnost', { mod: 'cetiri_igraca' }),
  dnevna('D08', 'Pobjednik Četveroboja', 'Pobijedi u 1 javnom Četveroboju.', 'pobjede', 1, 'plasman', { mod: 'cetiri_igraca' }),
  dnevna('D09', 'Tri dvobojske pobjede', 'Pobijedi u 3 javna Dvoboja.', 'pobjede', 3, 'plasman', { mod: 'dva_igraca' }),
  dnevna('D10', 'Pobjeda za zagrijavanje', 'Završi i pobijedi u 1 treningu.', 'trening_pobjede', 1, 'trening', { kontekst: 'trening', mod: 'dva_igraca' }),
  dnevna('D11', 'Dvobojski ritam', 'Završi 3 Dvoboja.', 'partije', 3, 'aktivnost', { mod: 'dva_igraca' }),
  dnevna('D12', 'Oba lica Kaladonta', 'Završi 1 Dvoboj i 1 Četveroboj.', 'oba_moda', 2, 'oba_moda', {
    podciljevi: [
      { kljuc: 'dva_igraca', naziv: 'Dvoboji', cilj: 1 },
      { kljuc: 'cetiri_igraca', naziv: 'Četveroboji', cilj: 1 },
    ],
  }),
  dnevna('D13', 'Dva izbacivanja', 'Izazovi 2 eliminacije protivnika prema pravilima motora.', 'eliminacije', 2, 'taktika'),
  dnevna('D14', 'Kaladont potez', 'Izvedi 1 uspješan Kaladont prema pravilima motora.', 'kaladont', 1, 'taktika', { zahtjevnija: true }),
  dnevna('D15', 'Baš duga riječ', 'Odigraj 1 riječ s najmanje 15 grafema.', 'jako_duge', 1, 'duljina', { zahtjevnija: true }),
  dnevna('D16', 'Skriveno blago', 'Odigraj 1 riječ označenu kao „jako rijetka”.', 'jako_rijetke', 1, 'rijetkost', { zahtjevnija: true }),
  dnevna('D17', 'Dvostruki pogodak', 'Odigraj 1 riječ koja je istodobno duga (≥10 grafema) i rijetka (bilo koji tier).', 'duge_i_rijetke', 1, 'spoj_rijeci', { zahtjevnija: true }),
  dnevna('D18', 'Pet početaka', 'Odigraj riječi s 5 različitih početaka od dva hrvatska grafema.', 'razliciti_poceci', 5, 'raznolikost'),
  dnevna('D19', 'Među najboljima', 'Završi 1 Četveroboj na 1. ili 2. mjestu.', 'pobjede', 1, 'plasman', { mod: 'cetiri_igraca' }),
  dnevna('D20', 'Dvije dobre partije', 'U 2 različite partije odigraj barem 3 prihvaćene riječi po partiji.', 'partije_s_rijecima', 2, 'ucinak_partije', { pragMetrike: 3 }),

  tjedna('W01', 'Redoviti igrač', 'Završi 15 javnih partija.', 'partije', 15, 'aktivnost'),
  tjedna('W02', 'Sto riječi', 'Odigraj ukupno 100 prihvaćenih riječi.', 'rijeci', 100, 'kolicina_rijeci'),
  tjedna('W03', 'Tri dobra niza', 'U 3 različite partije ostvari niz od barem 5 prihvaćenih riječi bez pogreške.', 'partije_s_nizom', 3, 'niz', { pragMetrike: 5 }),
  tjedna('W04', 'Čuvar dugih riječi', 'Odigraj 15 riječi s najmanje 10 grafema.', 'duge', 15, 'duljina'),
  tjedna('W05', 'Lovac na rijetke', 'Odigraj 10 rijetkih riječi, bilo kojeg postojećeg tiera.', 'rijetke', 10, 'rijetkost'),
  tjedna('W06', 'Tri dana igre', 'Završi barem 1 javnu partiju u 3 različita dana ovog tjedna.', 'dani', 3, 'razliciti_dani'),
  tjedna('W07', 'Osam dobrih partija', 'U 8 različitih partija odigraj barem 5 prihvaćenih riječi po partiji.', 'partije_s_rijecima', 8, 'ucinak_partije', { pragMetrike: 5 }),
  tjedna('W08', 'Pet četverobojnih pobjeda', 'Pobijedi u 5 Četveroboja.', 'pobjede', 5, 'plasman', { zahtjevnija: true, mod: 'cetiri_igraca' }),
  tjedna('W09', 'Dvobojski pobjednik', 'Pobijedi u 20 javnih Dvoboja.', 'pobjede', 20, 'plasman', { zahtjevnija: true, mod: 'dva_igraca' }),
  tjedna('W10', 'Trening tjedan', 'Završi i pobijedi u 3 različita treninga.', 'trening_pobjede', 3, 'trening', { kontekst: 'trening', mod: 'dva_igraca' }),
  tjedna('W11', 'Četverobojni tjedan', 'Završi 10 Četveroboja.', 'partije', 10, 'aktivnost', { mod: 'cetiri_igraca' }),
  tjedna('W12', 'Dvobojski maraton', 'Završi 25 Dvoboja.', 'partije', 25, 'aktivnost', { mod: 'dva_igraca' }),
  tjedna('W13', 'Taktičar', 'Izazovi 10 eliminacija protivnika prema pravilima motora.', 'eliminacije', 10, 'taktika'),
  tjedna('W14', 'Kaladont majstor', 'Izvedi 5 uspješnih Kaladonta.', 'kaladont', 5, 'taktika', { zahtjevnija: true }),
  tjedna('W15', 'Velike riječi', 'Odigraj 5 riječi s najmanje 15 grafema.', 'jako_duge', 5, 'duljina', { zahtjevnija: true }),
  tjedna('W16', 'Rijetka zbirka', 'Odigraj 5 riječi označenih kao „jako rijetke”.', 'jako_rijetke', 5, 'rijetkost', { zahtjevnija: true }),
  tjedna('W17', 'Dugi i rijetki', 'Odigraj 5 riječi koje su svaka istodobno duge (≥10 grafema) i rijetke.', 'duge_i_rijetke', 5, 'spoj_rijeci', { zahtjevnija: true }),
  tjedna('W18', 'Dvadeset početaka', 'Odigraj riječi s 20 različitih početaka od dva hrvatska grafema.', 'razliciti_poceci', 20, 'raznolikost'),
  tjedna('W19', 'Stalno pri vrhu', 'Završi 10 Četveroboja na 1. ili 2. mjestu.', 'pobjede', 10, 'plasman', { mod: 'cetiri_igraca' }),
  tjedna('W20', 'Svestrani igrač', 'Završi 5 Dvoboja i 5 Četveroboja.', 'oba_moda', 10, 'oba_moda', {
    podciljevi: [
      { kljuc: 'dva_igraca', naziv: 'Dvoboji', cilj: 5 },
      { kljuc: 'cetiri_igraca', naziv: 'Četveroboji', cilj: 5 },
    ],
  }),
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
