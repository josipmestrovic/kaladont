/** HMAC tokeni za potvrdu emaila i reset lozinke. Sesije su serverski provjerene u racuni/sesije.ts. */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { konfiguracija } from '../konfiguracija.js';

const TRAJANJE_POTVRDE_MS = 24 * 60 * 60 * 1000; // 24 h (sigurnost-i-privatnost.md)

function tajna(): string {
  return konfiguracija.SESIJA_TAJNA;
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

function hashEmaila(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('base64url');
}

export const izdajTokenPotvrdeEmaila = (igracId: string, email: string): string => {
  const istekMs = Date.now() + TRAJANJE_POTVRDE_MS;
  const emailHash = hashEmaila(email);
  const sadrzaj = `potvrda-emaila.${igracId}.${istekMs}.${emailHash}`;
  return `${sadrzaj}.${potpisi(sadrzaj)}`;
};

export function provjeriTokenPotvrdeEmaila(token: string): { igracId: string; emailHash: string } | null {
  const dijelovi = token.split('.');
  if (dijelovi.length !== 5) return null;
  const [svrha, igracId, istekStr, emailHash, potpis] = dijelovi;
  if (svrha !== 'potvrda-emaila' || !igracId || !istekStr || !emailHash || !potpis || Date.now() > Number(istekStr)) return null;
  const ocekivaniPotpis = potpisi(`${svrha}.${igracId}.${istekStr}.${emailHash}`);
  const a = Buffer.from(potpis);
  const b = Buffer.from(ocekivaniPotpis);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { igracId, emailHash };
}

export const emailHashPotvrde = hashEmaila;

export const izdajTokenResetaLozinke = (igracId: string): string =>
  izdaj('reset-lozinke', igracId, TRAJANJE_POTVRDE_MS);
export const provjeriTokenResetaLozinke = (token: string): string | null => provjeri('reset-lozinke', token);
