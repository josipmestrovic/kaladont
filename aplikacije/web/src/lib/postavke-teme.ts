import { writable } from 'svelte/store';

const KLJUC_POSTAVKE = 'kaladont_tema_v1';

export type Tema = 'tamna' | 'svijetla';

export const tema = writable<Tema>('tamna');

function primijeniTemu(odabrana: Tema): void {
  if (typeof document === 'undefined') return;
  if (odabrana === 'svijetla') document.documentElement.setAttribute('data-tema', 'svijetla');
  else document.documentElement.removeAttribute('data-tema');
}

export function inicijalizirajTemu(): void {
  if (typeof window === 'undefined') return;

  let odabrana: Tema = 'tamna';
  try {
    if (window.localStorage.getItem(KLJUC_POSTAVKE) === 'svijetla') odabrana = 'svijetla';
  } catch {
    // Tema ostaje zadana i kada preglednik zabrani lokalnu pohranu.
  }

  primijeniTemu(odabrana);
  tema.set(odabrana);
}

export function postaviTemu(odabrana: Tema): void {
  primijeniTemu(odabrana);
  tema.set(odabrana);

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, odabrana);
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}
