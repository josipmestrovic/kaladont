/**
 * Potpisani tokeni (sesija, potvrda emaila, reset lozinke) - HMAC nad SESIJA_TAJNA.
 * Format: `${svrha}.${igracId}.${istekMs}.${potpis}` - razlikuje se od gost UUID-a (nema tocaka).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TRAJANJE_SESIJE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dana
const TRAJANJE_POTVRDE_MS = 24 * 60 * 60 * 1000; // 24 h (sigurnost-i-privatnost.md)

function tajna(): string {
  const t = process.env.SESIJA_TAJNA;
  if (!t) throw new Error('SESIJA_TAJNA nije postavljen (vidi .env.primjer)');
  return t;
}

function potpisi(sadrzaj: string): string {
  return createHmac('sha256', tajna()).update(sadrzaj).digest('base64url');
}

function izdaj(svrha: string, igracId: string, trajanjeMs: number): string {
  const istekMs = Date.now() + trajanjeMs;
  const sadrzaj = `${svrha}.${igracId}.${istekMs}`;
  return `${sadrzaj}.${potpisi(sadrzaj)}`;
}

/** Vraća igracId ako je token valjan (potpis + svrha + neistekao), inače null. */
function provjeri(ocekivanaSvrha: string, token: string): string | null {
  const dijelovi = token.split('.');
  if (dijelovi.length !== 4) return null;
  const [svrha, igracId, istekStr, potpis] = dijelovi;
  if (svrha !== ocekivanaSvrha || !igracId || !istekStr || !potpis) return null;

  const ocekivaniPotpis = potpisi(`${svrha}.${igracId}.${istekStr}`);
  const a = Buffer.from(potpis);
  const b = Buffer.from(ocekivaniPotpis);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(istekStr)) return null;

  return igracId;
}

/** Je li ovo format potpisanog tokena (za razliku od gost UUID-a). */
export function jePotpisaniToken(token: string): boolean {
  return token.includes('.');
}

export const izdajSesijskiToken = (igracId: string): string => izdaj('sesija', igracId, TRAJANJE_SESIJE_MS);
export const provjeriSesijskiToken = (token: string): string | null => provjeri('sesija', token);

export const izdajTokenPotvrdeEmaila = (igracId: string): string =>
  izdaj('potvrda-emaila', igracId, TRAJANJE_POTVRDE_MS);
export const provjeriTokenPotvrdeEmaila = (token: string): string | null => provjeri('potvrda-emaila', token);

export const izdajTokenResetaLozinke = (igracId: string): string =>
  izdaj('reset-lozinke', igracId, TRAJANJE_POTVRDE_MS);
export const provjeriTokenResetaLozinke = (token: string): string | null => provjeri('reset-lozinke', token);
