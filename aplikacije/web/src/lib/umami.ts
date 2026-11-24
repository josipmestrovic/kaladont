/** Cookieless Umami događaji — nikad ne smiju rušiti UI. */

declare global {
  interface Window {
    umami?: {
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

export type UmamiDogadjaj =
  | 'igraj-klik'
  | 'forum-klik-landing'
  | 'forum-klik-o-igri'
  | 'naslovnica-brza-igra-klik'
  | 'naslovnica-izazovi-klik'
  | 'naslovnica-trening-klik'
  | 'naslovnica-privatna-soba-klik'
  | 'naslovnica-ljestvice-klik'
  | 'naslovnica-misije-klik'
  | 'naslovnica-profil-klik'
  | 'naslovnica-registracija-klik'
  | 'naslovnica-pravila-klik'
  | 'naslovnica-novosti-klik';

export function zabiljeziUmamiDogadjaj(naziv: UmamiDogadjaj): void {
  try {
    window.umami?.track(naziv);
  } catch {
    // namjerno prazno
  }
}
