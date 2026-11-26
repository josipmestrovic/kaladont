/**
 * Klijentska koordinacija nagradnih efekata (#159): dedup pljeska Kaladont vs pobjeda.
 */
import { trebaPljesakPobjede } from 'zajednicko';
import { pustiAudio } from './audio-manager.js';

let aplauzKaladontZaPartijuId: string | null = null;
const pljesakPobjedeZaPartiju = new Set<string>();
const konfetiRezultataZaPartiju = new Set<string>();

export function zabiljeziAplauzKaladonta(partijaId: string | null | undefined): void {
  if (partijaId) aplauzKaladontZaPartijuId = partijaId;
}

/** Vrati true ako treba odsvirati pljesak (jednom; ne ako je Kaladont već odsvirao). */
export function pokusajPljesakPobjede(
  partijaId: string,
  mojIgracId: string | null | undefined,
  pobjednikId: string | null | undefined,
): boolean {
  if (!trebaPljesakPobjede(mojIgracId, pobjednikId)) return false;
  if (aplauzKaladontZaPartijuId === partijaId) return false;
  if (pljesakPobjedeZaPartiju.has(partijaId)) return false;
  pljesakPobjedeZaPartiju.add(partijaId);
  pustiAudio('aplauz-kaladont');
  return true;
}

/** Jednokratni konfeti na završnom ekranu (remount/reconnect). */
export function trebaKonfetiRezultata(partijaId: string): boolean {
  if (konfetiRezultataZaPartiju.has(partijaId)) return false;
  konfetiRezultataZaPartiju.add(partijaId);
  return true;
}

export function resetirajNagradeEfekte(): void {
  aplauzKaladontZaPartijuId = null;
  pljesakPobjedeZaPartiju.clear();
  konfetiRezultataZaPartiju.clear();
}
