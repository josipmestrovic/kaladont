import { IKONE_DOSTIGNUCA } from './ikone-dostignuca.js';

const TIMEOUT_ASETA_MS = 8_000;

/** Glavna navigacija na landingu — warm-up u pozadini. */
export const KRITICNE_IKONE: readonly string[] = [
  '/ikone/07-igraj.png',
  '/ikone/61-korisnicki-profil.webp',
  '/ikone/62-misije.webp',
  '/ikone/09-ljestvice.png',
  '/ikone/08-pravila.png',
  '/ikone/11-postavke.png',
  '/ikone/12-odjavi-se.png',
  '/ikone/13-prijavi-se.png',
  '/ikone/14-registriraj-se.png',
];

/** Ikone u modalu „Igraj” — warm na klik, ne blocking. */
export const MODAL_IGRA_IKONE: readonly string[] = [
  '/ikone/16-soba-4-igraca.png',
  '/ikone/17-soba-2-igraca.png',
  '/ikone/18-privatna-soba.png',
  '/ikone/67-zagrijavanje-bot.webp',
];

/** Idle warm-up na landingu — ne blokira children(). */
export const POZADINSKE_SLIKE_LANDINGA: readonly string[] = [
  '/ikone/01-sto-je-novo.png',
  '/ikone/02-pomozi-poboljsati-igru.png',
  '/ikone/03-nazad.png',
  '/ikone/04-naslovna.png',
  '/ikone/05-naprijed.png',
  ...MODAL_IGRA_IKONE,
  '/slike/demo-slika.webp',
  '/slike/2-5-d-components/Tube-body.png',
  '/slike/2-5-d-components/Cap.png',
  '/slike/2-5-d-components/Speech-Bubble-kaladont.png',
];

/** Profil / dostignuća — tek kad se ode na profil. */
export const SLIKE_PROFILA: readonly string[] = [
  '/ikone/15-kaladont-dnk.png',
  '/ikone/23-uredi-avatar.png',
  '/ikone/26-zvjezdica-prazna.png',
  '/ikone/27-zvjezdica-puna.png',
  '/ikone/29-random-avatar.png',
  ...new Set(Object.values(IKONE_DOSTIGNUCA)),
];

const blobUrlovi = new Map<string, string>();
let pozadinaPokrenuta = false;
let profilPokrenut = false;
let modalIgraPokrenut = false;

/** Blob URL ako je kritična ikona već skinuta; inače originalna putanja. */
export function urlAseta(putanja: string): string {
  return blobUrlovi.get(putanja) ?? putanja;
}

function sTimeoutom<T>(obecanje: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(undefined), ms);
    obecanje.then(
      (vrijednost) => {
        window.clearTimeout(timer);
        resolve(vrijednost);
      },
      () => {
        window.clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

async function dohvatiBlobUrl(url: string, spremiBlob: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  if (spremiBlob && blobUrlovi.has(url)) return;
  try {
    const odgovor = await sTimeoutom(fetch(url), TIMEOUT_ASETA_MS);
    if (!odgovor?.ok) return;
    const blob = await sTimeoutom(odgovor.blob(), TIMEOUT_ASETA_MS);
    if (!blob) return;
    if (spremiBlob) {
      const stari = blobUrlovi.get(url);
      if (stari) URL.revokeObjectURL(stari);
      blobUrlovi.set(url, URL.createObjectURL(blob));
    }
  } catch {
    // Pojedinačni asset ne smije zaustaviti warm-up ostalih.
  }
}

/** Warm-up kritičnih nav ikona (blob cache za urlAseta). */
export async function ucitajKriticneIkone(): Promise<void> {
  if (typeof window === 'undefined') return;

  await Promise.all(KRITICNE_IKONE.map((url) => dohvatiBlobUrl(url, true)));
}

function pokreniUPozadini(posao: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) ric(() => posao(), { timeout: 2_000 });
  else window.setTimeout(posao, 0);
}

/** Fire-and-forget: header, modal, hero, 2.5D. */
export function ucitajPozadinskeAseteLandinga(): void {
  if (typeof window === 'undefined' || pozadinaPokrenuta) return;
  pozadinaPokrenuta = true;
  pokreniUPozadini(() => {
    void Promise.all(POZADINSKE_SLIKE_LANDINGA.map((url) => dohvatiBlobUrl(url, false)));
  });
}

/** Fire-and-forget kad se otvori profil. */
export function ucitajAseteProfila(): void {
  if (typeof window === 'undefined' || profilPokrenut) return;
  profilPokrenut = true;
  pokreniUPozadini(() => {
    void Promise.all(SLIKE_PROFILA.map((url) => dohvatiBlobUrl(url, false)));
  });
}

/** Fire-and-forget na klik „Igraj” — modal ikone odmah kreću download. */
export function ucitajModalIgraAsete(): void {
  if (typeof window === 'undefined' || modalIgraPokrenut) return;
  modalIgraPokrenut = true;
  void Promise.all(MODAL_IGRA_IKONE.map((url) => dohvatiBlobUrl(url, false)));
}
