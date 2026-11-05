import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';

export type IshodDodjeleAdmina =
  | 'dodijeljen'
  | 'vec-admin'
  | 'nije-pronaden'
  | 'email-nije-potvrdjen'
  | 'nije-covjek'
  | 'obrisan'
  | 'postoji-drugi-admin';

export async function dodijeliAdmina(email: string, potvrdi: boolean): Promise<IshodDodjeleAdmina> {
  const normaliziran = email.trim().toLowerCase();
  if (!normaliziran) {
    throw new Error('Email je obavezan (--email=...).');
  }

  if (!potvrdi) {
    throw new Error(
      konfiguracija.NODE_ENV === 'staging' || konfiguracija.NODE_ENV === 'production'
        ? 'U staging/produkciji dodjela admina zahtijeva --potvrdi.'
        : 'Dodjela nije potvrđena (--potvrdi).',
    );
  }

  const [igrac] = await baza
    .select({
      id: igraci.id,
      email: igraci.email,
      vrsta: igraci.vrsta,
      upravljac: igraci.upravljac,
      emailPotvrdjen: igraci.emailPotvrdjen,
      obrisanAt: igraci.obrisanAt,
    })
    .from(igraci)
    .where(sql`lower(${igraci.email}) = ${normaliziran}`)
    .limit(1);

  if (!igrac) return 'nije-pronaden';
  if (igrac.obrisanAt) return 'obrisan';
  if (igrac.upravljac !== 'covjek') return 'nije-covjek';
  if (!igrac.emailPotvrdjen) return 'email-nije-potvrdjen';
  if (igrac.vrsta === 'admin') return 'vec-admin';

  const [drugi] = await baza
    .select({ id: igraci.id })
    .from(igraci)
    .where(and(eq(igraci.vrsta, 'admin'), isNull(igraci.obrisanAt), ne(igraci.id, igrac.id)))
    .limit(1);
  if (drugi) return 'postoji-drugi-admin';

  await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igrac.id));
  console.log(`Admin dodijeljen: id=${igrac.id} email=${normaliziran}`);
  return 'dodijeljen';
}
