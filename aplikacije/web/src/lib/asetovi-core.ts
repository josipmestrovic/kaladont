import { IKONE_DOSTIGNUCA } from './ikone-dostignuca.js';

const TIMEOUT_ASETA_MS = 8_000;
const MAX_PARALELNIH = 4;

/** Warm-up ikona navigacije na landingu — ne blokira children(). */
export const KRITICNE_IKONE: readonly string[] = [
  '/ikone/03-nazad.webp',
  '/ikone/04-naslovna.webp',
  '/ikone/05-naprijed.webp',
  '/ikone/07-igraj.webp',
];

/** Ikone u modalu „Igraj” — warm na klik, ne blocking. */
export const MODAL_IGRA_IKONE: readonly string[] = [
  '/ikone/16-soba-4-igraca.webp',
  '/ikone/17-soba-2-igraca.webp',
];

/** Idle warm-up na landingu — ne blokira children(). */
export const POZADINSKE_SLIKE_LANDINGA: readonly string[] = [
  '/ikone/06-trofej.webp',
  '/ikone/67-zagrijavanje-bot.webp',
  '/ikone/18-privatna-soba.webp',
  '/ikone/09-ljestvice.webp',
  '/ikone/62-misije.webp',
  '/ikone/61-korisnicki-profil.webp',
  '/ikone/08-pravila.webp',
  '/ikone/01-sto-je-novo.webp',
  '/ikone/02-pomozi-poboljsati-igru.webp',
];

/** Profil chrome — bez svih ikona dostignuća unaprijed. */
export const SLIKE_PROFILA: readonly string[] = [
  '/ikone/15-kaladont-dnk.webp',
  '/ikone/26-zvjezdica-prazna.webp',
  '/ikone/27-zvjezdica-puna.webp',
  '/ikone/29-random-avatar.webp',
];

/** Dostupno za lazy warm pojedinačnih dostignuća ako zatreba. */
export const SLIKE_DOSTIGNUCA: readonly string[] = [...new Set(Object.values(IKONE_DOSTIGNUCA))];

const blobUrlovi = new Map<string, string>();
const uTijeku = new Map<string, Promise<void>>();
let pozadinaPokrenuta = false;
let profilPokrenut = false;
let modalIgraPokrenut = false;

/** Blob URL ako je kritična ikona već skinuta; inače originalna putanja. */
export function urlAseta(putanja: string): string {
  return blobUrlovi.get(putanja) ?? putanja;
}

function dataSaverAktivan(): boolean {
  if (typeof navigator === 'undefined') return false;
  const veza = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(veza?.saveData);
}

async function dohvatiBlobUrl(url: string, spremiBlob: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  if (spremiBlob && blobUrlovi.has(url)) return;
  const postojeci = uTijeku.get(url);
  if (postojeci) {
    await postojeci;
    return;
  }

  const posao = (async () => {
    const kontroler = new AbortController();
    const timer = window.setTimeout(() => kontroler.abort(), TIMEOUT_ASETA_MS);
    try {
      const odgovor = await fetch(url, { signal: kontroler.signal });
      if (!odgovor.ok) return;
      const blob = await odgovor.blob();
      if (spremiBlob) {
        const stari = blobUrlovi.get(url);
        if (stari) URL.revokeObjectURL(stari);
        blobUrlovi.set(url, URL.createObjectURL(blob));
      }
    } catch {
      // Pojedinačni asset / abort ne smije zaustaviti warm-up ostalih.
    } finally {
      window.clearTimeout(timer);
      uTijeku.delete(url);
    }
  })();

  uTijeku.set(url, posao);
  await posao;
}

async function ucitajURedu(urlovi: readonly string[], spremiBlob: boolean): Promise<void> {
  const red = [...urlovi];
  const radnici = Array.from({ length: Math.min(MAX_PARALELNIH, red.length) }, async () => {
    while (red.length > 0) {
      const url = red.shift();
      if (!url) return;
      await dohvatiBlobUrl(url, spremiBlob);
    }
  });
  await Promise.all(radnici);
}

/** Warm-up kritičnih nav ikona (blob cache za urlAseta). */
export async function ucitajKriticneIkone(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (dataSaverAktivan()) return;
  await ucitajURedu(KRITICNE_IKONE, true);
}

function pokreniUPozadini(posao: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) ric(() => posao(), { timeout: 2_000 });
  else window.setTimeout(posao, 0);
}

/** Fire-and-forget: header, hero. */
export function ucitajPozadinskeAseteLandinga(): void {
  if (typeof window === 'undefined' || pozadinaPokrenuta) return;
  pozadinaPokrenuta = true;
  if (dataSaverAktivan()) return;
  pokreniUPozadini(() => {
    void ucitajURedu(POZADINSKE_SLIKE_LANDINGA, false);
  });
}

/** Fire-and-forget kad se otvori profil (bez masovnog warm-a dostignuća). */
export function ucitajAseteProfila(): void {
  if (typeof window === 'undefined' || profilPokrenut) return;
  profilPokrenut = true;
  if (dataSaverAktivan()) return;
  pokreniUPozadini(() => {
    void ucitajURedu(SLIKE_PROFILA, false);
  });
}

/** Fire-and-forget na klik „Igraj” — modal ikone odmah kreću download. */
export function ucitajModalIgraAsete(): void {
  if (typeof window === 'undefined' || modalIgraPokrenut) return;
  modalIgraPokrenut = true;
  if (dataSaverAktivan()) return;
  void ucitajURedu(MODAL_IGRA_IKONE, false);
}
