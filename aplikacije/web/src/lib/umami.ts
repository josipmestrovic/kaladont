/** Cookieless Umami događaji — nikad ne smiju rušiti UI. */

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

export type UmamiDogadjaj = 'igraj-klik' | 'forum-klik-landing' | 'forum-klik-o-igri';

export function zabiljeziUmamiDogadjaj(naziv: UmamiDogadjaj): void {
  try {
    window.umami?.track(naziv);
  } catch {
    // namjerno prazno
  }
}
