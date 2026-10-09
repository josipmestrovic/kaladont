export type AkcijaLeaseStaginga = 'acquire' | 'renew' | 'release';

export interface LeaseStaginga {
  runId: string;
  istjeceU: number;
}

export interface IshodLeaseStaginga {
  uspio: boolean;
  zauzet: boolean;
  lease: LeaseStaginga | null;
}

export function obradiLeaseStaginga(
  trenutni: LeaseStaginga | null,
  zahtjev: { akcija: AkcijaLeaseStaginga; runId: string },
  sada: number,
  trajanjeMs: number,
): IshodLeaseStaginga {
  const vazeci = trenutni && trenutni.istjeceU > sada ? trenutni : null;

  if (zahtjev.akcija === 'acquire') {
    if (vazeci && vazeci.runId !== zahtjev.runId) {
      return { uspio: false, zauzet: true, lease: vazeci };
    }
    return {
      uspio: true,
      zauzet: false,
      lease: { runId: zahtjev.runId, istjeceU: sada + trajanjeMs },
    };
  }

  if (!vazeci || vazeci.runId !== zahtjev.runId) {
    return { uspio: false, zauzet: vazeci !== null, lease: vazeci };
  }
  if (zahtjev.akcija === 'release') return { uspio: true, zauzet: false, lease: null };
  return {
    uspio: true,
    zauzet: false,
    lease: { runId: zahtjev.runId, istjeceU: sada + trajanjeMs },
  };
}