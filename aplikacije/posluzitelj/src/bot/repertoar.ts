/**
 * Zajednički ograničeni repertoar botova (politika v7).
 * Jedna generacija po procesu, dijeljena svim botovima i partijama.
 */
import { grafemi, PRAGOVI_DULJINE, zadnjaDva } from 'zajednicko';

function jeNepoznataBotu(rijec: string, frekvencija: number | null): boolean {
  const brojGrafema = grafemi(rijec).length;
  if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) return true;
  if (frekvencija === null || frekvencija === 0) return brojGrafema >= 4 || frekvencija === null;
  return false;
}

export const REPERTOAR_GLAVNI_PO_PREFIKSU = 256;
export const REPERTOAR_REZERVA_PO_PREFIKSU = 256;
export const RADNI_UZORAK_PO_POTEZU = 100;
export const DETALJNA_PROVJERA_PO_POTEZU = 12;
export const DOKAZ_DODATNA_PROVJERA = 12;
export const UKUPNO_DETALJNO_PROVJERA = 24;

/** Završeci koji taktici dodaju bod (teži nastavak za protivnika). */
export const OPASNI_ZAVRSETCI_ZA_TAKTIKU: readonly string[] = ['ća', 'će', 'ši'];

export interface IzvorPodatakaRepertoara {
  prefiksi(): Iterable<string>;
  rijeciNaPrefiksu(prefiks: string): readonly string[];
  frekvencijaZa(rijec: string): number | null;
  grupeZa(rijec: string): readonly string[];
  jeOsnovniOblik(rijec: string): boolean;
  jePostojecaRijec(rijec: string): boolean;
}

export interface StavkaPrefiksa {
  readonly glavni: readonly string[];
  readonly rezerva: readonly string[];
}

export interface SnimkaRepertoara {
  readonly generacija: number;
  readonly poPrefiksu: ReadonlyMap<string, StavkaPrefiksa>;
}

export function jeOpasanZavrsetak(prefiks: string): boolean {
  return OPASNI_ZAVRSETCI_ZA_TAKTIKU.includes(prefiks);
}

function stabilniHash(rijec: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < rijec.length; i += 1) {
    h ^= rijec.charCodeAt(i);
    h = Math.imul(h, 1_677_769);
  }
  return h >>> 0;
}

interface KandidatGradnje {
  rijec: string;
  osnovni: boolean;
  frekvencija: number;
  kategorijaFrekvencije: number;
  zavrsetak: string;
  grupe: readonly string[];
  hash: number;
}

function ocjenaKandidata(k: KandidatGradnje): number {
  let bod = 0;
  bod += k.osnovni ? 1_000_000 : 0;
  bod += k.kategorijaFrekvencije * 10_000;
  bod += Math.min(9_999, Math.log1p(k.frekvencija) * 100);
  return bod;
}

function kategorijaFrekvencije(freq: number | null): number {
  if (freq === null || freq === 0) return 0;
  if (freq >= 100) return 3;
  if (freq >= 10) return 2;
  return 1;
}

function kljuceviGrupa(rijec: string, grupe: readonly string[]): string[] {
  if (grupe.length === 0) return [`rijec:${rijec}`];
  return [...grupe];
}

function odaberiZaPrefiks(
  izvor: IzvorPodatakaRepertoara,
  prefiks: string,
): StavkaPrefiksa {
  const rijeci = izvor.rijeciNaPrefiksu(prefiks);
  const kandidati: KandidatGradnje[] = [];
  for (const rijec of rijeci) {
    if (!izvor.jePostojecaRijec(rijec)) continue;
    const frekvencijaSirowa = izvor.frekvencijaZa(rijec);
    if (jeNepoznataBotu(rijec, frekvencijaSirowa)) continue;
    const frekvencija = frekvencijaSirowa ?? 0;
    kandidati.push({
      rijec,
      osnovni: izvor.jeOsnovniOblik(rijec),
      frekvencija,
      kategorijaFrekvencije: kategorijaFrekvencije(frekvencijaSirowa),
      zavrsetak: zadnjaDva(rijec),
      grupe: izvor.grupeZa(rijec),
      hash: stabilniHash(rijec),
    });
  }
  kandidati.sort((a, b) => {
    const razlika = ocjenaKandidata(b) - ocjenaKandidata(a);
    if (razlika !== 0) return razlika;
    return a.hash - b.hash || a.rijec.localeCompare(b.rijec, 'hr');
  });

  const glavni: string[] = [];
  const rezerva: string[] = [];
  const odabrane = new Set<string>();
  const pokriveneGrupe = new Set<string>();
  const pokriveniZavrsetci = new Set<string>();

  /** Monotoni pokazivač: jednom nevaljan kandidat više ne postaje alternativa (grupe/završeci samo rastu). */
  let indeksAlternative = 0;

  const naprijedDoAlternative = (): KandidatGradnje | undefined => {
    while (indeksAlternative < kandidati.length) {
      const druga = kandidati[indeksAlternative]!;
      if (
        !pokriveniZavrsetci.has(druga.zavrsetak)
        && !odabrane.has(druga.rijec)
        && !druga.grupe.some((g) => pokriveneGrupe.has(g))
      ) {
        return druga;
      }
      indeksAlternative += 1;
    }
    return undefined;
  };

  const dodaj = (lista: string[], limit: number, preferirajRaznolikost: boolean) => {
    for (const k of kandidati) {
      if (lista.length >= limit) break;
      if (odabrane.has(k.rijec)) continue;
      const grupe = kljuceviGrupa(k.rijec, k.grupe);
      if (grupe.some((g) => pokriveneGrupe.has(g))) continue;
      if (preferirajRaznolikost && pokriveniZavrsetci.has(k.zavrsetak) && lista.length < limit - 1) {
        const alternativa = naprijedDoAlternative();
        if (alternativa && alternativa.rijec !== k.rijec) continue;
      }
      lista.push(k.rijec);
      odabrane.add(k.rijec);
      for (const g of grupe) pokriveneGrupe.add(g);
      pokriveniZavrsetci.add(k.zavrsetak);
    }
  };

  dodaj(glavni, REPERTOAR_GLAVNI_PO_PREFIKSU, false);
  pokriveniZavrsetci.clear();
  indeksAlternative = 0;
  dodaj(rezerva, REPERTOAR_REZERVA_PO_PREFIKSU, true);

  return { glavni, rezerva };
}

export function izgradiRepertoarBotova(
  izvor: IzvorPodatakaRepertoara,
  generacija: number,
): SnimkaRepertoara {
  const poPrefiksu = new Map<string, StavkaPrefiksa>();
  for (const prefiks of izvor.prefiksi()) {
    const stavka = odaberiZaPrefiks(izvor, prefiks);
    if (stavka.glavni.length > 0 || stavka.rezerva.length > 0) {
      poPrefiksu.set(prefiks, stavka);
    }
  }
  return { generacija, poPrefiksu };
}

export class UpraviteljRepertoara {
  private snimka: SnimkaRepertoara = { generacija: 0, poPrefiksu: new Map() };

  objavi(snimka: SnimkaRepertoara): void {
    this.snimka = snimka;
  }

  dohvati(): SnimkaRepertoara {
    return this.snimka;
  }

  verzija(): number {
    return this.snimka.generacija;
  }

  /** Odmah izbaci uklonjene/nelegalne riječi iz aktivne snimke (dok se rebuild još ne završi). */
  filtrirajUklonjene(uklonjene: ReadonlySet<string>, novaGeneracija: number): void {
    if (uklonjene.size === 0) return;
    const poPrefiksu = new Map<string, StavkaPrefiksa>();
    for (const [prefiks, stavka] of this.snimka.poPrefiksu) {
      const glavni = stavka.glavni.filter((r) => !uklonjene.has(r));
      const rezerva = stavka.rezerva.filter((r) => !uklonjene.has(r));
      if (glavni.length > 0 || rezerva.length > 0) {
        poPrefiksu.set(prefiks, { glavni, rezerva });
      }
    }
    this.snimka = { generacija: novaGeneracija, poPrefiksu };
  }
}

export function* kandidatiRepertoaraNaPrefiksu(
  snimka: SnimkaRepertoara,
  prefiks: string,
): Generator<string> {
  const stavka = snimka.poPrefiksu.get(prefiks);
  if (!stavka) return;
  yield* stavka.glavni;
  yield* stavka.rezerva;
}

export function* igriviKandidatiIzRepertoara(
  snimka: SnimkaRepertoara,
  prefiks: string,
  provjeriIgrivost: (rijec: string) => boolean,
): Generator<string> {
  for (const rijec of kandidatiRepertoaraNaPrefiksu(snimka, prefiks)) {
    if (provjeriIgrivost(rijec)) yield rijec;
  }
}

export function* poznatiNastavciIzRepertoara(
  snimka: SnimkaRepertoara,
  prefiks: string,
  provjeriIgrivost: (rijec: string) => boolean,
): Generator<string> {
  yield* igriviKandidatiIzRepertoara(snimka, prefiks, provjeriIgrivost);
}

export function prefiksImaPrijemljivuRijec(
  snimka: SnimkaRepertoara,
  prefiks: string,
  rijeciNa: readonly string[],
  frekvencijaZa: (rijec: string) => number | null,
): boolean {
  const stavka = snimka.poPrefiksu.get(prefiks);
  if (stavka && (stavka.glavni.length > 0 || stavka.rezerva.length > 0)) return true;
  for (const rijec of rijeciNa) {
    if (jeNepoznataBotu(rijec, frekvencijaZa(rijec))) continue;
    return true;
  }
  return false;
}