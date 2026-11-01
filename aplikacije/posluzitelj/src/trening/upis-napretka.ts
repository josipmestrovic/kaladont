import { and, eq, inArray, sql } from 'drizzle-orm';
import { izracunajRazinuDostignuca, DEFINICIJE_DOSTIGNUCA } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca, otkljucaneGrupeIgraca, pobjedeTreninga, treningRijeciIgraca } from '../baza/shema.js';

const PRAGOVI_ZAGRIJANOG = [1, 5, 20, 50, 100] as const;

export interface RijecTreninga {
  rijec: string;
  grupe: readonly { grupa: string; tier: number | null }[];
}

export async function zapisiPrihvaceneRijeciTreninga(igracId: string, treningId: string, rijeci: readonly RijecTreninga[]) {
  if (!rijeci.length) return { spremljeno: 0, ukupno: 0 };
  return baza.transaction(async (tx) => {
    const [igrac] = await tx.select({ vrsta: igraci.vrsta, upravljac: igraci.upravljac, obrisanAt: igraci.obrisanAt })
      .from(igraci).where(eq(igraci.id, igracId)).for('share');
    if ((igrac?.vrsta !== 'registriran' && igrac?.vrsta !== 'admin') || igrac.upravljac !== 'covjek' || igrac.obrisanAt !== null) return { spremljeno: 0, ukupno: 0 };
    const oblici = [...new Set(rijeci.map((stavka) => stavka.rijec))];
    const noveRijeci = await tx.insert(treningRijeciIgraca)
      .values(oblici.map((rijec) => ({ igracId, rijec, prvoTreningId: treningId })))
      .onConflictDoNothing()
      .returning({ rijec: treningRijeciIgraca.rijec });
    const grupe = [...new Map(rijeci.flatMap((stavka) => stavka.grupe.map((grupa) => [grupa.grupa, grupa] as const))).values()];
    if (grupe.length) await tx.insert(otkljucaneGrupeIgraca)
      .values(grupe.map(({ grupa, tier }) => ({ igracId, grupa, tier, zaDostignuca: false })))
      .onConflictDoNothing();
    const [ukupno] = await tx.select({ broj: sql<number>`count(*)::int` }).from(treningRijeciIgraca).where(eq(treningRijeciIgraca.igracId, igracId));
    return { spremljeno: noveRijeci.length, ukupno: ukupno?.broj ?? 0 };
  });
}

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

export async function dohvatiRijeciTreninga(igracId: string, limit: number, cursor?: string) {
  const uvjeti = [eq(treningRijeciIgraca.igracId, igracId), ...(cursor ? [sql`${treningRijeciIgraca.rijec} > ${cursor}`] : [])];
  const retci = await baza.select({ rijec: treningRijeciIgraca.rijec }).from(treningRijeciIgraca)
    .where(and(...uvjeti)).orderBy(treningRijeciIgraca.rijec).limit(limit + 1);
  return { rijeci: retci.slice(0, limit).map((redak) => redak.rijec), imaJos: retci.length > limit };
}

export async function promovirajTreningGrupe(igracId: string, grupe: readonly string[]) {
  if (!grupe.length) return [];
  return baza.update(otkljucaneGrupeIgraca).set({ zaDostignuca: true })
    .where(and(eq(otkljucaneGrupeIgraca.igracId, igracId), eq(otkljucaneGrupeIgraca.zaDostignuca, false), inArray(otkljucaneGrupeIgraca.grupa, [...grupe])))
    .returning({ grupa: otkljucaneGrupeIgraca.grupa });
}