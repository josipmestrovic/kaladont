import { writable } from 'svelte/store';

const KLJUC_POSTAVKE = 'kaladont_animirana_pozadina_v1';

/** Zadano uključeno; reduced motion ima prednost u UI sloju. */
export const animiranaPozadinaUkljucena = writable(true);

export function inicijalizirajAnimacijuPozadine(): void {
  if (typeof window === 'undefined') return;

  let ukljucena = true;
  try {
    const spremljeno = window.localStorage.getItem(KLJUC_POSTAVKE);
    if (spremljeno === 'false') ukljucena = false;
    else if (spremljeno === 'true') ukljucena = true;
  } catch {
    // Animacija ostaje zadana i kada preglednik zabrani lokalnu pohranu.
  }

  animiranaPozadinaUkljucena.set(ukljucena);
}

export function postaviAnimiranuPozadinu(ukljucena: boolean): void {
  animiranaPozadinaUkljucena.set(ukljucena);

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, String(ukljucena));
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}
