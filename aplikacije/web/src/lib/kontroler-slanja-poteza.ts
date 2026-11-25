/**
 * Jedan životni ciklus slanja poteza (#142 A).
 * Timeout je rok komunikacije, ne dokaz da potez nije obrađen.
 */

export type StatusSlanja =
  | 'mirovanje'
  | 'slanje'
  | 'prihvacen'
  | 'odbijen'
  | 'nepoznat_ishod'
  | 'sinkronizacija';

export type VrstaNaredbePoteza = 'rijec' | 'ne-znam';

export interface AktivniZahtjevPoteza {
  partijaId: string;
  requestId: string;
  turnToken: string;
  vrsta: VrstaNaredbePoteza;
  rijec?: string;
  status: Exclude<StatusSlanja, 'mirovanje'>;
}

export interface PokreniZahtjevUlaz {
  partijaId: string;
  turnToken: string;
  vrsta: VrstaNaredbePoteza;
  rijec?: string;
  requestId?: string;
}

export const TRAJANJE_CEKANJA_POTVRDE_MS = 5_000;

export const PORUKA_NEPOZNAT_ISHOD = 'Provjeravamo stanje poteza…';
export const PORUKA_SINKRONIZACIJA = 'Provjeravamo stanje poteza…';

type TimeoutApi = {
  postavi: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  ponisti: (id: ReturnType<typeof setTimeout>) => void;
};

const zadaniTimeout: TimeoutApi = {
  postavi: (fn, ms) => setTimeout(fn, ms),
  ponisti: (id) => clearTimeout(id),
};

export function noviRequestIdPoteza(): string {
  return crypto.randomUUID();
}

export function stvoriKontrolerSlanjaPoteza(opcije?: {
  timeoutApi?: TimeoutApi;
  trajanjeCekanjaMs?: number;
  naPromjenu?: (zahtjev: AktivniZahtjevPoteza | null) => void;
}) {
  const timeoutApi = opcije?.timeoutApi ?? zadaniTimeout;
  const trajanjeCekanjaMs = opcije?.trajanjeCekanjaMs ?? TRAJANJE_CEKANJA_POTVRDE_MS;
  const naPromjenu = opcije?.naPromjenu;

  let aktivni: AktivniZahtjevPoteza | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  function objavi() {
    naPromjenu?.(aktivni);
  }

  function ponistiTimeout() {
    if (timeoutHandle === null) return;
    timeoutApi.ponisti(timeoutHandle);
    timeoutHandle = null;
  }

  function zakaziTimeout(requestId: string) {
    ponistiTimeout();
    timeoutHandle = timeoutApi.postavi(() => {
      timeoutHandle = null;
      if (!aktivni || aktivni.requestId !== requestId) return;
      if (aktivni.status !== 'slanje') return;
      aktivni = { ...aktivni, status: 'nepoznat_ishod' };
      objavi();
    }, trajanjeCekanjaMs);
  }

  function mozePokrenuti(): boolean {
    if (!aktivni) return true;
    return aktivni.status === 'prihvacen' || aktivni.status === 'odbijen';
  }

  function pokreniZahtjev(ulaz: PokreniZahtjevUlaz): AktivniZahtjevPoteza | null {
    if (!mozePokrenuti()) return null;
    if (!ulaz.partijaId || !ulaz.turnToken) return null;

    const zahtjev: AktivniZahtjevPoteza = {
      partijaId: ulaz.partijaId,
      requestId: ulaz.requestId ?? noviRequestIdPoteza(),
      turnToken: ulaz.turnToken,
      vrsta: ulaz.vrsta,
      rijec: ulaz.rijec,
      status: 'slanje',
    };
    aktivni = zahtjev;
    zakaziTimeout(zahtjev.requestId);
    objavi();
    return zahtjev;
  }

  /**
   * Završava zahtjev samo ako se requestId (ili jedini aktivni) poklapa.
   * Zastarjeli callback ne smije dirati novi zahtjev.
   */
  function zavrsiZahtjev(
    ishod: 'prihvacen' | 'odbijen',
    identifikator?: { requestId?: string; partijaId?: string },
  ): boolean {
    if (!aktivni) return false;
    if (identifikator?.requestId && identifikator.requestId !== aktivni.requestId) return false;
    if (identifikator?.partijaId && identifikator.partijaId !== aktivni.partijaId) return false;
    if (aktivni.status === 'prihvacen' || aktivni.status === 'odbijen') return false;

    ponistiTimeout();
    aktivni = { ...aktivni, status: ishod };
    objavi();
    return true;
  }

  /** Snimka istog reda / tokena sama po sebi nije potvrda naredbe. */
  function snimkaIstogReda(partijaId: string, turnToken: string | null | undefined): void {
    if (!aktivni) return;
    if (aktivni.partijaId !== partijaId) return;
    if (!turnToken || turnToken !== aktivni.turnToken) return;
    // ostaje u slanje / nepoznat_ishod — ne otključavaj
  }

  /**
   * Kad je ishod nepoznat i snimka pokazuje drugi red, prihvati kanonsko stanje
   * bez lažnog prihvaćanja/odbijanja.
   */
  function razrijesiNepoznatPremaSnimci(
    partijaId: string,
    turnToken: string | null | undefined,
  ): void {
    if (!aktivni || aktivni.partijaId !== partijaId) return;
    if (aktivni.status !== 'nepoznat_ishod' && aktivni.status !== 'sinkronizacija') return;
    if (!turnToken || turnToken === aktivni.turnToken) return;
    ocisti();
  }

  /** Promjena reda/tokena onemogućuje stari unos; ishod i dalje čeka ACK/sync. */
  function obavijestiPromjenuReda(partijaId: string, noviTurnToken: string | null | undefined): void {
    if (!aktivni || aktivni.partijaId !== partijaId) return;
    if (!noviTurnToken || noviTurnToken === aktivni.turnToken) return;
    if (aktivni.status === 'slanje') {
      // Token se promijenio — ne zaključuj lažno odbijanje; čekaj sync.
      ponistiTimeout();
      aktivni = { ...aktivni, status: 'nepoznat_ishod' };
      objavi();
    }
  }

  function oznaciSinkronizaciju(requestId?: string): boolean {
    if (!aktivni) return false;
    if (requestId && requestId !== aktivni.requestId) return false;
    if (aktivni.status !== 'nepoznat_ishod' && aktivni.status !== 'slanje') return false;
    ponistiTimeout();
    aktivni = { ...aktivni, status: 'sinkronizacija' };
    objavi();
    return true;
  }

  function ocisti(razlog?: { partijaId?: string }): void {
    if (razlog?.partijaId && aktivni && aktivni.partijaId !== razlog.partijaId) return;
    ponistiTimeout();
    if (aktivni !== null) {
      aktivni = null;
      objavi();
    }
  }

  function dohvatiAktivni(): AktivniZahtjevPoteza | null {
    return aktivni;
  }

  function slanjeUTijeku(): boolean {
    if (!aktivni) return false;
    return (
      aktivni.status === 'slanje' ||
      aktivni.status === 'nepoznat_ishod' ||
      aktivni.status === 'sinkronizacija'
    );
  }

  function porukaStatusa(): string | null {
    if (!aktivni) return null;
    if (aktivni.status === 'nepoznat_ishod' || aktivni.status === 'sinkronizacija') {
      return PORUKA_NEPOZNAT_ISHOD;
    }
    return null;
  }

  return {
    pokreniZahtjev,
    zavrsiZahtjev,
    snimkaIstogReda,
    razrijesiNepoznatPremaSnimci,
    obavijestiPromjenuReda,
    oznaciSinkronizaciju,
    ocisti,
    dohvatiAktivni,
    slanjeUTijeku,
    porukaStatusa,
    mozePokrenuti,
  };
}

export type KontrolerSlanjaPoteza = ReturnType<typeof stvoriKontrolerSlanjaPoteza>;
