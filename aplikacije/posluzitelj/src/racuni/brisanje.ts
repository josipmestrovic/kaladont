import { and, eq, isNull, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import {
  aktivnostIgracaDani,
  ciklusiTjednihMisija,
  dnkStatistikeIgraca,
  dodjeleMisija,
  doprinosiMisijama,
  dostignucaIgraca,
  dotokDnevnihMisija,
  igraci,
  ishodiMisijaIgara,
  napredakDostignucaIgraca,
  nagradeMisija,
  nizAktivnostiIgraca,
  otkljucaneGrupeIgraca,
  otkljucaneRijeciIgraca,
  sesije,
  stanjeMisijaIgraca,
  statistikeRijeciIgraca,
  treningRijeciIgraca,
  pobjedeTreninga,
  zamjeneMisija,
} from '../baza/shema.js';

export type IshodBrisanja = 'obrisan' | 'nije-pronaden' | 'vec-obrisan' | 'zasticen';

async function obrisiRacunUTransakciji(
  transakcija: Parameters<Parameters<typeof baza.transaction>[0]>[0],
  igrac: { id: string; obrisanAt: Date | null; vrsta: 'gost' | 'registriran' | 'admin'; upravljac: 'covjek' | 'bot' },
): Promise<IshodBrisanja> {
  if (igrac.obrisanAt) return 'vec-obrisan';
  // Botovi i admini ne smiju se soft-brisati ovim putem (živ fond / admin pristup).
  if (igrac.upravljac === 'bot' || igrac.vrsta === 'admin') return 'zasticen';

  await transakcija.delete(sesije).where(eq(sesije.igracId, igrac.id));
  await transakcija.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igrac.id));
  await transakcija.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igrac.id));
  await transakcija.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igrac.id));
  await transakcija.delete(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igrac.id));
  await transakcija.delete(otkljucaneRijeciIgraca).where(eq(otkljucaneRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(treningRijeciIgraca).where(eq(treningRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(pobjedeTreninga).where(eq(pobjedeTreninga.igracId, igrac.id));
  await transakcija.delete(doprinosiMisijama).where(eq(doprinosiMisijama.igracId, igrac.id));
  await transakcija.delete(nagradeMisija).where(eq(nagradeMisija.igracId, igrac.id));
  await transakcija.delete(ishodiMisijaIgara).where(eq(ishodiMisijaIgara.igracId, igrac.id));
  await transakcija.delete(zamjeneMisija).where(eq(zamjeneMisija.igracId, igrac.id));
  await transakcija.delete(dodjeleMisija).where(eq(dodjeleMisija.igracId, igrac.id));
  await transakcija.delete(dotokDnevnihMisija).where(eq(dotokDnevnihMisija.igracId, igrac.id));
  await transakcija.delete(ciklusiTjednihMisija).where(eq(ciklusiTjednihMisija.igracId, igrac.id));
  await transakcija.delete(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, igrac.id));
  await transakcija.delete(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igrac.id));
  await transakcija.delete(nizAktivnostiIgraca).where(eq(nizAktivnostiIgraca.igracId, igrac.id));
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
}

export async function obrisiRacun(email: string, potvrdi: boolean): Promise<IshodBrisanja> {
  const normaliziraniEmail = email.trim().toLowerCase();
  if (!normaliziraniEmail) throw new Error('Obavezan je --email=<adresa>.');
  if (!potvrdi) throw new Error('Brisanje nije potvrđeno. Dodaj --potvrdi.');

  return baza.transaction(async (transakcija) => {
    const [igrac] = await transakcija
      .select({
        id: igraci.id,
        email: igraci.email,
        obrisanAt: igraci.obrisanAt,
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
      })
      .from(igraci)
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
      .limit(1);

    if (!igrac) return 'nije-pronaden';
    return obrisiRacunUTransakciji(transakcija, igrac);
  });
}

export async function obrisiRacunPoId(igracId: string): Promise<IshodBrisanja> {
  return baza.transaction(async (transakcija) => {
    const [igrac] = await transakcija
      .select({
        id: igraci.id,
        obrisanAt: igraci.obrisanAt,
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
      })
      .from(igraci)
      .where(eq(igraci.id, igracId))
      .limit(1);

    if (!igrac) return 'nije-pronaden';
    return obrisiRacunUTransakciji(transakcija, igrac);
  });
}
