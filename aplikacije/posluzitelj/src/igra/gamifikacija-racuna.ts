/**
 * Tko prima profilnu gamifikaciju (dostignuća, posebne nagrade, napredak).
 * Botovi nikad; samo ljudski igrači. Sandučić, misije i sesije ostaju odvojeno (samo ljudi).
 */

export type BotTipPrezentacije = 'imenovani' | 'gost';

/** U motoru: samo ljudski sudionici primaju profilnu gamifikaciju. */
export function primaProfilnuGamifikacijuUIgri(
  sudionik: { upravljac: 'covjek' | 'bot'; vrsta: 'gost' | 'registriran' | 'admin' },
): boolean {
  return sudionik.upravljac === 'covjek';
}

/**
 * U upisu iz baze: botovi nikad ne primaju osobni napredak (XP, rang, dostignuća…).
 * `botTip` ostaje u potpisu radi kompatibilnosti pozivatelja.
 */
export function primaProfilnuGamifikaciju(
  vrsta: string,
  upravljac: string,
  _botTip: BotTipPrezentacije | null = null,
): boolean {
  if (upravljac === 'bot') return false;
  if (upravljac === 'covjek') {
    return vrsta === 'registriran' || vrsta === 'admin' || vrsta === 'gost';
  }
  return false;
}

/** Javni profil / klikabilan nadimak: samo ljudski registriran/admin. */
export function imaJavniProfil(
  sudionik: { upravljac: 'covjek' | 'bot'; vrsta: 'gost' | 'registriran' | 'admin' },
): boolean {
  return sudionik.upravljac === 'covjek' && (sudionik.vrsta === 'registriran' || sudionik.vrsta === 'admin');
}
