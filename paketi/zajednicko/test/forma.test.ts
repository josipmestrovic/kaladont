import { describe, expect, it } from 'vitest';
import { azurirajPobjednickiNiz, bonusPobjednickogNiza, izracunajFormu, razinaVatre, type RezultatForme } from '../src/forma.js';

function rezultati(plasmani: number[], bodovi = 0): RezultatForme[] {
  return plasmani.map((plasman, indeks) => ({
    partijaId: `partija-${indeks}`,
    kraj: `2026-09-${String(25 - indeks).padStart(2, '0')}T12:00:00.000Z`,
    plasman,
    bodovi: bodovi || (5 - plasman),
    eliminacije: 0,
  }));
}

describe('forma igrača', () => {
  it('razlikuje nedostatak podataka, prikupljanje i početnu procjenu', () => {
    expect(izracunajFormu([], 'dva_igraca').status).toBe('nema_podataka');
    expect(izracunajFormu(rezultati([1, 2, 1, 2]), 'dva_igraca').status).toBe('prikupljanje');
    expect(izracunajFormu(rezultati([1, 2, 1, 2, 1]), 'dva_igraca')).toMatchObject({ status: 'pocetna_procjena', naziv: 'Odlična' });
  });

  it('klasificira 1v1 prema nezaokruženom udjelu pobjeda', () => {
    expect(izracunajFormu(rezultati([1, 1, 1, 2, 2, 2, 2, 2, 2, 2]), 'dva_igraca').naziv).toBe('Dobra');
    expect(izracunajFormu(rezultati([1, 1, 1, 1, 1, 2, 2, 2, 2, 2]), 'dva_igraca').naziv).toBe('Odlična');
    expect(izracunajFormu(rezultati([1, 1, 1, 1, 1, 1, 1, 2, 2, 2]), 'dva_igraca').naziv).toBe('Izvanredna');
  });

  it('klasificira četvero prema prosjeku bodova', () => {
    expect(izracunajFormu(rezultati([1, 2, 3, 4, 1, 2, 3, 4, 1, 2], 1.75), 'cetiri_igraca').naziv).toBe('Dobra');
    expect(izracunajFormu(rezultati([1, 2, 3, 4, 1, 2, 3, 4, 1, 2], 2.5), 'cetiri_igraca').naziv).toBe('Odlična');
  });

  it('računa trend iz dva nepovezana prozora od deset rezultata', () => {
    const zadnjihDeset = rezultati([1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
    const prethodnihDeset = rezultati([1, 1, 2, 2, 2, 2, 2, 2, 2, 2]).map((rezultat, indeks) => ({ ...rezultat, partijaId: `stara-${indeks}` }));
    const forma = izracunajFormu([...zadnjihDeset, ...prethodnihDeset], 'dva_igraca');
    expect(forma.trend?.smjer).toBe('gore');
    expect(forma.trend?.razlika).toBeCloseTo(0.4);
  });
});

describe('pobjednički niz', () => {
  it('povećava niz pobjedom, resetira ga porazom i ignorira ponovljeni završetak', () => {
    const pobjeda = azurirajPobjednickiNiz({ trenutniNiz: 2, najboljiNiz: 4, zadnjaObradenaPartijaId: null }, 'partija-1', true);
    expect(pobjeda).toEqual({ trenutniNiz: 3, najboljiNiz: 4, zadnjaObradenaPartijaId: 'partija-1' });
    expect(azurirajPobjednickiNiz(pobjeda, 'partija-1', true)).toEqual(pobjeda);
    expect(azurirajPobjednickiNiz(pobjeda, 'partija-2', false)).toEqual({ trenutniNiz: 0, najboljiNiz: 4, zadnjaObradenaPartijaId: 'partija-2' });
  });

  it('računa bonus po modu i ograničava ga na sto posto', () => {
    expect(bonusPobjednickogNiza(1, 'cetiri_igraca')).toBe(0);
    expect(bonusPobjednickogNiza(3, 'cetiri_igraca')).toBe(20);
    expect(bonusPobjednickogNiza(21, 'dva_igraca')).toBe(100);
  });

  it('računa tri razine vatre po modu', () => {
    expect([0, 2, 3, 5, 8].map((niz) => razinaVatre(niz, 'cetiri_igraca'))).toEqual([0, 0, 1, 2, 3]);
    expect([0, 3, 4, 8, 14].map((niz) => razinaVatre(niz, 'dva_igraca'))).toEqual([0, 0, 1, 2, 3]);
  });
});
