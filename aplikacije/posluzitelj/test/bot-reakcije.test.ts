import { describe, expect, it, vi } from 'vitest';
import { BotKontroler } from '../src/bot/kontroler.js';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import {
  DODATNA_ODGODA_REAKCIJE_MS,
  MINIMALNA_ODGODA_REAKCIJE_MS,
  POOL_BRAVO,
  POOL_POZDRAV,
  POOL_SORRY,
  odaberiReakcijuNaPocetku,
  odaberiReakcijuPriEliminacijiProtivnika,
  odaberiReakcijuPriIspadanju,
  odgodaReakcijeMs,
} from '../src/bot/reakcije.js';
import type { RjecnikUMemoriji } from '../src/rjecnik/ucitaj.js';

describe('bot reakcije — odabir', () => {
  it('odgoda je baza + nasumično 0–1 s (uključivo)', () => {
    expect(odgodaReakcijeMs(() => 0)).toBe(MINIMALNA_ODGODA_REAKCIJE_MS);
    expect(odgodaReakcijeMs(() => (DODATNA_ODGODA_REAKCIJE_MS + 0.5) / (DODATNA_ODGODA_REAKCIJE_MS + 1))).toBe(
      MINIMALNA_ODGODA_REAKCIJE_MS + DODATNA_ODGODA_REAKCIJE_MS,
    );
    expect(odgodaReakcijeMs(() => 0.5, { odgodaReakcijeMinMs: 2_500 })).toBe(
      2_500 + Math.floor(0.5 * (DODATNA_ODGODA_REAKCIJE_MS + 1)),
    );
  });

  it('obvezni poolovi: pozdrav / sorry / bravo', () => {
    expect(POOL_POZDRAV).toContain(odaberiReakcijuNaPocetku(() => 0));
    expect(POOL_POZDRAV).toContain(odaberiReakcijuNaPocetku(() => 0.99));
    expect(POOL_SORRY).toContain(odaberiReakcijuPriEliminacijiProtivnika(() => 0));
    expect(POOL_SORRY).toContain(odaberiReakcijuPriEliminacijiProtivnika(() => 0.99));
    expect(POOL_BRAVO).toContain(odaberiReakcijuPriIspadanju(() => 0));
    expect(POOL_BRAVO).toContain(odaberiReakcijuPriIspadanju(() => 0.99));
  });
});

describe('bot reakcije — kontroler', () => {
  const prazanRjecnik = {
    igriviKandidati: () => [],
    grupeZa: () => [],
    verzijaRjecnika: () => 1,
    frekvencijaZa: () => null,
  } as unknown as Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika'> & { frekvencijaZa(rijec: string): number | null };

  function stvoriKontroler(opts: {
    poslano: { partijaId: string; igracId: string; poruka: string }[];
    zakazano: { ms: number; posao: () => void }[];
    rngPrezentacije?: () => number;
  }) {
    let roll = 0;
    const vrijednosti = [0, 0.5, 0.99, 0.25, 0.75, 0.1, 0.9];
    const rngPrezentacije = opts.rngPrezentacije ?? (() => vrijednosti[Math.min(roll++, vrijednosti.length - 1)]!);
    return new BotKontroler({
      rjecnik: prazanRjecnik,
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      posaljiReakciju: (partijaId, igracId, poruka) => {
        opts.poslano.push({ partijaId, igracId, poruka });
        return true;
      },
      konfiguracija: { ...ZADANA_KONFIGURACIJA_BOTA },
      rng: () => 0.5,
      rngPrezentacije,
      zakazi: (posao, ms) => {
        opts.zakazano.push({ ms, posao });
        return { ref: opts.zakazano.length } as unknown as NodeJS.Timeout;
      },
      otkazi: vi.fn(),
    });
  }

  it('zakazuje pozdrave u javnoj, privatnoj i trening partiji', () => {
    for (const kontekst of ['javna', 'privatna', 'trening'] as const) {
      const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
      const zakazano: { ms: number; posao: () => void }[] = [];
      const kontroler = stvoriKontroler({ poslano, zakazano });
      kontroler.naPocetakPartije('p1', kontekst, ['bot-a', 'bot-b']);
      expect(zakazano).toHaveLength(2);
      expect(zakazano.every((z) => z.ms >= MINIMALNA_ODGODA_REAKCIJE_MS && z.ms <= MINIMALNA_ODGODA_REAKCIJE_MS + DODATNA_ODGODA_REAKCIJE_MS)).toBe(true);
      for (const z of zakazano) z.posao();
      expect(poslano).toHaveLength(2);
      expect(poslano.every((p) => (POOL_POZDRAV as readonly string[]).includes(p.poruka))).toBe(true);
      // dedup: drugi poziv ne dodaje nove pozdrave
      const prije = zakazano.length;
      kontroler.naPocetakPartije('p1', kontekst, ['bot-a', 'bot-b']);
      expect(zakazano).toHaveLength(prije);
    }
  });

  it('eliminacija: sorry + bravo kad postoji zaslužni; tišina bez bodZa', () => {
    const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
    const zakazano: { ms: number; posao: () => void }[] = [];
    const kontroler = stvoriKontroler({ poslano, zakazano });
    kontroler.naEliminaciju('p2', 'javna', 'bot-zrtva', 'bot-napadac', [
      { igracId: 'bot-zrtva', upravljac: 'bot' },
      { igracId: 'bot-napadac', upravljac: 'bot' },
      { igracId: 'covjek', upravljac: 'covjek' },
    ], 'p2:1');
    expect(zakazano).toHaveLength(2);
    for (const z of zakazano) z.posao();
    expect(poslano).toEqual([
      expect.objectContaining({ partijaId: 'p2', igracId: 'bot-napadac', poruka: expect.any(String) }),
      expect.objectContaining({ partijaId: 'p2', igracId: 'bot-zrtva', poruka: expect.any(String) }),
    ]);
    expect((POOL_SORRY as readonly string[]).includes(poslano[0]!.poruka)).toBe(true);
    expect((POOL_BRAVO as readonly string[]).includes(poslano[1]!.poruka)).toBe(true);

    poslano.length = 0;
    zakazano.length = 0;
    kontroler.naEliminaciju('p3', 'trening', 'bot-sam', null, [
      { igracId: 'bot-sam', upravljac: 'bot' },
    ], 'p3:1');
    expect(zakazano).toHaveLength(0);
    expect(poslano).toHaveLength(0);
  });

  it('cooldown pomiče drugu reakciju istog bota', () => {
    const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
    const zakazano: { ms: number; posao: () => void }[] = [];
    const t = 0;
    const kontroler = new BotKontroler({
      rjecnik: prazanRjecnik,
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      posaljiReakciju: (partijaId, igracId, poruka) => {
        poslano.push({ partijaId, igracId, poruka });
        return true;
      },
      konfiguracija: { ...ZADANA_KONFIGURACIJA_BOTA, odgodaReakcijeMinMs: 2_000 },
      rng: () => 0,
      rngPrezentacije: () => 0,
      sada: () => t,
      zakazi: (posao, ms) => {
        zakazano.push({ ms, posao });
        return { ref: zakazano.length } as unknown as NodeJS.Timeout;
      },
      otkazi: vi.fn(),
    });
    kontroler.naPocetakPartije('p4', 'javna', ['bot-a']);
    expect(zakazano[0]!.ms).toBe(2_000);
    // Ista bot eliminira — druga poruka mora čekati cooldown nakon prve.
    kontroler.naEliminaciju('p4', 'javna', 'covjek', 'bot-a', [
      { igracId: 'bot-a', upravljac: 'bot' },
      { igracId: 'covjek', upravljac: 'covjek' },
    ], 'p4:1');
    expect(zakazano).toHaveLength(2);
    expect(zakazano[1]!.ms).toBeGreaterThanOrEqual(4_000);
  });
});
