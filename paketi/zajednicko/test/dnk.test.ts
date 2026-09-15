import { describe, expect, it } from 'vitest';
import { izracunajDnkTier, izracunajKaladontDnk, jeDnkOtkljucan } from '../src/dnk.js';
import { izracunajRang } from '../src/rangovi.js';

describe('DNK zajednicko', () => {
  it('vraća ispravne granice tierova i vrijednosti', () => {
    expect(izracunajDnkTier(0, [{ min: 0, max: 10, naziv: 'A', oznaka: 'A' }])).toBe(1);
    expect(izracunajDnkTier(10, [{ min: 0, max: 10, naziv: 'A', oznaka: 'A' }])).toBe(1);
    expect(izracunajDnkTier(100, [{ min: 50, max: 100, naziv: 'B', oznaka: 'B' }])).toBe(1);
    expect(izracunajDnkTier(50, [{ min: 0, max: 50, naziv: 'A', oznaka: 'A' }, { min: 51, max: 100, naziv: 'B', oznaka: 'B' }])).toBe(1);
  });

  it('otkljucavanje DNK ovisi o broju javnih partija', () => {
    expect(jeDnkOtkljucan(9)).toBe(false);
    expect(jeDnkOtkljucan(10)).toBe(true);
    expect(jeDnkOtkljucan(11)).toBe(true);
  });

  it('računa profil za 4 igrača i 1v1 odvojeno', () => {
    const cetiri = izracunajKaladontDnk({
      mod: 'cetiri_igraca',
      odigrano: 10,
      prosjekBodova: 4.5,
      eliminacijePoPartiji: 1.2,
      najduziStreak: 7,
      prosjekPrihvacenogPotezaMs: 6000,
      ponderiraneDuge: 1.1,
      ponderiraneRijetke: 0.3,
    });
    const dvoja = izracunajKaladontDnk({
      mod: 'dva_igraca',
      odigrano: 10,
      prosjekBodova: 0.7,
      eliminacijePoPartiji: 0.6,
      najduziStreak: 5,
      prosjekPrihvacenogPotezaMs: 5000,
      ponderiraneDuge: 0.9,
      ponderiraneRijetke: 0.2,
    });

    expect(cetiri.mod).toBe('cetiri_igraca');
    expect(dvoja.mod).toBe('dva_igraca');
    expect(cetiri.otkljucan).toBe(true);
    expect(dvoja.otkljucan).toBe(true);
    expect(cetiri.osi.length).toBe(6);
    expect(dvoja.osi.length).toBe(6);
    expect(cetiri.osi.every((os) => os.vrijednost >= 0 && os.vrijednost <= 100)).toBe(true);
    expect(dvoja.osi.every((os) => os.vrijednost >= 0 && os.vrijednost <= 100)).toBe(true);
  });

  it('koristi Dobricu i snižene pragove taktike', () => {
    const profil = (eliminacijePoPartiji: number, mod: 'cetiri_igraca' | 'dva_igraca') => izracunajKaladontDnk({
      mod,
      odigrano: 10,
      eliminacijePoPartiji,
    });

    expect(profil(0.25, 'cetiri_igraca').osi.find((os) => os.kljuc === 'taktika')?.oznaka).toBe('Dobrica');
    expect(profil(0.5, 'cetiri_igraca').osi.find((os) => os.kljuc === 'taktika')?.oznaka).toBe('Taktičar');
    expect(profil(0.45, 'dva_igraca').osi.find((os) => os.kljuc === 'taktika')?.oznaka).toBe('Napadač');
    expect(profil(0.65, 'dva_igraca').osi.find((os) => os.kljuc === 'taktika')?.oznaka).toBe('Agresivac');
  });
});

describe('1v1 rangovi', () => {
  it('1v1 Kaladont je moguć i Piskaralo ne otključava rang', () => {
    expect(izracunajRang(10, 0.89, 'dva_igraca')).toBe('Kaladont');
    expect(izracunajRang(9, 1.5, 'dva_igraca')).toBe('Piskaralo');
    expect(izracunajRang(10, 0.4, 'dva_igraca')).toBe('Jezičar');
  });
});
