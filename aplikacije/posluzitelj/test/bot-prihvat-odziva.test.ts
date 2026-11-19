/**
 * CI prihvat (commit 3): fixture bez hrLex — brojači skeniranja, cache lifetime, checkpoint.
 * Veliki dataset nije dio PR CI; vidi scripts/benchmark-bot-odabir.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  PredmemorijaLegalnosti,
  odaberiPotez,
  odaberiPotezNastavivo,
  stvoriStanjeBota,
} from '../src/bot/odabir-rijeci.js';
import { CHECKPOINT_ZAPISA } from '../src/bot/raspored-odziva.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';

const konfig: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostPropustaKa: 0,
  vjerojatnostOstavljanjaKa: 0,
  vjerojatnostNeznanjaUMalomSkupu: 0,
  vjerojatnostTaktickogPoteza: 0,
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

describe('CI prihvat odziva botova', () => {
  it('rani prekid: postoji nastavak bez čitanja ostatka velikog prefiksa', () => {
    let pregledano = 0;
    const poznatiKandidatiNa = () => ({
      *[Symbol.iterator](): Generator<string> {
        for (let i = 0; i < 10_000; i += 1) {
          pregledano += 1;
          if (i === 0) yield 'lampa';
          else yield `xx${i}`;
        }
      },
    });
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      pravila: 'ka_zna',
      brojAktivnih: 2,
      iskoristeneGrupe: new Set(),
      imaSlobodnuRijecNa: () => true,
      poznatiKandidatiNa,
      turnToken: 't-rani',
    }, stvoriStanjeBota(konfig, rng(1)), konfig, rng(1));
    expect(odluka.vrsta).toBe('rijec');
    // izbjegni + filtriraj mogu dvaput krenuti bez cachea — uz predmemoriju jednom.
    expect(pregledano).toBeLessThanOrEqual(4);
  });

  it('cache ne raste s poviješću tokena (100 uzastopnih)', () => {
    const pred = new PredmemorijaLegalnosti();
    let peak = 0;
    for (let i = 0; i < 100; i += 1) {
      pred.uskladiKontekst(`t-${i}`, 1);
      for (let j = 0; j < 50; j += 1) {
        pred.dohvatiIliIzracunaj(`k-${j}`, () => j % 2 === 0);
      }
      peak = Math.max(peak, pred.brojZapisa());
      expect(pred.brojZapisa()).toBeLessThanOrEqual(50);
    }
    expect(peak).toBeLessThanOrEqual(50);
    pred.uskladiKontekst('t-final', 1);
    expect(pred.brojZapisa()).toBe(0);
  });

  it('limit predmemorije ne mijenja legalnost (preskoči upis)', () => {
    const pred = new PredmemorijaLegalnosti();
    pred.uskladiKontekst('t1', 1);
    for (let i = 0; i < PredmemorijaLegalnosti.LIMIT_ZAPISA + 10; i += 1) {
      expect(pred.dohvatiIliIzracunaj(`x-${i}`, () => true)).toBe(true);
    }
    expect(pred.brojZapisa()).toBe(PredmemorijaLegalnosti.LIMIT_ZAPISA);
    expect(pred.dohvatiIliIzracunaj('x-extra', () => false)).toBe(false);
  });

  it('nastavivi odabir predaje kontrolu najmanje jednom na dugom skenu', async () => {
    let predaja = 0;
    const N = CHECKPOINT_ZAPISA * 2 + 10;
    const odluka = await odaberiPotezNastavivo(
      {
        trazenaSlova: 'ma',
        kandidati: ['masa'],
        frekvencijaZa: () => 500,
        grupeZa: (r) => [`imenica:${r}`],
        pravila: 'ka_zna',
        brojAktivnih: 2,
        iskoristeneGrupe: new Set(),
        imaSlobodnuRijecNa: () => true,
        poznatiKandidatiNa: () => ['lampa'],
        poznatiKandidatiNaNastavivo: () => ({
          async *[Symbol.asyncIterator](): AsyncGenerator<string> {
            for (let i = 0; i < N; i += 1) {
              if (i === N - 1) yield 'lampa';
              if ((i + 1) % CHECKPOINT_ZAPISA === 0) {
                // checkpoint broji se u kontroleru; ovdje simuliramo predaju pozivatelja
              }
            }
          },
        }),
        turnToken: 't-cp',
      },
      stvoriStanjeBota(konfig, rng(2)),
      konfig,
      rng(2),
      async () => { predaja += 1; },
      () => true,
    );
    expect(odluka?.vrsta).toBe('rijec');
    // odaberiPotezNastavivo zove predaj na početku i između kandidata.
    expect(predaja).toBeGreaterThanOrEqual(1);
  });

  it('seeded ekvivalencija sinkronog i nastavivog odabira na malom fixtureu', async () => {
    const ulaz = {
      trazenaSlova: 'ma' as const,
      kandidati: ['masa', 'mast', 'maslac', 'maska'],
      frekvencijaZa: (r: string) => (r === 'maska' ? 200 : 800),
      grupeZa: (r: string) => [`imenica:${r}`],
      pravila: 'ka_zna' as const,
      brojAktivnih: 2,
      iskoristeneGrupe: new Set<string>(),
      imaSlobodnuRijecNa: () => true,
      poznatiKandidatiNa: () => ['lampa'],
      turnToken: 't-eq',
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfig, rng(7)), konfig, rng(7));
    const b = await odaberiPotezNastavivo(
      {
        ...ulaz,
        poznatiKandidatiNaNastavivo: async function* () { yield 'lampa'; },
      },
      stvoriStanjeBota(konfig, rng(7)),
      konfig,
      rng(7),
      async () => undefined,
      () => true,
    );
    expect(b).toEqual(a);
  });
});
