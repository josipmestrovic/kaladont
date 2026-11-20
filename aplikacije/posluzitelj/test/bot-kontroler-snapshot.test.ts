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

    globalna.vjerojatnostTaktickogPoteza = 0.99;
    expect(kontroler.dohvatiKonfiguracijuPartije('p-iskusni')?.vjerojatnostTaktickogPoteza).toBe(0.25);
    expect(kontroler.dohvatiKonfiguracijuPartije('p-majstor')?.vjerojatnostTaktickogPoteza).toBe(0.5);

    // Mutacija vraćene kopije ne dira internu mapu.
    const kopija = kontroler.dohvatiKonfiguracijuPartije('p-majstor')!;
    kopija.vjerojatnostTaktickogPoteza = 0.11;
    expect(kontroler.dohvatiKonfiguracijuPartije('p-majstor')?.vjerojatnostTaktickogPoteza).toBe(0.5);
  });
});
