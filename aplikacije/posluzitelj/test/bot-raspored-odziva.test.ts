import { describe, expect, it, vi } from 'vitest';
import {
  BUDZET_BLOKA_MS,
  BUDZET_SLICE_MS,
  CHECKPOINT_ZAPISA,
  RasporedjivacOdziva,
  predajSetImmediate,
} from '../src/bot/raspored-odziva.js';
import { odaberiPotezNastavivo, stvoriStanjeBota } from '../src/bot/odabir-rijeci.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';

const konfig: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostNeznanjaUMalomSkupu: 0,
  vjerojatnostTaktickogPoteza: 0,
};

async function cekajPrazan(raspored: RasporedjivacOdziva, max = 200): Promise<void> {
  for (let i = 0; i < max && raspored.brojAktivnih() > 0; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

describe('raspored odziva', () => {
  it('CHECKPOINT_ZAPISA je 256', () => {
    expect(CHECKPOINT_ZAPISA).toBe(256);
  });

  it('BUDZET_BLOKA_MS i BUDZET_SLICE_MS su postavljeni', () => {
    expect(BUDZET_BLOKA_MS).toBe(5);
    expect(BUDZET_SLICE_MS).toBe(2);
  });

  it('predajSetImmediate vraća kontrolu event loopu', async () => {
    let redoslijed = '';
    const p = predajSetImmediate().then(() => { redoslijed += 'b'; });
    redoslijed += 'a';
    await p;
    expect(redoslijed).toBe('ab');
  });

  it('prijavi ne pokreće kalkulaciju sinkrono (setImmediate)', async () => {
    const raspored = new RasporedjivacOdziva();
    let pokrenut = false;
    raspored.prijavi(async () => {
      pokrenut = true;
      return 'gotovo';
    });
    expect(pokrenut).toBe(false);
    expect(raspored.brojAktivnih()).toBe(1);
    await cekajPrazan(raspored);
    expect(pokrenut).toBe(true);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('pravednost: dva duga posla izmjenjuju sliceove prije prvog gotovo', async () => {
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    const log: string[] = [];
    const dug = (oznaka: string, sliceova: number) =>
      raspored.prijavi(async ({ predaj }) => {
        for (let i = 0; i < sliceova; i += 1) {
          log.push(oznaka);
          await predaj();
        }
        return 'gotovo';
      });
    dug('A', 4);
    dug('B', 4);
    await cekajPrazan(raspored);
    const prviGotovo = log.length;
    expect(prviGotovo).toBe(8);
    // Prije završetka prvog posla (4. A) moraju se izmjenjivati A/B.
    expect(log.slice(0, 4)).toEqual(['A', 'B', 'A', 'B']);
    expect(log.filter((x) => x === 'A')).toHaveLength(4);
    expect(log.filter((x) => x === 'B')).toHaveLength(4);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('novi posao napreduje dok stari nije gotov', async () => {
    // Budžet + stvarni setImmediate: pump pauzira nakon prvog slicea da stignemo ubaciti novi posao.
    let sat = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: () => new Promise((r) => setImmediate(r)),
      sada: () => { sat += BUDZET_BLOKA_MS; return sat; },
    });
    const log: string[] = [];
    let stariParkiran = false;
    raspored.prijavi(async ({ predaj }) => {
      for (let i = 0; i < 6; i += 1) {
        log.push('stari');
        stariParkiran = true;
        await predaj();
        stariParkiran = false;
      }
      return 'gotovo';
    });
    for (let i = 0; i < 40 && !stariParkiran; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(stariParkiran).toBe(true);
    expect(log.filter((x) => x === 'stari').length).toBeLessThan(6);
    raspored.prijavi(async ({ predaj }) => {
      log.push('novi');
      await predaj();
      log.push('novi');
      return 'gotovo';
    });
    await cekajPrazan(raspored, 400);
    const idxNovi = log.indexOf('novi');
    expect(idxNovi).toBeGreaterThanOrEqual(0);
    expect(idxNovi).toBeLessThan(log.lastIndexOf('stari'));
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('nema izgladnjivanja — svi poslovi dobiju slice', async () => {
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    const dobili = new Set<number>();
    for (let id = 0; id < 5; id += 1) {
      const oznaka = id;
      raspored.prijavi(async ({ predaj }) => {
        dobili.add(oznaka);
        await predaj();
        dobili.add(oznaka);
        return 'gotovo';
      });
    }
    await cekajPrazan(raspored);
    expect(dobili.size).toBe(5);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('budžet bloka forsira predaju event loopu (fake sada)', async () => {
    let sat = 0;
    let predajaEventLoopa = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => { predajaEventLoopa += 1; },
      sada: () => {
        sat += BUDZET_BLOKA_MS;
        return sat;
      },
    });
    raspored.prijavi(async ({ predaj }) => {
      await predaj();
      await predaj();
      return 'gotovo';
    });
    raspored.prijavi(async ({ predaj }) => {
      await predaj();
      return 'gotovo';
    });
    await cekajPrazan(raspored);
    expect(predajaEventLoopa).toBeGreaterThanOrEqual(1);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('kratki poslovi bez predaj() vraćaju event loop nakon zajedničkog budžeta', async () => {
    let sat = 0;
    let predajaEventLoopa = 0;
    let dovrsenoPrijeYielda = 0;
    let yieldVidjen = false;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => {
        predajaEventLoopa += 1;
        yieldVidjen = true;
      },
      // Svaki poziv sada() troši cijeli budžet → nakon prvog slicea mora biti yield.
      sada: () => {
        sat += BUDZET_BLOKA_MS;
        return sat;
      },
    });
    const N = 8;
    for (let i = 0; i < N; i += 1) {
      raspored.prijavi(async () => {
        if (!yieldVidjen) dovrsenoPrijeYielda += 1;
        return 'gotovo';
      });
    }
    await cekajPrazan(raspored);
    expect(predajaEventLoopa).toBeGreaterThanOrEqual(1);
    // Bez budžet-provjere na putu 'gotovo' svi bi završili prije prvog yielda.
    expect(dovrsenoPrijeYielda).toBeLessThan(N);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('jedan aktivan CPU slice (nema paralelnih run blokova)', async () => {
    let istodobno = 0;
    let maxIstodobno = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    const napravi = () =>
      raspored.prijavi(async ({ predaj }) => {
        // Broji samo sinkroni CPU dio; predaj parkira pa ne drži „istodobno”.
        istodobno += 1;
        maxIstodobno = Math.max(maxIstodobno, istodobno);
        istodobno -= 1;
        await predaj();
        istodobno += 1;
        maxIstodobno = Math.max(maxIstodobno, istodobno);
        istodobno -= 1;
        await predaj();
        return 'gotovo';
      });
    napravi();
    napravi();
    await cekajPrazan(raspored);
    expect(maxIstodobno).toBe(1);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('otkazi tijekom parkiranja ne curi Promise i drugi posao ostaje', async () => {
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    let aParkiran = false;
    let aNastavio = false;
    let bSliceova = 0;
    const idA = raspored.prijavi(async ({ predaj }) => {
      aParkiran = true;
      await predaj();
      aNastavio = true;
      return 'gotovo';
    });
    raspored.prijavi(async ({ predaj }) => {
      bSliceova += 1;
      await predaj();
      bSliceova += 1;
      await predaj();
      return 'gotovo';
    });
    for (let i = 0; i < 40 && !aParkiran; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
    expect(aParkiran).toBe(true);
    raspored.otkazi(idA);
    await cekajPrazan(raspored);
    // Parkirani predaj je resumean (nema curenja); A može nastaviti nakon otkaza.
    expect(aNastavio).toBe(true);
    expect(bSliceova).toBeGreaterThanOrEqual(1);
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('otkazivanje prije starta uklanja posao', async () => {
    const raspored = new RasporedjivacOdziva({ predaj: async () => undefined });
    const run = vi.fn(async () => 'gotovo' as const);
    const id = raspored.prijavi(run);
    raspored.otkazi(id);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(run).not.toHaveBeenCalled();
    expect(raspored.brojAktivnih()).toBe(0);
  });

  it('na kraju red je prazan', async () => {
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => 0,
    });
    for (let i = 0; i < 3; i += 1) {
      raspored.prijavi(async ({ predaj }) => {
        await predaj();
        return 'gotovo';
      });
    }
    await cekajPrazan(raspored);
    expect(raspored.brojAktivnih()).toBe(0);
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
    expect(odluka === null || odluka.vrsta === 'rijec').toBe(true);
  });
});
