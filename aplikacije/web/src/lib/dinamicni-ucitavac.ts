/**
 * Keširani dinamički importi — jedan Promise po ključu, bez utrke kod paralelnih poziva.
 * Vite i dalje radi code-splitting; ovo samo dijeljeno čeka isti modul.
 */

import {
  odaberiZavrsneChunkove,
  type UlazZavrsnihChunkova,
  type ZavrsniChunk,
} from './odaberi-zavrsne-chunkove.js';

const keš = new Map<string, Promise<unknown>>();

/** Samo za testove — prazni keš dinamičkih modula. */
export function ocistiKesDinamicnihModula(): void {
  keš.clear();
}

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

/** Retry nakon pada (keš ključ se briše u ucitajModul). */
export async function ucitajSRetryjem<T>(
  ucitaj: () => Promise<T>,
  pokusaji = 3,
): Promise<T> {
  let zadnja: unknown;
  for (let i = 0; i < pokusaji; i += 1) {
    try {
      return await ucitaj();
    } catch (greska) {
      zadnja = greska;
    }
  }
  throw zadnja;
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

const UCITAVACI_CHUNKOVA: Record<ZavrsniChunk, () => Promise<unknown>> = {
  rezultatIzazova: ucitajRezultatIzazova,
  iskustvo: ucitajIskustvoPartije,
  misije: ucitajNapredakMisijaPartije,
  dnk: ucitajKaladontDnkPromjena,
  panelRijeci: ucitajPanelPrijavaRijeci,
  panelIgraca: ucitajPanelPrijavaIgraca,
};

export type RezultatZavrsnogChunka = {
  chunk: ZavrsniChunk;
  komponenta?: unknown;
  greska?: unknown;
};

/**
 * Učitava odabrane chunkove izolirano (allSettled).
 * Jedan pad ne sprečava uspjeh ostalih.
 */
export async function ucitajZavrsneChunkoveSUcitavacima(
  chunkovi: Iterable<ZavrsniChunk>,
  ucitavaci: Record<ZavrsniChunk, () => Promise<unknown>>,
  opcije?: { retry?: number },
): Promise<RezultatZavrsnogChunka[]> {
  const retry = opcije?.retry ?? 1;
  const lista = [...chunkovi];
  const rezultati = await Promise.allSettled(
    lista.map(async (chunk) => {
      const komponenta = await ucitajSRetryjem(ucitavaci[chunk], retry + 1);
      return { chunk, komponenta } satisfies RezultatZavrsnogChunka;
    }),
  );

  return rezultati.map((rezultat, indeks) => {
    const chunk = lista[indeks]!;
    if (rezultat.status === 'fulfilled') return rezultat.value;
    return { chunk, greska: rezultat.reason };
  });
}

export function ucitajZavrsneChunkove(
  chunkovi: Iterable<ZavrsniChunk>,
  opcije?: { retry?: number },
): Promise<RezultatZavrsnogChunka[]> {
  return ucitajZavrsneChunkoveSUcitavacima(chunkovi, UCITAVACI_CHUNKOVA, opcije);
}

/** Pozadinski preload prema kontekstu (opt-in izazov/DNK). */
export function pripremiZavrsniEkranPartije(ulaz: UlazZavrsnihChunkova): Promise<RezultatZavrsnogChunka[]> {
  return ucitajZavrsneChunkove(odaberiZavrsneChunkove(ulaz), { retry: 1 });
}
