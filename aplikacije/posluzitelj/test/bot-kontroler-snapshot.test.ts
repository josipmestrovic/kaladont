import { describe, expect, it } from 'vitest';
import { BotKontroler } from '../src/bot/kontroler.js';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import { razrijesiProfilBota } from '../src/bot/profili-bota.js';

describe('BotKontroler per-partija snapshot (PR02)', () => {
  it('eksplicitni snapshoti ostaju izolirani od globalne mutacije i međusobno', () => {
    const globalna = structuredClone(ZADANA_KONFIGURACIJA_BOTA);
    const kontroler = new BotKontroler({
      rjecnik: {
        igriviKandidati: () => [],
        grupeZa: () => [],
        verzijaRjecnika: 1,
        imaSlobodnuRijecNa: () => false,
        repertoarBotova: () => ({}) as never,
        pooloviBotova: () => ({
          generacija: 0,
          verzijaRjecnika: 1,
          poPrefiksu: new Map(),
          clanovi: new Set(),
          pool1Clanovi: new Set(),
          pool2Clanovi: new Set(),
        }),
        jeIgrivaRijec: () => false,
        frekvencijaZa: () => 0,
      },
      izvrsiNaredbu: () => ({ ishod: 'ignoriran', razlog: 'nema_partije' }),
      konfiguracija: globalna,
    });

    const iskusni = razrijesiProfilBota('iskusni').konfiguracija;
    const majstor = razrijesiProfilBota('majstor').konfiguracija;
    kontroler.postaviKonfiguracijuPartije('p-iskusni', iskusni);
    kontroler.postaviKonfiguracijuPartije('p-majstor', majstor);

    globalna.vjerojatnostAgresivnosti = 0.99;
    expect(kontroler.dohvatiKonfiguracijuPartije('p-iskusni')?.vjerojatnostAgresivnosti).toBe(0.3);
    expect(kontroler.dohvatiKonfiguracijuPartije('p-majstor')?.vjerojatnostAgresivnosti).toBe(0.6);

    // Mutacija vraćene kopije ne dira internu mapu.
    const kopija = kontroler.dohvatiKonfiguracijuPartije('p-majstor')!;
    kopija.vjerojatnostAgresivnosti = 0.11;
    expect(kontroler.dohvatiKonfiguracijuPartije('p-majstor')?.vjerojatnostAgresivnosti).toBe(0.6);
  });
});
