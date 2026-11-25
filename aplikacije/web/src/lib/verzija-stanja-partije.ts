/** Čista logika usporedbe verzija snimke i dedup efekata (#142 C/E). */

export function trebaPrimijenitiSnimku(ulaz: {
  aktivnaPartijaId: string | null;
  snimkaPartijaId: string;
  lokalnaVerzija: number;
  snimkaVerzija: number | undefined;
}): 'primijeni' | 'odbaci_staru' | 'odbaci_stranu' | 'ista_verzija' {
  if (ulaz.aktivnaPartijaId && ulaz.snimkaPartijaId !== ulaz.aktivnaPartijaId) {
    return 'odbaci_stranu';
  }
  const nova = ulaz.snimkaVerzija ?? 0;
  if (
    ulaz.aktivnaPartijaId === ulaz.snimkaPartijaId &&
    nova > 0 &&
    nova < ulaz.lokalnaVerzija
  ) {
    return 'odbaci_staru';
  }
  if (
    ulaz.aktivnaPartijaId === ulaz.snimkaPartijaId &&
    nova > 0 &&
    nova === ulaz.lokalnaVerzija
  ) {
    return 'ista_verzija';
  }
  return 'primijeni';
}

/** Treba li događaj druge partije biti ignoriran (C04). */
export function dogadajPripadaAktivnojPartiji(
  aktivnaPartijaId: string | null,
  dogadajPartijaId: string | undefined,
): boolean {
  if (!dogadajPartijaId) return true;
  if (!aktivnaPartijaId) return true;
  return dogadajPartijaId === aktivnaPartijaId;
}

/**
 * Dedup jednokratnih efekata po dogadajId (C02/C03).
 * Isti ID → bez ponovnog efekta; različiti ID-evi iste verzije → oba efekta.
 */
export function trebamJednokratniEfekt(
  vidjeni: Set<string>,
  dogadajId: string | undefined,
  kapacitet = 256,
): boolean {
  if (!dogadajId) return true;
  if (vidjeni.has(dogadajId)) return false;
  vidjeni.add(dogadajId);
  if (vidjeni.size > kapacitet) {
    const prvi = vidjeni.values().next().value;
    if (prvi !== undefined) vidjeni.delete(prvi);
  }
  return true;
}

/** E01: klijent nikad ne završava partiju iz broja aktivnih sjedala. */
export function klijentSmijeZakljucitiIzBrojaAktivnih(aktivni: number): boolean {
  void aktivni;
  return false;
}
