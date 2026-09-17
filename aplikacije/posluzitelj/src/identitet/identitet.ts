/**
 * Razrješavanje identiteta pri Socket.IO handshakeu (gost token iz localStoragea, ili
 * serverska sesija nakon prijave - racuni/sesije.ts).
 * RS-18: dopuštena je samo jedna aktivna veza po identitetu.
 */
import { and, eq, lt } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { dohvatiSesiju, jeGostSesijskiToken, jeSesijskiToken, stvoriGostSesijuZaToken } from '../racuni/sesije.js';

const INTERVAL_AKTIVNOSTI_MS = 15 * 60 * 1000;

/** Broj statičkih avatara dostupnih u web katalogu. */
export const BROJ_AVATARA = 9;

export function jeValjaniToken(token: unknown): token is string {
  return typeof token === 'string' && jeSesijskiToken(token);
}

export interface Identitet {
  igracId: string;
  nadimak: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  avatarId: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  odigrane1v1: number;
  pobjede1v1: number;
  bodovi1v1: number;
  iskustvoUkupno: number;
  sesijaId?: string;
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
    odigrane1v1: redak.odigrane1v1,
    pobjede1v1: redak.pobjede1v1,
    bodovi1v1: redak.bodovi1v1,
    iskustvoUkupno: redak.iskustvoUkupno,
  };
}

async function osvjeziZadnjuAktivnostAkoTreba(redak: typeof igraci.$inferSelect): Promise<void> {
  const sada = new Date();
  const granica = new Date(sada.getTime() - INTERVAL_AKTIVNOSTI_MS);
  if (redak.zadnjaAktivnost >= granica) return;

  await baza
    .update(igraci)
    .set({ zadnjaAktivnost: sada })
    .where(and(eq(igraci.id, redak.id), lt(igraci.zadnjaAktivnost, granica)));
}

/**
 * Razrješava identitet iz tokena poslanog u Socket.IO handshakeu.
 * - Sesijski token (nakon prijave) -> mora postojati aktivni red u `sesije`, inače baca grešku.
 * - Guest/session token -> mora postojati aktivna serverska sesija.
 */
export async function razrijesiIdentitet(token: string): Promise<Identitet> {
  if (jeSesijskiToken(token)) {
    const sesija = await dohvatiSesiju(token) ?? (jeGostSesijskiToken(token) ? await stvoriGostSesijuZaToken(token) : null);
    if (!sesija) throw new Error('Nevaljan ili istekao sesijski token');
    const igracId = sesija.igracId;
    const [postojeci] = await baza.select().from(igraci).where(eq(igraci.id, igracId)).limit(1);
    if (!postojeci || postojeci.obrisanAt) {
      throw new Error('Sesijski token ne odgovara nijednom igraču');
    }
    await osvjeziZadnjuAktivnostAkoTreba(postojeci);
    return { ...uIdentitet(postojeci), sesijaId: 'sesijaId' in sesija ? sesija.sesijaId : sesija.id };
  }

  throw new Error('Nevaljan ili istekao gostujući sesijski token');
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
