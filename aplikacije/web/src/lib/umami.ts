/** Cookieless Umami događaji — nikad ne smiju rušiti UI. */

declare global {
  interface Window {
    umami?: {
      track: (
        event: string,
        data?: Record<string, string>,
      ) => void | Promise<unknown>;
    };
  }
}

export type UmamiIzvor =
  | 'naslovnica'
  | 'izbornik_profila'
  | 'zavrsetak_partije'
  | 'zavrsetak_izazova'
  | 'zavrsetak_treninga'
  | 'profil'
  | 'footer'
  | 'misije'
  | 'ljestvice'
  | 'postavke'
  | 'prijava'
  | 'registracija'
  | 'zahvala'
  | 'avatar_editor'
  | 'obavijest_misije'
  | 'ostalo';

export type UmamiMod = 'brza_igra' | 'izazovi' | 'trening' | 'privatna_soba';

export type UmamiOdrediste =
  | 'ljestvice'
  | 'misije'
  | 'kolekcija'
  | 'dostignuca'
  | 'profil'
  | 'pravila'
  | 'novosti';

export type UmamiPayloadi = {
  'mod-klik': { mod: UmamiMod; izvor: UmamiIzvor };
  'navigacija-klik': { odrediste: UmamiOdrediste; izvor: UmamiIzvor };
  'registracija-klik': { izvor: UmamiIzvor };
  'prijava-klik': { izvor: UmamiIzvor };
  'privatna-soba-kreirana': undefined;
  'privatna-soba-link-kopiran': undefined;
  'avatar-uredjivanje-otvoreno': { izvor: UmamiIzvor };
  'avatar-spremljen': undefined;
  'povratne-informacije-poslane': undefined;
};

export type UmamiDogadjaj = keyof UmamiPayloadi;

type ArgumeniDogadjaja<T extends UmamiDogadjaj> = UmamiPayloadi[T] extends undefined
  ? [naziv: T]
  : [naziv: T, podaci: UmamiPayloadi[T]];

export function zabiljeziUmamiDogadjaj<T extends UmamiDogadjaj>(
  ...args: ArgumeniDogadjaja<T>
): void {
  if (typeof window === 'undefined') return;

  const [naziv, podaci] = args;
  try {
    const rezultat = podaci
      ? window.umami?.track(naziv, podaci)
      : window.umami?.track(naziv);
    if (rezultat != null && typeof (rezultat as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(rezultat).catch(() => {
        // namjerno prazno — analitika ne smije rušiti UI
      });
    }
  } catch {
    // namjerno prazno
  }
}
