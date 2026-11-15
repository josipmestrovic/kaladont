/**
 * Razrješavanje identiteta pri Socket.IO handshakeu (gost token iz localStoragea, ili
 * serverska sesija nakon prijave - racuni/sesije.ts).
 * RS-18: dopuštena je samo jedna aktivna veza po identitetu.
 */
import { and, eq, lt } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci, statistikeModaIgraca } from '../baza/shema.js';
import { jePrihvacenaAktualnaVerzijaUvjeta, validirajAvatarConfig, type AvatarConfigV1 } from 'zajednicko';
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
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  odigrane1v1: number;
  pobjede1v1: number;
  bodovi1v1: number;
  odigrane3p: number;
  pobjede3p: number;
  bodovi3p: number;
  /** PR09 univerzalni rang agregat. */
  rangBrojPartija: number;
  rangSumaJedinica: number;
  iskustvoUkupno: number;
  emailPotvrdjen: boolean;
  uvjetiPrihvaceni: boolean;
  sesijaId?: string;
}

async function dohvatiTrobojBrojace(igracId: string): Promise<{ odigrane3p: number; pobjede3p: number; bodovi3p: number }> {
  const [red] = await baza
    .select({
      odigrane3p: statistikeModaIgraca.odigrane,
      pobjede3p: statistikeModaIgraca.pobjede,
      bodovi3p: statistikeModaIgraca.bodovi,
    })
    .from(statistikeModaIgraca)
    .where(and(eq(statistikeModaIgraca.igracId, igracId), eq(statistikeModaIgraca.mod, 'tri_igraca')))
    .limit(1);
  return {
    odigrane3p: red?.odigrane3p ?? 0,
    pobjede3p: red?.pobjede3p ?? 0,
    bodovi3p: red?.bodovi3p ?? 0,
  };
}

async function uIdentitet(redak: typeof igraci.$inferSelect): Promise<Identitet> {
  const troboj = await dohvatiTrobojBrojace(redak.id);
  return {
    igracId: redak.id,
    nadimak: redak.nadimak,
    vrsta: redak.vrsta,
    avatarId: redak.avatarId,
    avatarConfig: validirajAvatarConfig(redak.avatarConfig) ? redak.avatarConfig : null,
    avatarRevision: redak.avatarRevision,
    odigrane: redak.odigrane,
    pobjede: redak.pobjede,
    bodoviUkupno: redak.bodoviUkupno,
    odigrane1v1: redak.odigrane1v1,
    pobjede1v1: redak.pobjede1v1,
    bodovi1v1: redak.bodovi1v1,
    ...troboj,
    rangBrojPartija: redak.rangBrojPartija,
    rangSumaJedinica: Number(redak.rangSumaJedinica ?? 0),
    iskustvoUkupno: redak.iskustvoUkupno,
    emailPotvrdjen: redak.emailPotvrdjen,
    uvjetiPrihvaceni: jePrihvacenaAktualnaVerzijaUvjeta(redak.potvrdaDob16, redak.uvjetiVerzija),
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
    if (!postojeci || postojeci.obrisanAt || postojeci.upravljac === 'bot') {
      throw new Error('Sesijski token ne odgovara nijednom igraču');
    }
    await osvjeziZadnjuAktivnostAkoTreba(postojeci);
    return { ...(await uIdentitet(postojeci)), sesijaId: 'sesijaId' in sesija ? sesija.sesijaId : sesija.id };
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
