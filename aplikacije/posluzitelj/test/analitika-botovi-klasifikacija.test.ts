import { describe, expect, it } from 'vitest';
import { ZADANA_KONFIGURACIJA_BOTA } from '../src/bot/konfiguracija-bota.js';
import {
  klasificirajProfilIzKonfiguracije,
  razrijesiProfilBota,
  snimkaBotAnalitikeIzRazrijesenog,
  VERZIJA_PROFILA_BOTA,
} from '../src/bot/profili-bota.js';

describe('klasifikacija profila bot analitike', () => {
  it('prepoznaje sva četiri imenovana profila', () => {
    for (const profil of ['pocetnik', 'iskusni', 'majstor', 'velemajstor'] as const) {
      const raz = razrijesiProfilBota(profil);
      const snimka = snimkaBotAnalitikeIzRazrijesenog(raz);
      expect(snimka.profil).toBe(profil);
      expect(snimka.verzijaProfila).toBe(VERZIJA_PROFILA_BOTA);
      expect(klasificirajProfilIzKonfiguracije(raz.konfiguracija).profil).toBe(profil);
    }
  });

  it('označava prilagođeno kad poluge ne odgovaraju profilu', () => {
    const konfig = structuredClone(ZADANA_KONFIGURACIJA_BOTA);
    konfig.vjerojatnostAgresivnosti = 0.42;
    konfig.vjerojatnostShielda = 0.11;
    const snimka = klasificirajProfilIzKonfiguracije(konfig);
    expect(snimka.profil).toBe('prilagodeno');
    expect(snimka.verzijaProfila).toBeNull();
    expect(snimka.verzijaPolitike).toBe(konfig.verzija);
  });
});
