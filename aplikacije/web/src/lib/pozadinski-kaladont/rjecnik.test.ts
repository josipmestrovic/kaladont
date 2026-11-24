import { describe, expect, it } from 'vitest';
import { grafemi, jeDopustenOblikRijeci, prvaDva, zadnjaDva } from 'zajednicko';
import { izgradiIndeks } from './indeks-rijeci.js';
import { BROJ_RIJECI_U_FONDU, POSEDNA_RIJEC_KALADONT, POZADINSKI_FOND } from './rjecnik.js';

describe('pozadinski rječnik', () => {
  it('ima dovoljno riječi za kontinuirano igranje', () => {
    expect(BROJ_RIJECI_U_FONDU).toBeGreaterThanOrEqual(300);
    expect(BROJ_RIJECI_U_FONDU).toBe(POZADINSKI_FOND.length);
  });

  it('normalizira i dopušta samo hrvatske grafeme', () => {
    for (const stavka of POZADINSKI_FOND) {
      expect(stavka.rijec).toBe(stavka.rijec.normalize('NFC').toLowerCase());
      expect(jeDopustenOblikRijeci(stavka.rijec)).toBe(true);
      expect(grafemi(stavka.rijec).length).toBeGreaterThanOrEqual(2);
      expect(stavka.grupe.length).toBeGreaterThan(0);
    }
  });

  it('ne sadrži posebnu riječ kaladont u običnom fondu', () => {
    expect(POZADINSKI_FOND.some((s) => s.rijec === POSEDNA_RIJEC_KALADONT)).toBe(false);
  });

  it('indeksira sve riječi po početnim grafemima', () => {
    const indeks = izgradiIndeks(POZADINSKI_FOND);
    expect(indeks.sve.length).toBe(POZADINSKI_FOND.length);

    for (const stavka of indeks.sve) {
      expect(stavka.pocetak).toBe(prvaDva(stavka.rijec));
      expect(stavka.nastavak).toBe(zadnjaDva(stavka.rijec));
      const lista = indeks.poPocetku.get(stavka.pocetak) ?? [];
      expect(lista.some((x) => x.rijec === stavka.rijec)).toBe(true);
    }
  });

  it('obrađuje digrafe i iznimke kroz zajedničke funkcije', () => {
    expect(grafemi('njiva')[0]).toBe('nj');
    expect(prvaDva('njiva')).toBe('nji');
    expect(grafemi('ljubav')[0]).toBe('lj');
    expect(grafemi('džep')[0]).toBe('dž');
    expect(prvaDva('injekcija')).toBe('in');
  });

  it('sadrži riječi iz specifikacijskih lanaca', () => {
    const skup = new Set(POZADINSKI_FOND.map((s) => s.rijec));
    for (const rijec of [
      'ajvar',
      'arhitektura',
      'raketa',
      'tava',
      'vatra',
      'rakija',
      'jabuka',
      'more',
      'remen',
      'energija',
      'jakna',
      'naranča',
      'čarapa',
      'patka',
    ]) {
      expect(skup.has(rijec)).toBe(true);
    }
  });
});
