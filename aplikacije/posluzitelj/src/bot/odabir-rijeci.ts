/**
 * Čisti odabir botove riječi (ADR-017). Nenapadačka politika: ni jedan kriterij ne gleda
 * protivnikove nastavke; broj kandidata procjenjuje samo težinu TRENUTNOG prefiksa.
 */
import { grafemi, kolekcijskiKljucGrupe, zadnjaDva } from 'zajednicko';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import type { KategorijaRijeci, KonfiguracijaBota, RitamPoteza } from './konfiguracija-bota.js';

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
  vrecicaKategorija: Vrecica<KategorijaRijeci>;
  vrecicaRitma: Vrecica<RitamPoteza>;
  propustDostupan: boolean;
}

export function stvoriStanjeBota(konfig: KonfiguracijaBota, rng: Rng): StanjeBotaUPartiji {
  return {
    vrecicaKategorija: new Vrecica(
      (Object.keys(konfig.udioKategorija) as KategorijaRijeci[]).map((k) => ({ vrijednost: k, udio: konfig.udioKategorija[k] })),
      rng,
    ),
    vrecicaRitma: new Vrecica(
      (Object.keys(konfig.udioRitma) as RitamPoteza[]).map((r) => ({ vrijednost: r, udio: konfig.udioRitma[r] })),
      rng,
    ),
    propustDostupan: rng() < konfig.udioPartijaSPropustom,
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

  const poKategoriji: Record<KategorijaRijeci, string[]> = { uobicajena: [], srednja: [], rijetka: [] };
  const naKa: string[] = [];
  const uobicajeneGrupe = new Set<string>();
  for (const rijec of ulaz.kandidati) {
    if (zadnjaDva(rijec) === 'ka') {
      naKa.push(rijec);
      continue;
    }
    const kategorija = kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig);
    poKategoriji[kategorija].push(rijec);
    if (kategorija === 'uobicajena') for (const grupa of ulaz.grupeZa(rijec)) uobicajeneGrupe.add(kolekcijskiKljucGrupe(grupa));
  }

  const ukupnoBezKa = poKategoriji.uobicajena.length + poKategoriji.srednja.length + poKategoriji.rijetka.length;
  if (ukupnoBezKa === 0 && naKa.length === 0) return { vrsta: 'odustani', razlog: 'nema_rijeci' };

  // Rijetko ostavljanje KA: samo kad kandidat postoji i samo kontroliranim udjelom.
  if (naKa.length > 0 && (ukupnoBezKa === 0 || rng() < konfig.vjerojatnostOstavljanjaKa)) {
    for (const rijec of naKa) poKategoriji[kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig)].push(rijec);
  }

  if (stanje.propustDostupan && uobicajeneGrupe.size < konfig.pragTeskogPrefiksa) {
    stanje.propustDostupan = false;
    return { vrsta: 'odustani', razlog: 'namjerni_propust' };
  }

  let kategorija = stanje.vrecicaKategorija.izvuci();
  if (poKategoriji[kategorija].length === 0) {
    const neprazne = (Object.keys(poKategoriji) as KategorijaRijeci[]).filter((k) => poKategoriji[k].length > 0);
    const zbroj = neprazne.reduce((suma, k) => suma + konfig.udioKategorija[k], 0);
    let preostalo = rng() * zbroj;
    kategorija = neprazne[neprazne.length - 1]!;
    for (const k of neprazne) {
      preostalo -= konfig.udioKategorija[k];
      if (preostalo < 0) {
        kategorija = k;
        break;
      }
    }
  }
  return { vrsta: 'rijec', rijec: izaberiPonderirano(poKategoriji[kategorija], rng), kategorija };
}

/** Vrijeme razmišljanja unutar roka; bot nikad ne dobiva više od roka minus margina. */
export function trajanjeRazmisljanjaMs(
  ritam: RitamPoteza,
  rijec: string | null,
  trajanjePotezaMs: number | null,
  konfig: KonfiguracijaBota,
  rng: Rng,
): number {
  if (trajanjePotezaMs === null) return konfig.odgodaBezTimeraMs;
  const [od, do_] = konfig.rasponRitma[ritam];
  const osnova = trajanjePotezaMs * (od + rng() * (do_ - od));
  const dodatak = rijec ? Math.min(konfig.maksDodatakMs, grafemi(rijec).length * konfig.dodatakPoGrafemuMs) : 0;
  const gornja = Math.max(0, trajanjePotezaMs - konfig.marginaRokaMs);
  return Math.min(gornja, Math.max(Math.min(konfig.najmanjeRazmisljanjeMs, gornja), osnova + dodatak));
}
