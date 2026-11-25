import { get, writable } from 'svelte/store';

const KLJUC_POSTAVKE = 'kaladont_autofokus_poteza_v1';

function ucitajIzPohrane(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KLJUC_POSTAVKE) === 'true';
  } catch {
    return false;
  }
}

/** Zadano isključeno: na mobitelu igrač prvo vidi stol, pa sam otvara tipkovnicu. */
export const autofokusPotezaUkljucen = writable(false);

export function inicijalizirajAutofokusPoteza(): void {
  if (typeof window === 'undefined') return;
  autofokusPotezaUkljucen.set(ucitajIzPohrane());
}

export function postaviAutofokusPoteza(ukljucen: boolean): void {
  autofokusPotezaUkljucen.set(ukljucen);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, String(ukljucen));
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}

export function trebaAutofokusPoteza(): boolean {
  if (typeof window === 'undefined') return false;
  // Desktop: fokus na unos ne otvara sistemsku tipkovnicu — zadrži postojeće ponašanje.
  if (window.matchMedia('(min-width: 1000px)').matches) return true;
  // Memorija storea je izvor istine (i kad localStorage.setItem padne).
  return get(autofokusPotezaUkljucen);
}
