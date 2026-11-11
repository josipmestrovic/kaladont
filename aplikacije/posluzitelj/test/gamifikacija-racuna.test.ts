import { describe, expect, it } from 'vitest';
import {
  imaJavniProfil,
  primaProfilnuGamifikaciju,
  primaProfilnuGamifikacijuUIgri,
} from '../src/igra/gamifikacija-racuna.js';

describe('gamifikacija-racuna', () => {
  it('nijedan bot ne prima gamifikaciju ni javni profil', () => {
    const imenovani = { upravljac: 'bot' as const, vrsta: 'registriran' as const };
    const gostBot = { upravljac: 'bot' as const, vrsta: 'gost' as const };
    expect(primaProfilnuGamifikacijuUIgri(imenovani)).toBe(false);
    expect(imaJavniProfil(imenovani)).toBe(false);
    expect(primaProfilnuGamifikacijuUIgri(gostBot)).toBe(false);
    expect(imaJavniProfil(gostBot)).toBe(false);
  });

  it('u upisu botovi nikad ne primaju profilnu gamifikaciju', () => {
    expect(primaProfilnuGamifikaciju('registriran', 'bot', 'imenovani')).toBe(false);
    expect(primaProfilnuGamifikaciju('registriran', 'bot', 'gost')).toBe(false);
    expect(primaProfilnuGamifikaciju('gost', 'covjek')).toBe(true);
    expect(primaProfilnuGamifikaciju('registriran', 'covjek')).toBe(true);
  });
});
