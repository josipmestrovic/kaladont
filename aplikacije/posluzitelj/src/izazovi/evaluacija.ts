/**
 * Čista evaluacija ciljeva Izazova — bez IO-a i bez drugog validatora riječi.
 * Motor šalje činjenice; ovdje se broje ciljevi i odlučuje stop (bez-pogreške / ne-ka).
 */
import {
  PRAGOVI_DULJINE,
  zadnjaDva,
  type CiljeviIzazova,
  type GoalProgressIzazova,
  type RazlogNeuspjehaIzazova,
  type StavkaNapretkaCiljaIzazova,
} from 'zajednicko';

/** Kodovi koji lome niz / broje se kao prava pogreška (motor-partije komentar uz pogresniUnosi). */
export const KODOVI_PRAVE_POGRESKE = new Set([
  'RIJEC_NE_POSTOJI',
  'VLASTITO_IME',
  'KRIVA_SLOVA',
  'RIJEC_ISKORISTENA',
  'NEDOPUSTENA_VRSTA',
  'NIJE_OSNOVNI_OBLIK',
  'PREKRATKA_RIJEC',
]);

export function jePravaPogreskaPoteza(kod: string): boolean {
  return KODOVI_PRAVE_POGRESKE.has(kod);
}

export interface CinjeniceIzazova {
  imaPravuPogresku: boolean;
  /** Čovjek je odigrao prihvaćenu riječ koja završava na „ka”. */
  zavrsioNaKa: boolean;
  dugeRijeci: number;
  rijetkeRijeci: number;
  uspjesniDokazi: number;
  /** Prihvaćene ljudske riječi (PR04 misije). */
  prihvaceneRijeci: number;
}

export function prazneCinjenice(): CinjeniceIzazova {
  return {
    imaPravuPogresku: false,
    zavrsioNaKa: false,
    dugeRijeci: 0,
    rijetkeRijeci: 0,
    uspjesniDokazi: 0,
    prihvaceneRijeci: 0,
  };
}

/** Prihvaćena riječ završava na „ka” (isti grafemski nastavak kao u motoru). */
export function rijecZavrsavaNaKa(rijecNormalizirana: string): boolean {
  return zadnjaDva(rijecNormalizirana) === 'ka';
}

export type StavkaNapretkaCilja = StavkaNapretkaCiljaIzazova;
export type GoalProgress = GoalProgressIzazova;

/** Metrike koje idu u `pokusaji_izazova.metrics` (CAS završetak). */
export interface MetrikePokusajaIzazova {
  dugeRijeci: number;
  rijetkeRijeci: number;
  uspjesniDokazi: number;
  imaPravuPogresku: boolean;
  prihvaceneRijeci: number;
  goalProgress: GoalProgress;
}

export function jeDugaRijecZaIzazov(brojGrafema: number): boolean {
  return brojGrafema >= PRAGOVI_DULJINE.duga;
}

/** Bilo koji postojeći tier rijetkosti (frekvencija 0–99 uz prag grafema za 0). */
export function jeRijetkaRijecZaIzazov(
  frekvencija: number | null | undefined,
  brojGrafema: number,
): boolean {
  if (frekvencija === undefined || frekvencija === null) return false;
  if (frekvencija === 0) return brojGrafema >= 4;
  return frekvencija >= 1 && frekvencija <= 99;
}

export function azurirajCinjenicePrihvacenomRijeci(
  cinjenice: CinjeniceIzazova,
  ulaz: {
    brojGrafema: number;
    frekvencija: number | null | undefined;
    uspjesanDokaz?: boolean;
  },
): CinjeniceIzazova {
  const iduce: CinjeniceIzazova = { ...cinjenice };
  iduce.prihvaceneRijeci += 1;
  if (jeDugaRijecZaIzazov(ulaz.brojGrafema)) iduce.dugeRijeci += 1;
  if (jeRijetkaRijecZaIzazov(ulaz.frekvencija, ulaz.brojGrafema)) iduce.rijetkeRijeci += 1;
  if (ulaz.uspjesanDokaz) iduce.uspjesniDokazi += 1;
  return iduce;
}

export function azurirajCinjenicePravomPogreskom(cinjenice: CinjeniceIzazova): CinjeniceIzazova {
  return { ...cinjenice, imaPravuPogresku: true };
}

export function evaluirajNapredak(ciljevi: CiljeviIzazova, cinjenice: CinjeniceIzazova): GoalProgress {
  const bezRequired = Boolean(ciljevi.bezPogreske);
  const kaRequired = Boolean(ciljevi.bezZavrsavanjaNaKa);
  const dugeRequired = ciljevi.dugeRijeci ?? 0;
  const rijetkeRequired = ciljevi.rijetkeRijeci ?? 0;
  const dokazRequired = ciljevi.uspjesanDokaz ?? 0;

  const bezPogreske = {
    required: bezRequired,
    met: !bezRequired || !cinjenice.imaPravuPogresku,
  };
  const bezZavrsavanjaNaKa = {
    required: kaRequired,
    met: !kaRequired || !cinjenice.zavrsioNaKa,
  };
  const dugeRijeci: StavkaNapretkaCilja = {
    required: dugeRequired,
    current: cinjenice.dugeRijeci,
    met: cinjenice.dugeRijeci >= dugeRequired,
  };
  const rijetkeRijeci: StavkaNapretkaCilja = {
    required: rijetkeRequired,
    current: cinjenice.rijetkeRijeci,
    met: cinjenice.rijetkeRijeci >= rijetkeRequired,
  };
  const uspjesanDokaz: StavkaNapretkaCilja = {
    required: dokazRequired,
    current: cinjenice.uspjesniDokazi,
    met: cinjenice.uspjesniDokazi >= dokazRequired,
  };

  return {
    bezPogreske,
    bezZavrsavanjaNaKa,
    dugeRijeci,
    rijetkeRijeci,
    uspjesanDokaz,
    sviCiljeviIspunjeni:
      bezPogreske.met
      && bezZavrsavanjaNaKa.met
      && dugeRijeci.met
      && rijetkeRijeci.met
      && uspjesanDokaz.met,
  };
}

export function metrikeIzCinjenica(
  ciljevi: CiljeviIzazova,
  cinjenice: CinjeniceIzazova,
): MetrikePokusajaIzazova {
  return {
    dugeRijeci: cinjenice.dugeRijeci,
    rijetkeRijeci: cinjenice.rijetkeRijeci,
    uspjesniDokazi: cinjenice.uspjesniDokazi,
    imaPravuPogresku: cinjenice.imaPravuPogresku,
    prihvaceneRijeci: cinjenice.prihvaceneRijeci,
    goalProgress: evaluirajNapredak(ciljevi, cinjenice),
  };
}

/** Sinkroni stop nakon odbijenog poteza — samo prava pogreška + cilj bezPogreske. */
export function odlukaNakonOdbijenogPoteza(ulaz: {
  ciljevi: CiljeviIzazova;
  cinjenice: CinjeniceIzazova;
  kod: string;
}): { stop: true; razlog: 'nevaljana_rijec'; cinjenice: CinjeniceIzazova } | { stop: false; cinjenice: CinjeniceIzazova } {
  if (!jePravaPogreskaPoteza(ulaz.kod)) {
    return { stop: false, cinjenice: ulaz.cinjenice };
  }
  const cinjenice = azurirajCinjenicePravomPogreskom(ulaz.cinjenice);
  if (ulaz.ciljevi.bezPogreske) {
    return { stop: true, razlog: 'nevaljana_rijec', cinjenice };
  }
  return { stop: false, cinjenice };
}

/**
 * Sinkroni stop nakon prihvaćene riječi — cilj bezZavrsavanjaNaKa + završetak na „ka”.
 * Činjenice (duge/rijetke) se prvo ažuriraju, pa se eventualno forsira terminal.
 */
export function odlukaNakonPrihvaceneRijeci(ulaz: {
  ciljevi: CiljeviIzazova;
  cinjenice: CinjeniceIzazova;
  rijecNormalizirana: string;
  brojGrafema: number;
  frekvencija: number | null | undefined;
  uspjesanDokaz?: boolean;
}): {
  stop: true;
  razlog: 'zavrsio_na_ka';
  cinjenice: CinjeniceIzazova;
} | { stop: false; cinjenice: CinjeniceIzazova } {
  let cinjenice = azurirajCinjenicePrihvacenomRijeci(ulaz.cinjenice, {
    brojGrafema: ulaz.brojGrafema,
    frekvencija: ulaz.frekvencija,
    uspjesanDokaz: ulaz.uspjesanDokaz,
  });
  if (ulaz.ciljevi.bezZavrsavanjaNaKa && rijecZavrsavaNaKa(ulaz.rijecNormalizirana)) {
    cinjenice = { ...cinjenice, zavrsioNaKa: true };
    return { stop: true, razlog: 'zavrsio_na_ka', cinjenice };
  }
  return { stop: false, cinjenice };
}

export function odlukaNakonKrajaIgre(ulaz: {
  ciljevi: CiljeviIzazova;
  cinjenice: CinjeniceIzazova;
  covjekPobijedio: boolean;
  /** Ako je već forsirani razlog (bez-pogreške / odustajanje / prekid). */
  forsiranRazlog?: RazlogNeuspjehaIzazova | null;
}): {
  status: 'uspjeh' | 'neuspjeh';
  razlog: RazlogNeuspjehaIzazova | null;
  gameWon: boolean;
  metrics: MetrikePokusajaIzazova;
} {
  const metrics = metrikeIzCinjenica(ulaz.ciljevi, ulaz.cinjenice);
  if (ulaz.forsiranRazlog) {
    return {
      status: 'neuspjeh',
      razlog: ulaz.forsiranRazlog,
      gameWon: ulaz.covjekPobijedio,
      metrics,
    };
  }
  if (ulaz.covjekPobijedio && metrics.goalProgress.sviCiljeviIspunjeni) {
    return { status: 'uspjeh', razlog: null, gameWon: true, metrics };
  }
  if (ulaz.covjekPobijedio) {
    return {
      status: 'neuspjeh',
      razlog: 'cilj_neispunjen',
      gameWon: true,
      metrics,
    };
  }
  return {
    status: 'neuspjeh',
    razlog: 'eliminiran',
    gameWon: false,
    metrics,
  };
}
