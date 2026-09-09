/** Gost identitet - nasumični UUID u localStorage (RS-19: brisanje localStoragea = novi identitet). */
const KLJUC_GOST_TOKEN = 'kaladont_gost_token';
const KLJUC_SESIJSKI_TOKEN = 'kaladont_sesijski_token';

export function dohvatiGostToken(): string {
  if (typeof localStorage === 'undefined') {
    // SSR/build faza - vrati privremeni token, klijent ce ga zamijeniti u browseru
    return crypto.randomUUID();
  }
  const postojeci = localStorage.getItem(KLJUC_GOST_TOKEN);
  if (postojeci) return postojeci;

  const novi = crypto.randomUUID();
  localStorage.setItem(KLJUC_GOST_TOKEN, novi);
  return novi;
}

/** Sprema potpisani sesijski token nakon prijave/registracije (racuni/tokeni.ts na serveru). */
export function spremiSesijskiToken(token: string): void {
  localStorage.setItem(KLJUC_SESIJSKI_TOKEN, token);
}

export function obrisiSesijskiToken(): void {
  localStorage.removeItem(KLJUC_SESIJSKI_TOKEN);
}

/** Token koji se koristi za autentikaciju - sesijski (nakon prijave) ili gost UUID. */
export function dohvatiAuthToken(): string {
  if (typeof localStorage === 'undefined') return dohvatiGostToken();
  return localStorage.getItem(KLJUC_SESIJSKI_TOKEN) ?? dohvatiGostToken();
}

/** Ima li korisnik potpisani sesijski token (registriran/admin) ili je gost. */
export function jeRegistriranKorisnik(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(KLJUC_SESIJSKI_TOKEN) !== null;
}

