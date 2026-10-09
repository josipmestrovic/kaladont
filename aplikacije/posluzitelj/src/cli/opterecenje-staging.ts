/**
 * Zajednički pomoćnici staging/lokalnih pokusa opterećenja: health snimka s metrikama botova
 * (ADR-017) i staging lease. Dijele ih miješani test i predtest popune reda.
 */
export interface HealthSnapshot {
  ok: boolean;
  aktivnePartije: number;
  aktivneVeze: number;
  rssBajtovi: number;
  heapUsedBajtovi: number;
  verzija: string;
  digest: string;
  /** Metrike botova i event-loopa; `null` kad izdanje poslužitelja ne izlaže polje. */
  eventLoopP95Ms: number | null;
  aktivniTreninzi: number | null;
  botoviUPartiji: number | null;
  fondSlobodni: number | null;
  fondIscrpljenja: number | null;
  botIsteci: number | null;
  botTehnickeGreske: number | null;
  botoviDvoboj: boolean | null;
  botoviCetveroboj: boolean | null;
}

const POLJA_METRIKA_BOTOVA = ['eventLoopP95Ms', 'aktivniTreninzi', 'botoviUPartiji', 'fondSlobodni', 'botIsteci', 'botTehnickeGreske'] as const;

export function imaMetrikeBotova(health: HealthSnapshot): boolean {
  return POLJA_METRIKA_BOTOVA.every((polje) => health[polje] !== null);
}

export const PORUKA_BEZ_METRIKA_BOTOVA = 'Health poslužitelja ne izlaže metrike botova i event-loopa; objavi izdanje s metrikama botova (ADR-017) prije stres testa.';

export async function dohvatiHealth(adresa: string, prekid?: AbortSignal): Promise<HealthSnapshot> {
  const signal = prekid ? AbortSignal.any([prekid, AbortSignal.timeout(3_000)]) : AbortSignal.timeout(3_000);
  const odgovor = await fetch(`${adresa}/zdravlje`, { signal, redirect: 'manual' });
  if (!odgovor.ok || new URL(odgovor.url).origin !== adresa) {
    throw new Error(`Health provjera nije uspjela ili je preusmjerena: HTTP ${odgovor.status}.`);
  }
  const tijelo = await odgovor.json() as Record<string, unknown>;
  if (
    tijelo.ok !== true ||
    !Number.isFinite(tijelo.aktivnePartije) ||
    !Number.isFinite(tijelo.aktivneVeze) ||
    !Number.isFinite(tijelo.rssBajtovi) ||
    !Number.isFinite(tijelo.heapUsedBajtovi) ||
    typeof tijelo.verzija !== 'string' ||
    typeof tijelo.digest !== 'string'
  ) {
    throw new Error('Health odgovor staginga nema valjane kapacitetske metrike i digest.');
  }
  const broj = (polje: string): number | null => (typeof tijelo[polje] === 'number' && Number.isFinite(tijelo[polje]) ? tijelo[polje] as number : null);
  const zastavica = (polje: string): boolean | null => (typeof tijelo[polje] === 'boolean' ? tijelo[polje] as boolean : null);
  return {
    ok: true,
    aktivnePartije: tijelo.aktivnePartije as number,
    aktivneVeze: tijelo.aktivneVeze as number,
    rssBajtovi: tijelo.rssBajtovi as number,
    heapUsedBajtovi: tijelo.heapUsedBajtovi as number,
    verzija: tijelo.verzija,
    digest: tijelo.digest,
    eventLoopP95Ms: broj('eventLoopP95Ms'),
    aktivniTreninzi: broj('aktivniTreninzi'),
    botoviUPartiji: broj('botoviUPartiji'),
    fondSlobodni: broj('fondSlobodni'),
    fondIscrpljenja: broj('fondIscrpljenja'),
    botIsteci: broj('botIsteci'),
    botTehnickeGreske: broj('botTehnickeGreske'),
    botoviDvoboj: zastavica('botoviDvoboj'),
    botoviCetveroboj: zastavica('botoviCetveroboj'),
  };
}

export async function azurirajStagingLease(
  adresa: string,
  runId: string,
  akcija: 'acquire' | 'renew' | 'release',
): Promise<void> {
  const odgovor = await fetch(`${adresa}/_staging/opterecenje/lease`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ akcija, runId }),
    signal: AbortSignal.timeout(3_000),
    redirect: 'manual',
  });
  if (!odgovor.ok || new URL(odgovor.url).origin !== adresa) {
    const tijelo = await odgovor.json().catch(() => null) as { greska?: string } | null;
    throw new Error(tijelo?.greska ?? `Staging lease ${akcija} nije uspio: HTTP ${odgovor.status}.`);
  }
}

export function pokreniObnavljanjeLeasea(
  adresa: string,
  runId: string,
  signal: AbortSignal,
  priGubitku: (razlog: string) => void,
): () => void {
  let zahtjevUTijeku = false;
  let zaustavljeno = false;
  const timer = setInterval(() => {
    if (signal.aborted || zahtjevUTijeku) return;
    zahtjevUTijeku = true;
    void azurirajStagingLease(adresa, runId, 'renew')
      .catch((greska: unknown) => {
        if (zaustavljeno || signal.aborted) return;
        priGubitku(greska instanceof Error ? greska.message : String(greska));
      })
      .finally(() => {
        zahtjevUTijeku = false;
      });
  }, 10_000);
  timer.unref();
  return () => {
    zaustavljeno = true;
    clearInterval(timer);
  };
}

export function odgodi(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('Test je prekinut.'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', prekid);
      resolve();
    }, ms);
    const prekid = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', prekid);
      reject(new Error('Test je prekinut.'));
    };
    signal.addEventListener('abort', prekid, { once: true });
  });
}
