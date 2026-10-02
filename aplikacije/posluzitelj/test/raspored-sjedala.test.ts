import { describe, expect, it, vi } from 'vitest';
import { promijesajNiz } from '../src/igra/raspored-sjedala.js';

describe('promijesajNiz', () => {
  it('vraća novu permutaciju bez promjene ulaznog niza', () => {
    const izvor = ['A', 'B', 'C', 'D'];
    const rezultat = promijesajNiz(izvor, (granica) => granica - 1);

    expect(rezultat).toEqual(['A', 'B', 'C', 'D']);
    expect(rezultat).not.toBe(izvor);
    expect(izvor).toEqual(['A', 'B', 'C', 'D']);
  });

  it('koristi uzastopne granice u Fisher-Yates koracima', () => {
    const slucajniIndeks = vi.fn((granica: number) => (granica === 3 ? 0 : 0));

    expect(promijesajNiz(['A', 'B', 'C'], slucajniIndeks)).toEqual(['B', 'C', 'A']);
    expect(slucajniIndeks.mock.calls).toEqual([[3], [2]]);
  });

  it('ne traži slučajne indekse za prazne nizove i nizove s jednim elementom', () => {
    const slucajniIndeks = vi.fn(() => 0);

    expect(promijesajNiz([], slucajniIndeks)).toEqual([]);
    expect(promijesajNiz(['A'], slucajniIndeks)).toEqual(['A']);
    expect(slucajniIndeks).not.toHaveBeenCalled();
  });

  it('poštuje dozvoljeni raspon indeksa u svakom koraku', () => {
    const slucajniIndeks = vi.fn((granica: number) => granica - 1);

    promijesajNiz(['A', 'B', 'C', 'D'], slucajniIndeks);

    expect(slucajniIndeks.mock.calls).toEqual([[4], [3], [2]]);
  });
});
