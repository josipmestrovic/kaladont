/** Tipizirani HTTP klijent za katalog i pokušaje Izazova. */
import type {
  AgregatLevelaIzazovaDto,
  IdIzazova,
  LevelIzazova,
  OdgovorKatalogaIzazova,
  RazlogZakljucavanja,
  SettlementIzazovaDto,
  StatusPokusajaIzazova,
  StatusSpremanjaIzazova,
  GoalProgressIzazova,
  RazlogNeuspjehaIzazova,
} from 'zajednicko';
import { NAZIVI_LEVELA_IZAZOVA, jeIdIzazova } from 'zajednicko';
import { ApiGreska, api } from './api.js';

export { ApiGreska };

export type OdgovorPokusajaIzazova = {
  ok: true;
  pokusaj: {
    attemptId: string;
    challengeId: IdIzazova;
    status: StatusPokusajaIzazova;
    reason: RazlogNeuspjehaIzazova | null;
    partijaId: string | null;
    startedAt: string;
    terminalAt: string | null;
    resultsVisibleAt: string | null;
    gameWon: boolean | null;
    metrics: unknown;
    goalProgress: GoalProgressIzazova | null;
    snapshot: unknown;
    settlementState: StatusSpremanjaIzazova;
    accountTypeAtStart: 'gost' | 'registriran';
    definitionVersion: number;
    firstCompletion: boolean;
    challengeXp: SettlementIzazovaDto['challengeXp'];
    missionXp: SettlementIzazovaDto['missionXp'];
    izazivac: SettlementIzazovaDto['izazivac'];
  };
};

const KLJUC_ZADNJEG_IZAZOVA = 'kaladont:izazov:zadnjiChallengeId';

export function dohvatiKatalogIzazova(): Promise<OdgovorKatalogaIzazova> {
  return api<OdgovorKatalogaIzazova>('/izazovi');
}

export function dohvatiPokusajIzazova(attemptId: string): Promise<OdgovorPokusajaIzazova> {
  return api<OdgovorPokusajaIzazova>(`/izazovi/pokusaji/${encodeURIComponent(attemptId)}`);
}

export function noviRequestIdIzazova(): string {
  return crypto.randomUUID();
}

export function spremiZadnjiChallengeId(id: IdIzazova): void {
  try {
    sessionStorage.setItem(KLJUC_ZADNJEG_IZAZOVA, id);
  } catch {
    /* private mode */
  }
}

export function procitajZadnjiChallengeId(): IdIzazova | null {
  try {
    const v = sessionStorage.getItem(KLJUC_ZADNJEG_IZAZOVA);
    return v && jeIdIzazova(v) ? v : null;
  } catch {
    return null;
  }
}

export function porukaZaKodIzazova(kod: string | null | undefined, fallback: string): string {
  switch (kod) {
    case 'IZAZOV_NEDOSTUPAN':
      return 'Izazovi trenutačno nisu dostupni.';
    case 'IZAZOV_ZAKLJUCAN':
      return 'Najprije otključaj ovaj izazov.';
    case 'IZAZOV_AKTIVAN':
      return 'Već imaš aktivan pokušaj. Nastavi ga ili pričekaj završetak.';
    case 'VEC_U_PARTIJI':
      return 'Već si u partiji. Završi je prije novog izazova.';
    case 'NEVALJAN_PAYLOAD':
      return 'Neispravan zahtjev. Pokušaj ponovno.';
    default:
      return fallback;
  }
}

export function tekstRazlogaNeuspjeha(razlog: RazlogNeuspjehaIzazova | null | undefined): string {
  switch (razlog) {
    case 'cilj_neispunjen':
      return 'Pobijedio si, ali nisu ispunjeni svi ciljevi izazova.';
    case 'eliminiran':
      return 'Ispao si prije pobjede.';
    case 'nevaljana_rijec':
      return 'Nevaljana riječ prekinula je izazov.';
    case 'odustao':
      return 'Odustao si od izazova.';
    case 'prekid_veze':
      return 'Veza je prekinuta tijekom izazova.';
    default:
      return 'Izazov nije uspio.';
  }
}

export function tekstRazlogaZakljucavanja(razlog: RazlogZakljucavanja | null | undefined): string {
  if (!razlog) return 'Zaključano.';
  if (razlog.vrsta === 'prethodni_level') {
    return `Zaključano — najprije dovrši level ${razlog.level} (${NAZIVI_LEVELA_IZAZOVA[razlog.level]}).`;
  }
  return 'Zaključano — najprije dovrši varijante 1–4 ovog formata.';
}

/** Najviši otključani nezavršen level; inače najviši otključani; fallback 1. */
export function zadaniLevelIzazova(leveli: readonly AgregatLevelaIzazovaDto[]): LevelIzazova {
  let najvisiOtkljucan: LevelIzazova = 1;
  let najvisiNezavrsen: LevelIzazova | null = null;
  for (const L of leveli) {
    if (L.status === 'zakljucan') break;
    najvisiOtkljucan = L.level;
    if (L.zavrseno < L.ukupno) najvisiNezavrsen = L.level;
  }
  return najvisiNezavrsen ?? najvisiOtkljucan;
}

export function parsirajLevelIzUrl(sirovo: string | null): LevelIzazova | null {
  if (sirovo === '1' || sirovo === '2' || sirovo === '3' || sirovo === '4') {
    return Number(sirovo) as LevelIzazova;
  }
  return null;
}
