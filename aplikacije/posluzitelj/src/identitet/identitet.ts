/**
 * Razrješavanje identiteta pri Socket.IO handshakeu (gost token iz localStoragea, ili
 * potpisani sesijski token nakon prijave - racuni/tokeni.ts).
 * RS-18: dopuštena je samo jedna aktivna veza po identitetu.
 */
import { eq } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { generirajNadimak } from './nadimci.js';
import { jePotpisaniToken, provjeriSesijskiToken } from '../racuni/tokeni.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Broj statičkih avatara dostupnih u web katalogu. */
export const BROJ_AVATARA = 9;

export function jeValjaniToken(token: unknown): token is string {
  return typeof token === 'string' && (UUID_REGEX.test(token) || jePotpisaniToken(token));
}

export interface Identitet {
  igracId: string;
  nadimak: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  avatarId: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
}

function uIdentitet(redak: typeof igraci.$inferSelect): Identitet {
  return {
    igracId: redak.id,
    nadimak: redak.nadimak,
    vrsta: redak.vrsta,
    avatarId: redak.avatarId,
    odigrane: redak.odigrane,
    pobjede: redak.pobjede,
    bodoviUkupno: redak.bodoviUkupno,
  };
}

/**
 * Razrješava identitet iz tokena poslanog u Socket.IO handshakeu.
 * - Potpisani sesijski token (nakon prijave) -> mora postojati odgovarajući red, inače baca grešku.
 * - Goli gost UUID -> create-if-missing SAMO ako red ne postoji ili je već `gost` (RS-18 + sprječava
 *   impersonaciju registriranog računa golim UUID-om bez ispravne lozinke).
 */
export async function razrijesiIdentitet(token: string): Promise<Identitet> {
  if (jePotpisaniToken(token)) {
    const igracId = provjeriSesijskiToken(token);
    if (!igracId) {
      throw new Error('Nevaljan ili istekao sesijski token');
    }
    const [postojeci] = await baza.select().from(igraci).where(eq(igraci.id, igracId)).limit(1);
    if (!postojeci) {
      throw new Error('Sesijski token ne odgovara nijednom igraču');
    }
    await baza.update(igraci).set({ zadnjaAktivnost: new Date() }).where(eq(igraci.id, igracId));
    return uIdentitet(postojeci);
  }

  const [postojeci] = await baza.select().from(igraci).where(eq(igraci.id, token)).limit(1);

  if (postojeci) {
    if (postojeci.vrsta !== 'gost') {
      throw new Error('Registrirani račun zahtijeva sesijski token, ne goli identitet');
    }
    await baza
      .update(igraci)
      .set({ zadnjaAktivnost: new Date() })
      .where(eq(igraci.id, token));
    return uIdentitet(postojeci);
  }

  const [novi] = await baza
    .insert(igraci)
    .values({
      id: token,
      vrsta: 'gost',
      nadimak: generirajNadimak(),
      avatarId: Math.floor(Math.random() * BROJ_AVATARA),
    })
    .returning();

  if (!novi) {
    throw new Error('Stvaranje gosta nije uspjelo');
  }

  return uIdentitet(novi);
}

/** Registar aktivnih socket veza po igracId - za RS-18 (jedna aktivna veza po identitetu). */
export class RegistarVeza {
  private veze = new Map<string, string>(); // igracId -> socketId

  /** Vraća socketId prethodne veze istog identiteta (za odjavu) ili null ako nema. */
  zamijeni(igracId: string, novaSocketId: string): string | null {
    const stara = this.veze.get(igracId) ?? null;
    this.veze.set(igracId, novaSocketId);
    return stara;
  }

  dohvatiSocketId(igracId: string): string | null {
    return this.veze.get(igracId) ?? null;
  }

  ukloni(igracId: string, socketId: string): void {
    if (this.veze.get(igracId) === socketId) {
      this.veze.delete(igracId);
    }
  }
}
