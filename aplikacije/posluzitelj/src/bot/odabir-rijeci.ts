/**
 * Čisti odabir botove riječi (ADR-017). Nenapadačka politika: ni jedan kriterij ne gleda
 * protivnikove nastavke; broj kandidata procjenjuje samo težinu TRENUTNOG prefiksa.
 */
import { grafemi, zadnjaDva } from 'zajednicko';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import type { KategorijaRijeci, KonfiguracijaBota } from './konfiguracija-bota.js';

/** Vraća broj u [0, 1). */
export type Rng = () => number;

/** Promiješana vrećica s ponderiranim udjelima; puni se iznova kad se isprazni. */
export class Vrecica<T> {
  private preostalo: T[] = [];

  constructor(
    private readonly udjeli: readonly { vrijednost: T; udio: number }[],
    private readonly rng: Rng,
  ) {}

  izvuci(): T {
    if (this.preostalo.length === 0) this.napuni();
    return this.preostalo.pop()!;
  }

  private napuni(): void {
    const stavke: T[] = [];
    for (const { vrijednost, udio } of this.udjeli) {
      for (let i = 0; i < Math.max(0, Math.round(udio)); i += 1) stavke.push(vrijednost);
    }
    if (stavke.length === 0) throw new Error('Vrećica nema stavki.');
    this.preostalo = promijesajNiz(stavke, (granica) => Math.floor(this.rng() * granica));
  }
}

export interface StanjeBotaUPartiji {
  vrecicaVrsta: Vrecica<'imenica' | 'ostalo'>;
}

export function stvoriStanjeBota(_konfig: KonfiguracijaBota, rng: Rng): StanjeBotaUPartiji {
  return {
    vrecicaVrsta: new Vrecica([{ vrijednost: 'imenica', udio: 90 }, { vrijednost: 'ostalo', udio: 10 }], rng),
  };
}

export interface UlazOdabira {
  trazenaSlova: string;
  kandidati: Iterable<string>;
  frekvencijaZa(rijec: string): number | null;
  grupeZa(rijec: string): readonly string[];
}

export type OdlukaBota =
  | { vrsta: 'rijec'; rijec: string; kategorija: KategorijaRijeci | 'kaladont' }
  | { vrsta: 'odustani'; razlog: 'nema_rijeci' | 'namjerni_propust' };

export function kategorijaRijeci(frekvencija: number | null, konfig: KonfiguracijaBota): KategorijaRijeci {
  if (frekvencija === null) return 'rijetka';
  if (frekvencija >= konfig.pragFrekvencije.uobicajena) return 'uobicajena';
  if (frekvencija >= konfig.pragFrekvencije.srednja) return 'srednja';
  return 'rijetka';
}

function ponderDuljine(rijec: string): number {
  return 1 / (1 + 0.1 * Math.max(0, grafemi(rijec).length - 8));
}

function izaberiPonderirano(rijeci: readonly string[], rng: Rng): string {
  const ponderi = rijeci.map(ponderDuljine);
  let preostalo = rng() * ponderi.reduce((zbroj, p) => zbroj + p, 0);
  for (let i = 0; i < rijeci.length; i += 1) {
    preostalo -= ponderi[i]!;
    if (preostalo < 0) return rijeci[i]!;
  }
  return rijeci[rijeci.length - 1]!;
}

export function odaberiPotez(
  ulaz: UlazOdabira,
  stanje: StanjeBotaUPartiji,
  konfig: KonfiguracijaBota,
  rng: Rng,
): OdlukaBota {
  // Primljeni KA: bot prepoznaje Kaladont kao i čovjek; to nije traženje mrtvog izlaznog nastavka.
  if (ulaz.trazenaSlova === 'ka') return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };

  const kandidati: string[] = [];
  const naKa: string[] = [];
  for (const rijec of ulaz.kandidati) {
    if (zadnjaDva(rijec) === 'ka') {
      naKa.push(rijec);
      continue;
    }
    kandidati.push(rijec);
  }

  if (kandidati.length === 0 && naKa.length === 0) return { vrsta: 'odustani', razlog: 'nema_rijeci' };

  // Rijetko ostavljanje KA: samo kad kandidat postoji i samo kontroliranim udjelom.
  if (naKa.length > 0 && (kandidati.length === 0 || rng() < konfig.vjerojatnostOstavljanjaKa)) {
    kandidati.push(...naKa);
  }

  const osnovnaVrsta = (rijec: string, vrste: string[]) => ulaz.grupeZa(rijec).some((grupa) => {
    const [vrsta, lema] = grupa.split(':');
    return vrste.includes(vrsta!) && lema === rijec;
  });
  const uobicajene = kandidati.filter((rijec) => kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig) === 'uobicajena');
  const imenice = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['imenica']));
  const ostalo = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['glagol', 'pridjev']));
  let izbor: string[];
  if (imenice.length || ostalo.length) {
    const vrsta = stanje.vrecicaVrsta.izvuci();
    izbor = vrsta === 'imenica' && imenice.length ? imenice : ostalo.length ? ostalo : imenice;
  } else {
    if (rng() < konfig.vjerojatnostPropusta) return { vrsta: 'odustani', razlog: 'namjerni_propust' };
    izbor = uobicajene.length ? uobicajene : kandidati;
  }
  const najvisaFrekvencija = izbor.reduce((maksimum, rijec) => Math.max(maksimum, ulaz.frekvencijaZa(rijec) ?? 0), 0);
  const popularne = najvisaFrekvencija > 0 ? izbor.filter((rijec) => (ulaz.frekvencijaZa(rijec) ?? 0) >= najvisaFrekvencija * 0.5) : izbor;
  const rijec = izaberiPonderirano(popularne, rng);
  return { vrsta: 'rijec', rijec, kategorija: kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig) };
}

/** Vrijeme razmišljanja unutar roka; bot nikad ne dobiva više od roka minus margina. */
export function trajanjeRazmisljanjaMs(
  trajanjePotezaMs: number | null,
  konfig: KonfiguracijaBota,
  rng: Rng,
  kontekst: 'javna' | 'privatna' | 'trening' = 'javna',
): number {
  const osnova = kontekst === 'trening' ? konfig.treningRazmisljanjeMs
    : konfig.javnoRazmisljanjeMinMs + rng() * (konfig.javnoRazmisljanjeMaksMs - konfig.javnoRazmisljanjeMinMs);
  if (trajanjePotezaMs === null) return osnova;
  const gornja = Math.max(0, trajanjePotezaMs - konfig.marginaRokaMs);
  return Math.min(gornja, osnova);
}
