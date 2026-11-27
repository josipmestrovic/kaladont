import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ZavrsniChunk } from './odaberi-zavrsne-chunkove.js';
import {
  ocistiKesDinamicnihModula,
  ucitajModul,
  ucitajSRetryjem,
  ucitajZavrsneChunkove,
  ucitajZavrsneChunkoveSUcitavacima,
} from './dinamicni-ucitavac.js';

afterEach(() => {
  ocistiKesDinamicnihModula();
  vi.restoreAllMocks();
});

function prazniUcitavaci(
  override: Partial<Record<ZavrsniChunk, () => Promise<unknown>>>,
): Record<ZavrsniChunk, () => Promise<unknown>> {
  const baza = {
    rezultatIzazova: async () => ({ name: 'rezultat' }),
    iskustvo: async () => ({ name: 'iskustvo' }),
    misije: async () => ({ name: 'misije' }),
    dnk: async () => ({ name: 'dnk' }),
    panelRijeci: async () => ({ name: 'panelRijeci' }),
    panelIgraca: async () => ({ name: 'panelIgraca' }),
  } satisfies Record<ZavrsniChunk, () => Promise<unknown>>;
  return { ...baza, ...override };
}

describe('ucitajModul', () => {
  it('dijeli isti Promise za paralelne pozive istog ključa', async () => {
    let pozivi = 0;
    const ucitaj = () => {
      pozivi += 1;
      return Promise.resolve(`v-${pozivi}`);
    };
    const [a, b] = await Promise.all([
      ucitajModul('isti', ucitaj),
      ucitajModul('isti', ucitaj),
    ]);
    expect(a).toBe(b);
    expect(pozivi).toBe(1);
  });

  it('briše keš nakon pada i dopušta ponovni pokušaj', async () => {
    let pozivi = 0;
    const ucitaj = () => {
      pozivi += 1;
      if (pozivi === 1) return Promise.reject(new Error('pad'));
      return Promise.resolve('ok');
    };
    await expect(ucitajModul('retry', ucitaj)).rejects.toThrow('pad');
    await expect(ucitajModul('retry', ucitaj)).resolves.toBe('ok');
    expect(pozivi).toBe(2);
  });
});

describe('ucitajSRetryjem', () => {
  it('uspijeva nakon privremenog pada', async () => {
    let pozivi = 0;
    const vrijednost = await ucitajSRetryjem(async () => {
      pozivi += 1;
      if (pozivi < 3) throw new Error('privremeno');
      return 'gotovo';
    }, 3);
    expect(vrijednost).toBe('gotovo');
    expect(pozivi).toBe(3);
  });
});

describe('ucitajZavrsneChunkove izolacija', () => {
  it('jedan pad ne sprečava uspjeh ostalih chunkova', async () => {
    const dnk = vi.fn(async () => {
      throw new Error('dnk-fail');
    });
    const iskustvo = vi.fn(async () => ({ name: 'IskustvoOK' }));
    const panelRijeci = vi.fn(async () => ({ name: 'PanelOK' }));

    const rezultati = await ucitajZavrsneChunkoveSUcitavacima(
      ['iskustvo', 'dnk', 'panelRijeci'],
      prazniUcitavaci({ dnk, iskustvo, panelRijeci }),
      { retry: 0 },
    );

    expect(rezultati.find((r) => r.chunk === 'iskustvo')?.komponenta).toEqual({ name: 'IskustvoOK' });
    expect(rezultati.find((r) => r.chunk === 'panelRijeci')?.komponenta).toEqual({ name: 'PanelOK' });
    expect(rezultati.find((r) => r.chunk === 'dnk')?.greska).toBeInstanceOf(Error);
    expect(iskustvo).toHaveBeenCalled();
    expect(panelRijeci).toHaveBeenCalled();
    expect(dnk).toHaveBeenCalled();
  });

  it('prazan skup ne pokreće učitavače', async () => {
    const rezultati = await ucitajZavrsneChunkove([]);
    expect(rezultati).toEqual([]);
  });

  it('ne poziva izazov učitavač kad chunk nije na listi', async () => {
    const rezultatIzazova = vi.fn(async () => ({ name: 'izazov' }));
    const rezultati = await ucitajZavrsneChunkoveSUcitavacima(
      ['panelRijeci', 'iskustvo'],
      prazniUcitavaci({ rezultatIzazova }),
      { retry: 0 },
    );
    expect(rezultatIzazova).not.toHaveBeenCalled();
    expect(rezultati.map((r) => r.chunk).sort()).toEqual(['iskustvo', 'panelRijeci']);
  });
});
