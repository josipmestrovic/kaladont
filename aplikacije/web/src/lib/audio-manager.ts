import { writable } from 'svelte/store';

export type AudioDogadaj =
  | 'ulazak-u-sobu'
  | 'izlazak-iz-sobe'
  | 'odbrojavanje-single-count-sound'
  | 'pocetak-partije'
  | 'potez-prihvacen'
  | 'potez-odbijen-1'
  | 'potez-odbijen-2'
  | 'potez-odbijen-3'
  | 'tvoj-red'
  | 'eliminacija'
  | 'nova-runda'
  | 'partija-kraj'
  | 'pred-istek-vremena'
  | 'klik-misa'
  | 'hover-efekt';

const KLJUC_POSTAVKI = 'kaladont_audio_postavke_v1';
const ZVUKOVI: Record<AudioDogadaj, string> = {
  'ulazak-u-sobu': '/zvukovi/ulazak-u-sobu.wav',
  'izlazak-iz-sobe': '/zvukovi/izlazak-iz-sobe.wav',
  'odbrojavanje-single-count-sound': '/zvukovi/odbrojavanje-single-count-sound.wav',
  'pocetak-partije': '/zvukovi/pocetak-partije.wav',
  'potez-prihvacen': '/zvukovi/potez-prihvacen.wav',
  'potez-odbijen-1': '/zvukovi/potez-odbijen-1.wav',
  'potez-odbijen-2': '/zvukovi/potez-odbijen-2.wav',
  'potez-odbijen-3': '/zvukovi/potez-odbijen-3.wav',
  'tvoj-red': '/zvukovi/tvoj-red.mp3',
  eliminacija: '/zvukovi/eliminacija.wav',
  'nova-runda': '/zvukovi/nova-runda.wav',
  'partija-kraj': '/zvukovi/partija-kraj.mp3',
  'pred-istek-vremena': '/zvukovi/pred-istek-vremena.wav',
  'klik-misa': '/zvukovi/klik-misa.wav',
  'hover-efekt': '/zvukovi/hover-efekt.wav',
};

interface AudioPostavke {
  volumen: number;
  utišano: boolean;
}

// UI feedback (klik/hover) je najucestaliji i najlakse zamara - stisan na 30% (-70%); ostalo na 60% (-40%).
const POJACANJE_PO_DOGADAJU: Record<AudioDogadaj, number> = {
  'ulazak-u-sobu': 0.6,
  'izlazak-iz-sobe': 0.6,
  'odbrojavanje-single-count-sound': 0.6,
  'pocetak-partije': 0.6,
  'potez-prihvacen': 0.6,
  'potez-odbijen-1': 0.6,
  'potez-odbijen-2': 0.6,
  'potez-odbijen-3': 0.6,
  'tvoj-red': 0.6,
  eliminacija: 0.6,
  'nova-runda': 0.6,
  'partija-kraj': 0.6,
  'pred-istek-vremena': 0.6,
  'klik-misa': 0.3,
  'hover-efekt': 0.3,
};

const zadanePostavke: AudioPostavke = { volumen: 0.65, utišano: false };
export const audioPostavke = writable<AudioPostavke>(zadanePostavke);

let aktiviran = false;
let postavke: AudioPostavke = zadanePostavke;
const cache = new Map<AudioDogadaj, HTMLAudioElement>();

function ucitajPostavke(): AudioPostavke {
  if (typeof localStorage === 'undefined') return zadanePostavke;
  try {
    const spremljeno = JSON.parse(localStorage.getItem(KLJUC_POSTAVKI) ?? 'null') as Partial<AudioPostavke> | null;
    return {
      volumen: typeof spremljeno?.volumen === 'number' ? Math.min(1, Math.max(0, spremljeno.volumen)) : 0.65,
      utišano: spremljeno?.utišano === true,
    };
  } catch {
    return zadanePostavke;
  }
}

function spremiPostavke(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KLJUC_POSTAVKI, JSON.stringify(postavke));
  audioPostavke.set({ ...postavke });
}

export function inicijalizirajAudio(): void {
  if (typeof window === 'undefined') return;
  postavke = ucitajPostavke();
  audioPostavke.set({ ...postavke });
}

export function aktivirajAudio(): void {
  aktiviran = true;
}

function ucitajZvuk(dogadaj: AudioDogadaj): HTMLAudioElement {
  let zvuk = cache.get(dogadaj);
  if (!zvuk) {
    zvuk = new Audio(ZVUKOVI[dogadaj]);
    zvuk.preload = 'auto';
    cache.set(dogadaj, zvuk);
  }
  return zvuk;
}

// Klik/hover/ulazak su gotovo sigurno prvi zvukovi koje korisnik čuje - preuzeti ih odmah umjesto
// da se prvi put dohvaćaju tek pri prvom pustiAudio pozivu; ostalo ostaje lijeno (rjeđi, teži zvukovi).
const KRITICNI_ZVUKOVI: AudioDogadaj[] = ['klik-misa', 'hover-efekt', 'ulazak-u-sobu'];

function preucitajKriticneZvukove(): void {
  if (typeof window === 'undefined') return;
  for (const dogadaj of KRITICNI_ZVUKOVI) ucitajZvuk(dogadaj);
}

export function pustiAudio(dogadaj: AudioDogadaj): void {
  if (typeof window === 'undefined' || !aktiviran || postavke.utišano || postavke.volumen <= 0) return;
  const zvuk = ucitajZvuk(dogadaj);
  zvuk.volume = postavke.volumen * POJACANJE_PO_DOGADAJU[dogadaj];
  zvuk.currentTime = 0;
  void zvuk.play().catch(() => undefined);
}

export function postaviVolumen(volumen: number): void {
  postavke = { ...postavke, volumen: Math.min(1, Math.max(0, volumen)) };
  spremiPostavke();
}

export function postaviUtišano(utišano: boolean): void {
  postavke = { ...postavke, utišano };
  spremiPostavke();
}

/** Pomak slidera dok je zvuk utišan mora ga i odmutirati - jedan store-update umjesto dva. */
export function postaviGlasnocu(volumen: number): void {
  postavke = { ...postavke, volumen: Math.min(1, Math.max(0, volumen)), utišano: false };
  spremiPostavke();
}

export function dohvatiAudioPostavke(): AudioPostavke {
  return { ...postavke };
}

let globalniUiZvukoviInicijalizirani = false;
let zadnjiHoveraniGumb: Element | null = null;
const KLIKABILNI_SELEKTOR = 'button:not(:disabled), a[href]';

export function inicijalizirajGlobalneUiZvukove(): void {
  if (typeof document === 'undefined' || globalniUiZvukoviInicijalizirani) return;
  globalniUiZvukoviInicijalizirani = true;

  preucitajKriticneZvukove();

  // Prva prava korisnicka interakcija bilo gdje u appu naoruzava zvuk (aktiviran flag resetira se na svaki refresh).
  document.addEventListener('pointerdown', aktivirajAudio, { capture: true, passive: true });
  document.addEventListener('keydown', aktivirajAudio, { capture: true, passive: true });

  document.addEventListener(
    'click',
    (event) => {
      if ((event.target as Element | null)?.closest(KLIKABILNI_SELEKTOR)) pustiAudio('klik-misa');
    },
    true,
  );

  document.addEventListener(
    'mouseover',
    (event) => {
      const gumb = (event.target as Element | null)?.closest(KLIKABILNI_SELEKTOR) ?? null;
      if (gumb && gumb !== zadnjiHoveraniGumb) {
        zadnjiHoveraniGumb = gumb;
        pustiAudio('hover-efekt');
      }
    },
    true,
  );

  document.addEventListener(
    'mouseout',
    (event) => {
      const napusteniGumb = (event.target as Element | null)?.closest(KLIKABILNI_SELEKTOR) ?? null;
      const ulazi = (event as MouseEvent).relatedTarget as Element | null;
      if (napusteniGumb && napusteniGumb === zadnjiHoveraniGumb && !napusteniGumb.contains(ulazi)) {
        zadnjiHoveraniGumb = null;
      }
    },
    true,
  );
}
