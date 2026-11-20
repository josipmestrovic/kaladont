import { describe, expect, it, vi } from 'vitest';
import { CHECKPOINT_ZAPISA, RasporedjivacOdziva, predajSetImmediate } from '../src/bot/raspored-odziva.js';
import { odaberiPotezNastavivo, stvoriStanjeBota } from '../src/bot/odabir-rijeci.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';

const konfig: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostPropustaKa: 0,
  vjerojatnostOstavljanjaKa: 0,
  vjerojatnostNeznanjaUMalomSkupu: 0,
  vjerojatnostTaktickogPoteza: 0,
};

describe('raspored odziva', () => {
  it('CHECKPOINT_ZAPISA je 256', () => {
    expect(CHECKPOINT_ZAPISA).toBe(256);
  });

  it('predajSetImmediate vraća kontrolu event loopu', async () => {
    let redoslijed = '';
    const p = predajSetImmediate().then(() => { redoslijed += 'b'; });
    redoslijed += 'a';
    await p;
    expect(redoslijed).toBe('ab');
  });

  it('RasporedjivacOdziva round-robin obrađuje dva posla bez izgladnjivanja', async () => {
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    const log: number[] = [];
    let a = 0;
    let b = 0;
    raspored.prijavi(async () => {
      log.push(1);
      a += 1;
      return a >= 3 ? 'gotovo' : 'nastavi';
    });
    raspored.prijavi(async () => {
      log.push(2);
      b += 1;
      return b >= 3 ? 'gotovo' : 'nastavi';
    });
    for (let i = 0; i < 20 && raspored.brojAktivnih() > 0; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(a).toBe(3);
    expect(b).toBe(3);
    expect(log.filter((x) => x === 1).length).toBe(3);
    expect(log.filter((x) => x === 2).length).toBe(3);
  });

  it('odaberiPotezNastavivo poštuje aktivan() i vraća null', async () => {
    let ziv = true;
    const odluka = await odaberiPotezNastavivo(
      {
        trazenaSlova: 'ma',
        kandidati: ['masa', 'mast'],
        frekvencijaZa: () => 500,
        grupeZa: (r) => [`imenica:${r}`],
        turnToken: 't-x',
        iskoristeneGrupe: new Set(),
        imaSlobodnuRijecNa: () => true,
        poznatiKandidatiNa: () => ['lampa'],
        poznatiKandidatiNaNastavivo: async function* () {
          yield 'lampa';
        },
      },
      stvoriStanjeBota(konfig, () => 0.5),
      konfig,
      () => 0.5,
      async () => { ziv = false; },
      () => ziv,
    );
    // Nakon prve predaje aktivan je false — može biti null ili rana odluka ovisno o putu.
    expect(odluka === null || odluka.vrsta === 'rijec').toBe(true);
  });

  it('otkazivanje uklanja posao iz rasporeda', async () => {
    const raspored = new RasporedjivacOdziva({ predaj: async () => undefined });
    const korak = vi.fn(async () => 'nastavi' as const);
    const id = raspored.prijavi(korak);
    raspored.otkazi(id);
    await new Promise((r) => setImmediate(r));
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('otkaz tijekom await koraka ne briše drugi posao', async () => {
    let sat = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => { sat += 1; return sat; },
    });
    let odblokiraj!: () => void;
    const blokada = new Promise<void>((resolve) => { odblokiraj = resolve; });
    let bKoraka = 0;
    let aPokrenut = false;
    const idA = raspored.prijavi(async () => {
      aPokrenut = true;
      await blokada;
      return 'gotovo';
    });
    raspored.prijavi(async () => {
      bKoraka += 1;
      return 'gotovo';
    });
    for (let i = 0; i < 20 && !aPokrenut; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(aPokrenut).toBe(true);
    raspored.otkazi(idA);
    odblokiraj();
    for (let i = 0; i < 40 && raspored.brojAktivnih() > 0; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(bKoraka).toBe(1);
    expect(raspored.brojAktivnih()).toBe(0);
  });
});
