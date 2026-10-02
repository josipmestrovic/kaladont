import { writable } from 'svelte/store';

const KLJUC_POSTAVKE = 'kaladont_font_postavke_v1';

export const openDyslexicUkljucen = writable(false);

function primijeniFont(ukljucen: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.toggleAttribute('data-font-disleksiju', ukljucen);
}

export function inicijalizirajFontPostavku(): void {
  if (typeof window === 'undefined') return;

  let ukljucen = false;
  try {
    ukljucen = window.localStorage.getItem(KLJUC_POSTAVKE) === 'true';
  } catch {
    // Font ostaje dostupan i kada preglednik zabrani lokalnu pohranu.
  }

  primijeniFont(ukljucen);
  openDyslexicUkljucen.set(ukljucen);
}

export function postaviOpenDyslexic(ukljucen: boolean): void {
  primijeniFont(ukljucen);
  openDyslexicUkljucen.set(ukljucen);

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, String(ukljucen));
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}