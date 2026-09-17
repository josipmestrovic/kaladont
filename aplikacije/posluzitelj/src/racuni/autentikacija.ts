/**
 * Fastify preHandler hookovi za autentikaciju - čitaju Authorization: Bearer <token> (prioritet)
 * ili kaladont_sesija kolačić, verificiraju serversku sesiju (racuni/sesije.ts).
 * Dualna podrška: serverske sesije (registrirani) i goli UUID-i (gosti).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { dohvatiSesiju, jeGostSesijskiToken, jeSesijskiToken } from './sesije.js';

export interface ZahtjevSIgracem extends FastifyRequest {
  igrac?: typeof igraci.$inferSelect;
  sesijaId?: string;
}

function dohvatiToken(zahtjev: FastifyRequest): string | null {
  const header = zahtjev.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const kolacic = zahtjev.cookies?.kaladont_sesija;
  return kolacic ?? null;
}

export async function dohvatiSesijuZahtjeva(zahtjev: FastifyRequest) {
  const token = dohvatiToken(zahtjev);
  return token && jeSesijskiToken(token) ? dohvatiSesiju(token) : null;
}

/** Dohvata igraca iz baze - prihvaca serverske sesije (registrirani) ili gole UUID-e (gosti). */
async function dohvatiIgraca(
  zahtjev: FastifyRequest,
): Promise<{ igrac: typeof igraci.$inferSelect; sesijaId?: string } | null> {
  const token = dohvatiToken(zahtjev);
  if (!token) return null;

  if (jeSesijskiToken(token)) {
    const sesija = await dohvatiSesijuZahtjeva(zahtjev);
    if (!sesija) return null;
    const [redak] = await baza.select().from(igraci).where(eq(igraci.id, sesija.igracId)).limit(1);
    if (!redak || redak.obrisanAt) return null;
    if (jeGostSesijskiToken(token) && redak.vrsta !== 'gost') return null;
    return { igrac: redak, sesijaId: sesija.id };
  }
  return null;
}

/** Zahtijeva identifikaciju - prihvaca registrirane (potpisani token) i goste (goli UUID). */
export async function zahtijevajIdentifikaciju(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const autentikacija = await dohvatiIgraca(zahtjev);
  if (!autentikacija) {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je identifikacija (prijava ili gost token).' });
    return;
  }
  zahtjev.igrac = autentikacija.igrac;
  zahtjev.sesijaId = autentikacija.sesijaId;
}

/** Opcionalna identifikacija - postavlja zahtjev.igrac ako je token valjan, inace tiho nastavlja bez greske. */
export async function pokusajIdentifikaciju(zahtjev: ZahtjevSIgracem): Promise<void> {
  const autentikacija = await dohvatiIgraca(zahtjev);
  if (autentikacija) {
    zahtjev.igrac = autentikacija.igrac;
    zahtjev.sesijaId = autentikacija.sesijaId;
  }
}

export async function zahtijevajPrijavu(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const autentikacija = await dohvatiIgraca(zahtjev);
  if (!autentikacija || autentikacija.igrac.vrsta === 'gost') {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je prijava (samo registrirani).' });
    return;
  }
  zahtjev.igrac = autentikacija.igrac;
  zahtjev.sesijaId = autentikacija.sesijaId;
}

export async function zahtijevajAdmina(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const autentikacija = await dohvatiIgraca(zahtjev);
  if (!autentikacija) {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je prijava.' });
    return;
  }
  if (autentikacija.igrac.vrsta !== 'admin') {
    await odgovor.code(403).send({ ok: false, greska: 'Potrebne su admin ovlasti.' });
    return;
  }
  zahtjev.igrac = autentikacija.igrac;
  zahtjev.sesijaId = autentikacija.sesijaId;
}
