import { IKONE_DOSTIGNUCA } from './ikone-dostignuca.js';
import { brojZvukovaZaPreload, preucitajSveZvukove } from './audio-manager.js';

const TIMEOUT_ASETA_MS = 15_000;

/** UI / landing / dostignuća — bez avatar kataloga i kurzora. */
export const CORE_SLIKE: readonly string[] = [
  // Header
  '/ikone/01-sto-je-novo.png',
  '/ikone/02-pomozi-poboljsati-igru.png',
  '/ikone/03-nazad.png',
  '/ikone/04-naslovna.png',
  '/ikone/05-naprijed.png',
  // Landing / nav
  '/ikone/07-igraj.png',
  '/ikone/08-pravila.png',
  '/ikone/09-ljestvice.png',
  '/ikone/11-postavke.png',
  '/ikone/12-odjavi-se.png',
  '/ikone/13-prijavi-se.png',
  '/ikone/14-registriraj-se.png',
  '/ikone/16-soba-4-igraca.png',
  '/ikone/17-soba-2-igraca.png',
  '/ikone/18-privatna-soba.png',
  '/ikone/19-vatra.png',
  '/ikone/31-moj-profil.png',
  // Profil / igra
  '/ikone/06-trofej.png',
  '/ikone/15-kaladont-dnk.png',
  '/ikone/23-uredi-avatar.png',
  '/ikone/26-zvjezdica-prazna.png',
  '/ikone/27-zvjezdica-puna.png',
  '/ikone/29-random-avatar.png',
  // Dostignuća
  ...new Set(Object.values(IKONE_DOSTIGNUCA)),
  // Landing hero
  '/slike/demo-slika.png',
  '/slike/2-5-d-components/Tube-body.png',
  '/slike/2-5-d-components/Cap.png',
  '/slike/2-5-d-components/Pointing-hand.png',
  '/slike/2-5-d-components/Speech-Bubble-kaladont.png',
];

function sTimeoutom(obecanje: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(), ms);
    obecanje.then(
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      () => {
        window.clearTimeout(timer);
        resolve();
      },
    );
  });
}

export async function ucitajSliku(url: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const slika = new Image();
    slika.decoding = 'async';
    const ucitano = new Promise<void>((resolve, reject) => {
      slika.onload = () => resolve();
      slika.onerror = () => reject(new Error(`Neuspjelo učitavanje: ${url}`));
    });
    slika.src = url;
    await sTimeoutom(
      ucitano.then(async () => {
        if (typeof slika.decode === 'function') {
          try {
            await slika.decode();
          } catch {
            // decode može baciti ako je slika oštećena — toleriramo.
          }
        }
      }),
      TIMEOUT_ASETA_MS,
    );
  } catch {
    // Pojedinačni asset ne smije blokirati boot.
  }
}

export async function ucitajCoreAsete(onProgress?: (napredak: number) => void): Promise<void> {
  if (typeof window === 'undefined') {
    onProgress?.(1);
    return;
  }

  const urlsSlika = [...new Set(CORE_SLIKE)];
  const ukupno = urlsSlika.length + brojZvukovaZaPreload();
  let gotovo = 0;

  const prijavi = () => {
    onProgress?.(ukupno === 0 ? 1 : Math.min(1, gotovo / ukupno));
  };

  const oznaciGotovo = () => {
    gotovo += 1;
    prijavi();
  };

  prijavi();

  await Promise.all([
    ...urlsSlika.map(async (url) => {
      await ucitajSliku(url);
      oznaciGotovo();
    }),
    preucitajSveZvukove(oznaciGotovo),
  ]);

  onProgress?.(1);
}
