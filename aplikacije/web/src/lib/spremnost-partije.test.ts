import { describe, expect, it } from 'vitest';
import {
  odlukaNakonSyncSnimke,
  pomakSataIzRtt,
  sljedecaSpremnostPartije,
} from './spremnost-partije.js';

describe('sljedecaSpremnostPartije', () => {
  it('D05: sync_start → sinkronizacija, sync_ok → spremna', () => {
    expect(sljedecaSpremnostPartije({ trenutna: 'spremna', dogadaj: 'sync_start' })).toBe(
      'sinkronizacija',
    );
    expect(sljedecaSpremnostPartije({ trenutna: 'sinkronizacija', dogadaj: 'sync_ok' })).toBe(
      'spremna',
    );
  });

  it('D05: partija_nestala → nedostupna bez petlje', () => {
    expect(sljedecaSpremnostPartije({ trenutna: 'spremna', dogadaj: 'partija_nestala' })).toBe(
      'nedostupna',
    );
  });
});

describe('odlukaNakonSyncSnimke', () => {
  it('D01/D02: isti red + potvrda → primijeni potvrdu', () => {
    expect(
      odlukaNakonSyncSnimke({
        aktivniRequestId: 'r1',
        aktivniTurnToken: 't1',
        snimkaTurnToken: 't1',
        potvrdaZaRequestId: true,
      }),
    ).toBe('primijeni_potvrdu');
  });

  it('D01: isti red bez potvrde → zadrži nepoznat', () => {
    expect(
      odlukaNakonSyncSnimke({
        aktivniRequestId: 'r1',
        aktivniTurnToken: 't1',
        snimkaTurnToken: 't1',
        potvrdaZaRequestId: false,
      }),
    ).toBe('zadrzi_nepoznat');
  });

  it('D03: drugi red → prihvati snimku', () => {
    expect(
      odlukaNakonSyncSnimke({
        aktivniRequestId: 'r1',
        aktivniTurnToken: 't-stari',
        snimkaTurnToken: 't-novi',
        potvrdaZaRequestId: false,
      }),
    ).toBe('prihvati_snimku');
  });

  it('D04: nema aktivne naredbe → prihvati snimku (terminalni status sa snimke)', () => {
    expect(
      odlukaNakonSyncSnimke({
        aktivniRequestId: null,
        aktivniTurnToken: null,
        snimkaTurnToken: 't',
        potvrdaZaRequestId: false,
      }),
    ).toBe('prihvati_snimku');
  });
});

describe('pomakSataIzRtt', () => {
  it('računa pomak iz sredine RTT-a', () => {
    const pomak = pomakSataIzRtt({
      serverVrijemeIso: new Date(1_000_050).toISOString(),
      klijentSlanjeMs: 1_000_000,
      klijentPrijemMs: 1_000_100,
    });
    // sredina klijenta = 1000050; server = 1000050 → pomak 0
    expect(pomak).toBe(0);
  });
});
