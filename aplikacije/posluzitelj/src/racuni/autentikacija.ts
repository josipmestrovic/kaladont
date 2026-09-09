/**
 * Fastify preHandler hookovi za autentikaciju - čitaju Authorization: Bearer <token> (prioritet)
 * ili kaladont_sesija kolačić, verificiraju potpisani sesijski token (racuni/tokeni.ts).
 * Dualna podrška: potpisani sesijski tokeni (registrirani) i goli UUID-i (gosti).
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { jePotpisaniToken, provjeriSesijskiToken } from './tokeni.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ZahtjevSIgracem extends FastifyRequest {
  igrac?: typeof igraci.$inferSelect;
}

function dohvatiToken(zahtjev: FastifyRequest): string | null {
  const header = zahtjev.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const kolacic = zahtjev.cookies?.kaladont_sesija;
  return kolacic ?? null;
}

/** Dohvata igraca iz baze - prihvaca potpisane tokene (registrirani) ili gole UUID-e (gosti, vec kreirani pri Socket.IO). */
async function dohvatiIgraca(zahtjev: FastifyRequest): Promise<typeof igraci.$inferSelect | null> {
  const token = dohvatiToken(zahtjev);
  if (!token) return null;

  let igracId: string | null = null;
  if (jePotpisaniToken(token)) {
    igracId = provjeriSesijskiToken(token);
    if (!igracId) return null;
  } else if (UUID_REGEX.test(token)) {
    igracId = token; // gosti - bez validacije HMAC-a
  } else {
    return null;
  }

  const [redak] = await baza.select().from(igraci).where(eq(igraci.id, igracId)).limit(1);
  return redak ?? null;
}

/** Zahtijeva identifikaciju - prihvaca registrirane (potpisani token) i goste (goli UUID). */
export async function zahtijevajIdentifikaciju(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const igrac = await dohvatiIgraca(zahtjev);
  if (!igrac) {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je identifikacija (prijava ili gost token).' });
    return;
  }
  zahtjev.igrac = igrac;
}

/** Opcionalna identifikacija - postavlja zahtjev.igrac ako je token valjan, inace tiho nastavlja bez greske. */
export async function pokusajIdentifikaciju(zahtjev: ZahtjevSIgracem): Promise<void> {
  const igrac = await dohvatiIgraca(zahtjev);
  if (igrac) zahtjev.igrac = igrac;
}

export async function zahtijevajPrijavu(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const igrac = await dohvatiIgraca(zahtjev);
  if (!igrac || igrac.vrsta === 'gost') {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je prijava (samo registrirani).' });
    return;
  }
  zahtjev.igrac = igrac;
}

export async function zahtijevajAdmina(zahtjev: ZahtjevSIgracem, odgovor: FastifyReply): Promise<void> {
  const igrac = await dohvatiIgraca(zahtjev);
  if (!igrac) {
    await odgovor.code(401).send({ ok: false, greska: 'Potrebna je prijava.' });
    return;
  }
  if (igrac.vrsta !== 'admin') {
    await odgovor.code(403).send({ ok: false, greska: 'Potrebne su admin ovlasti.' });
    return;
  }
  zahtjev.igrac = igrac;
}
