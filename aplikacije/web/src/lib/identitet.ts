/** Gost identitet - opaque token u localStorageu; javni igracId nikad nije bearer token. */
import { apiUrl } from './api-url.js';

const KLJUC_GOST_TOKEN = 'kaladont_gost_token';
const KLJUC_SESIJSKI_TOKEN = 'kaladont_sesijski_token';
// Naslijedeni kljuc ukinutog onboardinga gostiju; brise se da ne ostane u pregledniku.
const KLJUC_ONBORDING_ZAVRSEN = 'kaladont_onboarding_zavrsen';

export function dohvatiGostToken(): string {
  if (typeof localStorage === 'undefined') {
    // SSR/build faza - vrati privremeni token, klijent ce ga zamijeniti u browseru
    return `gost.${crypto.randomUUID().replaceAll('-', '')}`;
  }
  const postojeci = localStorage.getItem(KLJUC_GOST_TOKEN);
  if (postojeci) return postojeci;

  const novi = `gost.${crypto.randomUUID().replaceAll('-', '')}`;
  localStorage.setItem(KLJUC_GOST_TOKEN, novi);
  return novi;
}

export async function inicijalizirajGostSesiju(): Promise<void> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(KLJUC_SESIJSKI_TOKEN)) return;

  const postojeci = localStorage.getItem(KLJUC_GOST_TOKEN);
  if (postojeci?.startsWith('gost.')) {
    try {
      const provjera = await fetch(apiUrl('/profil'), {
        headers: { authorization: `Bearer ${postojeci}` },
      });
      if (provjera.ok) return;
      // 401 → lokalni/nevaljani token; ostale greške — ostavi token i kasnije retryaj profil.
      if (provjera.status !== 401) return;
    } catch {
      // Mreža pala — ne briši token, boot ide dalje.
      return;
    }
    localStorage.removeItem(KLJUC_GOST_TOKEN);
    localStorage.removeItem(KLJUC_ONBORDING_ZAVRSEN);
  }

  for (let pokusaj = 0; pokusaj < 3; pokusaj += 1) {
    try {
      const odgovor = await fetch(apiUrl('/racuni/gost-sesija'), { method: 'POST' });
      if (!odgovor.ok) {
        if (pokusaj < 2) await new Promise((r) => setTimeout(r, 200 * (pokusaj + 1)));
        continue;
      }
      const tijelo = (await odgovor.json()) as { token?: string };
      if (tijelo.token) {
        localStorage.setItem(KLJUC_GOST_TOKEN, tijelo.token);
        return;
      }
    } catch {
      if (pokusaj < 2) await new Promise((r) => setTimeout(r, 200 * (pokusaj + 1)));
    }
  }
}

/** Sprema nečitljivi sesijski token nakon prijave/registracije (racuni/sesije.ts na serveru). */
export function spremiSesijskiToken(token: string): void {
  localStorage.setItem(KLJUC_SESIJSKI_TOKEN, token);
  localStorage.removeItem(KLJUC_GOST_TOKEN);
}

export function obrisiSesijskiToken(): void {
  localStorage.removeItem(KLJUC_SESIJSKI_TOKEN);
  localStorage.removeItem(KLJUC_GOST_TOKEN);
}

/** Odjavljuje račun i stvara potpuno novi gostujući identitet za samostalnu igru. */
export async function prijediNaGostujucuSesiju(): Promise<void> {
  localStorage.removeItem(KLJUC_SESIJSKI_TOKEN);
  localStorage.removeItem(KLJUC_GOST_TOKEN);
  localStorage.removeItem(KLJUC_ONBORDING_ZAVRSEN);
  await inicijalizirajGostSesiju();
}

/** Token koji se koristi za autentikaciju - sesijski (nakon prijave) ili gost UUID. */
export function dohvatiAuthToken(): string {
  if (typeof localStorage === 'undefined') return dohvatiGostToken();
  return localStorage.getItem(KLJUC_SESIJSKI_TOKEN) ?? dohvatiGostToken();
}

/** Ima li korisnik sesijski token (registriran/admin) ili je gost. */
export function jeRegistriranKorisnik(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KLJUC_SESIJSKI_TOKEN) !== null;
}

