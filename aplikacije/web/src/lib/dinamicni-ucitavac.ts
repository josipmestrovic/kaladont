/**
 * Keširani dinamički importi — jedan Promise po ključu, bez utrke kod paralelnih poziva.
 * Vite i dalje radi code-splitting; ovo samo dijeljeno čeka isti modul.
 */

const keš = new Map<string, Promise<unknown>>();

export function ucitajModul<T>(kljuc: string, ucitaj: () => Promise<T>): Promise<T> {
  const postojeci = keš.get(kljuc) as Promise<T> | undefined;
  if (postojeci) return postojeci;
  const obećanje = ucitaj().catch((greska) => {
    keš.delete(kljuc);
    throw greska;
  });
  keš.set(kljuc, obećanje);
  return obećanje;
}

export type SvelteModul<T = unknown> = { default: T };

export function ucitajKomponentu<T>(
  kljuc: string,
  ucitaj: () => Promise<SvelteModul<T>>,
): Promise<T> {
  return ucitajModul(kljuc, async () => (await ucitaj()).default);
}

export function ucitajPadajuceRijeci() {
  return ucitajKomponentu('PadajuceRijeci', () => import('$lib/komponente/PadajuceRijeci.svelte'));
}

export function ucitajCitanjeNaglasObavijest() {
  return ucitajKomponentu(
    'CitanjeNaglasObavijest',
    () => import('$lib/komponente/CitanjeNaglasObavijest.svelte'),
  );
}

export function ucitajAvatarKonfiguracijaPreview() {
  return ucitajKomponentu(
    'AvatarKonfiguracijaPreview',
    () => import('$lib/komponente/AvatarKonfiguracijaPreview.svelte'),
  );
}

export function ucitajKonfeti() {
  return ucitajKomponentu('Konfeti', () => import('$lib/komponente/Konfeti.svelte'));
}

export function ucitajBotDebugPanel() {
  return ucitajKomponentu('BotDebugPanel', () => import('$lib/komponente/BotDebugPanel.svelte'));
}

export function ucitajRezultatIzazova() {
  return ucitajKomponentu(
    'RezultatIzazova',
    () => import('$lib/komponente/RezultatIzazova.svelte'),
  );
}

export function ucitajIskustvoPartije() {
  return ucitajKomponentu(
    'IskustvoPartije',
    () => import('$lib/komponente/IskustvoPartije.svelte'),
  );
}

export function ucitajNapredakMisijaPartije() {
  return ucitajKomponentu(
    'NapredakMisijaPartije',
    () => import('$lib/komponente/NapredakMisijaPartije.svelte'),
  );
}

export function ucitajKaladontDnkPromjena() {
  return ucitajKomponentu(
    'KaladontDnkPromjena',
    () => import('$lib/komponente/KaladontDnkPromjena.svelte'),
  );
}

export function ucitajPanelPrijavaRijeci() {
  return ucitajKomponentu(
    'PanelPrijavaRijeci',
    () => import('$lib/komponente/PanelPrijavaRijeci.svelte'),
  );
}

export function ucitajPanelPrijavaIgraca() {
  return ucitajKomponentu(
    'PanelPrijavaIgraca',
    () => import('$lib/komponente/PanelPrijavaIgraca.svelte'),
  );
}

/** Završni ekran + paneli prijava — pozadinski preload tijekom partije. */
export function pripremiZavrsniEkranPartije(opcije?: { izazov?: boolean; dnk?: boolean }): Promise<void> {
  const zadaci: Promise<unknown>[] = [
    ucitajIskustvoPartije(),
    ucitajNapredakMisijaPartije(),
    ucitajPanelPrijavaRijeci(),
    ucitajPanelPrijavaIgraca(),
  ];
  if (opcije?.izazov !== false) zadaci.push(ucitajRezultatIzazova());
  if (opcije?.dnk !== false) zadaci.push(ucitajKaladontDnkPromjena());
  return Promise.all(zadaci).then(() => undefined);
}
