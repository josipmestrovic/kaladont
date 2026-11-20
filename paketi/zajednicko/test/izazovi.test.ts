import { describe, expect, it } from 'vitest';
import {
  brojBotovaZaIzazov,
  definicijaIzazova,
  ID_OVI_IZAZOVA,
  izgradiStavkuKataloga,
  izracunajZvjezdiceIzazivaca,
  jePoznatiProfilBota,
  KATALOG_IZAZOVA,
  nadimakProfilaBota,
  prethodniIzazovId,
  PRAG_DUGE_RIJECI_IZAZOVA,
  validirajKatalogIzazova,
  VERZIJA_DEFINICIJE_IZAZOVA,
  ZADANI_PROFIL_TRENINGA,
} from '../src/izazovi.js';

describe('katalog izazova', () => {
  it('validira svih 24 definicija i ima 15-s razine', () => {
    expect(() => validirajKatalogIzazova()).not.toThrow();
    expect(KATALOG_IZAZOVA).toHaveLength(24);
    expect(ID_OVI_IZAZOVA).toHaveLength(24);
    expect(VERZIJA_DEFINICIJE_IZAZOVA).toBe(1);
    const petnaest = KATALOG_IZAZOVA.filter((d) => d.turnDurationMs === 15_000);
    expect(petnaest.map((d) => d.id)).toEqual(['IZ09', 'IZ14', 'IZ16', 'IZ20']);
  });

  it('koristi shared prag duge riječi (≥10)', () => {
    expect(PRAG_DUGE_RIJECI_IZAZOVA).toBe(10);
  });

  it('IZ22 koristi Majstor i Dokaži; IZ24 traži dokaz', () => {
    const iz22 = definicijaIzazova('IZ22');
    expect(iz22.pravila).toBe('dokazi_nastavak');
    expect(iz22.profileId).toBe('majstor');
    expect(iz22.ciljevi.uspjesanDokaz).toBeUndefined();
    const iz24 = definicijaIzazova('IZ24');
    expect(iz24.ciljevi.uspjesanDokaz).toBe(1);
    expect(brojBotovaZaIzazov(iz24)).toBe(3);
  });

  it('linearni prethodnik i lock ≠ hide', () => {
    expect(prethodniIzazovId('IZ01')).toBeNull();
    expect(prethodniIzazovId('IZ07')).toBe('IZ06');
    const stavka = izgradiStavkuKataloga(definicijaIzazova('IZ07'), { zavrseni: new Set() });
    expect(stavka.status).toBe('zakljucan');
    expect(stavka.blockingChallengeId).toBe('IZ06');
    expect(stavka.naziv).toBe('Pazi kome ostavljaš KA');
    expect(stavka.effectiveProfileId).toBe('iskusni');
  });

  it('otključava sljedeći nakon prethodnog završetka', () => {
    const zavrseni = new Set(['IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06']);
    const stavka = izgradiStavkuKataloga(definicijaIzazova('IZ07'), { zavrseni });
    expect(stavka.status).toBe('dostupan');
    expect(stavka.blockingChallengeId).toBeNull();
  });

  it('računa zvjezdice Izazivača po milestone skupovima', () => {
    expect(izracunajZvjezdiceIzazivaca(new Set())).toBe(0);
    expect(izracunajZvjezdiceIzazivaca(new Set(['IZ01']))).toBe(1);
    expect(izracunajZvjezdiceIzazivaca(new Set(['IZ01', 'IZ02', 'IZ03', 'IZ04', 'IZ05', 'IZ06']))).toBe(2);
    expect(izracunajZvjezdiceIzazivaca(new Set(ID_OVI_IZAZOVA))).toBe(5);
  });

  it('PR02: zadani trening profil i nadimci', () => {
    expect(ZADANI_PROFIL_TRENINGA).toBe('iskusni');
    expect(jePoznatiProfilBota('majstor')).toBe(true);
    expect(jePoznatiProfilBota('xyz')).toBe(false);
    expect(nadimakProfilaBota('velemajstor', 1, 1)).toBe('Velemajstor');
    expect(nadimakProfilaBota('velemajstor', 2, 3)).toBe('Velemajstor 2');
  });
});
