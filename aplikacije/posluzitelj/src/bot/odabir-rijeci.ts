/**
 * Čisti odabir botove riječi (ADR-017 / PR02 / Botovi V8).
 * Kontekstualno neznanje po tokenu, oprezna KA politika i ograničena 1-ply taktika.
 * Skupa analiza nastavaka samo u taktičkom budžetu — ne prije radnog uzorka.
 */
import { grafemi, PRAGOVI_DULJINE, zadnjaDva, type FazaPoteza, type PravilnikPartije, type VrstaRijeci } from 'zajednicko';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import { type KategorijaRijeci, type KonfiguracijaBota } from './konfiguracija-bota.js';
import {
  RADNI_UZORAK_PO_POTEZU,
  jeOpasanZavrsetak,
} from './repertoar.js';
import { BUDZET_SLICE_MS, CHECKPOINT_ZAPISA } from './raspored-odziva.js';

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
  /**
   * Jednokratna odluka o probabilističkom neznanju po turnTokenu.
   * Drži samo aktualni token (ne povijest partije).
   */
  neznanjePoTokenu: Map<string, boolean>;
  /**
   * Jednokratna odluka je li potez taktički, po turnTokenu.
   * Drži samo aktualni token (ne povijest partije).
   */
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

export type AnalizaNastavkaSpremljena =
  | { ishod: 'poznat'; cestihNeovisnih: number }
  | { ishod: 'indeks' }
  | { ishod: 'legalno_nepoznato' }
  | { ishod: 'mrtvo' };

export type AnalizaNastavka = AnalizaNastavkaSpremljena | { ishod: 'otkazano' };

/**
 * Stabilan potpis skupa potrošenih grupa (veličina + sortirani ključevi).
 * Poziv jednom po odluci — sortiranje velikog skupa je prihvatljivo.
 */
export function potpisPotrosenihGrupa(set: ReadonlySet<string>): string {
  return `${set.size}:${[...set].sort().join('\0')}`;
}

/** Predmemorija 1-ply analize nastavaka za aktualni turnToken / verziju rječnika. */
export class PredmemorijaLegalnosti {
  static readonly LIMIT_ZAPISA = 128;

  private readonly zapis = new Map<string, AnalizaNastavkaSpremljena>();
  private verzijaRjecnika = -1;
  private turnToken: string | null = null;
  private potrosenePotpis: string | null = null;

  ocisti(): void {
    this.zapis.clear();
    this.turnToken = null;
    this.potrosenePotpis = null;
  }

  brojZapisa(): number {
    return this.zapis.size;
  }

  /** Čisti cache kad se promijeni token, verzija rječnika ili potpis potrošenih grupa. */
  uskladiKontekst(turnToken: string, verzija: number, potrosenePotpis?: string): void {
    const potpis = potrosenePotpis ?? null;
    if (
      this.turnToken !== turnToken
      || this.verzijaRjecnika !== verzija
      || this.potrosenePotpis !== potpis
    ) {
      this.turnToken = turnToken;
      this.verzijaRjecnika = verzija;
      this.potrosenePotpis = potpis;
      this.zapis.clear();
    }
  }

  /** @deprecated Koristi uskladiKontekst(turnToken, verzija). */
  uskladiVerziju(verzija: number): void {
    if (this.verzijaRjecnika !== verzija) {
      this.verzijaRjecnika = verzija;
      this.zapis.clear();
    }
  }

  peek(kljuc: string): AnalizaNastavkaSpremljena | undefined {
    return this.zapis.get(kljuc);
  }

  spremi(kljuc: string, vrijednost: AnalizaNastavkaSpremljena): void {
    if (this.zapis.has(kljuc)) return;
    if (this.zapis.size < PredmemorijaLegalnosti.LIMIT_ZAPISA) {
      this.zapis.set(kljuc, vrijednost);
    }
  }

  dohvatiIliIzracunaj(kljuc: string, izracunaj: () => AnalizaNastavkaSpremljena): AnalizaNastavkaSpremljena {
    const postojece = this.zapis.get(kljuc);
    if (postojece !== undefined) return postojece;
    const vrijednost = izracunaj();
    this.spremi(kljuc, vrijednost);
    return vrijednost;
  }
}

/** Članstvo potrošenih grupa (baza + hipoteza kandidata). */
export interface ProvjeraPotrosenih {
  has(grupa: string): boolean;
}

/**
 * Pogled na bazne potrošene grupe + dodatne grupe hipotetske riječi.
 * Izbjegava `new Set(iskoristene)` po kandidatu; `has` gleda oba izvora.
 * Namjerno nije `implements ReadonlySet` (TS SetIterator vs IterableIterator).
 */
export class SlozeneIskoristeneGrupe implements ProvjeraPotrosenih {
  constructor(
    private readonly baza: ReadonlySet<string>,
    private readonly dodatne: readonly string[],
  ) {}

  has(grupa: string): boolean {
    return this.baza.has(grupa) || this.dodatne.includes(grupa);
  }

  get size(): number {
    let n = this.baza.size;
    for (const grupa of this.dodatne) {
      if (!this.baza.has(grupa)) n += 1;
    }
    return n;
  }

  /** Za rječničke API-je koji očekuju ReadonlySet (koriste samo `has`). */
  kaoReadonlySet(): ReadonlySet<string> {
    return this as unknown as ReadonlySet<string>;
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
  imaSlobodnuRijecNaNastavivo?: (
    prefiks: string,
    iskoristeneGrupe: ReadonlySet<string>,
    predaj: PredajKontrolu,
    aktivan: () => boolean,
    dopusteneVrste?: ReadonlySet<VrstaRijeci>,
  ) => Promise<boolean | 'otkazano'>;
  /** Pri spremanju u cache — ako se verzija promijenila, ne spremaj. */
  dohvatiVerzijuRjecnika?: () => number;
  /** Poznati botu kandidati na prefiksu (za 1-ply repertoar). */
  poznatiKandidatiNa?: (prefiks: string, iskoristeneGrupe: ReadonlySet<string>) => Iterable<string>;
  /**
   * Nastaviva varijanta poznatih kandidata (MVP scheduler).
   * Ako postoji, `odaberiPotezNastavivo` koristi nju umjesto sinkronog iteratora.
   */
  poznatiKandidatiNaNastavivo?: (
    prefiks: string,
    iskoristeneGrupe: ReadonlySet<string>,
  ) => AsyncIterable<string>;
  predmemorija?: PredmemorijaLegalnosti;
  verzijaRjecnika?: number;
  /**
   * @deprecated Cache više ne koristi globalni hash potrošenih grupa;
   * predmemorija živi unutar snimke tokena, a ključ nosi hipotetske grupe kandidata.
   */
  verzijaPotrosenih?: string;
}

export type PredajKontrolu = () => Promise<void>;

/**
 * Politika „ka” po broju aktivnih igrača.
 * - agresivni: ≥3 aktivna — „ka” u poolu, primljeni „ka” → uvijek kaladont
 * - oprezni: manje od 3 — izbjegava vlastito „ka” dok postoji druga poznata riječ; inače prisilni izbor
 */
export type PolitikaKa = 'agresivni' | 'oprezni';

export function politikaKa(brojAktivnih = 2): PolitikaKa {
  return brojAktivnih >= 3 ? 'agresivni' : 'oprezni';
}

/** @deprecated Preferiraj `politikaKa`; true = oprezni (ne agresivni). */
export function oprezKa(brojAktivnih = 2): boolean {
  return politikaKa(brojAktivnih) === 'oprezni';
}

export type RazlogInterniOdustajanja =
  /** Javna Brza igra: nakon 10 poteza u bot-duelu forsiran „Ne znam”. */
  | 'bot_duel_limit';

export type OdlukaBota =
  | { vrsta: 'rijec'; rijec: string; kategorija: KategorijaRijeci | 'kaladont'; izborKa?: 'dobrovoljni' | 'prisilni'; propustKa?: boolean; takticki?: boolean }
  | { vrsta: 'odustani'; razlog: 'nema_rijeci' | 'namjerni_propust'; razlogInterni?: RazlogInterniOdustajanja };

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

function dodajGrupe(iskoristene: ReadonlySet<string>, grupe: readonly string[]): SlozeneIskoristeneGrupe {
  if (grupe.length === 0) return new SlozeneIskoristeneGrupe(iskoristene, []);
  return new SlozeneIskoristeneGrupe(iskoristene, grupe);
}

/** Zadrži samo odluku za aktualni token — ne akumuliraj povijest partije. */
function zapisiOdlukuTokena(mapa: Map<string, boolean>, turnToken: string, vrijednost: boolean): void {
  if (mapa.size !== 1 || !mapa.has(turnToken)) mapa.clear();
  mapa.set(turnToken, vrijednost);
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
    // Frekvenciju gledamo na svakom poznatom obliku — česta fleksija kasnije u grupi
    // i dalje čini skup „dovoljnim”, ne samo prvi neovisni predstavnik.
    if (jeCesta(rijec, frekvencijaZa, konfig)) imaCestu = true;

    const grupe = grupeZa(rijec);
    const nova = grupe.length === 0
      ? !pokriveneGrupe.has(`rijec:${rijec}`)
      : grupe.some((grupa) => !pokriveneGrupe.has(grupa));
    if (nova) {
      brojNeovisnih += 1;
      predstavnici.push(rijec);
      if (grupe.length === 0) pokriveneGrupe.add(`rijec:${rijec}`);
      else for (const grupa of grupe) pokriveneGrupe.add(grupa);
    }

    if (imaCestu || brojNeovisnih >= pragNeovisnih) {
      // Dovoljan skup: early-exit. Ostale poznate nisu potrebne za klasifikaciju.
      return {
        vrsta: 'dovoljan',
        brojNeovisnih,
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

/** Ponderirani uzorak bez ponavljanja, O(n+k); neovisno o redoslijedu u datoteci. */
export function uzorkujPonderirano(rijeci: readonly string[], broj: number, frekvencijaZa: UlazOdabira['frekvencijaZa'], rng: Rng, konfig: KonfiguracijaBota): string[] {
  if (rijeci.length <= broj) return [...rijeci];
  const ponderirano = rijeci.map((rijec) => ({ rijec, ponder: ponderRijeci(rijec, frekvencijaZa, konfig) }));
  let zbroj = ponderirano.reduce((s, p) => s + p.ponder, 0);
  const preostalo = [...ponderirano];
  const odabrano: string[] = [];
  while (odabrano.length < broj && preostalo.length > 0) {
    let cilj = rng() * zbroj;
    let indeks = 0;
    for (; indeks < preostalo.length; indeks += 1) {
      cilj -= preostalo[indeks]!.ponder;
      if (cilj < 0) break;
    }
    if (indeks >= preostalo.length) indeks = preostalo.length - 1;
    const uzeto = preostalo.splice(indeks, 1)[0]!;
    zbroj -= uzeto.ponder;
    odabrano.push(uzeto.rijec);
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
  zapisiOdlukuTokena(stanje.neznanjePoTokenu, turnToken, vrijednost);
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
  zapisiOdlukuTokena(stanje.taktikaPoTokenu, turnToken, vrijednost);
  return vrijednost;
}

function kljucAnalizeNastavka(
  prefiks: string,
  hipotetskeGrupe: readonly string[],
  pravila: string,
  faza: string,
  dopusteneVrste?: ReadonlySet<VrstaRijeci>,
): string {
  const vrste = dopusteneVrste ? JSON.stringify([...dopusteneVrste].sort()) : '';
  return `${pravila}|${faza}|${prefiks}|${JSON.stringify([...hipotetskeGrupe].sort())}|${vrste}`;
}

function potroseneNakonRijeci(
  iskoristene: ReadonlySet<string>,
  grupe: readonly string[],
): SlozeneIskoristeneGrupe {
  return dodajGrupe(iskoristene, grupe);
}

function smijeSpremitiAnalizu(ulaz: UlazOdabira): boolean {
  if (ulaz.dohvatiVerzijuRjecnika !== undefined && ulaz.verzijaRjecnika !== undefined) {
    return ulaz.dohvatiVerzijuRjecnika() === ulaz.verzijaRjecnika;
  }
  return true;
}

function dodajBodNastavka(bod: number, analiza: AnalizaNastavkaSpremljena): number {
  if (analiza.ishod === 'mrtvo') return bod - 1000;
  if (analiza.ishod === 'poznat') {
    let novi = bod + 5;
    novi += Math.max(0, 3 - analiza.cestihNeovisnih) * 0.5;
    return novi;
  }
  if (analiza.ishod === 'indeks') return bod + 5;
  return bod;
}

export function analizirajNastavak(
  rijec: string,
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
  konfig: KonfiguracijaBota,
  budzetCestih = 8,
): AnalizaNastavkaSpremljena {
  const grupe = ulaz.grupeZa(rijec);
  const nakon = potroseneNakonRijeci(iskoristene, grupe);
  const prefiks = zadnjaDva(rijec);
  const potrosene = nakon.kaoReadonlySet();
  const kljuc = kljucAnalizeNastavka(prefiks, grupe, ulaz.pravila ?? '', ulaz.faza ?? '', ulaz.dopusteneVrste);

  const izCachea = ulaz.predmemorija?.peek(kljuc);
  if (izCachea !== undefined) return izCachea;

  const izracunaj = (): AnalizaNastavkaSpremljena => {
    if (ulaz.poznatiKandidatiNa) {
      let pronadjen = false;
      let brojCestih = 0;
      const vidjene = new Set<string>();
      for (const nastavak of ulaz.poznatiKandidatiNa(prefiks, potrosene)) {
        pronadjen = true;
        const grupeN = ulaz.grupeZa(nastavak);
        const kljucG = grupeN.length ? grupeN.join('|') : nastavak;
        if (!vidjene.has(kljucG)) {
          vidjene.add(kljucG);
          if (jeCesta(nastavak, ulaz.frekvencijaZa, konfig)) brojCestih += 1;
          if (brojCestih >= budzetCestih) break;
        }
      }
      if (pronadjen) return { ishod: 'poznat', cestihNeovisnih: brojCestih };
      if (ulaz.imaSlobodnuRijecNa) {
        return ulaz.imaSlobodnuRijecNa(prefiks, potrosene, ulaz.dopusteneVrste)
          ? { ishod: 'legalno_nepoznato' }
          : { ishod: 'mrtvo' };
      }
      return { ishod: 'legalno_nepoznato' };
    }
    if (!ulaz.imaSlobodnuRijecNa) return { ishod: 'legalno_nepoznato' };
    return ulaz.imaSlobodnuRijecNa(prefiks, potrosene, ulaz.dopusteneVrste)
      ? { ishod: 'indeks' }
      : { ishod: 'mrtvo' };
  };

  return ulaz.predmemorija
    ? ulaz.predmemorija.dohvatiIliIzracunaj(kljuc, izracunaj)
    : izracunaj();
}

export async function analizirajNastavakNastavivo(
  rijec: string,
  ulaz: UlazOdabira,
  iskoristene: ReadonlySet<string>,
  konfig: KonfiguracijaBota,
  predaj: PredajKontrolu,
  aktivan: () => boolean,
  budzetCestih = 8,
): Promise<AnalizaNastavka> {
  if (!aktivan()) return { ishod: 'otkazano' };
  const grupe = ulaz.grupeZa(rijec);
  const nakon = potroseneNakonRijeci(iskoristene, grupe);
  const prefiks = zadnjaDva(rijec);
  const potrosene = nakon.kaoReadonlySet();
  const kljuc = kljucAnalizeNastavka(prefiks, grupe, ulaz.pravila ?? '', ulaz.faza ?? '', ulaz.dopusteneVrste);

  const izCachea = ulaz.predmemorija?.peek(kljuc);
  if (izCachea !== undefined) return izCachea;

  const spremiAko = (analiza: AnalizaNastavkaSpremljena): AnalizaNastavka => {
    if (!aktivan()) return { ishod: 'otkazano' };
    // Promjena verzije rječnika: ne truj cache aktualne verzije, ali vrati rezultat —
    // inače odabir padne na null i potez visi do isteka tempa (izvršenje već ima refresh retry).
    if (smijeSpremitiAnalizu(ulaz)) ulaz.predmemorija?.spremi(kljuc, analiza);
    return analiza;
  };

  if (ulaz.poznatiKandidatiNaNastavivo || ulaz.poznatiKandidatiNa) {
    let pronadjen = false;
    let brojCestih = 0;
    const vidjene = new Set<string>();
    let n = 0;
    let pocetakSlicea = performance.now();
    const izvor = ulaz.poznatiKandidatiNaNastavivo
      ? ulaz.poznatiKandidatiNaNastavivo(prefiks, potrosene)
      : ulaz.poznatiKandidatiNa!(prefiks, potrosene);

    for await (const nastavak of izvor) {
      n += 1;
      pronadjen = true;
      const grupeN = ulaz.grupeZa(nastavak);
      const kljucG = grupeN.length ? grupeN.join('|') : nastavak;
      if (!vidjene.has(kljucG)) {
        vidjene.add(kljucG);
        if (jeCesta(nastavak, ulaz.frekvencijaZa, konfig)) brojCestih += 1;
        if (brojCestih >= budzetCestih) break;
      }
      const budzetIstekao = performance.now() - pocetakSlicea >= BUDZET_SLICE_MS;
      if (n % CHECKPOINT_ZAPISA === 0 || budzetIstekao) {
        await predaj();
        pocetakSlicea = performance.now();
        if (!aktivan()) return { ishod: 'otkazano' };
      }
    }

    if (pronadjen) return spremiAko({ ishod: 'poznat', cestihNeovisnih: brojCestih });

    if (ulaz.imaSlobodnuRijecNaNastavivo) {
      await predaj();
      if (!aktivan()) return { ishod: 'otkazano' };
      const zivo = await ulaz.imaSlobodnuRijecNaNastavivo(
        prefiks,
        potrosene,
        predaj,
        aktivan,
        ulaz.dopusteneVrste,
      );
      if (zivo === 'otkazano') return { ishod: 'otkazano' };
      return spremiAko(zivo ? { ishod: 'legalno_nepoznato' } : { ishod: 'mrtvo' });
    }
    if (ulaz.imaSlobodnuRijecNa) {
      await predaj();
      if (!aktivan()) return { ishod: 'otkazano' };
      const zivo = ulaz.imaSlobodnuRijecNa(prefiks, potrosene, ulaz.dopusteneVrste);
      return spremiAko(zivo ? { ishod: 'legalno_nepoznato' } : { ishod: 'mrtvo' });
    }
    return spremiAko({ ishod: 'legalno_nepoznato' });
  }

  if (!ulaz.imaSlobodnuRijecNaNastavivo && !ulaz.imaSlobodnuRijecNa) {
    return spremiAko({ ishod: 'legalno_nepoznato' });
  }

  if (ulaz.imaSlobodnuRijecNaNastavivo) {
    const zivo = await ulaz.imaSlobodnuRijecNaNastavivo(
      prefiks,
      potrosene,
      predaj,
      aktivan,
      ulaz.dopusteneVrste,
    );
    if (zivo === 'otkazano') return { ishod: 'otkazano' };
    return spremiAko(zivo ? { ishod: 'indeks' } : { ishod: 'mrtvo' });
  }

  const zivo = ulaz.imaSlobodnuRijecNa!(prefiks, potrosene, ulaz.dopusteneVrste);
  return spremiAko(zivo ? { ishod: 'indeks' } : { ishod: 'mrtvo' });
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
  iskoristene: ReadonlySet<string>,
  rng: Rng,
): string {
  const uzorak = uzorkujPonderirano(kandidati, konfig.maksimalnoTaktickihKandidata, ulaz.frekvencijaZa, rng, konfig);
  let najbolja = uzorak[0]!;
  let najboljiBod = Number.NEGATIVE_INFINITY;

  for (const rijec of uzorak) {
    let bod = ponderRijeci(rijec, ulaz.frekvencijaZa, konfig);
    const analiza = analizirajNastavak(rijec, ulaz, iskoristene, konfig);
    bod = dodajBodNastavka(bod, analiza);

    const zavrsavaKa = zadnjaDva(rijec) === 'ka';
    if (politika === 'agresivni' && zavrsavaKa) bod += 2;
    if (jeOpasanZavrsetak(zadnjaDva(rijec))) bod += 3;

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
): { skupina: string[]; prisilniKa: boolean } {
  if (politika === 'agresivni') return { skupina: [...poznati], prisilniKa: false };
  const kandidati: string[] = [];
  const naKa: string[] = [];
  for (const rijec of poznati) {
    if (zadnjaDva(rijec) === 'ka') naKa.push(rijec);
    else kandidati.push(rijec);
  }
  if (kandidati.length) return { skupina: kandidati, prisilniKa: false };
  return { skupina: naKa, prisilniKa: naKa.length > 0 };
}

export function odaberiPotez(
  ulaz: UlazOdabira,
  stanje: StanjeBotaUPartiji,
  konfig: KonfiguracijaBota,
  rng: Rng,
): OdlukaBota {
  // Jedna materijalizacija radnog niza — bez drugog spreada ako je već niz.
  const sviKandidati = Array.isArray(ulaz.kandidati)
    ? (ulaz.kandidati as string[])
    : [...ulaz.kandidati];
  // Odbaci odluke starih tokena čim stigne novi (ne čekaj novo izvlačenje).
  if (ulaz.turnToken) {
    if (stanje.neznanjePoTokenu.size > 0 && !stanje.neznanjePoTokenu.has(ulaz.turnToken)) {
      stanje.neznanjePoTokenu.clear();
    }
    if (stanje.taktikaPoTokenu.size > 0 && !stanje.taktikaPoTokenu.has(ulaz.turnToken)) {
      stanje.taktikaPoTokenu.clear();
    }
  }
  const brojAktivnih = ulaz.brojAktivnih ?? 2;
  const iskoristene = ulaz.iskoristeneGrupe ?? new Set<string>();
  const politika = politikaKa(brojAktivnih);

  if (ulaz.trazenaSlova === 'ka') {
    stanje.brojKandidata = 1;
    return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
  }

  const klasifikacija = klasificirajPoznatiSkup(sviKandidati, ulaz.frekvencijaZa, ulaz.grupeZa, konfig);
  let poznati = klasifikacija.poznateRijeci;
  // Early-exit dovoljnog skupa ne mora vratiti sve poznate — dopuni kad treba birati.
  if (klasifikacija.vrsta === 'dovoljan' && poznati.length < sviKandidati.length) {
    poznati = sviKandidati.filter((rijec) => !jeNepoznataBotu(rijec, ulaz.frekvencijaZa(rijec)));
  }
  stanje.brojKandidata = poznati.length;

  if (poznati.length === 0) {
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  if (klasifikacija.vrsta === 'mali') {
    if (odlukaNeznanjaZaToken(stanje, ulaz.turnToken, ulaz.oporavak, konfig.vjerojatnostNeznanjaUMalomSkupu, rng)) {
      return { vrsta: 'odustani', razlog: 'namjerni_propust' };
    }
  }

  const { skupina: odabranaSkupina, prisilniKa } = pripremiSkupinuZaIzbor(poznati, politika);
  let radnaSkupina = odabranaSkupina;
  if (radnaSkupina.length > RADNI_UZORAK_PO_POTEZU) {
    radnaSkupina = uzorkujPonderirano(radnaSkupina, RADNI_UZORAK_PO_POTEZU, ulaz.frekvencijaZa, rng, konfig);
  }
  if (radnaSkupina.length === 0) {
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  const takticki = odlukaTaktikeZaToken(stanje, ulaz.turnToken, konfig.vjerojatnostTaktickogPoteza, rng);
  let rijec: string;
  if (takticki) {
    rijec = ocjeniTakticki(radnaSkupina, ulaz, konfig, politika, iskoristene, rng);
  } else {
    const izbor = odaberiPoVrsti(radnaSkupina, stanje, ulaz, konfig);
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
    ...(takticki ? { takticki: true } : {}),
  };
}

/**
 * Nastavivi odabir: ista politika kao `odaberiPotez`, uz predaju kontrole tijekom skupih nastavaka.
 * Vraća `null` ako je posao otkazan (`aktivan() === false`).
 */
export async function odaberiPotezNastavivo(
  ulaz: UlazOdabira,
  stanje: StanjeBotaUPartiji,
  konfig: KonfiguracijaBota,
  rng: Rng,
  predaj: PredajKontrolu,
  aktivan: () => boolean,
): Promise<OdlukaBota | null> {
  // Bez nastavivog izvora — sinkroni odabir u jednom bloku (mali fixture / testovi).
  if (!ulaz.poznatiKandidatiNaNastavivo) {
    if (!aktivan()) return null;
    return odaberiPotez(ulaz, stanje, konfig, rng);
  }

  const sviKandidati = Array.isArray(ulaz.kandidati)
    ? (ulaz.kandidati as string[])
    : [...ulaz.kandidati];
  if (ulaz.turnToken) {
    if (stanje.neznanjePoTokenu.size > 0 && !stanje.neznanjePoTokenu.has(ulaz.turnToken)) {
      stanje.neznanjePoTokenu.clear();
    }
    if (stanje.taktikaPoTokenu.size > 0 && !stanje.taktikaPoTokenu.has(ulaz.turnToken)) {
      stanje.taktikaPoTokenu.clear();
    }
  }
  const brojAktivnih = ulaz.brojAktivnih ?? 2;
  const iskoristene = ulaz.iskoristeneGrupe ?? new Set<string>();
  const politika = politikaKa(brojAktivnih);

  if (ulaz.trazenaSlova === 'ka') {
    stanje.brojKandidata = 1;
    return { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
  }

  if (!aktivan()) return null;
  await predaj();
  if (!aktivan()) return null;

  const klasifikacija = klasificirajPoznatiSkup(sviKandidati, ulaz.frekvencijaZa, ulaz.grupeZa, konfig);
  let poznati = klasifikacija.poznateRijeci;
  if (klasifikacija.vrsta === 'dovoljan' && poznati.length < sviKandidati.length) {
    // Dopuna poznatih: predaj na duljim petljama (broji stvarno pregledane zapise).
    const dopuna: string[] = [];
    for (let i = 0; i < sviKandidati.length; i += 1) {
      const rijec = sviKandidati[i]!;
      if (!jeNepoznataBotu(rijec, ulaz.frekvencijaZa(rijec))) dopuna.push(rijec);
      if ((i + 1) % CHECKPOINT_ZAPISA === 0) {
        await predaj();
        if (!aktivan()) return null;
      }
    }
    poznati = dopuna;
  }
  stanje.brojKandidata = poznati.length;

  if (poznati.length === 0) {
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  if (klasifikacija.vrsta === 'mali') {
    if (odlukaNeznanjaZaToken(stanje, ulaz.turnToken, ulaz.oporavak, konfig.vjerojatnostNeznanjaUMalomSkupu, rng)) {
      return { vrsta: 'odustani', razlog: 'namjerni_propust' };
    }
  }

  const { skupina: odabranaSkupina, prisilniKa } = pripremiSkupinuZaIzbor(poznati, politika);
  let radnaSkupina = odabranaSkupina;
  if (radnaSkupina.length > RADNI_UZORAK_PO_POTEZU) {
    radnaSkupina = uzorkujPonderirano(radnaSkupina, RADNI_UZORAK_PO_POTEZU, ulaz.frekvencijaZa, rng, konfig);
  }
  if (radnaSkupina.length === 0) {
    return { vrsta: 'odustani', razlog: 'nema_rijeci' };
  }

  if (!aktivan()) return null;
  await predaj();
  if (!aktivan()) return null;

  const takticki = odlukaTaktikeZaToken(stanje, ulaz.turnToken, konfig.vjerojatnostTaktickogPoteza, rng);
  let rijec: string;
  if (takticki) {
    const uzorak = uzorkujPonderirano(radnaSkupina, konfig.maksimalnoTaktickihKandidata, ulaz.frekvencijaZa, rng, konfig);
    let najbolja = uzorak[0]!;
    let najboljiBod = Number.NEGATIVE_INFINITY;
    for (const kandidat of uzorak) {
      let bod = ponderRijeci(kandidat, ulaz.frekvencijaZa, konfig);
      const analiza = await analizirajNastavakNastavivo(kandidat, ulaz, iskoristene, konfig, predaj, aktivan);
      if (analiza.ishod === 'otkazano') return null;
      bod = dodajBodNastavka(bod, analiza);
      const zavrsavaKa = zadnjaDva(kandidat) === 'ka';
      if (politika === 'agresivni' && zavrsavaKa) bod += 2;
      if (jeOpasanZavrsetak(zadnjaDva(kandidat))) bod += 3;
      if (bod > najboljiBod) {
        najboljiBod = bod;
        najbolja = kandidat;
      }
    }
    rijec = najbolja;
  } else {
    const izbor = odaberiPoVrsti(radnaSkupina, stanje, ulaz, konfig);
    rijec = izaberiPonderirano(izbor, ulaz.frekvencijaZa, rng, konfig);
  }

  if (!aktivan()) return null;
  const izborKa = zadnjaDva(rijec) === 'ka'
    ? (prisilniKa ? 'prisilni' as const : 'dobrovoljni' as const)
    : undefined;
  return {
    vrsta: 'rijec',
    rijec,
    kategorija: kategorijaRijeci(ulaz.frekvencijaZa(rijec), konfig),
    ...(izborKa ? { izborKa } : {}),
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
  kontekst: 'javna' | 'privatna' | 'trening' | 'izazov' = 'javna',
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

/** Staging QA (#100): bot s ljudima ~3 s; bez aktivnih ljudi ~0,2 s. Pragove popune ne dira. */
export const STAGING_BOT_POTEZ_S_LJUDIMA_MS = 3_000;
/** Bez roka (CI / privatno / staging bot-only): brzi završetak. */
export const BOT_POTEZ_BEZ_ROKA_MS = 200;

/**
 * Konačna odgoda kad partija nema rok poteza (`istekPotezaMs === null`).
 * Staging: 3 s dok ima aktivnog čovjeka, inače 0,2 s. Ostalo: trening puni tempo, inače 0,2 s (CI).
 */
export function odgodaBezRokaMs(
  izracunataOdgodaMs: number,
  opcije: {
    kontekst: 'javna' | 'privatna' | 'trening' | 'izazov';
    imaAktivnogCovjeka: boolean;
    okruzenje: string;
  },
): number {
  if (opcije.okruzenje === 'staging') {
    return Math.min(
      izracunataOdgodaMs,
      opcije.imaAktivnogCovjeka ? STAGING_BOT_POTEZ_S_LJUDIMA_MS : BOT_POTEZ_BEZ_ROKA_MS,
    );
  }
  if (opcije.kontekst === 'trening' || opcije.kontekst === 'izazov') return izracunataOdgodaMs;
  return Math.min(izracunataOdgodaMs, BOT_POTEZ_BEZ_ROKA_MS);
}
