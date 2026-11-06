import { and, eq } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
  ID_DOSTIGNUCA_SVE_POHVALE,
  lokalniDatumIso,
} from 'zajednicko';
import { evidencijaDnevnihPobjedaModova, igraci } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';
import { dodijeliDoprinos, type IshodDodjele } from './dodjela.js';

function prazanIshod(): IshodDodjele {
  return { doprinosUmetnut: false, novaDostignuca: [], noveObavijesti: [] };
}

/**
 * Zabilježi javnu pobjedu moda na zagrebački datum. Brojač raste jednom po danu
 * tek kad su za taj datum prisutna oba moda. Dodatne pobjede istog dana ne dodaju doprinos.
 */
export async function priznajDnevnuPobjeduModa(
  tx: MisijeTx,
  ulaz: { igracId: string; mod: 'dva_igraca' | 'cetiri_igraca'; zavrsenoU: Date },
): Promise<IshodDodjele> {
  const lokalniDatum = lokalniDatumIso(ulaz.zavrsenoU);
  await tx.select({ id: igraci.id }).from(igraci).where(eq(igraci.id, ulaz.igracId)).for('update');
  await tx.insert(evidencijaDnevnihPobjedaModova).values({
    igracId: ulaz.igracId,
    lokalniDatum,
    mod: ulaz.mod,
  }).onConflictDoNothing();

  const modovi = await tx.select({ mod: evidencijaDnevnihPobjedaModova.mod }).from(evidencijaDnevnihPobjedaModova).where(and(
    eq(evidencijaDnevnihPobjedaModova.igracId, ulaz.igracId),
    eq(evidencijaDnevnihPobjedaModova.lokalniDatum, lokalniDatum),
  ));
  const prisutni = new Set(modovi.map((red) => red.mod));
  if (!prisutni.has('dva_igraca') || !prisutni.has('cetiri_igraca')) return prazanIshod();

  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
    dokaz: { vrsta: 'dnevna_pobjeda', lokalniDatum },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'dvostruka_kruna',
    kontekst: { lokalniDatum },
  });
}

/** Obje usporedne pohvale iste javne igre. Dijeljeno prvo mjesto vrijedi. */
export function priznajSvePohvale(
  tx: MisijeTx,
  ulaz: { igracId: string; partijaId: string; zavrsenoU: Date },
): Promise<IshodDodjele> {
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_SVE_POHVALE,
    dokaz: { vrsta: 'sve_pohvale', partijaId: ulaz.partijaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'sve_pohvale',
    kontekst: { partijaId: ulaz.partijaId },
  });
}
