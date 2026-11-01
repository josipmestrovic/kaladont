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
  | 'promjena-reda'
  | 'eliminacija'
  | 'aplauz-kaladont'
  | 'partija-kraj'
  | 'pred-istek-vremena'
  | 'klik-misa'
  | 'hover-efekt';

const KLJUC_POSTAVKI = 'kaladont_audio_postavke_v1';
const ZVUKOVI: Record<AudioDogadaj, string> = {
  'ulazak-u-sobu': '/zvukovi/ulazak-u-sobu.mp3',
  'izlazak-iz-sobe': '/zvukovi/izlazak-iz-sobe.mp3',
  'odbrojavanje-single-count-sound': '/zvukovi/odbrojavanje-single-count-sound.mp3',
  'pocetak-partije': '/zvukovi/pocetak-partije.mp3',
  'potez-prihvacen': '/zvukovi/potez-prihvacen.mp3',
  'potez-odbijen-1': '/zvukovi/potez-odbijen-1.mp3',
  'potez-odbijen-2': '/zvukovi/potez-odbijen-2.mp3',
  'potez-odbijen-3': '/zvukovi/potez-odbijen-3.mp3',
  'tvoj-red': '/zvukovi/tvoj-red.mp3',
  'promjena-reda': '/zvukovi/promjena-reda.mp3',
  eliminacija: '/zvukovi/eliminacija.mp3',
  'aplauz-kaladont': '/zvukovi/applause-cheering.mp3',
  'partija-kraj': '/zvukovi/partija-kraj.mp3',
  'pred-istek-vremena': '/zvukovi/pred-istek-vremena.mp3',
  'klik-misa': '/zvukovi/klik-misa.mp3',
  'hover-efekt': '/zvukovi/hover-efekt.mp3',
};

const UI_ZVUKOVI: AudioDogadaj[] = ['klik-misa', 'hover-efekt'];

/** Kritični SFX — warm do canplaythrough (odbrojavanje / potez / UI). */
const KRITICNI_WARM_ZVUKOVI: ReadonlySet<AudioDogadaj> = new Set([
  'odbrojavanje-single-count-sound',
  'pocetak-partije',
  'ulazak-u-sobu',
  'tvoj-red',
  'promjena-reda',
  'potez-prihvacen',
  'klik-misa',
  'hover-efekt',
]);

const GAMEPLAY_ZVUKOVI: AudioDogadaj[] = [
  'ulazak-u-sobu',
  'izlazak-iz-sobe',
  'odbrojavanje-single-count-sound',
  'pocetak-partije',
  'potez-prihvacen',
  'potez-odbijen-1',
  'potez-odbijen-2',
  'potez-odbijen-3',
  'tvoj-red',
  'promjena-reda',
  'eliminacija',
  'aplauz-kaladont',
  'partija-kraj',
  'pred-istek-vremena',
];

interface AudioPostavke {
  volumen: number;
  utišano: boolean;
}

// UI feedback (klik/hover) je najucestaliji i najlakse zamara - stisan na 30% (-70%);
// eliminacija i dugi aplauz su tiši da ne preglase tvoj-red / promjena-reda.
const POJACANJE_PO_DOGADAJU: Record<AudioDogadaj, number> = {
  'ulazak-u-sobu': 0.6,
  'izlazak-iz-sobe': 0.6,
  'odbrojavanje-single-count-sound': 0.6,
  'pocetak-partije': 0.6,
  'potez-prihvacen': 0.6,
  'potez-odbijen-1': 0.6,
  'potez-odbijen-2': 0.6,
  'potez-odbijen-3': 0.6,
  'tvoj-red': 0.85,
  'promjena-reda': 0.6,
  eliminacija: 0.3,
  'aplauz-kaladont': 0.25,
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
/** Trenutno svirajući cached elementi — gasi se pri izlasku iz partije. */
const aktivniZvukovi = new Set<HTMLAudioElement>();
let uiZvukoviPokrenuti = false;
let gameplayZvukoviPokrenuti = false;
let audioUnlockOdraden = false;

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

function odkljucajAudioPipeline(): void {
  if (audioUnlockOdraden || typeof window === 'undefined') return;
  audioUnlockOdraden = true;
  try {
    // Odvojeni element — ne diraj cached klik-misa (pointerdown + click bi se preklapali).
    const unlock = new Audio(ZVUKOVI['klik-misa']);
    unlock.preload = 'auto';
    unlock.muted = true;
    unlock.volume = 0;
    const ocisti = () => {
      try {
        unlock.pause();
      } catch {
        // Unlock ne smije bacati.
      }
    };
    void unlock.play().then(ocisti).catch(ocisti);
  } catch {
    // Unlock ne smije bacati.
  }
}

export function aktivirajAudio(): void {
  aktiviran = true;
  odkljucajAudioPipeline();
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

function cekajCanPlayThrough(zvuk: HTMLAudioElement): void {
  if (zvuk.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return;
  const naGotovo = () => {
    zvuk.removeEventListener('canplaythrough', naGotovo);
    zvuk.removeEventListener('error', naGotovo);
  };
  zvuk.addEventListener('canplaythrough', naGotovo, { once: true });
  zvuk.addEventListener('error', naGotovo, { once: true });
  try {
    zvuk.load();
  } catch {
    naGotovo();
  }
}

/** Zagrije cache; kritični SFX dodatno do canplaythrough (ne blokira UI). */
function zagrijZvukove(dogadaji: readonly AudioDogadaj[]): void {
  if (typeof window === 'undefined') return;
  for (const dogadaj of dogadaji) {
    try {
      const zvuk = ucitajZvuk(dogadaj);
      if (KRITICNI_WARM_ZVUKOVI.has(dogadaj)) cekajCanPlayThrough(zvuk);
    } catch {
      // Warm-up ne smije bacati.
    }
  }
}

function pokreniUPozadini(posao: () => void): void {
  if (typeof window === 'undefined') return;
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) ric(() => posao(), { timeout: 2_000 });
  else window.setTimeout(posao, 0);
}

/** Fire-and-forget nakon reveal — klik/hover (idle OK). */
export function preucitajUiZvukove(): void {
  if (uiZvukoviPokrenuti) return;
  uiZvukoviPokrenuti = true;
  pokreniUPozadini(() => zagrijZvukove(UI_ZVUKOVI));
}

/**
 * Zagrij gameplay SFX odmah (bez idle) — zove se iz user gest-a / ulaska u red.
 * Ne await-a canplaythrough; fetch kreće u istom ticku.
 */
export function zagrijGameplayZvukove(): void {
  if (gameplayZvukoviPokrenuti) return;
  gameplayZvukoviPokrenuti = true;
  zagrijZvukove(GAMEPLAY_ZVUKOVI);
}

const TIMEOUT_PLAY_RETRY_MS = 1_500;

export function pustiAudio(dogadaj: AudioDogadaj): void {
  if (typeof window === 'undefined' || !aktiviran || postavke.utišano || postavke.volumen <= 0) return;
  try {
    // Reuse istog elementa — cloneNode na mobitelu gubi buffer i čeka canplay po nekoliko sekundi.
    const zvuk = ucitajZvuk(dogadaj);
    zvuk.volume = postavke.volumen * POJACANJE_PO_DOGADAJU[dogadaj];
    try {
      zvuk.pause();
    } catch {
      // pause na neučitanom elementu može baciti u nekim browserima.
    }
    try {
      zvuk.currentTime = 0;
    } catch {
      // currentTime prije loada — ignoriši.
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const ocisti = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      aktivniZvukovi.delete(zvuk);
    };
    const naGresku = () => {
      cache.delete(dogadaj);
      ocisti();
    };
    zvuk.addEventListener('ended', ocisti, { once: true });
    zvuk.addEventListener('error', naGresku, { once: true });
    aktivniZvukovi.add(zvuk);

    const pokreni = () => {
      if (!aktivniZvukovi.has(zvuk)) return;
      void zvuk.play().catch(() => {
        if (!aktivniZvukovi.has(zvuk)) return;
        // play() odbijen jer buffer još nije spreman — jedan load + canplay retry s timeoutom.
        const naCanPlay = () => {
          if (retryTimer !== null) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
          if (!aktivniZvukovi.has(zvuk)) return;
          void zvuk.play().catch(ocisti);
        };
        zvuk.addEventListener('canplay', naCanPlay, { once: true });
        try {
          zvuk.load();
        } catch {
          ocisti();
          return;
        }
        retryTimer = setTimeout(() => {
          retryTimer = null;
          zvuk.removeEventListener('canplay', naCanPlay);
          ocisti();
        }, TIMEOUT_PLAY_RETRY_MS);
      });
    };

    // Optimistic play — ne čekaj canplay zauvijek (iOS/Chrome ponekad ga ne emitira nakon seek/load).
    pokreni();
  } catch {
    // Audio nikad ne smije prekinuti Socket.IO/state obradu poteza.
  }
}

/** Prekida sve trenutno svirajuće SFX (npr. izlazak iz partije). */
export function zaustaviSveZvukove(): void {
  const izAktivnih = [...aktivniZvukovi];
  aktivniZvukovi.clear();
  const kandidati = new Set<HTMLAudioElement>([...izAktivnih, ...cache.values()]);
  for (const zvuk of kandidati) {
    try {
      zvuk.pause();
      zvuk.currentTime = 0;
    } catch {
      // Čišćenje audia ne smije ometati navigaciju.
    }
  }
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
