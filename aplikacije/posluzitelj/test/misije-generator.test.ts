import { describe, expect, it } from 'vitest';
import { jePristupacnaTjedna } from 'zajednicko';
import { odaberiTjedniPaket, odaberiZamjenu } from '../src/misije/generator.js';
import { jeW06IzvedivZaNovuDodjelu } from '../src/misije/kalendar.js';

function fiksniRng(vrijednosti: number[]): () => number {
  let i = 0;
  return () => {
    const v = vrijednosti[i % vrijednosti.length] ?? 0;
    i += 1;
    return v;
  };
}

describe('generator misija', () => {
  it('sastavlja tjedni paket s pristupačnom i bez duplih obitelji', () => {
    const paket = odaberiTjedniPaket(new Date('2026-11-04T12:00:00Z'), fiksniRng([0.1, 0.4, 0.7, 0.2, 0.9]));
    expect(paket).not.toBeNull();
    expect(paket).toHaveLength(3);
    expect(new Set(paket!.map((d) => d.predlozakId)).size).toBe(3);
    expect(new Set(paket!.map((d) => d.obitelj)).size).toBe(3);
    expect(paket!.filter((d) => d.zahtjevnija).length).toBeLessThanOrEqual(1);
    expect(paket!.some((d) => jePristupacnaTjedna(d.predlozakId))).toBe(true);
  });

  it('ne nudi W06 subotom', () => {
    expect(jeW06IzvedivZaNovuDodjelu(new Date('2026-11-07T12:00:00Z'))).toBe(false); // subota Zagreb
    expect(jeW06IzvedivZaNovuDodjelu(new Date('2026-11-06T12:00:00Z'))).toBe(true); // petak
  });

  it('zamjena čuva ostale i ne vraća isti predložak', () => {
    const paket = odaberiTjedniPaket(new Date('2026-11-04T12:00:00Z'), fiksniRng([0.2, 0.5, 0.8]))!;
    const ostale = [paket[1]!, paket[2]!];
    const zamjena = odaberiZamjenu('tjedna', ostale, new Date('2026-11-04T12:00:00Z'), fiksniRng([0.3]), new Set([paket[0]!.predlozakId]));
    expect(zamjena).not.toBeNull();
    expect(zamjena!.predlozakId).not.toBe(paket[0]!.predlozakId);
    expect(ostale.map((d) => d.predlozakId)).not.toContain(zamjena!.predlozakId);
  });
});
