import { writable } from 'svelte/store';

export const SETOVI_KURSORA = [
  {
    id: '01-klasik',
    naziv: 'Klasik',
    stanja: {
      normal: { datoteka: 'normal.png', hotspot: '15 4' },
      hover: { datoteka: 'hover.png', hotspot: '19 4' },
      klik: { datoteka: 'klik.png', hotspot: '19 4' },
    },
  },
  {
    id: '02-vitez',
    naziv: 'Vitez',
    stanja: {
      normal: { datoteka: 'normal.png', hotspot: '12 4' },
      hover: { datoteka: 'hover.png', hotspot: '19 4' },
      klik: { datoteka: 'klik.png', hotspot: '19 4' },
    },
  },
  {
    id: '03-cudoviste',
    naziv: 'Čudovište',
    stanja: {
      normal: { datoteka: 'normal.png', hotspot: '14 4' },
      hover: { datoteka: 'hover.png', hotspot: '17 4' },
      klik: { datoteka: 'klik.png', hotspot: '17 4' },
    },
  },
  {
    id: '04-carobnjak',
    naziv: 'Čarobnjak',
    stanja: {
      normal: { datoteka: 'normal.png', hotspot: '17 4' },
      hover: { datoteka: 'hover.png', hotspot: '18 4' },
      klik: { datoteka: 'klik.png', hotspot: '18 4' },
    },
  },
  {
    id: '05-kaladont',
    naziv: 'Kaladont',
    stanja: {
      normal: { datoteka: 'normal.png', hotspot: '14 4' },
      hover: { datoteka: 'hover.png', hotspot: '21 4' },
      klik: { datoteka: 'klik.png', hotspot: '21 4' },
    },
  },
] as const;

export type SetKursora = (typeof SETOVI_KURSORA)[number]['id'];
export type RezimKursora = 'ruka' | 'strelica';

export interface PostavkeKursora {
  set: SetKursora;
  rezim: RezimKursora;
}

export const ZADANE_POSTAVKE_KURSORA: PostavkeKursora = {
  set: '05-kaladont',
  rezim: 'ruka',
};

const KLJUC_POSTAVKE = 'kaladont_kursor_v1';

export const postavkeKursora = writable<PostavkeKursora>(ZADANE_POSTAVKE_KURSORA);

let trenutnePostavke = ZADANE_POSTAVKE_KURSORA;
let slusateljiDodani = false;

function jeSetKursora(vrijednost: unknown): vrijednost is SetKursora {
  return SETOVI_KURSORA.some((set) => set.id === vrijednost);
}

function jeRezimKursora(vrijednost: unknown): vrijednost is RezimKursora {
  return vrijednost === 'ruka' || vrijednost === 'strelica';
}

function primijeniKursor(): void {
  if (typeof document === 'undefined') return;

  const korijen = document.documentElement;
  korijen.setAttribute('data-kursor-set', trenutnePostavke.set);
  korijen.setAttribute('data-kursor-rezim', trenutnePostavke.rezim);
  if (!korijen.hasAttribute('data-kursor-stanje')) korijen.setAttribute('data-kursor-stanje', 'mirno');
}

function spremiPostavke(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, JSON.stringify(trenutnePostavke));
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}

function vratiMirovanje(): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-kursor-stanje', 'mirno');
}

function pritisniKursor(dogadaj: PointerEvent): void {
  if (dogadaj.button !== 0 || dogadaj.pointerType === 'touch') return;
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-kursor-stanje', 'klik');
}

function inicijalizirajSlusatelje(): void {
  if (typeof window === 'undefined' || slusateljiDodani) return;

  window.addEventListener('pointerdown', pritisniKursor);
  window.addEventListener('pointerup', vratiMirovanje);
  window.addEventListener('pointercancel', vratiMirovanje);
  window.addEventListener('blur', vratiMirovanje);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') vratiMirovanje();
  });
  slusateljiDodani = true;
}

export function inicijalizirajKursor(): void {
  if (typeof window === 'undefined') return;

  let spremljeno: Partial<PostavkeKursora> = {};
  try {
    const zapis = window.localStorage.getItem(KLJUC_POSTAVKE);
    if (zapis) {
      const vrijednost: unknown = JSON.parse(zapis);
      if (typeof vrijednost === 'object' && vrijednost !== null) {
        spremljeno = vrijednost as Partial<PostavkeKursora>;
      }
    }
  } catch {
    // Neispravan ili nedostupan zapis ostavlja zadane postavke.
  }

  trenutnePostavke = {
    set: jeSetKursora(spremljeno.set) ? spremljeno.set : ZADANE_POSTAVKE_KURSORA.set,
    rezim: jeRezimKursora(spremljeno.rezim) ? spremljeno.rezim : ZADANE_POSTAVKE_KURSORA.rezim,
  };
  postavkeKursora.set(trenutnePostavke);
  primijeniKursor();
  inicijalizirajSlusatelje();
}

export function postaviSetKursora(set: SetKursora): void {
  if (!jeSetKursora(set)) return;
  trenutnePostavke = { ...trenutnePostavke, set };
  postavkeKursora.set(trenutnePostavke);
  primijeniKursor();
  spremiPostavke();
}

export function postaviRezimKursora(rezim: RezimKursora): void {
  if (!jeRezimKursora(rezim)) return;
  trenutnePostavke = { ...trenutnePostavke, rezim };
  postavkeKursora.set(trenutnePostavke);
  primijeniKursor();
  spremiPostavke();
}