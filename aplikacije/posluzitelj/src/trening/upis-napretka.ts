import { and, eq, inArray, sql } from 'drizzle-orm';
import { izracunajRazinuDostignuca, DEFINICIJE_DOSTIGNUCA, type MetrikeMisijaIgre, type ObavijestOtkljucanogDostignuca } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca, otkljucaneGrupeIgraca, pobjedeTreninga } from '../baza/shema.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import { dohvatiIshodMisija, obracunajMisijeZaIgraca, type IshodMisijaPayload } from '../misije/obracun.js';

const PRAGOVI_ZAGRIJANOG = [1, 5, 20, 50, 100] as const;

export type RezultatTreningPobjede = {
  pobjede: number;
  novaRazina: number;
  maksimalnaRazina: number;
  ishodMisija: IshodMisijaPayload | null;
};

export async function zabiljeziPobjeduTreninga(
  treningId: string,
  igracId: string,
  zavrsenoU: Date = new Date(),
  metrike?: {
    mod: 'dva_igraca' | 'cetiri_igraca';
    plasman: number;
    nacinIspadanja: string;
    prihvaceneRijeci: number;
    najduziNiz: number;
  },
): Promise<RezultatTreningPobjede | null> {
  const rezultat = await baza.transaction(async (tx) => {
    const [igrac] = await tx.select({
      vrsta: igraci.vrsta,
      upravljac: igraci.upravljac,
      obrisanAt: igraci.obrisanAt,
      iskustvoUkupno: igraci.iskustvoUkupno,
    })
      .from(igraci).where(eq(igraci.id, igracId)).for('update');
    if ((igrac?.vrsta !== 'registriran' && igrac?.vrsta !== 'admin') || igrac.upravljac !== 'covjek' || igrac.obrisanAt !== null) {
      return null;
    }

    const [pobjeda] = await tx.insert(pobjedeTreninga).values({
      treningId,
      igracId,
      zavrseno: zavrsenoU,
    }).onConflictDoNothing().returning({ treningId: pobjedeTreninga.treningId });

    if (!pobjeda) {
      const ishodMisija = await dohvatiIshodMisija(tx, igracId, 'trening', treningId);
      const [napredak] = await tx.select({ treningPobjede: napredakDostignucaIgraca.treningPobjede })
        .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
      return {
        pobjede: napredak?.treningPobjede ?? 0,
        novaRazina: 0,
        maksimalnaRazina: PRAGOVI_ZAGRIJANOG.length,
        ishodMisija,
        obavijesti: [] as ObavijestOtkljucanogDostignuca[],
      };
    }

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
      await tx.insert(dostignucaIgraca).values({
        igracId,
        dostignuceId: 'zagrijan',
        razina: poslije,
        prvoOtkljucano: zavrsenoU,
        zadnjeOtkljucavanje: zavrsenoU,
      }).onConflictDoUpdate({
        target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
        set: { razina: poslije, zadnjeOtkljucavanje: zavrsenoU },
      });
    }

    const potpuneMetrike: MetrikeMisijaIgre = {
      izvorId: treningId,
      kontekst: 'trening',
      mod: metrike?.mod ?? 'dva_igraca',
      igracId,
      zavrsenoU,
      plasman: metrike?.plasman ?? 1,
      nacinIspadanja: metrike?.nacinIspadanja ?? 'pobjednik',
      prihvaceneRijeci: metrike?.prihvaceneRijeci ?? 0,
      najduziNiz: metrike?.najduziNiz ?? 0,
      dugeRijeci: 0,
      jakoDugeRijeci: 0,
      rijetkeRijeci: 0,
      jakoRijetkeRijeci: 0,
      dugeIRijetkeRijeci: 0,
      eliminacije: 0,
      kaladontIzvedbe: 0,
      razlicitiPoceci: [],
    };

    const ishodMisija = await obracunajMisijeZaIgraca(
      tx,
      potpuneMetrike,
      igrac.iskustvoUkupno,
      igrac.iskustvoUkupno,
    );

    return {
      pobjede: napredak.treningPobjede,
      novaRazina,
      maksimalnaRazina: PRAGOVI_ZAGRIJANOG.length,
      ishodMisija,
      obavijesti: ishodMisija.noveObavijesti ?? [],
    };
  });

  if (rezultat?.obavijesti.length) emitirajNovostiDostignuca(igracId, rezultat.obavijesti);
  if (!rezultat) return null;
  return {
    pobjede: rezultat.pobjede,
    novaRazina: rezultat.novaRazina,
    maksimalnaRazina: rezultat.maksimalnaRazina,
    ishodMisija: rezultat.ishodMisija,
  };
}

export async function promovirajTreningGrupe(igracId: string, grupe: readonly string[]) {
  if (!grupe.length) return [];
  return baza.update(otkljucaneGrupeIgraca).set({ zaDostignuca: true })
    .where(and(eq(otkljucaneGrupeIgraca.igracId, igracId), eq(otkljucaneGrupeIgraca.zaDostignuca, false), inArray(otkljucaneGrupeIgraca.grupa, [...grupe])))
    .returning({ grupa: otkljucaneGrupeIgraca.grupa });
}
