/** Tipizirani HTTP klijent za katalog i pokušaje Izazova. */
import type {
  IdIzazova,
  OdgovorKatalogaIzazova,
  SettlementIzazovaDto,
  StatusPokusajaIzazova,
  StatusSpremanjaIzazova,
  GoalProgressIzazova,
  RazlogNeuspjehaIzazova,
} from 'zajednicko';
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
    return v && /^IZ\d{2}$/.test(v) ? (v as IdIzazova) : null;
  } catch {
    return null;
  }
}

export function porukaZaKodIzazova(kod: string | null | undefined, fallback: string): string {
  switch (kod) {
    case 'IZAZOV_NEDOSTUPAN':
      return 'Izazovi trenutačno nisu dostupni.';
    case 'IZAZOV_ZAKLJUCAN':
      return 'Najprije dovrši prethodni izazov.';
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

export function nazivEtape(redniBroj: number): string {
  const etapa = Math.ceil(redniBroj / 3);
  return `Etapa ${etapa}`;
}
