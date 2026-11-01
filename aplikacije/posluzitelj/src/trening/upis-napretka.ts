import { and, eq, inArray, sql } from 'drizzle-orm';
import { izracunajRazinuDostignuca, DEFINICIJE_DOSTIGNUCA } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca, otkljucaneGrupeIgraca, pobjedeTreninga } from '../baza/shema.js';

const PRAGOVI_ZAGRIJANOG = [1, 5, 20, 50, 100] as const;

export async function zabiljeziPobjeduTreninga(treningId: string, igracId: string) {
  return baza.transaction(async (tx) => {
    const [igrac] = await tx.select({ vrsta: igraci.vrsta, upravljac: igraci.upravljac, obrisanAt: igraci.obrisanAt })
      .from(igraci).where(eq(igraci.id, igracId)).for('share');
    if ((igrac?.vrsta !== 'registriran' && igrac?.vrsta !== 'admin') || igrac.upravljac !== 'covjek' || igrac.obrisanAt !== null) return null;
    const [pobjeda] = await tx.insert(pobjedeTreninga).values({ treningId, igracId }).onConflictDoNothing().returning({ treningId: pobjedeTreninga.treningId });
    if (!pobjeda) return null;
    const [napredak] = await tx.insert(napredakDostignucaIgraca).values({ igracId, treningPobjede: 1 }).onConflictDoUpdate({
      target: napredakDostignucaIgraca.igracId,
      set: { treningPobjede: sql`${napredakDostignucaIgraca.treningPobjede} + 1`, azurirano: new Date() },
    }).returning({ treningPobjede: napredakDostignucaIgraca.treningPobjede });
    if (!napredak) throw new Error('Nije moguće spremiti napredak treninga.');
    const definicija = DEFINICIJE_DOSTIGNUCA.find((stavka) => stavka.id === 'zagrijan');
    if (!definicija) throw new Error('Nedostaje definicija dostignuća Zagrijan.');
    const prije = izracunajRazinuDostignuca(definicija, napredak.treningPobjede - 1);
    const poslije = izracunajRazinuDostignuca(definicija, napredak.treningPobjede);
    let novaRazina = 0;
    if (poslije > prije) {
      novaRazina = poslije;
      await tx.insert(dostignucaIgraca).values({ igracId, dostignuceId: 'zagrijan', razina: poslije, prvoOtkljucano: new Date(), zadnjeOtkljucavanje: new Date() }).onConflictDoUpdate({
        target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
        set: { razina: poslije, zadnjeOtkljucavanje: new Date() },
      });
    }
    return { pobjede: napredak.treningPobjede, novaRazina, maksimalnaRazina: PRAGOVI_ZAGRIJANOG.length };
  });
}

export async function promovirajTreningGrupe(igracId: string, grupe: readonly string[]) {
  if (!grupe.length) return [];
  return baza.update(otkljucaneGrupeIgraca).set({ zaDostignuca: true })
    .where(and(eq(otkljucaneGrupeIgraca.igracId, igracId), eq(otkljucaneGrupeIgraca.zaDostignuca, false), inArray(otkljucaneGrupeIgraca.grupa, [...grupe])))
    .returning({ grupa: otkljucaneGrupeIgraca.grupa });
}
