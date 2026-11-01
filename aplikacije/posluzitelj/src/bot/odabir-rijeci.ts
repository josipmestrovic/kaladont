/**
 * Čisti odabir botove riječi (ADR-017). Nenapadačka politika: ni jedan kriterij ne gleda
 * protivnikove nastavke; broj kandidata procjenjuje samo težinu TRENUTNOG prefiksa.
 */
import { grafemi, zadnjaDva } from 'zajednicko';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KategorijaRijeci, type KonfiguracijaBota } from './konfiguracija-bota.js';
import { createHash } from 'node:crypto';

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
  ciljIzostanka: number | null;
  ciljNeznanja: number | null;
  brojPoteza: number;
  brojTeskihPoteza: number;
  zadnjiToken: string | null;
  zadnjiTezakToken: string | null;
  izostanakPotrosen: boolean;
  neznanjePotroseno: boolean;
  konfiguracija: KonfiguracijaBota;
  koeficijentTempa: number;
  brojKandidata: number;
  zadnjiTokenKa: string | null;
}

export function stvoriStanjeBota(konfig: KonfiguracijaBota, rng: Rng): StanjeBotaUPartiji {
  const cilj = (vjerojatnost: number, raspon: readonly [number, number]) => rng() < vjerojatnost ? raspon[0] + Math.min(raspon[1] - raspon[0], Math.floor(rng() * (raspon[1] - raspon[0] + 1))) : null;
  return {
    vrecicaVrsta: new Vrecica([{ vrijednost: 'imenica', udio: konfig.udioImenica * 100 }, { vrijednost: 'ostalo', udio: (1 - konfig.udioImenica) * 100 }], rng),
    ciljIzostanka: cilj(konfig.brziRazvoj ? 0 : konfig.vjerojatnostIzostankaPoSudjelovanju, konfig.rasponPotezaIzostanka),
    ciljNeznanja: cilj(konfig.vjerojatnostNeznanjaPoSudjelovanju, konfig.rasponTeskogPotezaNeznanja),
    brojPoteza: 0, brojTeskihPoteza: 0, zadnjiToken: null, zadnjiTezakToken: null,
    izostanakPotrosen: false, neznanjePotroseno: false,
    konfiguracija: structuredClone(konfig), koeficijentTempa: 1, brojKandidata: 0, zadnjiTokenKa: null,
  };
}

export function koeficijentTempaBota(igracId: string, konfig: KonfiguracijaBota = ZADANA_KONFIGURACIJA_BOTA): number {
  return konfig.koeficijentTempaMin + createHash('sha256').update(igracId).digest().readUInt16BE(0) / 65_535 * (konfig.koeficijentTempaMaks - konfig.koeficijentTempaMin);
}

export interface UlazOdabira {
  trazenaSlova: string;
  kandidati: Iterable<string>;
  frekvencijaZa(rijec: string): number | null;
  grupeZa(rijec: string): readonly string[];
  turnToken?: string;
  oporavak?: boolean;
}

export type OdlukaBota =
  | { vrsta: 'rijec'; rijec: string; kategorija: KategorijaRijeci | 'kaladont'; izborKa?: 'dobrovoljni' | 'prisilni' }
  | { vrsta: 'odustani'; razlog: 'nema_rijeci' | 'namjerni_propust' };

export function kategorijaRijeci(frekvencija: number | null, konfig: KonfiguracijaBota): KategorijaRijeci {
  if (frekvencija === null) return 'rijetka';
  if (frekvencija >= konfig.pragFrekvencije.uobicajena) return 'uobicajena';
  if (frekvencija >= konfig.pragFrekvencije.srednja) return 'srednja';
  return 'rijetka';
}

function ponderDuljine(rijec: string, konfig: KonfiguracijaBota): number {
  return 1 / (1 + konfig.ponderDuljinePoGrafemu * Math.max(0, grafemi(rijec).length - 8));
}

function izaberiPonderirano(rijeci: readonly string[], frekvencijaZa: UlazOdabira['frekvencijaZa'], rng: Rng, konfig: KonfiguracijaBota): string {
  const ponderi = rijeci.map((rijec) => (1 + konfig.skalaLogFrekvencije * Math.log1p(Math.max(0, frekvencijaZa(rijec) ?? 0))) * ponderDuljine(rijec, konfig));
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
  if (ulaz.trazenaSlova === 'ka') { stanje.brojKandidata = 1; return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' }; }

  const kandidati: string[] = [];
  const naKa: string[] = [];
  for (const rijec of ulaz.kandidati) {
    if (zadnjaDva(rijec) === 'ka') {
      naKa.push(rijec);
      continue;
    }
    kandidati.push(rijec);
  }

  stanje.brojKandidata = kandidati.length + naKa.length;
  if (stanje.brojKandidata === 0) return { vrsta: 'odustani', razlog: 'nema_rijeci' };

  const osnovnaVrsta = (rijec: string, vrste: string[]) => ulaz.grupeZa(rijec).some((grupa) => {
    const [vrsta, lema] = grupa.split(':');
    return vrste.includes(vrsta!) && lema === rijec;
  });
  const svi = [...kandidati, ...naKa];
  const imaPozeljnih = svi.some((rijec) => kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig) === 'uobicajena' && osnovnaVrsta(rijec, ['imenica', 'glagol', 'pridjev']));
  if (!imaPozeljnih && !ulaz.oporavak) {
    if (!ulaz.turnToken || ulaz.turnToken !== stanje.zadnjiTezakToken) {
      stanje.brojTeskihPoteza += 1;
      stanje.zadnjiTezakToken = ulaz.turnToken ?? null;
    }
    if (!stanje.neznanjePotroseno && stanje.ciljNeznanja === stanje.brojTeskihPoteza) {
      stanje.neznanjePotroseno = true;
      return { vrsta: 'odustani', razlog: 'namjerni_propust' };
    }
  }
  const prisilniKa = naKa.length > 0 && kandidati.length === 0;
  const odabranaSkupina = naKa.length && (prisilniKa || rng() < konfig.vjerojatnostOstavljanjaKa) ? naKa : kandidati;
  const uobicajene = odabranaSkupina.filter((rijec) => kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig) === 'uobicajena');
  const imenice = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['imenica']));
  const ostalo = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['glagol', 'pridjev']));
  let izbor: string[];
  if (imenice.length || ostalo.length) {
    const vrsta = stanje.vrecicaVrsta.izvuci();
    izbor = vrsta === 'imenica' && imenice.length ? imenice : ostalo.length ? ostalo : imenice;
  } else {
    izbor = uobicajene.length ? uobicajene : odabranaSkupina;
  }
  const rijec = izaberiPonderirano(izbor, ulaz.frekvencijaZa, rng, konfig);
  return { vrsta: 'rijec', rijec, kategorija: kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig), ...(zadnjaDva(rijec) === 'ka' ? { izborKa: prisilniKa ? 'prisilni' as const : 'dobrovoljni' as const } : {}) };
}

/** Vrijeme razmišljanja unutar roka; bot nikad ne dobiva više od roka minus margina. */
export function trajanjeRazmisljanjaMs(
  trajanjePotezaMs: number | null,
  konfig: KonfiguracijaBota,
  rng: Rng,
  kontekst: 'javna' | 'privatna' | 'trening' = 'javna',
  podaci?: { punoTrajanjeMs: number; protekloMs: number; koeficijentTempa?: number; primljeniKa?: boolean; brojGrafema?: number; frekvencija?: number | null; brojKandidata?: number },
): number {
  const trajanje = podaci?.punoTrajanjeMs ?? trajanjePotezaMs ?? 30_000;
  const kategorija = rng();
  const raspon = podaci?.primljeniKa || kategorija < konfig.udioBrzih ? konfig.rasponBrzih : kategorija < konfig.udioBrzih + konfig.udioUobicajenih ? konfig.rasponUobicajenih : konfig.rasponSporih;
  const duljina = 1 + Math.min(konfig.maksimalnaKorekcijaDuljine, Math.max(0, (podaci?.brojGrafema ?? 8) - 8) * konfig.korekcijaDuljinePoGrafemu);
  const rijetkost = podaci?.frekvencija !== undefined && (podaci.frekvencija ?? 0) < konfig.pragFrekvencije.uobicajena ? 1 + konfig.korekcijaRijetkosti : 1;
  const tezinaPrefiksa = 1 + Math.min(0.15, Math.max(0, 8 - (podaci?.brojKandidata ?? 8)) * konfig.korekcijaTeskogPrefiksa);
  const udio = Math.min(konfig.maksimalniUdioPoteza, Math.max(konfig.minimalniUdioPoteza, (raspon[0] + rng() * (raspon[1] - raspon[0])) * (podaci?.koeficijentTempa ?? 1) * duljina * rijetkost * tezinaPrefiksa));
  const cilj = kontekst === 'trening'
    ? konfig.treningRazmisljanjeMinMs + rng() * (konfig.treningRazmisljanjeMaksMs - konfig.treningRazmisljanjeMinMs)
    : konfig.brziRazvoj ? 2_000 : trajanje * udio;
  const osnova = Math.max(0, cilj - (podaci?.protekloMs ?? 0));
  if (trajanjePotezaMs === null) return osnova;
  const margina = Math.min(konfig.marginaRokaMs, Math.max(150, trajanje * 0.05));
  const gornja = Math.max(0, trajanjePotezaMs - margina);
  return Math.min(gornja, osnova);
}
