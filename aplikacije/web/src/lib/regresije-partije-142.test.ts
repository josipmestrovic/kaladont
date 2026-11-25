/**
 * Preostali A–F regresijski scenariji kao čiste funkcije (#142 commit 6).
 */
import { describe, expect, it } from 'vitest';
import { stvoriKontrolerSlanjaPoteza } from './kontroler-slanja-poteza.js';
import { odlukaNakonSyncSnimke } from './spremnost-partije.js';
import { klijentSmijeZakljucitiIzBrojaAktivnih, trebaPrimijenitiSnimku } from './verzija-stanja-partije.js';
import { timerAktivanIzSnimke } from './timer-poteza.js';

describe('#142 regresije aktivnih partija', () => {
  it('A02: snimka istog reda ne otključava aktivni zahtjev', () => {
    const k = stvoriKontrolerSlanjaPoteza({ trajanjeCekanjaMs: 0 });
    k.pokreniZahtjev({ partijaId: 'p1', turnToken: 't1', vrsta: 'rijec', rijec: 'auto' });
    k.snimkaIstogReda('p1', 't1');
    expect(k.slanjeUTijeku()).toBe(true);
    expect(k.dohvatiAktivni()?.status).toBe('slanje');
  });

  it('E02: terminalni status dolazi sa snimke, ne lokalnog broja', () => {
    expect(klijentSmijeZakljucitiIzBrojaAktivnih(1)).toBe(false);
    expect(
      trebaPrimijenitiSnimku({
        aktivnaPartijaId: 'p1',
        snimkaPartijaId: 'p1',
        lokalnaVerzija: 3,
        snimkaVerzija: 4,
      }),
    ).toBe('primijeni');
  });

  it('D03: reconnect nakon promjene reda prihvaća snimku', () => {
    expect(
      odlukaNakonSyncSnimke({
        aktivniRequestId: 'r-stari',
        aktivniTurnToken: 't-stari',
        snimkaTurnToken: 't-novi',
        potvrdaZaRequestId: false,
      }),
    ).toBe('prihvati_snimku');
  });

  it('F05: izazov / privatni rok — timerAktivan iz snimke', () => {
    expect(
      timerAktivanIzSnimke({
        timerAktivan: true,
        istekPotezaIso: '2099-01-01T00:00:00.000Z',
        trajanjePotezaSek: 15,
        faza: 'obican_potez',
      }),
    ).toBe(true);
    expect(
      timerAktivanIzSnimke({
        timerAktivan: false,
        istekPotezaIso: null,
        trajanjePotezaSek: 30,
        faza: 'dokaz_nastavka',
      }),
    ).toBe(false);
  });
});
