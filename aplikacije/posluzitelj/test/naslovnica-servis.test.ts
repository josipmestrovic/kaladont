import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/konfiguracija.js', () => ({
  konfiguracija: {
    IZAZOV_OMOGUCEN: 'false',
    DOPUSTI_VLASTITA_IMENA: 'false',
  },
}));

vi.mock('../src/ljestvice/sazetak.js', () => ({
  izgradiOdgovorSazetkaLjestvice: vi.fn(),
}));

vi.mock('../src/izazovi/pohrana.js', () => ({
  dohvatiZavrseneChallengeIds: vi.fn(async () => new Set()),
}));

vi.mock('../src/racuni/aktivnost-dana.js', () => ({
  dohvatiNajboljiNizAktivnosti: vi.fn(async () => 0),
}));

vi.mock('../src/sanducic/servis.js', () => ({
  dohvatiSazetak: vi.fn(async () => ({ brojNeprocitanih: 0, zaNajavu: [] })),
  dohvatiListu: vi.fn(async () => ({ poruke: [], sljedeciCursor: null })),
}));

vi.mock('../src/misije/dto.js', () => ({
  izgradiStanjeMisijaDto: vi.fn(),
}));

function lanacUpita(rezultat: unknown[] = []) {
  const thenable = {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rezultat).then(resolve, reject),
    limit: () => thenable,
    orderBy: () => thenable,
  };
  return {
    from: () => ({
      where: () => thenable,
    }),
  };
}

vi.mock('../src/baza/klijent.js', () => ({
  baza: {
    select: () => lanacUpita([]),
    transaction: async (fn: (tx: unknown) => unknown) => fn({}),
  },
}));

import { LJESTVICE_TIMEOUT_MS, izgradiNaslovnicaSazetak } from '../src/naslovnica/servis.js';
import { izgradiOdgovorSazetkaLjestvice } from '../src/ljestvice/sazetak.js';

const mockLjestvice = vi.mocked(izgradiOdgovorSazetkaLjestvice);

function gostIgrac() {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    nadimak: 'Gost',
    vrsta: 'gost' as const,
    avatarId: 0,
    avatarConfig: null,
    email: null,
    rangSumaJedinica: 0,
    rangBrojPartija: 0,
    iskustvoUkupno: 0,
  };
}

describe('izgradiNaslovnicaSazetak', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pri sporoj ljestvici vraća profil i neutralan status unutar timeouta', async () => {
    mockLjestvice.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true as const,
                status: { vrsta: 'rangiran' as const, mjesto: 1, metrika: 'iskustvo', razdoblje: null },
                izracunatoU: new Date().toISOString(),
              }),
            LJESTVICE_TIMEOUT_MS + 250,
          );
        }),
    );

    const pocetak = Date.now();
    const odgovor = await izgradiNaslovnicaSazetak(gostIgrac() as never);
    const trajanje = Date.now() - pocetak;

    expect(odgovor.ok).toBe(true);
    expect(odgovor.profil.nadimak).toBe('Gost');
    expect(odgovor.profil.igracId).toBe(gostIgrac().id);
    expect(odgovor.ljestvice.status).toEqual({ vrsta: 'neutralan' });
    expect(trajanje).toBeLessThan(LJESTVICE_TIMEOUT_MS + 150);
  });

  it('pri padu ljestvice i dalje vraća profil', async () => {
    mockLjestvice.mockRejectedValue(new Error('ljestvice pad'));
    const odgovor = await izgradiNaslovnicaSazetak(gostIgrac() as never);
    expect(odgovor.profil.nadimak).toBe('Gost');
    expect(odgovor.ljestvice.status).toEqual({ vrsta: 'neutralan' });
    expect(odgovor.kolekcija.ukupnoOtkljucano).toBe(0);
  });
});
