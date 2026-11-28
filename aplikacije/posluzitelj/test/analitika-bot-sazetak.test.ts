import { describe, expect, it } from 'vitest';
import type { RazlogEliminacije } from 'zajednicko';
import {
  mapirajRazlogEliminacijeZaAnalitiku,
  sazetakBotAnalitikeIzStanja,
} from '../src/analitika/bot-sazetak.js';
import type { SnimkaBotovaPocetka } from '../src/analitika/igre.js';

const snimka: SnimkaBotovaPocetka = {
  brojLjudi: 1,
  brojBotova: 2,
  profilBotova: 'iskusni',
  verzijaBotPolitike: 8,
  verzijaProfilaBota: 3,
};

function sudionici(ids: { covjek: string; botovi: string[] }) {
  return [
    { igracId: ids.covjek, upravljac: 'covjek' as const },
    ...ids.botovi.map((igracId) => ({ igracId, upravljac: 'bot' as const })),
  ];
}

describe('sazetakBotAnalitikeIzStanja', () => {
  it('mapira stvarne razloge mrtvih slova bez nepoznatog', () => {
    expect(mapirajRazlogEliminacijeZaAnalitiku('mrtva_slova_baza')).toBe('mrtva_slova');
    expect(mapirajRazlogEliminacijeZaAnalitiku('mrtva_slova_iskoristeno')).toBe('mrtva_slova');
    expect(mapirajRazlogEliminacijeZaAnalitiku('ne_znam')).toBe('ne_znam');
  });

  it('rani završetak treninga: stvarna ljudska eliminacija, bez fiktivnih bot eliminacija', () => {
    const covjek = 'covjek-1';
    const botA = 'bot-a';
    const botB = 'bot-b';
    // Kao nakon sabijPreostaleZaRaniStop: čovjek + jedan bot u eliminirani, jedan bot aktivan,
    // ali razlog postoji samo za stvarno eliminiranog čovjeka.
    const razlozi = new Map<string, RazlogEliminacije>([[covjek, 'ne_znam']]);
    const sazetak = sazetakBotAnalitikeIzStanja({
      ishod: 'zavrsena',
      analitikaBotSnimka: snimka,
      aktivni: new Set([botA]),
      sudionici: sudionici({ covjek, botovi: [botA, botB] }),
      razloziEliminacije: razlozi,
    });

    expect(sazetak.eliminacijeLjudi.ne_znam).toBe(1);
    expect(sazetak.eliminacijeLjudi.mrtva_slova).toBe(0);
    expect(sazetak.eliminacijeBotova.mrtva_slova).toBe(0);
    expect(sazetak.eliminacijeBotova.ne_znam).toBe(0);
    expect(
      Object.values(sazetak.eliminacijeBotova).reduce((a, b) => a + b, 0),
    ).toBe(0);
    expect(sazetak.vrstaPobjednika).toBe('bot');
  });

  it('terminal izazova bez standardnog razloga: čovjek u eliminirani ne ulazi kao mrtva slova', () => {
    const covjek = 'covjek-1';
    const botA = 'bot-a';
    const botB = 'bot-b';
    // forsajTerminalIzazova: čovjek u eliminirani, botovi sabijeni, bez razloziEliminacije.
    const sazetak = sazetakBotAnalitikeIzStanja({
      ishod: 'zavrsena',
      analitikaBotSnimka: snimka,
      aktivni: new Set([botA]),
      sudionici: sudionici({ covjek, botovi: [botA, botB] }),
      razloziEliminacije: new Map(),
    });

    expect(sazetak.eliminacijeLjudi.mrtva_slova).toBe(0);
    expect(sazetak.eliminacijeLjudi.nepoznato).toBe(0);
    expect(Object.values(sazetak.eliminacijeLjudi).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Object.values(sazetak.eliminacijeBotova).reduce((a, b) => a + b, 0)).toBe(0);
    expect(sazetak.vrstaPobjednika).toBe('bot');
  });

  it('broji stvarnu bot eliminaciju i zanemaruje fiktivnog preostalog bota', () => {
    const covjek = 'covjek-1';
    const botA = 'bot-a';
    const botB = 'bot-b';
    const razlozi = new Map<string, RazlogEliminacije>([
      [botA, 'istek'],
      [covjek, 'kaladont'],
    ]);
    const sazetak = sazetakBotAnalitikeIzStanja({
      ishod: 'zavrsena',
      analitikaBotSnimka: { ...snimka, brojBotova: 2 },
      aktivni: new Set([botB]),
      sudionici: sudionici({ covjek, botovi: [botA, botB] }),
      razloziEliminacije: razlozi,
    });

    expect(sazetak.eliminacijeBotova.istek).toBe(1);
    expect(sazetak.eliminacijeBotova.mrtva_slova).toBe(0);
    expect(sazetak.eliminacijeLjudi.kaladont).toBe(1);
    expect(sazetak.vrstaPobjednika).toBe('bot');
  });

  it('prekinuta igra nema pobjednika', () => {
    const covjek = 'covjek-1';
    const botA = 'bot-a';
    const sazetak = sazetakBotAnalitikeIzStanja({
      ishod: 'prekinuta',
      analitikaBotSnimka: { ...snimka, brojBotova: 1 },
      aktivni: new Set([covjek, botA]),
      sudionici: sudionici({ covjek, botovi: [botA] }),
      razloziEliminacije: new Map(),
    });
    expect(sazetak.vrstaPobjednika).toBeNull();
  });
});
