import { get, writable } from 'svelte/store';

const KLJUC_POSTAVKE = 'kaladont_glas_postavke_v1';

export const glasUkljucen = writable(false);

export interface GovornoOkruzenje {
  provjereno: boolean;
  podrzavaSintezu: boolean;
  platforma: string;
  jeziciPreglednika: string[];
  jeziciGlasova: string[];
  hrvatskiGlas: boolean;
}

export const govornoOkruzenje = writable<GovornoOkruzenje>({
  provjereno: false,
  podrzavaSintezu: false,
  platforma: 'nepoznat sustav',
  jeziciPreglednika: [],
  jeziciGlasova: [],
  hrvatskiGlas: false,
});

let slusateljGlasovaRegistriran = false;

function procijeniPlatformu(): string {
  const navigator = window.navigator;
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (userAgent.includes('android')) return 'Android';
  if (/iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && navigator.maxTouchPoints > 1)) return 'iOS/iPadOS';
  if (userAgent.includes('windows')) return 'Windows';
  if (userAgent.includes('mac os') || platform.includes('mac')) return 'macOS';
  if (userAgent.includes('linux')) return 'Linux';
  return 'nepoznat sustav';
}

export function osvjeziGovornoOkruzenje(): void {
  if (typeof window === 'undefined') return;

  const sinteza = window.speechSynthesis;
  let jeziciGlasova: string[] = [];
  if (sinteza) {
    try {
      jeziciGlasova = [...new Set(sinteza.getVoices().map((glas) => glas.lang).filter(Boolean))];
    } catch {
      jeziciGlasova = [];
    }
  }

  const jeziciPreglednika = [...new Set((window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language]).filter(Boolean))];

  govornoOkruzenje.set({
    provjereno: true,
    podrzavaSintezu: typeof SpeechSynthesisUtterance !== 'undefined' && Boolean(sinteza),
    platforma: procijeniPlatformu(),
    jeziciPreglednika,
    jeziciGlasova,
    hrvatskiGlas: jeziciGlasova.some((jezik) => jezik.toLowerCase().startsWith('hr')),
  });
}

export function inicijalizirajGlas(): void {
  if (typeof window === 'undefined') return;

  osvjeziGovornoOkruzenje();
  if (!slusateljGlasovaRegistriran && window.speechSynthesis) {
    window.speechSynthesis.addEventListener('voiceschanged', osvjeziGovornoOkruzenje);
    slusateljGlasovaRegistriran = true;
  }

  let ukljucen = false;
  try {
    ukljucen = window.localStorage.getItem(KLJUC_POSTAVKE) === 'true';
  } catch {
    // Govor ostaje isključen kada lokalna pohrana nije dostupna.
  }

  glasUkljucen.set(ukljucen);
}

export function postaviGlas(ukljucen: boolean): void {
  glasUkljucen.set(ukljucen);
  if (typeof window === 'undefined') return;

  if (!ukljucen) {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // Isključivanje postavke ne smije prekinuti sučelje.
    }
  }
  try {
    window.localStorage.setItem(KLJUC_POSTAVKE, String(ukljucen));
  } catch {
    // Promjena vrijedi do zatvaranja stranice i bez dostupne lokalne pohrane.
  }
}

export function izgovoriRijec(rijec: string): void {
  if (
    typeof window === 'undefined' ||
    typeof SpeechSynthesisUtterance === 'undefined' ||
    !get(glasUkljucen) ||
    !('speechSynthesis' in window)
  ) return;

  try {
    const izgovor = new SpeechSynthesisUtterance(rijec);
    izgovor.lang = 'hr-HR';
    izgovor.rate = 0.9;
    const hrvatskiGlas = window.speechSynthesis.getVoices().find((glas) => glas.lang.toLowerCase().startsWith('hr'));
    if (hrvatskiGlas) izgovor.voice = hrvatskiGlas;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(izgovor);
  } catch {
    // Nedostupan ili blokiran govor ne smije ometati partiju.
  }
}

export function zaustaviGovor(): void {
  try {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  } catch {
    // Čišćenje govora ne smije ometati napuštanje partije.
  }
}