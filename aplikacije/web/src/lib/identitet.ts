/** Gost identitet - opaque token u localStorageu; javni igracId nikad nije bearer token. */
import { apiUrl } from './api-url.js';

const KLJUC_GOST_TOKEN = 'kaladont_gost_token';
const KLJUC_SESIJSKI_TOKEN = 'kaladont_sesijski_token';
// Naslijedeni kljuc ukinutog onboardinga gostiju; brise se da ne ostane u pregledniku.
const KLJUC_ONBORDING_ZAVRSEN = 'kaladont_onboarding_zavrsen';

export function dohvatiGostToken(): string {
  if (typeof localStorage === 'undefined') {
    // SSR/build faza - privremeni; klijent koristi samo token iz gost-sesije.
    return `gost.${crypto.randomUUID().replaceAll('-', '')}`;
  }
  // Sync read — može biti prazan prije gost-sesije. Za HTTP/socket koristi osigurajAuthToken().
  return localStorage.getItem(KLJUC_GOST_TOKEN) ?? '';
}

/** Gost token koji je u ovoj kartici prošao /profil (ili tek stigao iz gost-sesije). */
let zadnjiValjaniGostToken: string | null = null;

/** Vraća bearer token; nevaljani leftover gost.* se zamijeni prije HTTP/socket poziva. */
export async function osigurajAuthToken(): Promise<string> {
  if (typeof localStorage === 'undefined') return dohvatiAuthToken();
  const sesijski = localStorage.getItem(KLJUC_SESIJSKI_TOKEN);
  if (sesijski) return sesijski;

  const gost = localStorage.getItem(KLJUC_GOST_TOKEN) ?? '';
  if (gost && gost === zadnjiValjaniGostToken) return gost;

  // Cache puni samo init (uspješan /profil ili novi token) — 5xx ne smije cacheirati slijepo.
  await inicijalizirajGostSesiju();
  return dohvatiAuthToken();
}

/** Nakon 401/neuspjelog /profil — zaboravi cache da idući osigurajAuthToken ponovo validira. */
export async function osvjeziGostSesijuNakon401(): Promise<void> {
  zadnjiValjaniGostToken = null;
  await inicijalizirajGostSesiju();
}

/** Jedan in-flight init — paralelni pozivi ne smiju oboje obrisati tuđi valjani token. */
let gostSesijaUTijeku: Promise<void> | null = null;

export async function inicijalizirajGostSesiju(): Promise<void> {
  if (typeof localStorage === 'undefined' || localStorage.getItem(KLJUC_SESIJSKI_TOKEN)) return;
  if (gostSesijaUTijeku) return gostSesijaUTijeku;

  gostSesijaUTijeku = (async () => {
    const postojeci = localStorage.getItem(KLJUC_GOST_TOKEN);
    if (postojeci?.startsWith('gost.')) {
      try {
        const provjera = await fetch(apiUrl('/profil'), {
          headers: { authorization: `Bearer ${postojeci}` },
        });
        if (provjera.ok) {
          zadnjiValjaniGostToken = postojeci;
          return;
        }
        // 401 → lokalni/nevaljani token; ostale greške — ostavi token i kasnije retryaj profil.
        if (provjera.status !== 401) return;
      } catch {
        // Mreža pala — ne briši token, boot ide dalje.
        return;
      }
      // Briši samo ako je još isti token — inače bi obrisali valjanu sesiju koju je drugi poziv upravo spremio.
      if (localStorage.getItem(KLJUC_GOST_TOKEN) === postojeci) {
        localStorage.removeItem(KLJUC_GOST_TOKEN);
        localStorage.removeItem(KLJUC_ONBORDING_ZAVRSEN);
        zadnjiValjaniGostToken = null;
      } else {
        return;
      }
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
          zadnjiValjaniGostToken = tijelo.token;
          return;
        }
      } catch {
        if (pokusaj < 2) await new Promise((r) => setTimeout(r, 200 * (pokusaj + 1)));
      }
    }
  })().finally(() => {
    gostSesijaUTijeku = null;
  });

  return gostSesijaUTijeku;
}

/** Sprema nečitljivi sesijski token nakon prijave/registracije (racuni/sesije.ts na serveru). */
export function spremiSesijskiToken(token: string): void {
  localStorage.setItem(KLJUC_SESIJSKI_TOKEN, token);
  localStorage.removeItem(KLJUC_GOST_TOKEN);
}

/** Samo sesijski token. Za odjavu + novi gost koristi `prijediNaGostujucuSesiju`. */
export function obrisiSesijskiToken(): void {
  localStorage.removeItem(KLJUC_SESIJSKI_TOKEN);
}

/** Odjavljuje račun i stvara potpuno novi gostujući identitet za samostalnu igru. */
export async function prijediNaGostujucuSesiju(): Promise<void> {
  localStorage.removeItem(KLJUC_SESIJSKI_TOKEN);
  localStorage.removeItem(KLJUC_GOST_TOKEN);
  localStorage.removeItem(KLJUC_ONBORDING_ZAVRSEN);
  zadnjiValjaniGostToken = null;
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

