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
  odgodaPocetnogPozdravaMs,
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

  it('početni pozdravi: javna od 1. runde, stol tijekom odbrojavanja', () => {
    expect(odgodaPocetnogPozdravaMs('javna', 0, () => 0)).toBe(1_000);
    expect(odgodaPocetnogPozdravaMs('javna', 0, () => 0.999)).toBe(1_500);
    expect(odgodaPocetnogPozdravaMs('javna', 1, () => 0)).toBe(2_150);
    expect(odgodaPocetnogPozdravaMs('trening', 0, () => 0)).toBe(500);
    expect(odgodaPocetnogPozdravaMs('privatna', 1, () => 0)).toBe(1_200);
    expect(odgodaPocetnogPozdravaMs('izazov', 0, () => 0.999)).toBe(1_000);
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
    imaSlobodnuRijecNa: () => false,
    jeIgrivaRijec: () => false,
    repertoarBotova: () => ({ generacija: 1, poPrefiksu: new Map() }),
  } as unknown as Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika' | 'imaSlobodnuRijecNa' | 'jeIgrivaRijec' | 'repertoarBotova'> & { frekvencijaZa(rijec: string): number | null };

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

  it('privatna/trening/izazov: pozdravi odmah na najavi (stolni raspored)', () => {
    for (const kontekst of ['privatna', 'trening', 'izazov'] as const) {
      const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
      const zakazano: { ms: number; posao: () => void }[] = [];
      const kontroler = stvoriKontroler({ poslano, zakazano });
      kontroler.naPocetakPartije('p1', kontekst, ['bot-a', 'bot-b']);
      expect(zakazano).toHaveLength(2);
      expect(zakazano[0]!.ms).toBeGreaterThanOrEqual(500);
      expect(zakazano[0]!.ms).toBeLessThanOrEqual(1_000);
      expect(zakazano[1]!.ms).toBeGreaterThanOrEqual(1_000);
      expect(zakazano[1]!.ms).toBeLessThanOrEqual(3_500);
      for (const z of zakazano) z.posao();
      expect(poslano).toHaveLength(2);
      expect(poslano.every((p) => (POOL_POZDRAV as readonly string[]).includes(p.poruka))).toBe(true);
      const prije = zakazano.length;
      kontroler.naPocetakPartije('p1', kontekst, ['bot-a', 'bot-b']);
      expect(zakazano).toHaveLength(prije);
    }
  });

  it('javna: pozdravi tek nakon otvaranja prve runde', () => {
    const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
    const zakazano: { ms: number; posao: () => void }[] = [];
    const kontroler = stvoriKontroler({ poslano, zakazano });
    kontroler.naPocetakPartije('p-javna', 'javna', ['bot-a', 'bot-b']);
    expect(zakazano).toHaveLength(0);
    kontroler.naPromjenuPoteza({
      partijaId: 'p-javna',
      kontekst: 'javna',
      turnToken: 't1',
      naPotezuId: 'covjek',
      trazenaSlova: 'ka',
      izborUToku: false,
      zavrsena: false,
      istekPotezaMs: null,
      trajanjePotezaMs: 30_000,
      pocetakPotezaMs: 0,
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: true },
        { igracId: 'bot-a', upravljac: 'bot', aktivan: true },
        { igracId: 'bot-b', upravljac: 'bot', aktivan: true },
      ],
      dokaz: null,
      pravila: 'klasicna',
    } as never);
    expect(zakazano).toHaveLength(2);
    expect(zakazano[0]!.ms).toBeGreaterThanOrEqual(1_000);
    expect(zakazano[0]!.ms).toBeLessThanOrEqual(1_500);
    expect(zakazano[1]!.ms).toBeGreaterThanOrEqual(2_000);
    for (const z of zakazano) z.posao();
    expect(poslano).toHaveLength(2);
    // drugi turn ne ponavlja pozdrave (smije zakazati potez bota)
    poslano.length = 0;
    zakazano.length = 0;
    kontroler.naPromjenuPoteza({
      partijaId: 'p-javna',
      kontekst: 'javna',
      turnToken: 't2',
      naPotezuId: 'covjek',
      trazenaSlova: 'la',
      izborUToku: false,
      zavrsena: false,
      istekPotezaMs: null,
      trajanjePotezaMs: 30_000,
      pocetakPotezaMs: 0,
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: true },
        { igracId: 'bot-a', upravljac: 'bot', aktivan: true },
        { igracId: 'bot-b', upravljac: 'bot', aktivan: true },
      ],
      dokaz: null,
      pravila: 'klasicna',
    } as never);
    expect(zakazano).toHaveLength(0);
    expect(poslano).toHaveLength(0);
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
    kontroler.naPocetakPartije('p4', 'privatna', ['bot-a']);
    expect(zakazano[0]!.ms).toBe(500);
    // Ista bot eliminira — druga poruka mora čekati cooldown nakon prve.
    kontroler.naEliminaciju('p4', 'privatna', 'covjek', 'bot-a', [
      { igracId: 'bot-a', upravljac: 'bot' },
      { igracId: 'covjek', upravljac: 'covjek' },
    ], 'p4:1');
    expect(zakazano).toHaveLength(2);
    expect(zakazano[1]!.ms).toBeGreaterThanOrEqual(2_500);
  });

  it('odbijena reakcija zbog cooldowna se jednom ponavlja', () => {
    const poslano: { partijaId: string; igracId: string; poruka: string }[] = [];
    const zakazano: { ms: number; posao: () => void }[] = [];
    let pokusaji = 0;
    const kontroler = new BotKontroler({
      rjecnik: prazanRjecnik,
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      posaljiReakciju: (partijaId, igracId, poruka) => {
        pokusaji += 1;
        if (pokusaji === 1) return false;
        poslano.push({ partijaId, igracId, poruka });
        return true;
      },
      konfiguracija: { ...ZADANA_KONFIGURACIJA_BOTA, odgodaReakcijeMinMs: 0 },
      rng: () => 0,
      rngPrezentacije: () => 0,
      sada: () => 0,
      zakazi: (posao, ms) => {
        zakazano.push({ ms, posao });
        return { ref: zakazano.length } as unknown as NodeJS.Timeout;
      },
      otkazi: vi.fn(),
    });
    kontroler.naPocetakPartije('p5', 'privatna', ['bot-a']);
    expect(zakazano).toHaveLength(1);
    zakazano[0]!.posao();
    expect(poslano).toHaveLength(0);
    expect(zakazano).toHaveLength(2);
    expect(zakazano[1]!.ms).toBe(2_000);
    zakazano[1]!.posao();
    expect(poslano).toHaveLength(1);
  });
});
