/** Gost identitet - opaque token u localStorageu; javni igracId nikad nije bearer token. */
import { ADRESA_POSLUZITELJA } from './konfiguracija.js';

const KLJUC_GOST_TOKEN = 'kaladont_gost_token';
const KLJUC_SESIJSKI_TOKEN = 'kaladont_sesijski_token';
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
  if (localStorage.getItem(KLJUC_GOST_TOKEN)?.startsWith('gost.')) return;

  const odgovor = await fetch(`${ADRESA_POSLUZITELJA}/racuni/gost-sesija`, { method: 'POST' });
  if (!odgovor.ok) throw new Error('Gostujuća sesija nije uspjela.');
  const tijelo = (await odgovor.json()) as { token: string };
  localStorage.setItem(KLJUC_GOST_TOKEN, tijelo.token);
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

/** Je li gost prošao onboarding (odabir imena i avatara) - vidi routes/dobrodoslica. */
export function jeOnboardingZavrsen(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KLJUC_ONBORDING_ZAVRSEN) !== null;
}

export function oznaciOnboardingZavrsen(): void {
  localStorage.setItem(KLJUC_ONBORDING_ZAVRSEN, '1');
}

