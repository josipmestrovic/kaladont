import { describe, expect, it, vi } from 'vitest';
import { BotKontroler } from '../src/bot/kontroler.js';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import {
  DODATNA_ODGODA_REAKCIJE_MS,
  MINIMALNA_ODGODA_REAKCIJE_MS,
  odaberiReakcijuNaPocetku,
  odaberiReakcijuPriEliminacijiProtivnika,
  odaberiReakcijuPriIspadanju,
  odgodaReakcijeMs,
} from '../src/bot/reakcije.js';
import type { RjecnikUMemoriji } from '../src/rjecnik/ucitaj.js';

describe('bot reakcije — odabir', () => {
  const konfig = {
    ...ZADANA_KONFIGURACIJA_BOTA,
    vjerojatnostReakcijePozdravNaPocetku: 0.2,
    vjerojatnostReakcijeSorryPriEliminaciji: 0.3,
    vjerojatnostReakcijeBravoPriIspadanju: 0.1,
    vjerojatnostReakcijeHvalaPriIspadanju: 0.05,
  };

  it('odgoda je 2 s + nasumično 0–3 s (uključivo)', () => {
    expect(odgodaReakcijeMs(() => 0)).toBe(MINIMALNA_ODGODA_REAKCIJE_MS);
    expect(odgodaReakcijeMs(() => (DODATNA_ODGODA_REAKCIJE_MS + 0.5) / (DODATNA_ODGODA_REAKCIJE_MS + 1))).toBe(
      MINIMALNA_ODGODA_REAKCIJE_MS + DODATNA_ODGODA_REAKCIJE_MS,
    );
    expect(odgodaReakcijeMs(() => 0.5)).toBe(MINIMALNA_ODGODA_REAKCIJE_MS + Math.floor(0.5 * (DODATNA_ODGODA_REAKCIJE_MS + 1)));
  });

  it('pozdrav i sorry po pragu; ispadanje je međusobno isključivo', () => {
    expect(odaberiReakcijuNaPocetku(konfig, () => 0.19)).toBe('pozdrav');
    expect(odaberiReakcijuNaPocetku(konfig, () => 0.2)).toBeNull();
    expect(odaberiReakcijuPriEliminacijiProtivnika(konfig, () => 0.29)).toBe('sorry');
    expect(odaberiReakcijuPriEliminacijiProtivnika(konfig, () => 0.3)).toBeNull();
    expect(odaberiReakcijuPriIspadanju(konfig, () => 0.05)).toBe('dobro-odigrano');
    expect(odaberiReakcijuPriIspadanju(konfig, () => 0.12)).toBe('najjaci');
    expect(odaberiReakcijuPriIspadanju(konfig, () => 0.2)).toBeNull();
  });
});

describe('bot reakcije — kontroler', () => {
  const prazanRjecnik = {
    igriviKandidati: () => [],
    grupeZa: () => [],
    verzijaRjecnika: () => 1,
    frekvencijaZa: () => null,
  } as unknown as Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika'> & { frekvencijaZa(rijec: string): number | null };

  it('zakazuje različite odgode i šalje reakcije samo u javnoj partiji', () => {
    const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
    const zakazano: { ms: number; posao: () => void }[] = [];
    let roll = 0;
    const rng = () => {
      // po botu: roll odabira (p=1 pa je ionako da) pa roll odgode
      const vrijednosti = [0.5, 0.0, 0.5, 0.99];
      return vrijednosti[Math.min(roll++, vrijednosti.length - 1)]!;
    };
    const kontroler = new BotKontroler({
      rjecnik: prazanRjecnik,
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      posaljiReakciju: (partijaId, igracId, poruka) => {
        poslano.push({ partijaId, igracId, poruka });
        return true;
      },
      konfiguracija: {
        ...ZADANA_KONFIGURACIJA_BOTA,
        vjerojatnostReakcijePozdravNaPocetku: 1,
        vjerojatnostReakcijeSorryPriEliminaciji: 1,
        vjerojatnostReakcijeBravoPriIspadanju: 1,
        vjerojatnostReakcijeHvalaPriIspadanju: 0,
      },
      rng,
      zakazi: (posao, ms) => {
        zakazano.push({ ms, posao });
        return { ref: zakazano.length } as unknown as NodeJS.Timeout;
      },
      otkazi: vi.fn(),
    });

    kontroler.naPocetakPartije('p1', 'trening', ['bot-a']);
    expect(zakazano).toHaveLength(0);

    kontroler.naPocetakPartije('p1', 'javna', ['bot-a', 'bot-b']);
    expect(zakazano).toHaveLength(2);
    expect(zakazano.every((z) => z.ms >= MINIMALNA_ODGODA_REAKCIJE_MS && z.ms <= MINIMALNA_ODGODA_REAKCIJE_MS + DODATNA_ODGODA_REAKCIJE_MS)).toBe(true);
    expect(zakazano[0]!.ms).not.toBe(zakazano[1]!.ms);

    for (const z of zakazano) z.posao();
    expect(poslano).toEqual([
      { partijaId: 'p1', igracId: 'bot-a', poruka: 'pozdrav' },
      { partijaId: 'p1', igracId: 'bot-b', poruka: 'pozdrav' },
    ]);

    roll = 0;
    zakazano.length = 0;
    poslano.length = 0;
    const rngElim = (() => {
      let i = 0;
      const vrijednosti = [0.0, 0.0, 0.0, 0.5]; // sorry da + odgoda; bravo da + odgoda
      return () => vrijednosti[Math.min(i++, vrijednosti.length - 1)]!;
    })();
    const kontrolerElim = new BotKontroler({
      rjecnik: prazanRjecnik,
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      posaljiReakciju: (partijaId, igracId, poruka) => {
        poslano.push({ partijaId, igracId, poruka });
        return true;
      },
      konfiguracija: {
        ...ZADANA_KONFIGURACIJA_BOTA,
        vjerojatnostReakcijeSorryPriEliminaciji: 1,
        vjerojatnostReakcijeBravoPriIspadanju: 1,
        vjerojatnostReakcijeHvalaPriIspadanju: 0,
      },
      rng: rngElim,
      zakazi: (posao, ms) => {
        zakazano.push({ ms, posao });
        return { ref: zakazano.length } as unknown as NodeJS.Timeout;
      },
      otkazi: vi.fn(),
    });
    kontrolerElim.naEliminaciju('p2', 'javna', 'bot-zrtva', 'bot-napadac', [
      { igracId: 'bot-zrtva', upravljac: 'bot' },
      { igracId: 'bot-napadac', upravljac: 'bot' },
      { igracId: 'covjek', upravljac: 'covjek' },
    ]);
    expect(zakazano).toHaveLength(2);
    for (const z of zakazano) z.posao();
    expect(poslano).toEqual([
      { partijaId: 'p2', igracId: 'bot-napadac', poruka: 'sorry' },
      { partijaId: 'p2', igracId: 'bot-zrtva', poruka: 'dobro-odigrano' },
    ]);
  });
});
