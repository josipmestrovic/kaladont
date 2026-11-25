/** Spremnost partije odvojena od socket connect (#142 D). */

export type SpremnostPartije = 'sinkronizacija' | 'spremna' | 'nedostupna';

export function sljedecaSpremnostPartije(ulaz: {
  trenutna: SpremnostPartije;
  dogadaj: 'sync_start' | 'sync_ok' | 'sync_fail' | 'partija_nestala' | 'nova_partija';
}): SpremnostPartije {
  switch (ulaz.dogadaj) {
    case 'sync_start':
      return 'sinkronizacija';
    case 'sync_ok':
      return 'spremna';
    case 'sync_fail':
      return ulaz.trenutna === 'spremna' ? 'spremna' : 'nedostupna';
    case 'partija_nestala':
      return 'nedostupna';
    case 'nova_partija':
      return 'sinkronizacija';
    default:
      return ulaz.trenutna;
  }
}

/**
 * D01–D03: što napraviti s nerazriješenom naredbom nakon snimke.
 * - isti red + ishod iz cachea → primijeni potvrdu
 * - isti red, nema ishoda → ostavi nepoznat / čekaj
 * - drugi red → prihvati snimku (očisti naredbu)
 */
export function odlukaNakonSyncSnimke(ulaz: {
  aktivniRequestId: string | null;
  aktivniTurnToken: string | null;
  snimkaTurnToken: string | null | undefined;
  potvrdaZaRequestId: boolean;
}): 'primijeni_potvrdu' | 'zadrzi_nepoznat' | 'prihvati_snimku' {
  if (!ulaz.aktivniRequestId) return 'prihvati_snimku';
  const istiRed =
    !!ulaz.aktivniTurnToken &&
    !!ulaz.snimkaTurnToken &&
    ulaz.aktivniTurnToken === ulaz.snimkaTurnToken;
  if (istiRed && ulaz.potvrdaZaRequestId) return 'primijeni_potvrdu';
  if (istiRed) return 'zadrzi_nepoznat';
  return 'prihvati_snimku';
}

/** Procjena pomaka serverova sata (ms): serverNow ≈ clientNow + pomak. */
export function pomakSataIzRtt(ulaz: {
  serverVrijemeIso: string;
  klijentSlanjeMs: number;
  klijentPrijemMs: number;
}): number {
  const serverMs = Date.parse(ulaz.serverVrijemeIso);
  if (!Number.isFinite(serverMs)) return 0;
  const sredina = (ulaz.klijentSlanjeMs + ulaz.klijentPrijemMs) / 2;
  return serverMs - sredina;
}
