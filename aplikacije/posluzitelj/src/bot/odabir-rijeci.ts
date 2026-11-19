/**
 * Čisti odabir botove riječi (ADR-017 / PR02).
 * Kontekstualno neznanje po tokenu, duel/Dokaži oprez i ograničena 1-ply taktika.
 * Procjena nastavka koristi javni repertoar profila; ista za čovjeka i bota.
 */
import { grafemi, PRAGOVI_DULJINE, zadnjaDva, type FazaPoteza, type PravilnikPartije, type VrstaRijeci } from 'zajednicko';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import { type KategorijaRijeci, type KonfiguracijaBota } from './konfiguracija-bota.js';

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
  brojPoteza: number;
  zadnjiToken: string | null;
  /** Jednokratna odluka o probabilističkom neznanju po turnTokenu. */
  neznanjePoTokenu: Map<string, boolean>;
  /** Jednokratna odluka je li potez taktički, po turnTokenu. */
  taktikaPoTokenu: Map<string, boolean>;
  konfiguracija: KonfiguracijaBota;
  brojKandidata: number;
  zadnjiTokenKa: string | null;
}

export function stvoriStanjeBota(konfig: KonfiguracijaBota, rng: Rng): StanjeBotaUPartiji {
  return {
    vrecicaVrsta: new Vrecica([{ vrijednost: 'imenica', udio: konfig.udioImenica * 100 }, { vrijednost: 'ostalo', udio: (1 - konfig.udioImenica) * 100 }], rng),
    brojPoteza: 0,
    zadnjiToken: null,
    neznanjePoTokenu: new Map(),
    taktikaPoTokenu: new Map(),
    konfiguracija: structuredClone(konfig),
    brojKandidata: 0,
    zadnjiTokenKa: null,
  };
}

/** Predmemorija 1-ply legalnosti u životnom vijeku partije. */
export class PredmemorijaLegalnosti {
  private readonly zapis = new Map<string, boolean>();
  private verzijaRjecnika = -1;

  ocisti(): void {
    this.zapis.clear();
  }

  uskladiVerziju(verzija: number): void {
    if (this.verzijaRjecnika !== verzija) {
      this.verzijaRjecnika = verzija;
      this.zapis.clear();
    }
  }

  dohvatiIliIzracunaj(kljuc: string, izracunaj: () => boolean): boolean {
    const postojece = this.zapis.get(kljuc);
    if (postojece !== undefined) return postojece;
    const vrijednost = izracunaj();
    this.zapis.set(kljuc, vrijednost);
    return vrijednost;
  }
}

export interface UlazOdabira {
  trazenaSlova: string;
  kandidati: Iterable<string>;
  frekvencijaZa(rijec: string): number | null;
  grupeZa(rijec: string): readonly string[];
  turnToken?: string;
  oporavak?: boolean;
  pravila?: PravilnikPartije;
  faza?: FazaPoteza;
  brojAktivnih?: number;
  /** Potrošene grupe tekuće partije (read-only). */
  iskoristeneGrupe?: ReadonlySet<string>;
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  /** Postoje li legalne riječi na prefiksu uz dane potrošene grupe (cijeli rječnik). */
  imaSlobodnuRijecNa?: (prefiks: string, iskoristeneGrupe: ReadonlySet<string>, dopusteneVrste?: ReadonlySet<VrstaRijeci>) => boolean;
  /** Poznati botu kandidati na prefiksu (za 1-ply repertoar). */
  poznatiKandidatiNa?: (prefiks: string, iskoristeneGrupe: ReadonlySet<string>) => Iterable<string>;
  predmemorija?: PredmemorijaLegalnosti;
  verzijaRjecnika?: number;
  /** Verzija potrošenih grupa (npr. size + hash) za cache ključ. */
  verzijaPotrosenih?: string;
}

/**
 * Politika „ka” po pravilniku.
 * - agresivni: Klasični ≥3 — „ka” u poolu, primljeni „ka” → uvijek kaladont
 * - oprezni: KA-ZNA / Klasični duel — 8 % propust, 1,5 % ostavljanje
 * - bez_ka: Dokaži nastavak — nikad kaladont, nikad ostavljanje „ka” (običan potez)
 */
export type PolitikaKa = 'agresivni' | 'oprezni' | 'bez_ka';

export function politikaKa(pravila: PravilnikPartije = 'ka_zna', brojAktivnih = 2): PolitikaKa {
  if (pravila === 'dokazi_nastavak') return 'bez_ka';
  if (pravila === 'klasicni' && brojAktivnih >= 3) return 'agresivni';
  return 'oprezni';
}

/** @deprecated Preferiraj `politikaKa`; true = oprezni (ne agresivni / ne bez_ka). */
export function oprezKa(pravila: PravilnikPartije = 'ka_zna', brojAktivnih = 2): boolean {
  return politikaKa(pravila, brojAktivnih) === 'oprezni';
}

export type OdlukaBota =
  | { vrsta: 'rijec'; rijec: string; kategorija: KategorijaRijeci | 'kaladont'; izborKa?: 'dobrovoljni' | 'prisilni'; propustKa?: boolean; takticki?: boolean }
  | { vrsta: 'odustani'; razlog: 'nema_rijeci' | 'namjerni_propust' };

export type VrstaSkupa = 'prazan' | 'mali' | 'dovoljan';

export interface KlasifikacijaSkupa {
  vrsta: VrstaSkupa;
  brojNeovisnih: number;
  imaCestu: boolean;
  predstavnici: string[];
  poznateRijeci: string[];
}

export function kategorijaRijeci(frekvencija: number | null, konfig: KonfiguracijaBota): KategorijaRijeci {
  if (frekvencija === null) return 'rijetka';
  if (frekvencija >= konfig.pragFrekvencije.uobicajena) return 'uobicajena';
  if (frekvencija >= konfig.pragFrekvencije.srednja) return 'srednja';
  return 'rijetka';
}

/** Jako rijetka (freq 0) ili ≥15 grafema — bot se toga „ne sjeća”. */
export function jeNepoznataBotu(rijec: string, frekvencija: number | null): boolean {
  const brojGrafema = grafemi(rijec).length;
  if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) return true;
  if (frekvencija === null || frekvencija === 0) return brojGrafema >= 4 || frekvencija === null;
  return false;
}

function dodajGrupe(iskoristene: ReadonlySet<string>, grupe: readonly string[]): Set<string> {
  const rezultat = new Set(iskoristene);
  for (const grupa of grupe) rezultat.add(grupa);
  return rezultat;
}

function jeCesta(rijec: string, frekvencijaZa: UlazOdabira['frekvencijaZa'], konfig: KonfiguracijaBota): boolean {
  return kategorijaRijeci(frekvencijaZa(rijec), konfig) === 'uobicajena';
}

/**
 * Klasificira poznati skup po neovisnim leksemskim grupama.
 * Early-exit kad nađe čestu opciju ili 4 neovisna predstavnika; za mali/prazan dovršava prolaz.
 */
export function klasificirajPoznatiSkup(
  kandidati: Iterable<string>,
  frekvencijaZa: UlazOdabira['frekvencijaZa'],
  grupeZa: UlazOdabira['grupeZa'],
  konfig: KonfiguracijaBota,
  pragNeovisnih = 4,
): KlasifikacijaSkupa {
  const poznateRijeci: string[] = [];
  const predstavnici: string[] = [];
  const pokriveneGrupe = new Set<string>();
  let imaCestu = false;
  let brojNeovisnih = 0;

  for (const rijec of kandidati) {
    if (jeNepoznataBotu(rijec, frekvencijaZa(rijec))) continue;
    poznateRijeci.push(rijec);
    const grupe = grupeZa(rijec);
    const nova = grupe.length === 0
      ? !pokriveneGrupe.has(`rijec:${rijec}`)
      : grupe.some((grupa) => !pokriveneGrupe.has(grupa));
    if (!nova) continue;

    brojNeovisnih += 1;
    predstavnici.push(rijec);
    if (grupe.length === 0) pokriveneGrupe.add(`rijec:${rijec}`);
    else for (const grupa of grupe) pokriveneGrupe.add(grupa);

    if (jeCesta(rijec, frekvencijaZa, konfig)) imaCestu = true;

    if (imaCestu || brojNeovisnih >= pragNeovisnih) {
      // Dovoljan skup: early-exit. Ostale poznate nisu potrebne za klasifikaciju.
      return {
        vrsta: 'dovoljan',
        brojNeovisnih: Math.max(brojNeovisnih, imaCestu ? pragNeovisnih : brojNeovisnih),
        imaCestu,
        predstavnici,
        poznateRijeci,
      };
    }
  }

  if (brojNeovisnih === 0) {
    return { vrsta: 'prazan', brojNeovisnih: 0, imaCestu: false, predstavnici, poznateRijeci };
  }
  if (!imaCestu && brojNeovisnih <= konfig.maksimalnoOpcijaMalogSkupa) {
    return { vrsta: 'mali', brojNeovisnih, imaCestu: false, predstavnici, poznateRijeci };
  }
  return { vrsta: 'dovoljan', brojNeovisnih, imaCestu, predstavnici, poznateRijeci };
}

function ponderDuljine(rijec: string, konfig: KonfiguracijaBota): number {
  const broj = grafemi(rijec).length;
  const odOsnovnog = Math.max(0, broj - 8) * konfig.ponderDuljinePoGrafemu;
  const odDuge = Math.max(0, broj - (PRAGOVI_DULJINE.duga - 1)) * konfig.ponderDuljinePoGrafemu;
  return 1 / (1 + odOsnovnog + odDuge);
}

function ponderRijeci(rijec: string, frekvencijaZa: UlazOdabira['frekvencijaZa'], konfig: KonfiguracijaBota): number {
  return (1 + konfig.skalaLogFrekvencije * Math.log1p(Math.max(0, frekvencijaZa(rijec) ?? 0))) * ponderDuljine(rijec, konfig);
}

function izaberiPonderirano(rijeci: readonly string[], frekvencijaZa: UlazOdabira['frekvencijaZa'], rng: Rng, konfig: KonfiguracijaBota): string {
  const ponderi = rijeci.map((rijec) => ponderRijeci(rijec, frekvencijaZa, konfig));
  let preostalo = rng() * ponderi.reduce((zbroj, p) => zbroj + p, 0);
  for (let i = 0; i < rijeci.length; i += 1) {
    preostalo -= ponderi[i]!;
    if (preostalo < 0) return rijeci[i]!;
  }
  return rijeci[rijeci.length - 1]!;
}

/** Ponderirani uzorak bez ponavljanja, neovisno o redoslijedu u datoteci. */
function uzorkujPonderirano(rijeci: readonly string[], broj: number, frekvencijaZa: UlazOdabira['frekvencijaZa'], rng: Rng, konfig: KonfiguracijaBota): string[] {
  if (rijeci.length <= broj) return [...rijeci];
  const preostalo = [...rijeci];
  const odabrano: string[] = [];
  while (odabrano.length < broj && preostalo.length > 0) {
    const izbor = izaberiPonderirano(preostalo, frekvencijaZa, rng, konfig);
    odabrano.push(izbor);
    const indeks = preostalo.indexOf(izbor);
    if (indeks >= 0) preostalo.splice(indeks, 1);
  }
  return odabrano;
}

function osnovnaVrsta(
  rijec: string,
  vrste: string[],
  grupeZa: UlazOdabira['grupeZa'],
): boolean {
  return grupeZa(rijec).some((grupa) => {
    const [vrsta, lema] = grupa.split(':');
    return vrste.includes(vrsta!) && lema === rijec;
  });
}

function odlukaNeznanjaZaToken(
  stanje: StanjeBotaUPartiji,
  turnToken: string | undefined,
  oporavak: boolean | undefined,
  vjerojatnost: number,
  rng: Rng,
): boolean {
  if (oporavak && turnToken && stanje.neznanjePoTokenu.has(turnToken)) {
    return stanje.neznanjePoTokenu.get(turnToken)!;
  }
  if (!turnToken) return rng() < vjerojatnost;
  const postojece = stanje.neznanjePoTokenu.get(turnToken);
  if (postojece !== undefined) return postojece;
  const vrijednost = rng() < vjerojatnost;
  stanje.neznanjePoTokenu.set(turnToken, vrijednost);
  return vrijednost;
}

function odlukaTaktikeZaToken(
  stanje: StanjeBotaUPartiji,
  turnToken: string | undefined,
  vjerojatnost: number,
  rng: Rng,
): boolean {
  if (!turnToken) return rng() < vjerojatnost;
  const postojece = stanje.taktikaPoTokenu.get(turnToken);
  if (postojece !== undefined) return postojece;
  const vrijednost = rng() < vjerojatnost;
  stanje.taktikaPoTokenu.set(turnToken, vrijednost);
  return vrijednost;
}

function imaPoznatiNastavak(
  rijec: string,
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
): boolean | null {
  const grupe = ulaz.grupeZa(rijec);
  const nakon = dodajGrupe(iskoristene, grupe);
  const prefiks = zadnjaDva(rijec);
  const verzijaPotrosenih = ulaz.verzijaPotrosenih ?? `${iskoristene.size}`;
  const kljuc = `${ulaz.verzijaRjecnika ?? 0}|${verzijaPotrosenih}|${ulaz.pravila ?? ''}|${ulaz.faza ?? ''}|${[...grupe].sort().join(',')}|${prefiks}|poznati`;

  const izracunaj = (): boolean => {
    if (ulaz.poznatiKandidatiNa) {
      for (const _ of ulaz.poznatiKandidatiNa(prefiks, nakon)) return true;
      return false;
    }
    if (ulaz.imaSlobodnuRijecNa) {
      return ulaz.imaSlobodnuRijecNa(prefiks, nakon, ulaz.dopusteneVrste);
    }
    return false;
  };

  if (ulaz.predmemorija) {
    ulaz.predmemorija.uskladiVerziju(ulaz.verzijaRjecnika ?? 0);
    return ulaz.predmemorija.dohvatiIliIzracunaj(kljuc, izracunaj);
  }
  if (!ulaz.poznatiKandidatiNa && !ulaz.imaSlobodnuRijecNa) return null;
  return izracunaj();
}

function brojCestihPoznatihNastavaka(
  rijec: string,
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
  konfig: KonfiguracijaBota,
  budzet = 8,
): number | null {
  if (!ulaz.poznatiKandidatiNa) return null;
  const nakon = dodajGrupe(iskoristene, ulaz.grupeZa(rijec));
  const prefiks = zadnjaDva(rijec);
  let broj = 0;
  const vidjene = new Set<string>();
  for (const nastavak of ulaz.poznatiKandidatiNa(prefiks, nakon)) {
    const grupe = ulaz.grupeZa(nastavak);
    const kljuc = grupe.length ? grupe.join('|') : nastavak;
    if (vidjene.has(kljuc)) continue;
    vidjene.add(kljuc);
    if (jeCesta(nastavak, ulaz.frekvencijaZa, konfig)) broj += 1;
    if (broj >= budzet) break;
  }
  return broj;
}

function filtrirajSigurne(
  rijeci: readonly string[],
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
): string[] {
  const sigurne: string[] = [];
  const nepoznate: string[] = [];
  for (const rijec of rijeci) {
    const nastavak = imaPoznatiNastavak(rijec, ulaz, iskoristene);
    if (nastavak === true) sigurne.push(rijec);
    else if (nastavak === null) nepoznate.push(rijec);
  }
  return sigurne.length ? sigurne : (nepoznate.length ? nepoznate : [...rijeci]);
}

function izbjegniSamoeliminaciju(
  rijeci: readonly string[],
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
): string[] {
  const sigurne: string[] = [];
  const nepoznate: string[] = [];
  const mrtve: string[] = [];
  for (const rijec of rijeci) {
    const nastavak = imaPoznatiNastavak(rijec, ulaz, iskoristene);
    if (nastavak === true) sigurne.push(rijec);
    else if (nastavak === false) mrtve.push(rijec);
    else nepoznate.push(rijec);
  }
  if (sigurne.length) return sigurne;
  if (nepoznate.length) return nepoznate;
  return mrtve;
}

function odaberiPoVrsti(
  skupina: readonly string[],
  stanje: StanjeBotaUPartiji,
  ulaz: UlazOdabira,
  konfig: KonfiguracijaBota,
): string[] {
  const uobicajene = skupina.filter((rijec) => jeCesta(rijec, ulaz.frekvencijaZa, konfig));
  const imenice = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['imenica'], ulaz.grupeZa));
  const ostalo = uobicajene.filter((rijec) => osnovnaVrsta(rijec, ['glagol', 'pridjev'], ulaz.grupeZa));
  if (imenice.length || ostalo.length) {
    const vrsta = stanje.vrecicaVrsta.izvuci();
    return vrsta === 'imenica' && imenice.length ? imenice : ostalo.length ? ostalo : imenice;
  }
  return uobicajene.length ? [...uobicajene] : [...skupina];
}

function ocjeniTakticki(
  kandidati: readonly string[],
  ulaz: UlazOdabira,
  konfig: KonfiguracijaBota,
  politika: PolitikaKa,
  faza: FazaPoteza,
  iskoristene: ReadonlySet<string>,
  rng: Rng,
): string {
  const uzorak = uzorkujPonderirano(kandidati, konfig.maksimalnoTaktickihKandidata, ulaz.frekvencijaZa, rng, konfig);
  let najbolja = uzorak[0]!;
  let najboljiBod = Number.NEGATIVE_INFINITY;

  for (const rijec of uzorak) {
    let bod = ponderRijeci(rijec, ulaz.frekvencijaZa, konfig);
    const nastavak = imaPoznatiNastavak(rijec, ulaz, iskoristene);
    if (nastavak === false) bod -= 1000;
    else if (nastavak === true) bod += 5;

    const zavrsavaKa = zadnjaDva(rijec) === 'ka';
    if (politika === 'agresivni' && zavrsavaKa) bod += 2;
    if (politika === 'bez_ka' && faza === 'obican_potez' && zavrsavaKa) bod -= 500;

    if (politika !== 'bez_ka' || faza === 'dokaz_nastavka') {
      const cestih = brojCestihPoznatihNastavaka(rijec, ulaz, iskoristene, konfig);
      if (cestih !== null) {
        if (faza === 'dokaz_nastavka' && nastavak === true) bod += Math.max(0, 4 - cestih);
        else if (faza !== 'dokaz_nastavka') bod += Math.max(0, 3 - cestih) * 0.5;
      }
    }

    if (bod > najboljiBod) {
      najboljiBod = bod;
      najbolja = rijec;
    }
  }
  return najbolja;
}

function pripremiSkupinuZaIzbor(
  poznati: readonly string[],
  politika: PolitikaKa,
  konfig: KonfiguracijaBota,
  rng: Rng,
): { skupina: string[]; prisilniKa: boolean } {
  if (politika === 'agresivni') return { skupina: [...poznati], prisilniKa: false };
  if (politika === 'bez_ka') {
    const bezKa = poznati.filter((rijec) => zadnjaDva(rijec) !== 'ka');
    return { skupina: bezKa.length ? bezKa : [], prisilniKa: false };
  }
  const kandidati: string[] = [];
  const naKa: string[] = [];
  for (const rijec of poznati) {
    if (zadnjaDva(rijec) === 'ka') naKa.push(rijec);
    else kandidati.push(rijec);
  }
  const prisilniKa = naKa.length > 0 && kandidati.length === 0;
  const skupina = naKa.length && (prisilniKa || rng() < konfig.vjerojatnostOstavljanjaKa)
    ? naKa
    : (kandidati.length ? kandidati : naKa);
  return { skupina, prisilniKa };
}

export function odaberiPotez(
  ulaz: UlazOdabira,
  stanje: StanjeBotaUPartiji,
  konfig: KonfiguracijaBota,
  rng: Rng,
): OdlukaBota {
  const sviKandidati = [...ulaz.kandidati];
  let propustKa = false;
  const pravila = ulaz.pravila ?? 'ka_zna';
  const brojAktivnih = ulaz.brojAktivnih ?? 2;
  const faza = ulaz.faza ?? 'obican_potez';
  const iskoristene = ulaz.iskoristeneGrupe ?? new Set<string>();
  const politikaSirowa = politikaKa(pravila, brojAktivnih);
  const politika: PolitikaKa =
    politikaSirowa === 'bez_ka' && faza === 'dokaz_nastavka' ? 'oprezni' : politikaSirowa;

  // Primljeni KA.
  if (ulaz.trazenaSlova === 'ka') {
    if (politika === 'bez_ka') {
      propustKa = true;
    } else if (politika === 'agresivni' || rng() >= konfig.vjerojatnostPropustaKa) {
      stanje.brojKandidata = 1;
      return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
    } else {
      propustKa = true;
    }
  }

  const klasifikacija = klasificirajPoznatiSkup(sviKandidati, ulaz.frekvencijaZa, ulaz.grupeZa, konfig);
  let poznati = klasifikacija.poznateRijeci;
  // Early-exit dovoljnog skupa ne mora vratiti sve poznate — dopuni kad treba birati.
  if (klasifikacija.vrsta === 'dovoljan' && poznati.length < sviKandidati.length) {
    poznati = sviKandidati.filter((rijec) => !jeNepoznataBotu(rijec, ulaz.frekvencijaZa(rijec)));
  }
  stanje.brojKandidata = poznati.length;

  if (poznati.length === 0) {
    if (propustKa && politika !== 'bez_ka') {
      stanje.brojKandidata = 1;
      return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
    }
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  if (klasifikacija.vrsta === 'mali') {
    if (odlukaNeznanjaZaToken(stanje, ulaz.turnToken, ulaz.oporavak, konfig.vjerojatnostNeznanjaUMalomSkupu, rng)) {
      if (propustKa && politika !== 'bez_ka') {
        stanje.brojKandidata = 1;
        return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
      }
      return { vrsta: 'odustani', razlog: 'namjerni_propust' };
    }
  }

  // Dokaži običan / duel: preferiraj riječi s legalnim poznatim nastavkom.
  if (politika === 'oprezni' || politikaSirowa === 'bez_ka') {
    poznati = izbjegniSamoeliminaciju(poznati, ulaz, iskoristene);
    if (politika === 'oprezni') {
      const sigurne = filtrirajSigurne(poznati, ulaz, iskoristene);
      if (sigurne.length) poznati = sigurne;
    }
  }

  // Sve poznate vode u potvrđenu samoeliminaciju u Dokaži → Ne znam (motor odlučuje o prethodnom autoru).
  if (politikaSirowa === 'bez_ka' && faza === 'obican_potez') {
    const imaIzbjegavanje = poznati.some((rijec) => imaPoznatiNastavak(rijec, ulaz, iskoristene) !== false);
    if (!imaIzbjegavanje && ulaz.imaSlobodnuRijecNa) {
      return { vrsta: 'odustani', razlog: 'nema_rijeci' };
    }
  }

  const { skupina: odabranaSkupina, prisilniKa } = pripremiSkupinuZaIzbor(poznati, politika, konfig, rng);
  if (odabranaSkupina.length === 0) {
    if (propustKa && politika !== 'bez_ka') {
      return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
    }
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  const takticki = odlukaTaktikeZaToken(stanje, ulaz.turnToken, konfig.vjerojatnostTaktickogPoteza, rng);
  let rijec: string;
  if (takticki) {
    rijec = ocjeniTakticki(odabranaSkupina, ulaz, konfig, politika, faza, iskoristene, rng);
  } else {
    const izbor = odaberiPoVrsti(odabranaSkupina, stanje, ulaz, konfig);
    rijec = izaberiPonderirano(izbor, ulaz.frekvencijaZa, rng, konfig);
  }

  const izborKa = zadnjaDva(rijec) === 'ka'
    ? (prisilniKa ? 'prisilni' as const : 'dobrovoljni' as const)
    : undefined;
  return {
    vrsta: 'rijec',
    rijec,
    kategorija: kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig),
    ...(izborKa ? { izborKa } : {}),
    ...(propustKa ? { propustKa: true } : {}),
    ...(takticki ? { takticki: true } : {}),
  };
}

/**
 * PR01: fiksni tempo od početka poteza (zadano 4000 ms) ± jitter, minus proteklo.
 * Isti ugovor za javnu, privatnu i trening. Presentation RNG; ne ovisi o riječi/identitetu.
 */
export function trajanjeRazmisljanjaMs(
  trajanjePotezaMs: number | null,
  konfig: KonfiguracijaBota,
  rng: Rng,
  kontekst: 'javna' | 'privatna' | 'trening' = 'javna',
  podaci?: { punoTrajanjeMs: number; protekloMs: number },
): number {
  void kontekst;
  const punoTrajanje = podaci?.punoTrajanjeMs ?? trajanjePotezaMs ?? 30_000;
  const jitter = konfig.jitterPotezaBotaMs;
  const pomak = jitter <= 0 ? 0 : Math.floor(rng() * (2 * jitter + 1)) - jitter;
  const cilj = konfig.trajanjePotezaBotaMs + pomak;
  const osnova = Math.max(0, cilj - (podaci?.protekloMs ?? 0));
  if (trajanjePotezaMs === null) return osnova;
  const margina = Math.min(konfig.marginaRokaMs, Math.max(150, punoTrajanje * 0.05));
  const gornja = Math.max(0, trajanjePotezaMs - margina);
  return Math.min(gornja, osnova);
}
