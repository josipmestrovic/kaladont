/**
 * Tko prima profilnu gamifikaciju (dostignuća, posebne nagrade, napredak).
 * Imenovani botovi da; gost-botovi ne. Sandučić, misije i sesije ostaju odvojeno (samo ljudi).
 */

export type BotTipPrezentacije = 'imenovani' | 'gost';

/** U motoru: tip gost ima vrsta=gost; imenovani ima vrsta=registriran. */
export function primaProfilnuGamifikacijuUIgri(
  sudionik: { upravljac: 'covjek' | 'bot'; vrsta: 'gost' | 'registriran' | 'admin' },
): boolean {
  if (sudionik.upravljac === 'covjek') return true;
  return sudionik.vrsta === 'registriran' || sudionik.vrsta === 'admin';
}

/**
 * U upisu iz baze: tip gost botova i dalje ima igraci.vrsta=registriran,
 * pa moraš proslijediti botovi.tip.
 */
export function primaProfilnuGamifikaciju(
  vrsta: string,
  upravljac: string,
  botTip: BotTipPrezentacije | null = null,
): boolean {
  if (upravljac === 'covjek') {
    return vrsta === 'registriran' || vrsta === 'admin' || vrsta === 'gost';
  }
  if (upravljac === 'bot') {
    if (botTip === 'gost') return false;
    if (botTip === 'imenovani') return true;
    return vrsta === 'registriran' || vrsta === 'admin';
  }
  return false;
}

/** Javni profil / klikabilan nadimak: registriran/admin, ne gost-bot. */
export function imaJavniProfil(
  sudionik: { upravljac: 'covjek' | 'bot'; vrsta: 'gost' | 'registriran' | 'admin' },
): boolean {
  return sudionik.vrsta === 'registriran' || sudionik.vrsta === 'admin';
}
