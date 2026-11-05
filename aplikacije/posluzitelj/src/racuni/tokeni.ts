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

/**
 * Jednokratni reset token. `verzija` mora odgovarati `igraci.reset_lozinke_verzija`
 * u trenutku izdavanja; uspješan reset atomski povećava verziju pa stari linkovi padaju.
 */
export function izdajTokenResetaLozinke(igracId: string, verzija: number): string {
  if (!Number.isInteger(verzija) || verzija < 0) {
    throw new Error('Verzija reset tokena mora biti cijeli broj ≥ 0.');
  }
  const istekMs = Date.now() + TRAJANJE_POTVRDE_MS;
  const sadrzaj = `reset-lozinke.${igracId}.${istekMs}.${verzija}`;
  return `${sadrzaj}.${potpisi(sadrzaj)}`;
}

export function provjeriTokenResetaLozinke(
  token: string,
): { igracId: string; verzija: number } | null {
  const dijelovi = token.split('.');
  if (dijelovi.length !== 5) return null;
  const [svrha, igracId, istekStr, verzijaStr, potpis] = dijelovi;
  if (svrha !== 'reset-lozinke' || !igracId || !istekStr || !verzijaStr || !potpis) return null;
  if (!/^\d+$/.test(verzijaStr)) return null;
  const verzija = Number(verzijaStr);
  if (!Number.isSafeInteger(verzija)) return null;

  const ocekivaniPotpis = potpisi(`${svrha}.${igracId}.${istekStr}.${verzija}`);
  const a = Buffer.from(potpis);
  const b = Buffer.from(ocekivaniPotpis);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Date.now() > Number(istekStr)) return null;

  return { igracId, verzija };
}
