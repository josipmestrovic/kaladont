/**
 * Botovi V8 Commit 08 — analiza nastavaka, predmemorija i skeniranje prefiksa.
 */
import { describe, expect, it } from 'vitest';
import {
  PredmemorijaLegalnosti,
  analizirajNastavak,
  analizirajNastavakNastavivo,
  odaberiPotez,
  odaberiPotezNastavivo,
  potpisPotrosenihGrupa,
  stvoriStanjeBota,
  type UlazOdabira,
} from '../src/bot/odabir-rijeci.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';

const konfig: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostNeznanjaUMalomSkupu: 0,
  vjerojatnostTaktickogPoteza: 1,
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bazaUlaz(preko: Partial<UlazOdabira> = {}): UlazOdabira {
  return {
    trazenaSlova: 'ma',
    kandidati: ['masa'],
    frekvencijaZa: () => 800,
    grupeZa: (r) => [`imenica:${r}`],
    pravila: 'klasicni',
    brojAktivnih: 2,
    iskoristeneGrupe: new Set(),
    turnToken: 't-base',
    ...preko,
  };
}

describe('Botovi V8 Commit 08 — analiza nastavaka', () => {
  it('poznat nastavak: jedan prolaz repertoara, rani hit', () => {
    let skenirano = 0;
    const analiza = analizirajNastavak(
      'masa',
      bazaUlaz({
        poznatiKandidatiNa: () => ({
          *[Symbol.iterator]() {
            for (let i = 0; i < 50; i += 1) {
              skenirano += 1;
              if (i === 3) yield 'lampa';
            }
          },
        }),
      }),
      new Set(),
      konfig,
    );
    expect(analiza).toEqual({ ishod: 'poznat', cestihNeovisnih: expect.any(Number) });
    expect(skenirano).toBeLessThanOrEqual(50);
    expect(skenirano).toBeGreaterThan(0);
  });

  it('repertoar prazan, imaSlobodnu true → legalno_nepoznato', () => {
    const analiza = analizirajNastavak(
      'masa',
      bazaUlaz({
        poznatiKandidatiNa: () => [],
        imaSlobodnuRijecNa: () => true,
      }),
      new Set(),
      konfig,
    );
    expect(analiza).toEqual({ ishod: 'legalno_nepoznato' });
  });

  it('repertoar prazan, iscrpljen prefiks → mrtvo', () => {
    const analiza = analizirajNastavak(
      'masa',
      bazaUlaz({
        poznatiKandidatiNa: () => [],
        imaSlobodnuRijecNa: () => false,
      }),
      new Set(),
      konfig,
    );
    expect(analiza).toEqual({ ishod: 'mrtvo' });
  });

  it('bez poznatih, samo indeks: živo → indeks, mrtvo prefiks → mrtvo', () => {
    const zivo = analizirajNastavak('masa', bazaUlaz({ imaSlobodnuRijecNa: () => true }), new Set(), konfig);
    const mrtvo = analizirajNastavak('masa', bazaUlaz({ imaSlobodnuRijecNa: () => false }), new Set(), konfig);
    expect(zivo).toEqual({ ishod: 'indeks' });
    expect(mrtvo).toEqual({ ishod: 'mrtvo' });
  });

  it('potrošene grupe: hipotetske grupe kandidata ulaze u potpis potrošenih', () => {
    const analiza = analizirajNastavak(
      'masa',
      bazaUlaz({
        poznatiKandidatiNa: () => [],
        imaSlobodnuRijecNa: (_pref, potrosene) => potrosene.has('imenica:masa') && !potrosene.has('imenica:mast'),
        grupeZa: (r) => (r === 'masa' ? ['imenica:masa'] : [`imenica:${r}`]),
      }),
      new Set(['imenica:mast']),
      konfig,
    );
    expect(analiza.ishod).toBe('mrtvo');
  });

  it('različite hipotetske grupe kandidata → različiti zapisi u predmemoriji', () => {
    const pred = new PredmemorijaLegalnosti();
    pred.uskladiKontekst('t-grupe', 1);
    let a = 0;
    let b = 0;
    analizirajNastavak('masa', bazaUlaz({ predmemorija: pred, grupeZa: () => { a += 1; return ['imenica:masa']; }, poznatiKandidatiNa: () => [] }), new Set(), konfig);
    analizirajNastavak('mast', bazaUlaz({ predmemorija: pred, grupeZa: () => { b += 1; return ['imenica:mast']; }, poznatiKandidatiNa: () => [] }), new Set(), konfig);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(pred.brojZapisa()).toBe(2);
  });

  it('nastavivo: prekid tokom imaSlobodnuNastavivo → otkazano', async () => {
    let aktivno = true;
    const analiza = await analizirajNastavakNastavivo(
      'masa',
      bazaUlaz({
        poznatiKandidatiNaNastavivo: async function* () { /* prazno */ },
        imaSlobodnuRijecNaNastavivo: async () => {
          aktivno = false;
          return true;
        },
      }),
      new Set(),
      konfig,
      async () => undefined,
      () => aktivno,
    );
    expect(analiza).toEqual({ ishod: 'otkazano' });
  });

  it('nastavivo: promjena verzije rječnika prije spremanja → rezultat bez cache upisa', async () => {
    let verzija = 1;
    const pred = new PredmemorijaLegalnosti();
    pred.uskladiKontekst('t-ver', 1);
    const analiza = await analizirajNastavakNastavivo(
      'masa',
      bazaUlaz({
        predmemorija: pred,
        verzijaRjecnika: 1,
        dohvatiVerzijuRjecnika: () => verzija,
        poznatiKandidatiNaNastavivo: async function* () {
          verzija = 2;
          yield 'lampa';
        },
      }),
      new Set(),
      konfig,
      async () => undefined,
      () => true,
    );
    // Ne otkazuj potez — izvršenje ima refresh; samo ne truj cache pod starom verzijom.
    expect(analiza).toEqual({ ishod: 'poznat', cestihNeovisnih: 1 });
    expect(pred.brojZapisa()).toBe(0);
  });

  it('uskladiKontekst briše predmemoriju na novi token i na promjenu potpisa potrošenih grupa', () => {
    const pred = new PredmemorijaLegalnosti();
    const izracun = () => ({ ishod: 'indeks' as const });
    pred.uskladiKontekst('t1', 1, potpisPotrosenihGrupa(new Set()));
    pred.dohvatiIliIzracunaj('k1', izracun);
    expect(pred.brojZapisa()).toBe(1);
    pred.uskladiKontekst('t2', 1, potpisPotrosenihGrupa(new Set()));
    expect(pred.brojZapisa()).toBe(0);
    pred.uskladiKontekst('t2', 1, potpisPotrosenihGrupa(new Set(['imenica:masa'])));
    expect(pred.brojZapisa()).toBe(0);
  });

  it('sinkroni i nastavivi odabir: ekvivalentni ishodi s istim mockovima', async () => {
    const ulaz = bazaUlaz({
      kandidati: ['masa', 'mast'],
      imaSlobodnuRijecNa: () => true,
      poznatiKandidatiNa: () => ['lampa'],
      turnToken: 't-eq-08',
    });
    const r = rng(99);
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfig, r), konfig, r);
    const b = await odaberiPotezNastavivo(
      {
        ...ulaz,
        poznatiKandidatiNaNastavivo: async function* () { yield 'lampa'; },
      },
      stvoriStanjeBota(konfig, r),
      konfig,
      r,
      async () => undefined,
      () => true,
    );
    expect(b).toEqual(a);
  });

  it('ne-taktički potez: nema skeniranja nastavaka', () => {
    const konfigObicni: KonfiguracijaBota = { ...konfig, vjerojatnostTaktickogPoteza: 0 };
    let repertoar = 0;
    let indeks = 0;
    odaberiPotez(
      bazaUlaz({
        kandidati: ['masa'],
        poznatiKandidatiNa: () => { repertoar += 1; return ['lampa']; },
        imaSlobodnuRijecNa: () => { indeks += 1; return true; },
      }),
      stvoriStanjeBota(konfigObicni, rng(1)),
      konfigObicni,
      rng(1),
    );
    expect(repertoar).toBe(0);
    expect(indeks).toBe(0);
  });

  it('mini prefiks indeks: broj pregleda za rani pravni hit', () => {
    const poPrefiksu = new Map<string, string[]>([
      ['sa', ['sama', 'samo', 'sastanak']],
    ]);
    const grupe = new Map<string, string[]>([
      ['sama', ['imenica:sama']],
      ['samo', ['imenica:samo']],
      ['sastanak', ['imenica:sastanak']],
    ]);
    let pregledano = 0;
    const imaSlobodnu = (pref: string, potrosene: ReadonlySet<string>) => {
      const lista = poPrefiksu.get(pref);
      if (!lista) return false;
      for (const rijec of lista) {
        pregledano += 1;
        const g = grupe.get(rijec) ?? [];
        if (!g.some((x) => potrosene.has(x))) return true;
      }
      return false;
    };
    analizirajNastavak(
      'masa',
      bazaUlaz({
        poznatiKandidatiNa: () => [],
        imaSlobodnuRijecNa: imaSlobodnu,
        grupeZa: (r) => grupe.get(r) ?? [`imenica:${r}`],
      }),
      new Set(),
      konfig,
    );
    expect(pregledano).toBe(1);
  });
});