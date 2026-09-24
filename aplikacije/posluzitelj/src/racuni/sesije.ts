import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci, sesije } from '../baza/shema.js';

export const TRAJANJE_SESIJE_MS = 30 * 24 * 60 * 60 * 1000;

const OBLICI_SESIJSKIH_TOKENA = /^(sesija|gost)\.[A-Za-z0-9_-]{32,43}$/;

export interface IzdanaSesija {
  token: string;
  sesijaId: string;
  istek: Date;
}

export function jeSesijskiToken(token: string): boolean {
  return OBLICI_SESIJSKIH_TOKENA.test(token);
}

export function jeGostSesijskiToken(token: string): boolean {
  return /^gost\.[A-Za-z0-9_-]{32,43}$/.test(token);
}

function hashirajToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function izdajSesijuSvrhe(igracId: string, svrha: 'sesija' | 'gost'): Promise<IzdanaSesija> {
  const token = `${svrha}.${randomBytes(32).toString('base64url')}`;
  const istek = new Date(Date.now() + TRAJANJE_SESIJE_MS);

  await baza.delete(sesije).where(lt(sesije.istek, new Date()));
  const [nova] = await baza
    .insert(sesije)
    .values({ igracId, tokenHash: hashirajToken(token), istek })
    .returning({ id: sesije.id });

  if (!nova) throw new Error('Stvaranje sesije nije uspjelo');
  return { token, sesijaId: nova.id, istek };
}

export async function dohvatiSesiju(token: string) {
  if (!jeSesijskiToken(token)) return null;

  const [sesija] = await baza
    .select()
    .from(sesije)
    .where(and(eq(sesije.tokenHash, hashirajToken(token)), gt(sesije.istek, new Date())))
    .limit(1);
  return sesija ?? null;
}

export async function opozoviSesiju(sesijaId: string): Promise<void> {
  await baza.delete(sesije).where(eq(sesije.id, sesijaId));
}

export async function izdajSesiju(igracId: string): Promise<IzdanaSesija> {
  return izdajSesijuSvrhe(igracId, 'sesija');
}

export async function stvoriGostSesiju(): Promise<{ igracId: string; token: string; sesijaId: string }> {
  const token = `gost.${randomBytes(32).toString('base64url')}`;
  return stvoriGostSesijuZaToken(token);
}

export async function stvoriGostSesijuZaToken(token: string): Promise<{ igracId: string; token: string; sesijaId: string }> {
  if (!/^gost\.[A-Za-z0-9_-]{32,43}$/.test(token)) throw new Error('Nevaljan gostujući token');
  const [igrac] = await baza
    .insert(igraci)
    .values({ vrsta: 'gost', nadimak: 'Gost', avatarId: 0 })
    .returning({ id: igraci.id });
  if (!igrac) throw new Error('Stvaranje gosta nije uspjelo');
  const istek = new Date(Date.now() + TRAJANJE_SESIJE_MS);
  const [sesija] = await baza.insert(sesije).values({ igracId: igrac.id, tokenHash: hashirajToken(token), istek }).returning({ id: sesije.id });
  if (!sesija) throw new Error('Stvaranje gostujuće sesije nije uspjelo');
  return { igracId: igrac.id, token, sesijaId: sesija.id };
}