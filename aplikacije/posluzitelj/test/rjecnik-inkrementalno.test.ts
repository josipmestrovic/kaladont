import { describe, expect, it } from 'vitest';
import { ucitajRjecnik } from '../src/rjecnik/ucitaj.js';

describe('inkrementalne izmjene rječnika', () => {
  it(
    'primijeniUbaci/Uklanjanje ažurira kolekcijske, rijetke i duge brojače',
    async () => {
      const rjecnik = await ucitajRjecnik();
      const prijeKolekcija = rjecnik.brojKolekcijskihGrupa();
      const prijeRijetkih = rjecnik.brojRijetkihOblika();
      const prijeDugih = rjecnik.brojDugihOblika();
      const prijeCiljevi = rjecnik.ciljeviRijeci();
      const rijec = 'zzzzzzzzzzzzzza';

      rjecnik.primijeniUbaci({
        rijec,
        prvaDva: 'zz',
        vrste: ['imenica'],
        grupe: [`imenica:${rijec}`],
        frekvencija: 0,
      });

      expect(rjecnik.jePostojecaRijec(rijec)).toBe(true);
      expect(rjecnik.brojKolekcijskihGrupa()).toBe(prijeKolekcija + 1);
      expect(rjecnik.brojRijetkihOblika()).toBe(prijeRijetkih + 1);
      expect(rjecnik.brojDugihOblika()).toBe(prijeDugih + 1);
      expect(rjecnik.ciljeviRijeci().rijetke.jaka).toBe(prijeCiljevi.rijetke.jaka + 1);
      expect(rjecnik.ciljeviRijeci().duge.jaka).toBe(prijeCiljevi.duge.jaka + 1);

      rjecnik.primijeniUklanjanje(rijec);

      expect(rjecnik.jePostojecaRijec(rijec)).toBe(false);
      expect(rjecnik.brojKolekcijskihGrupa()).toBe(prijeKolekcija);
      expect(rjecnik.brojRijetkihOblika()).toBe(prijeRijetkih);
      expect(rjecnik.brojDugihOblika()).toBe(prijeDugih);
      expect(rjecnik.ciljeviRijeci().rijetke.jaka).toBe(prijeCiljevi.rijetke.jaka);
      expect(rjecnik.ciljeviRijeci().duge.jaka).toBe(prijeCiljevi.duge.jaka);
    },
    120_000,
  );
});
