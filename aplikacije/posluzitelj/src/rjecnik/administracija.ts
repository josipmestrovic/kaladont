/**
 * Ručna administracija rječnika - reusable primitiva (koristi je admin ruta iz Faze 7,
 * vidi PLAN-IMPLEMENTACIJE.md).
 */
import { eq } from 'drizzle-orm';
import { grafemi, kljucGrupe, type VrstaRijeci } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { izmjeneRjecnika, rijeci } from '../baza/shema.js';

const DOPUSTENA_SLOVA = /^[a-zšđčćž]+$/;

export class NevaljanaRijecError extends Error {}

/** Dodaje riječ u rječnik (UPSERT) i bilježi izmjenu u izmjene_rjecnika. Vrsta je obavezna (ADR-013);
 * leksemska grupa se izvodi iz vrste i leme (default: sama riječ). Ne osvježava memoriju - pozovi rjecnik.ponovoUcitaj(). */
export async function dodajRijec(
  rijecUlaz: string,
  razlog: string,
  adminId: string | null,
  vrsta: VrstaRijeci,
  lemaUlaz?: string,
): Promise<void> {
  const rijec = rijecUlaz.normalize('NFC').trim().toLowerCase();
  const lema = (lemaUlaz ?? rijec).normalize('NFC').trim().toLowerCase();

  if (rijec.length < 2 || !DOPUSTENA_SLOVA.test(rijec)) {
    throw new NevaljanaRijecError(`Neispravan oblik riječi: "${rijecUlaz}"`);
  }

  const svi = grafemi(rijec);
  if (svi.length < 2) {
    throw new NevaljanaRijecError(`Riječ mora imati barem 2 grafema: "${rijecUlaz}"`);
  }
  const prvaDva = svi.slice(0, 2).join('');
  const zadnjaDva = svi.slice(-2).join('');
  const grupa = kljucGrupe(vrsta, lema);

  await baza
    .insert(rijeci)
    .values({ rijec, prvaDva, zadnjaDva, vrste: [vrsta], grupe: [grupa], aktivna: true, napomena: 'ručno dodano' })
    .onConflictDoUpdate({ target: rijeci.rijec, set: { aktivna: true } });

  await baza.insert(izmjeneRjecnika).values({ rijec, akcija: 'dodana', razlog, adminId });
}

/** Soft-delete (aktivna=false) - povijest odigranih partija ostaje razumljiva (odrzavanje-rjecnika.md). */
export async function deaktivirajRijec(rijecUlaz: string, razlog: string, adminId: string | null = null): Promise<void> {
  const rijec = rijecUlaz.normalize('NFC').trim().toLowerCase();
  await baza.update(rijeci).set({ aktivna: false }).where(eq(rijeci.rijec, rijec));
  await baza.insert(izmjeneRjecnika).values({ rijec, akcija: 'uklonjena', razlog, adminId });
}

/** Vraća prethodno deaktiviranu riječ. */
export async function vratiRijec(rijecUlaz: string, razlog: string, adminId: string | null = null): Promise<void> {
  const rijec = rijecUlaz.normalize('NFC').trim().toLowerCase();
  await baza.update(rijeci).set({ aktivna: true }).where(eq(rijeci.rijec, rijec));
  await baza.insert(izmjeneRjecnika).values({ rijec, akcija: 'vracena', razlog, adminId });
}

