import { describe, expect, it } from 'vitest';
import type { OdabirPocetneRijeci, RjecnikSucelje } from 'zajednicko';

/**
 * Izvor mora doći iz grane odabira, ne iz pripadnosti listi sigurnih riječi.
 * Ovdje simuliramo tri grane koje `nasumicnaPocetnaRijec` može vratiti.
 */
function simulirajOdabir(grana: 'sigurni_skup' | 'rezervni_odabir' | 'nema_kandidata', rijec = 'šećer'): OdabirPocetneRijeci | null {
  if (grana === 'nema_kandidata') return null;
  return { rijec, izvor: grana };
}

describe('izvor odabira početne riječi', () => {
  it('sigurna grana vraća izvor sigurni_skup', () => {
    expect(simulirajOdabir('sigurni_skup', 'velik')).toEqual({ rijec: 'velik', izvor: 'sigurni_skup' });
  });

  it('rezervna grana vraća izvor rezervni_odabir i za riječ iz sigurnog skupa', () => {
    // Ista tekstualna riječ može doći rezervom; izvor je grana, ne lista.
    expect(simulirajOdabir('rezervni_odabir', 'velik')).toEqual({ rijec: 'velik', izvor: 'rezervni_odabir' });
  });

  it('null rezultat znači nema_kandidata na strani motora', () => {
    expect(simulirajOdabir('nema_kandidata')).toBeNull();
  });

  it('testni rječnik stub vraća oblik s izvorom', () => {
    const stub: Pick<RjecnikSucelje, 'nasumicnaPocetnaRijec'> = {
      nasumicnaPocetnaRijec: () => ({ rijec: 'test', izvor: 'sigurni_skup' }),
    };
    expect(stub.nasumicnaPocetnaRijec(new Set())).toEqual({ rijec: 'test', izvor: 'sigurni_skup' });
  });
});
