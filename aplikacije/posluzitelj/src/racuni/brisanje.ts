import { and, eq, isNull, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import {
  dnkStatistikeIgraca,
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  otkljucaneGrupeIgraca,
  otkljucaneRijeciIgraca,
  sesije,
  statistikeRijeciIgraca,
} from '../baza/shema.js';

export type IshodBrisanja = 'obrisan' | 'nije-pronaden' | 'vec-obrisan';

export async function obrisiRacun(email: string, potvrdi: boolean): Promise<IshodBrisanja> {
  const normaliziraniEmail = email.trim().toLowerCase();
  if (!normaliziraniEmail) throw new Error('Obavezan je --email=<adresa>.');
  if (!potvrdi) throw new Error('Brisanje nije potvrđeno. Dodaj --potvrdi.');

  return baza.transaction(async (transakcija) => {
    const [igrac] = await transakcija
      .select({ id: igraci.id, email: igraci.email, obrisanAt: igraci.obrisanAt })
      .from(igraci)
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
      .limit(1);

    if (!igrac) return 'nije-pronaden';
    if (igrac.obrisanAt) return 'vec-obrisan';

    await transakcija.delete(sesije).where(eq(sesije.igracId, igrac.id));
    await transakcija.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igrac.id));
    await transakcija.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igrac.id));
    await transakcija.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igrac.id));
    await transakcija.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igrac.id));
    await transakcija.delete(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igrac.id));
    await transakcija.delete(otkljucaneRijeciIgraca).where(eq(otkljucaneRijeciIgraca.igracId, igrac.id));
    await transakcija
      .update(igraci)
      .set({
        vrsta: 'registriran',
        nadimak: 'Obrisani igrač',
        avatarId: 0,
        email: null,
        lozinkaHash: null,
        emailPotvrdjen: false,
        obrisanAt: new Date(),
        odigrane: 0,
        pobjede: 0,
        eliminacijeUkupno: 0,
        bodoviUkupno: 0,
        odigrane1v1: 0,
        pobjede1v1: 0,
        eliminacije1v1: 0,
        bodovi1v1: 0,
        iskustvoUkupno: 0,
      })
      .where(and(eq(igraci.id, igrac.id), isNull(igraci.obrisanAt)));

    return 'obrisan';
  });
}