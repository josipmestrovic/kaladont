import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAKS_TRAJANJE_STAGING_TESTA_MS,
  MAKS_VELICINA_VALA_STAGING,
  MAKS_RAZMAK_VALA_STAGING_MS,
  MIN_RAZMAK_VALA_STAGING_MS,
  MIN_TRAJANJE_STAGING_TESTA_MS,
  odbijProdukcijskuAdresu,
  provjeriNacinPokretanja,
  provjeriPrethodnuRazinuStagingTesta,
  provjeriRampuStagingTesta,
  provjeriScenarijStagingTesta,
  validirajAdresuStaginga,
  validirajZahtjevStagingTesta,
  zakljucajStagingTest,
  zabiljeziRezultatStagingTesta,
} from '../src/cli/opterecenje-postavke.js';

describe('validirajAdresuStaginga', () => {
  it('prihvaća samo korijensku HTTPS adresu staginga', () => {
    expect(validirajAdresuStaginga('https://staging.kaladont.hr').origin).toBe(
      'https://staging.kaladont.hr',
    );
  });

  it.each([
    'http://staging.kaladont.hr',
    'https://kaladont.hr',
    'https://drugi.staging.kaladont.hr',
    'https://staging.kaladont.hr:8443',
    'https://staging.kaladont.hr/putanja',
    'https://staging.kaladont.hr/?test=1',
    'https://korisnik@staging.kaladont.hr',
    'nije-adresa',
  ])('odbija adresu %s', (adresa) => {
    expect(() => validirajAdresuStaginga(adresa)).toThrow();
  });

  it.each(['https://kaladont.hr', 'https://www.kaladont.hr'])('odbija produkciju %s', (adresa) => {
    expect(() => odbijProdukcijskuAdresu(adresa)).toThrow();
  });

  it('zahtijeva zasebnu naredbu za staging i zasad dopušta samo veze', () => {
    expect(() => provjeriNacinPokretanja('https://staging.kaladont.hr', false)).toThrow();
    expect(() => provjeriNacinPokretanja('https://staging.kaladont.hr', true)).not.toThrow();
    expect(() => provjeriScenarijStagingTesta('veze')).not.toThrow();
    expect(() => provjeriScenarijStagingTesta('igra')).toThrow();
  });

  it('ograničava staging rampu na najviše 100 klijenata u sekundi', () => {
    expect(() => provjeriRampuStagingTesta(10, 1_000)).not.toThrow();
    expect(() => provjeriRampuStagingTesta(MAKS_VELICINA_VALA_STAGING, MIN_RAZMAK_VALA_STAGING_MS)).not.toThrow();
    expect(() => provjeriRampuStagingTesta(MAKS_VELICINA_VALA_STAGING + 1, 1_000)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, MIN_RAZMAK_VALA_STAGING_MS - 1)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, MAKS_RAZMAK_VALA_STAGING_MS + 1)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, 2 ** 31)).toThrow();
  });

  it('zahtijeva dogovorenu razinu, trajanje i dodatnu potvrdu za 10000 korisnika', () => {
    const zahtjev = {
      adresa: 'https://staging.kaladont.hr',
      brojKorisnika: 1_000,
      trajanjeMs: 60_000,
      potvrdaDesetTisuca: undefined,
    };
    expect(validirajZahtjevStagingTesta(zahtjev).hostname).toBe('staging.kaladont.hr');
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, brojKorisnika: 99 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, trajanjeMs: MIN_TRAJANJE_STAGING_TESTA_MS - 1 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, trajanjeMs: MAKS_TRAJANJE_STAGING_TESTA_MS + 1 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, brojKorisnika: 10_000 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({
      ...zahtjev,
      brojKorisnika: 10_000,
      potvrdaDesetTisuca: 'DA',
    })).not.toThrow();
  });

  it('sprječava paralelni test istog staginga i oslobađa zaključavanje', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-opterecenje-'));
    try {
      const oslobodi = await zakljucajStagingTest('https://staging.kaladont.hr', direktorij);
      await expect(zakljucajStagingTest('https://staging.kaladont.hr', direktorij)).rejects.toThrow(
        'Već je pokrenut test opterećenja za staging.',
      );
      await oslobodi();
      const oslobodiPonovno = await zakljucajStagingTest('https://staging.kaladont.hr', direktorij);
      await oslobodiPonovno();
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });

  it('zahtijeva i bilježi uspješne razine prije prelaska na veću', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-potvrde-testova-'));
    const adresa = 'https://staging.kaladont.hr';
    const sada = Date.now();
    try {
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 100, true, direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada)).resolves.toBeUndefined();
      await zabiljeziRezultatStagingTesta(adresa, 500, false, direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 1_000, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 500, true, direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 1_000, direktorij, sada)).resolves.toBeUndefined();
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 10_000, direktorij, sada)).rejects.toThrow();
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });
});