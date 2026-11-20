/**
 * Voditelj Izazova: snapshot → privremeni botovi + motor (kontekst izazov).
 * Ne koristi javni fond botova.
 */
import { randomUUID } from 'node:crypto';
import {
  AVATAR_RACUNALA,
  AVATAR_RACUNALA_2,
  definicijaIzazova,
  type AvatarConfigV1,
  type CiljeviIzazova,
  type IdIzazova,
  type ProfilBotaIzazova,
  type RazlogNeuspjehaIzazova,
} from 'zajednicko';
import {
  nadimakProfilaBota,
  razrijesiProfilBotaIliZadani,
} from '../bot/profili-bota.js';
import type { KonfiguracijaBota } from '../bot/konfiguracija-bota.js';
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import {
  azurirajCinjenicePrihvacenomRijeci,
  evaluirajNapredak,
  metrikeIzCinjenica,
  odlukaNakonKrajaIgre,
  odlukaNakonOdbijenogPoteza,
  prazneCinjenice,
  type CinjeniceIzazova,
  type GoalProgress,
} from './evaluacija.js';
import {
  oznaciPokusajUTijeku,
  type SnapshotPokusajaIzazova,
  dohvatiPokusajPoId,
} from './pohrana.js';
import { zavrsiPokusajIzazova } from './zavrsetak.js';
import type { PokreniPartijuIzazova } from './servis.js';

const PREFIKS_RACUNALA = 'racunalo-';

export interface SesijaIzazova {
  attemptId: string;
  partijaId: string;
  covjekId: string;
  ciljevi: CiljeviIzazova;
  cinjenice: CinjeniceIzazova;
  forsiranRazlog: RazlogNeuspjehaIzazova | null;
  /** true tek nakon uspješnog CAS završetka (retry smije ponoviti dok je false). */
  zavrseno: boolean;
  /** Deduplikacija paralelnih/retry poziva naKrajIgre. */
  zavrsavanjePromise?: Promise<{
    status: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto';
    reason: RazlogNeuspjehaIzazova | null;
    resultsVisibleAtIso: string | null;
    gameWon: boolean | null;
    goalProgress: GoalProgress;
  } | null>;
}

export interface OvisnostiVoditeljaIzazova {
  zapocniPartiju: (
    sudionici: StavkaReda[],
    mod: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca',
    opcije: {
      kontekst: 'izazov';
      pravila: SnapshotPokusajaIzazova['pravila'];
      botKonfiguracija: KonfiguracijaBota;
      trajanjePotezaSek: number;
    },
  ) => Promise<{ ishod: RezultatPokretanja; partijaId: string | null }>;
  /** Ako CAS u_tijeku ne uspije nakon starta motora — ukloni živi stol. */
  ponistiPartiju: (partijaId: string, poruka: string) => void;
  dohvatiIgracaZaStol: (igracId: string) => {
    igracId: string;
    vrsta: 'gost' | 'registriran' | 'admin';
    nadimak: string;
    avatarId: number;
    avatarConfig: AvatarConfigV1 | null;
    avatarRevision: number;
    odigrane?: number;
    pobjede?: number;
    bodoviUkupno?: number;
    odigrane1v1?: number;
    pobjede1v1?: number;
    bodovi1v1?: number;
    rangBrojPartija?: number;
    rangSumaJedinica?: number;
    iskustvoUkupno?: number;
  } | null;
}

function izradiRacunalo(
  indeks: number,
  ukupno: 1 | 2 | 3,
  pravila: SnapshotPokusajaIzazova['pravila'],
  profileId: ProfilBotaIzazova,
): StavkaReda {
  const nadimak = nadimakProfilaBota(profileId, indeks, ukupno);
  const avatarConfig: AvatarConfigV1 = indeks === 2 ? AVATAR_RACUNALA_2 : AVATAR_RACUNALA;
  return {
    igracId: `${PREFIKS_RACUNALA}${randomUUID()}`,
    vrsta: 'gost',
    upravljac: 'bot',
    nadimak,
    avatarId: 0,
    avatarConfig,
    avatarRevision: 0,
    odigrane: 0,
    pobjede: 0,
    bodoviUkupno: 0,
    iskustvoUkupno: 0,
    usaoU: Date.now(),
    odabranaPravila: pravila,
  };
}

export function stvoriVoditeljIzazova(ovisnosti: OvisnostiVoditeljaIzazova): {
  pokreniPartiju: PokreniPartijuIzazova;
  sesijaZaPartiju: (partijaId: string) => SesijaIzazova | undefined;
  goalProgressZaPartiju: (partijaId: string) => GoalProgress | null;
  naOdbijenPotez: (ulaz: {
    partijaId: string;
    igracId: string;
    kod: string;
  }) => { zaustavi: true; razlog: 'nevaljana_rijec' } | { zaustavi: false };
  naPrihvacenPotez: (ulaz: {
    partijaId: string;
    igracId: string;
    brojGrafema: number;
    frekvencija: number | null | undefined;
    uspjesanDokaz: boolean;
  }) => void;
  naKrajIgre: (ulaz: {
    partijaId: string;
    pobjednikId: string | null;
    terminalHint?: RazlogNeuspjehaIzazova | null;
  }) => Promise<{
    status: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto';
    reason: RazlogNeuspjehaIzazova | null;
    resultsVisibleAtIso: string | null;
    gameWon: boolean | null;
    goalProgress: GoalProgress;
  } | null>;
  oznaciForsiranRazlog: (partijaId: string, razlog: RazlogNeuspjehaIzazova) => void;
} {
  const sesijePoPartiji = new Map<string, SesijaIzazova>();
  const sesijePoAttempt = new Map<string, SesijaIzazova>();

  async function pokreniPartiju(ulaz: {
    attemptId: string;
    igracId: string;
    challengeId: IdIzazova;
  }): Promise<{ ok: true; partijaId: string } | { ok: false; razlog: string }> {
    const pokusaj = await dohvatiPokusajPoId(ulaz.attemptId);
    if (!pokusaj || pokusaj.igracId !== ulaz.igracId) {
      return { ok: false, razlog: 'pokusaj_nije_pronaden' };
    }
    if (pokusaj.status !== 'rezerviran' && pokusaj.status !== 'u_tijeku') {
      return { ok: false, razlog: `status_${pokusaj.status}` };
    }
    if (pokusaj.partijaId && pokusaj.status === 'u_tijeku') {
      return { ok: true, partijaId: pokusaj.partijaId };
    }

    const snapshot = pokusaj.snapshot as SnapshotPokusajaIzazova;
    const definicija = definicijaIzazova(ulaz.challengeId);
    const profileId = snapshot.profileId ?? definicija.profileId;
    const { konfiguracija: botKonfiguracija } = razrijesiProfilBotaIliZadani(profileId);
    const brojBotova = (snapshot.brojIgraca - 1) as 1 | 2 | 3;
    const trajanjePotezaSek = Math.round(snapshot.turnDurationMs / 1000);

    const igrac = ovisnosti.dohvatiIgracaZaStol(ulaz.igracId);
    if (!igrac) {
      return { ok: false, razlog: 'igrac_offline' };
    }

    const covjek: StavkaReda = {
      igracId: igrac.igracId,
      vrsta: igrac.vrsta,
      upravljac: 'covjek',
      nadimak: igrac.nadimak,
      avatarId: igrac.avatarId,
      avatarConfig: igrac.avatarConfig ?? null,
      avatarRevision: igrac.avatarRevision,
      odigrane: igrac.odigrane ?? 0,
      pobjede: igrac.pobjede ?? 0,
      bodoviUkupno: igrac.bodoviUkupno ?? 0,
      odigrane1v1: igrac.odigrane1v1 ?? 0,
      pobjede1v1: igrac.pobjede1v1 ?? 0,
      bodovi1v1: igrac.bodovi1v1 ?? 0,
      rangBrojPartija: igrac.rangBrojPartija ?? 0,
      rangSumaJedinica: igrac.rangSumaJedinica ?? 0,
      iskustvoUkupno: igrac.iskustvoUkupno ?? 0,
      trenutniNiz4p: 0,
      trenutniNiz1v1: 0,
      usaoU: Date.now(),
      odabranaPravila: snapshot.pravila,
    };

    const racunala: StavkaReda[] = [];
    for (let i = 1; i <= brojBotova; i += 1) {
      racunala.push(izradiRacunalo(i, brojBotova, snapshot.pravila, profileId));
    }

    const { ishod, partijaId } = await ovisnosti.zapocniPartiju(
      [covjek, ...racunala],
      snapshot.mod,
      {
        kontekst: 'izazov',
        pravila: snapshot.pravila,
        botKonfiguracija,
        trajanjePotezaSek,
      },
    );

    if (ishod !== 'pokrenuta' || !partijaId) {
      return { ok: false, razlog: ishod === 'pokrenuta' ? 'nema_partija_id' : ishod };
    }

    let uTijeku;
    try {
      uTijeku = await oznaciPokusajUTijeku(ulaz.attemptId, partijaId);
    } catch {
      ovisnosti.ponistiPartiju(partijaId, 'Izazov nije moguće pokrenuti zbog greške pri spremanju.');
      return { ok: false, razlog: 'cas_u_tijeku_greska' };
    }
    if (!uTijeku) {
      ovisnosti.ponistiPartiju(partijaId, 'Izazov nije moguće pokrenuti zbog greške pri spremanju.');
      return { ok: false, razlog: 'cas_u_tijeku_neuspjeh' };
    }

    const sesija: SesijaIzazova = {
      attemptId: ulaz.attemptId,
      partijaId,
      covjekId: ulaz.igracId,
      ciljevi: { ...(snapshot.ciljevi ?? {}) },
      cinjenice: prazneCinjenice(),
      forsiranRazlog: null,
      zavrseno: false,
    };
    sesijePoPartiji.set(partijaId, sesija);
    sesijePoAttempt.set(ulaz.attemptId, sesija);
    return { ok: true, partijaId };
  }

  function sesijaZaPartiju(partijaId: string): SesijaIzazova | undefined {
    return sesijePoPartiji.get(partijaId);
  }

  function goalProgressZaPartiju(partijaId: string): GoalProgress | null {
    const sesija = sesijePoPartiji.get(partijaId);
    if (!sesija) return null;
    return evaluirajNapredak(sesija.ciljevi, sesija.cinjenice);
  }

  function naOdbijenPotez(ulaz: {
    partijaId: string;
    igracId: string;
    kod: string;
  }): { zaustavi: true; razlog: 'nevaljana_rijec' } | { zaustavi: false } {
    const sesija = sesijePoPartiji.get(ulaz.partijaId);
    if (!sesija || sesija.zavrseno || ulaz.igracId !== sesija.covjekId) {
      return { zaustavi: false };
    }
    const odluka = odlukaNakonOdbijenogPoteza({
      ciljevi: sesija.ciljevi,
      cinjenice: sesija.cinjenice,
      kod: ulaz.kod,
    });
    sesija.cinjenice = odluka.cinjenice;
    if (odluka.stop) {
      sesija.forsiranRazlog = odluka.razlog;
      return { zaustavi: true, razlog: odluka.razlog };
    }
    return { zaustavi: false };
  }

  function naPrihvacenPotez(ulaz: {
    partijaId: string;
    igracId: string;
    brojGrafema: number;
    frekvencija: number | null | undefined;
    uspjesanDokaz: boolean;
  }): void {
    const sesija = sesijePoPartiji.get(ulaz.partijaId);
    if (!sesija || sesija.zavrseno || ulaz.igracId !== sesija.covjekId) return;
    sesija.cinjenice = azurirajCinjenicePrihvacenomRijeci(sesija.cinjenice, ulaz);
  }

  function oznaciForsiranRazlog(partijaId: string, razlog: RazlogNeuspjehaIzazova): void {
    const sesija = sesijePoPartiji.get(partijaId);
    if (!sesija || sesija.zavrseno) return;
    if (!sesija.forsiranRazlog) sesija.forsiranRazlog = razlog;
  }

  async function naKrajIgre(ulaz: {
    partijaId: string;
    pobjednikId: string | null;
    terminalHint?: RazlogNeuspjehaIzazova | null;
  }): Promise<{
    status: 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto';
    reason: RazlogNeuspjehaIzazova | null;
    resultsVisibleAtIso: string | null;
    gameWon: boolean | null;
    goalProgress: GoalProgress;
  } | null> {
    const sesija = sesijePoPartiji.get(ulaz.partijaId);
    if (!sesija) return null;
    if (sesija.zavrsavanjePromise) return sesija.zavrsavanjePromise;
    if (sesija.zavrseno) return null;

    if (ulaz.terminalHint && !sesija.forsiranRazlog) {
      sesija.forsiranRazlog = ulaz.terminalHint;
    }

    sesija.zavrsavanjePromise = (async () => {
      const covjekPobijedio = ulaz.pobjednikId === sesija.covjekId;
      const odluka = odlukaNakonKrajaIgre({
        ciljevi: sesija.ciljevi,
        cinjenice: sesija.cinjenice,
        covjekPobijedio,
        forsiranRazlog: sesija.forsiranRazlog,
      });
      const redak = await zavrsiPokusajIzazova({
        attemptId: sesija.attemptId,
        status: odluka.status,
        razlog: odluka.razlog,
        metrics: odluka.metrics,
        gameWon: odluka.gameWon,
        partijaId: ulaz.partijaId,
      });
      if (!redak) {
        // CAS nije prošao — ostavi sesiju za retry upisa motora.
        sesija.zavrsavanjePromise = undefined;
        return null;
      }
      sesija.zavrseno = true;
      sesijePoPartiji.delete(ulaz.partijaId);
      sesijePoAttempt.delete(sesija.attemptId);
      return {
        status: redak.status as 'uspjeh' | 'neuspjeh' | 'tehnicki_prekinuto',
        reason: (redak.reason as RazlogNeuspjehaIzazova | null) ?? odluka.razlog,
        resultsVisibleAtIso: redak.resultsVisibleAt?.toISOString() ?? null,
        gameWon: redak.gameWon ?? odluka.gameWon,
        goalProgress: odluka.metrics.goalProgress,
      };
    })();

    return sesija.zavrsavanjePromise;
  }

  return {
    pokreniPartiju,
    sesijaZaPartiju,
    goalProgressZaPartiju,
    naOdbijenPotez,
    naPrihvacenPotez,
    naKrajIgre,
    oznaciForsiranRazlog,
  };
}

/** Pomoć za testove bez punog voditelja. */
export function goalProgressIzSesije(sesija: SesijaIzazova): GoalProgress {
  return evaluirajNapredak(sesija.ciljevi, sesija.cinjenice);
}

export function metrikeIzSesije(sesija: SesijaIzazova) {
  return metrikeIzCinjenica(sesija.ciljevi, sesija.cinjenice);
}
