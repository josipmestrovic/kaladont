import { describe, expect, it } from 'vitest';
import {
  imaJavniProfil,
  primaProfilnuGamifikaciju,
  primaProfilnuGamifikacijuUIgri,
} from '../src/igra/gamifikacija-racuna.js';

describe('gamifikacija-racuna', () => {
  it('imenovani bot u igri prima gamifikaciju i ima javni profil', () => {
    const bot = { upravljac: 'bot' as const, vrsta: 'registriran' as const };
    expect(primaProfilnuGamifikacijuUIgri(bot)).toBe(true);
    expect(imaJavniProfil(bot)).toBe(true);
  });

  it('gost-bot u igri ne prima gamifikaciju ni javni profil', () => {
    const gostBot = { upravljac: 'bot' as const, vrsta: 'gost' as const };
    expect(primaProfilnuGamifikacijuUIgri(gostBot)).toBe(false);
    expect(imaJavniProfil(gostBot)).toBe(false);
  });

  it('u upisu tip gost isključuje botove i kad je igraci.vrsta=registriran', () => {
    expect(primaProfilnuGamifikaciju('registriran', 'bot', 'imenovani')).toBe(true);
    expect(primaProfilnuGamifikaciju('registriran', 'bot', 'gost')).toBe(false);
    expect(primaProfilnuGamifikaciju('gost', 'covjek')).toBe(true);
  });
});
