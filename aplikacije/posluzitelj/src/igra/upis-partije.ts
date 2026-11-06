/**
 * Upis partije u bazu (model-podataka.md): partije, sudionici_partije, potezi, agregati u igraci.
 * Upisi tijekom igre su fire-and-forget zbog latencije, ali završni tok mora osigurati
 * uspješan upis početka i svih poteza prije isplate XP-a (idempotentni retry).
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { izracunajNovaDostignuca, izracunajOcjenuIgre, odrediPohvaleIgre, postotakXpZaOcjenu, MAKSIMALNO_ISKUSTVO, stanjeIskustva, type DnkOs, type DeltaNapretkaDostignuca, type MetrikeMisijaIgre, type NovoDostignuce, type ObavijestOtkljucanogDostignuca, type PohvalaIgre, type PromjenaMisije, type UkupnoIskustvoIshoda } from 'zajednicko';
import { bonusPobjednickogNiza, izracunajFormu } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { jeJedinstvenostPrekrsena } from '../baza/greske.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, nizoviPobjedaIgraca, obracuniPartija, otkljucaneGrupeIgraca, otkljucaneRijeciIgraca, partije, pohvaleIgre, potezi, rezultatiFormeIgraca, statistikeRijeciIgraca, sudioniciPartije } from '../baza/shema.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import { priznajPrivatnika } from '../dostignuca/dodjela.js';
import { priznajDnevnuPobjeduModa, priznajSvePohvale } from '../dostignuca/dodjela-d02.js';
import { dohvatiIshodMisija, obracunajMisijeZaIgraca } from '../misije/obracun.js';
import type { SudionikPartije } from './motor-partije.js';
import { izracunajDnk, type DnkPodaci } from './izracun-dnk.js';

export async function zapisiPocetakPartije(
  partijaId: string,
  sudionici: SudionikPartije[],
  cekanjeMsPoIgracu: Map<string, number>,
  mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
  brojBotova = 0,
): Promise<void> {
  const [postojeca] = await baza
    .select({ id: partije.id })
    .from(partije)
    .where(eq(partije.id, partijaId))
    .limit(1);
  if (postojeca) return;

  try {
    await baza.transaction(async (tx) => {
      await tx.insert(partije).values({ id: partijaId, mod, status: 'u_tijeku', brojBotova });
      await tx.insert(sudioniciPartije).values(
        sudionici.map((s) => ({
          partijaId,
          igracId: s.igracId,
          nadimak: s.nadimak,
          sjedalo: s.sjedalo,
          cekanjeMs: cekanjeMsPoIgracu.get(s.igracId) ?? 0,
        })),
      );
    });
  } catch (greska) {
    if (jeJedinstvenostPrekrsena(greska)) {
      const [vecPostoji] = await baza
        .select({ id: partije.id })
        .from(partije)
        .where(eq(partije.id, partijaId))
        .limit(1);
      if (vecPostoji) return;
    }
    console.error('Neuspio transakcijski upis početka partije:', greska);
    throw new Error('Početak partije nije moguće spremiti.', { cause: greska });
  }
}

/** Restart ili kontrolirano gašenje prekida samo partije koje nisu završile. */
export async function ponistiPartijeUTijekuUBazi(partijaIdovi?: readonly string[]): Promise<number> {
  const uvjet = partijaIdovi && partijaIdovi.length > 0
    ? and(eq(partije.status, 'u_tijeku'), inArray(partije.id, [...partijaIdovi]))
    : eq(partije.status, 'u_tijeku');
  const ponistene = await baza
    .update(partije)
    .set({ status: 'ponistena', kraj: new Date() })
    .where(uvjet)
    .returning({ id: partije.id });
  return ponistene.length;
}

export interface ZapisPoteza {
  partijaId: string;
  runda: number;
  redniBroj: number;
  igracId: string | null;
  vrsta: 'rijec' | 'ne_znam' | 'istek' | 'prekid' | 'auto_kraj' | 'kaladont' | 'sustav_rijec';
  rijec: string | null;
  trazenaSlova: string | null;
  trajanjeMs: number;
}

/**
 * Idempotentan upis: UNIQUE (partija_id, redni_broj) sukob je uspjeh (ponovna provjera),
 * ne novi write. Ostale DB greške se propagiraju.
 */
export async function zapisiPotez(zapis: ZapisPoteza): Promise<void> {
  try {
    await baza.insert(potezi).values(zapis);
  } catch (greska) {
    if (jeJedinstvenostPrekrsena(greska)) return;
    console.error('Neuspio upis poteza:', greska);
    throw greska;
  }
}

/** Ponovno osigurava sve payloade (npr. nakon privremenog kvara baze prije završnog XP-a). */
export async function osigurajUpisePoteza(zapisi: readonly ZapisPoteza[]): Promise<void> {
  await Promise.all(zapisi.map((zapis) => zapisiPotez(zapis)));
}

export function spremiRaniPorazUBazi(zapis: {
  partijaId: string;
  igracId: string;
  mod: 'cetiri_igraca' | 'dva_igraca';
  plasman: 1 | 2 | 3 | 4;
  bodovi: number;
  eliminacije: number;
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'kaladont';
}): Promise<void> {
  return baza.transaction(async (tx) => {
    await tx.update(sudioniciPartije).set({
      plasman: zapis.plasman,
      bodovi: zapis.bodovi,
      eliminacije: zapis.eliminacije,
      nacinIspadanja: zapis.nacinIspadanja,
    }).where(and(
      eq(sudioniciPartije.partijaId, zapis.partijaId),
      eq(sudioniciPartije.igracId, zapis.igracId),
      sql`${sudioniciPartije.plasman} is null`,
    ));
    await tx.insert(rezultatiFormeIgraca).values({
      igracId: zapis.igracId,
      partijaId: zapis.partijaId,
      mod: zapis.mod,
      plasman: zapis.plasman,
      bodovi: zapis.bodovi,
      eliminacije: zapis.eliminacije,
    }).onConflictDoNothing();
    await tx.insert(nizoviPobjedaIgraca).values({
      igracId: zapis.igracId,
      mod: zapis.mod,
      trenutniNiz: 0,
      najboljiNiz: 0,
      zadnjaObradenaPartijaId: zapis.partijaId,
    }).onConflictDoUpdate({
      target: [nizoviPobjedaIgraca.igracId, nizoviPobjedaIgraca.mod],
      set: {
        trenutniNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${zapis.partijaId} then ${nizoviPobjedaIgraca.trenutniNiz} else 0 end`,
        zadnjaObradenaPartijaId: zapis.partijaId,
        azurirano: new Date(),
      },
    });
  }).then(() => {}).catch((greska) => {
    console.error('Neuspjelo rano spremanje poraza:', greska);
  });
}

export interface ZapisSudionika {
  igracId: string;
  plasman: 1 | 2 | 3 | 4;
  bodovi: number;
  eliminacije: number;
  iskustvo: number;
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'pobjednik' | 'kaladont';
}

export interface ZapisStatistikeRijeci {
  igracId: string;
  grupe: { grupa: string; tier: number | null }[];
  otkljucaneRijeci: { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[];
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  otkriveneJakoRijetkeGrupe: number;
  otkriveneSrednjeRijetkeGrupe: number;
  otkriveneRijetkeGrupe: number;
  upisaneDugeRijeci: number;
  upisaneSrednjeDugeRijeci: number;
  upisaneJakoDugeRijeci: number;
  prihvaceneRijetkeRijeci?: number;
  prihvaceneJakoRijetkeRijeci?: number;
  dugeIRijetkeRijeci?: number;
  razlicitiPoceci?: string[];
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
  najrjedaTier: number | null;
}

export interface ZapisNapretkaDostignuca {
  delta: DeltaNapretkaDostignuca;
}

interface AgregatZakljucka {
  bodoviUkupno: number;
  odigrane: number;
  pobjede: number;
  iskustvoUkupno: number;
  novaDostignuca: NovoDostignuce[];
  dnkPrije: DnkOs[];
  dnkPoslije: DnkOs[];
  ocjenaIgre: number | null;
  bonusOcjenaIgre: number;
  nizPrije: number;
  nizPoslije: number;
  najboljiNiz: number;
  osnovniXp: number;
  bonusPobjednickogNizaPostotak: number;
  bonusPobjednickogNizaXp: number;
  forma: ReturnType<typeof izracunajFormu> | null;
  pohvale: PohvalaIgre[];
  upravljac: 'covjek' | 'bot';
  vrstaIgraca: 'gost' | 'registriran' | 'admin';
  iskustvoPrijePartije: number;
  promjeneMisija?: PromjenaMisije[];
  ukupnoIskustvo?: UkupnoIskustvoIshoda;
  misijeStanjeVerzija?: number;
}

function dnkPodaciIzRedaka(
  redak: { odigrane: number; bodovi: number; eliminacije: number },
  statistika: Pick<
    DnkPodaci,
    'prihvaceniPotezi' | 'ukupnoTrajanjePrihvaceniPoteziMs' | 'najduziStreak' | 'dugeRijeci' | 'srednjeDugeRijeci' | 'jakoDugeRijeci' | 'rijetkeRijeci' | 'srednjeRijetkeRijeci' | 'jakoRijetkeRijeci'
  >,
): DnkPodaci {
  return { ...redak, ...statistika };
}

/** Sažetak igre za vremenske ljestvice; bez statistike ostaje NULL (nepoznato), nikad 0. */
export function sazetakMetrika(statistika: ZapisStatistikeRijeci | undefined) {
  if (!statistika) return {};
  const imaRijeci = statistika.prihvaceniPotezi > 0;
  if (imaRijeci && (!statistika.najduzaRijec || statistika.najduzaRijecGrafemi <= 0)) {
    // Nekonzistentan sažetak ne smije srušiti upis rezultata; ostaje nepoznat.
    console.error(`Nepotpun sažetak metrika za igrača ${statistika.igracId}; ne upisuje se.`);
    return {};
  }
  return {
    metrikeVerzija: 1,
    prihvaceneRijeci: statistika.prihvaceniPotezi,
    trajanjePrihvacenihMs: imaRijeci ? Math.max(0, Math.round(statistika.ukupnoTrajanjePrihvaceniPoteziMs)) : 0,
    najduziNizRijeci: imaRijeci ? Math.min(Math.max(1, statistika.najduziStreak), statistika.prihvaceniPotezi) : 0,
    najduzaRijec: imaRijeci ? statistika.najduzaRijec : null,
    najduzaRijecGrafemi: imaRijeci ? statistika.najduzaRijecGrafemi : null,
  };
}

function jeNamjerniIzlazak(nacin: string): boolean {
  return nacin === 'prekid' || nacin === 'odspajanje' || nacin === 'napustanje';
}

function jeLjudskiRacun(vrsta: string, upravljac: string): boolean {
  return upravljac === 'covjek' && (vrsta === 'registriran' || vrsta === 'admin');
}

/** Zaključuje partiju transakcijski i vraća ažurirane agregate (bodovi_ukupno, odigrane) po igraču. */
export async function zakljuciPartijuUBazi(
  partijaId: string,
  pobjednikId: string,
  rezultati: ZapisSudionika[],
  mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
  statistike: Map<string, ZapisStatistikeRijeci> = new Map(),
  samoStatistika = false,
  napredakDostignuca: Map<string, ZapisNapretkaDostignuca> = new Map(),
  zavrsenoU: Date = new Date(),
  /** Osnovni bruto XP prije bonusa niza/ocjene (iz motora); za rangiranje pohvale. */
  osnovniBrutoPoIgracu: Map<string, number> = new Map(),
): Promise<Map<string, AgregatZakljucka>> {
  const agregati = new Map<string, AgregatZakljucka>();
  const obavijestiPoIgracu = new Map<string, ObavijestOtkljucanogDostignuca[]>();
  const modStatistike = mod;

  const zapamtiObavijesti = (igracId: string, obavijesti: readonly ObavijestOtkljucanogDostignuca[]) => {
    if (obavijesti.length === 0) return;
    const lista = obavijestiPoIgracu.get(igracId) ?? [];
    lista.push(...obavijesti);
    obavijestiPoIgracu.set(igracId, lista);
  };

  const pridruziDostignuca = (
    igracId: string,
    nova: readonly NovoDostignuce[],
    upravljac: 'covjek' | 'bot',
    vrstaIgraca: 'gost' | 'registriran' | 'admin',
    iskustvoPrijePartije: number,
  ) => {
    if (nova.length === 0) return;
    const postojeci = agregati.get(igracId);
    if (!postojeci) {
      agregati.set(igracId, {
        bodoviUkupno: 0,
        odigrane: 0,
        pobjede: 0,
        iskustvoUkupno: 0,
        novaDostignuca: [...nova],
        dnkPrije: [],
        dnkPoslije: [],
        ocjenaIgre: null,
        bonusOcjenaIgre: 0,
        nizPrije: 0,
        nizPoslije: 0,
        najboljiNiz: 0,
        osnovniXp: 0,
        bonusPobjednickogNizaPostotak: 0,
        bonusPobjednickogNizaXp: 0,
        forma: null,
        pohvale: [],
        upravljac,
        vrstaIgraca,
        iskustvoPrijePartije,
      });
      return;
    }
    const poId = new Map(postojeci.novaDostignuca.map((dostignuce) => [dostignuce.id, dostignuce]));
    for (const dostignuce of nova) {
      const staro = poId.get(dostignuce.id);
      if (!staro || dostignuce.novaRazina > staro.novaRazina) poId.set(dostignuce.id, dostignuce);
    }
    postojeci.novaDostignuca = [...poId.values()];
  };

  const primijeniDodjelu = (
    igracId: string,
    ishod: { noveObavijesti: readonly ObavijestOtkljucanogDostignuca[]; novaDostignuca: readonly NovoDostignuce[] },
    upravljac: 'covjek' | 'bot',
    vrstaIgraca: 'gost' | 'registriran' | 'admin',
    iskustvoPrijePartije: number,
  ) => {
    zapamtiObavijesti(igracId, ishod.noveObavijesti);
    pridruziDostignuca(igracId, ishod.novaDostignuca, upravljac, vrstaIgraca, iskustvoPrijePartije);
  };

  await baza.transaction(async (tx) => {
    const brojNovihRijetkihGrupa = new Map<string, number>();
    const claim = samoStatistika
      ? await tx.insert(obracuniPartija)
        .values({ partijaId, vrsta: 'privatna_gamifikacija' })
        .onConflictDoNothing()
        .returning({ partijaId: obracuniPartija.partijaId })
      : await tx.update(partije)
        .set({ status: 'zavrsena', kraj: zavrsenoU, pobjednikId })
        .where(and(eq(partije.id, partijaId), eq(partije.status, 'u_tijeku')))
        .returning({ partijaId: partije.id });

    if (claim.length === 0) {
      const spremljenePohvale = !samoStatistika
        ? await tx.select().from(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId))
        : [];
      const pohvalePoIgracu = new Map<string, PohvalaIgre[]>();
      for (const red of spremljenePohvale) {
        const lista = pohvalePoIgracu.get(red.igracId) ?? [];
        lista.push({
          vrsta: red.vrsta,
          vrijednost: red.vrijednost,
          dijeljenoPrvoMjesto: spremljenePohvale.filter((p) => p.vrsta === red.vrsta).length > 1,
        });
        pohvalePoIgracu.set(red.igracId, lista);
      }
      for (const r of rezultati) {
        const [stanjeIgraca] = await tx
          .select({
            bodoviUkupno: mod === 'dva_igraca' ? igraci.bodovi1v1 : igraci.bodoviUkupno,
            odigrane: mod === 'dva_igraca' ? igraci.odigrane1v1 : igraci.odigrane,
            pobjede: mod === 'dva_igraca' ? igraci.pobjede1v1 : igraci.pobjede,
            iskustvoUkupno: igraci.iskustvoUkupno,
            upravljac: igraci.upravljac,
            vrstaIgraca: igraci.vrsta,
          })
          .from(igraci)
          .where(eq(igraci.id, r.igracId));
        if (stanjeIgraca) {
          agregati.set(r.igracId, {
            bodoviUkupno: stanjeIgraca.bodoviUkupno,
            odigrane: stanjeIgraca.odigrane,
            pobjede: stanjeIgraca.pobjede,
            iskustvoUkupno: stanjeIgraca.iskustvoUkupno,
            novaDostignuca: [],
            dnkPrije: [],
            dnkPoslije: [],
            ocjenaIgre: null,
            bonusOcjenaIgre: 0,
            nizPrije: 0,
            nizPoslije: 0,
            najboljiNiz: 0,
            osnovniXp: 0,
            bonusPobjednickogNizaPostotak: 0,
            bonusPobjednickogNizaXp: 0,
            forma: null,
            pohvale: pohvalePoIgracu.get(r.igracId) ?? [],
            upravljac: stanjeIgraca.upravljac,
            vrstaIgraca: stanjeIgraca.vrstaIgraca,
            iskustvoPrijePartije: stanjeIgraca.iskustvoUkupno,
          });
          if (!samoStatistika && (stanjeIgraca.vrstaIgraca === 'registriran' || stanjeIgraca.vrstaIgraca === 'admin') && stanjeIgraca.upravljac === 'covjek') {
            const ishod = await dohvatiIshodMisija(tx, r.igracId, 'javna', partijaId);
            const agregat = agregati.get(r.igracId);
            if (ishod && agregat) {
              agregat.promjeneMisija = ishod.promjeneMisija;
              agregat.ukupnoIskustvo = ishod.ukupnoIskustvo;
              agregat.misijeStanjeVerzija = ishod.misijeStanjeVerzija;
            }
          }
        }
      }
      return;
    }

    if (!samoStatistika) {
      await tx.insert(obracuniPartija)
        .values({ partijaId, vrsta: 'javna_partija' })
        .onConflictDoNothing();
    } else {
      await tx.update(partije)
        .set({ status: 'zavrsena', kraj: zavrsenoU, pobjednikId })
        .where(and(eq(partije.id, partijaId), eq(partije.status, 'u_tijeku')));
    }

    for (const r of rezultati) {
      const [stariIgrac] = await tx.select({
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
        odigrane: mod === 'dva_igraca' ? igraci.odigrane1v1 : igraci.odigrane,
        bodovi: mod === 'dva_igraca' ? igraci.bodovi1v1 : igraci.bodoviUkupno,
        eliminacije: mod === 'dva_igraca' ? igraci.eliminacije1v1 : igraci.eliminacijeUkupno,
        iskustvoUkupno: igraci.iskustvoUkupno,
      }).from(igraci).where(eq(igraci.id, r.igracId));
      const upravljac = stariIgrac?.upravljac ?? 'covjek';
      const vrstaIgraca = stariIgrac?.vrsta ?? 'gost';
      const [staraDnkStatistika] = await tx.select().from(dnkStatistikeIgraca)
        .where(and(eq(dnkStatistikeIgraca.igracId, r.igracId), eq(dnkStatistikeIgraca.mod, mod)))
        .limit(1);
      const prije = stariIgrac
        ? izracunajDnk(
          dnkPodaciIzRedaka(stariIgrac, {
            prihvaceniPotezi: staraDnkStatistika?.prihvaceniPotezi ?? 0,
            ukupnoTrajanjePrihvaceniPoteziMs: staraDnkStatistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0,
            najduziStreak: staraDnkStatistika?.najduziStreak ?? 0,
            dugeRijeci: staraDnkStatistika?.dugeRijeci ?? 0,
            srednjeDugeRijeci: staraDnkStatistika?.srednjeDugeRijeci ?? 0,
            jakoDugeRijeci: staraDnkStatistika?.jakoDugeRijeci ?? 0,
            rijetkeRijeci: staraDnkStatistika?.rijetkeRijeci ?? 0,
            srednjeRijetkeRijeci: staraDnkStatistika?.srednjeRijetkeRijeci ?? 0,
            jakoRijetkeRijeci: staraDnkStatistika?.jakoRijetkeRijeci ?? 0,
          }),
          mod,
        )
        : [];
      const [stariNiz] = !samoStatistika
        ? await tx.select().from(nizoviPobjedaIgraca).where(and(
          eq(nizoviPobjedaIgraca.igracId, r.igracId),
          eq(nizoviPobjedaIgraca.mod, mod),
        )).limit(1)
        : [];
      const [azuriraniNiz] = !samoStatistika
        ? await tx.insert(nizoviPobjedaIgraca).values({
          igracId: r.igracId,
          mod,
          trenutniNiz: r.plasman === 1 ? 1 : 0,
          najboljiNiz: r.plasman === 1 ? 1 : 0,
          zadnjaObradenaPartijaId: partijaId,
        }).onConflictDoUpdate({
          target: [nizoviPobjedaIgraca.igracId, nizoviPobjedaIgraca.mod],
          set: {
            trenutniNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${partijaId} then ${nizoviPobjedaIgraca.trenutniNiz} when ${r.plasman === 1} then ${nizoviPobjedaIgraca.trenutniNiz} + 1 else 0 end`,
            najboljiNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${partijaId} then ${nizoviPobjedaIgraca.najboljiNiz} when ${r.plasman === 1} then greatest(${nizoviPobjedaIgraca.najboljiNiz}, ${nizoviPobjedaIgraca.trenutniNiz} + 1) else ${nizoviPobjedaIgraca.najboljiNiz} end`,
            zadnjaObradenaPartijaId: partijaId,
            azurirano: new Date(),
          },
        }).returning()
        : [];
      const nizPrije = stariNiz?.trenutniNiz ?? 0;
      const nizPoslije = azuriraniNiz?.trenutniNiz ?? nizPrije;
      const najboljiNiz = azuriraniNiz?.najboljiNiz ?? stariNiz?.najboljiNiz ?? 0;
      const osnovniXp = r.iskustvo;
      const bonusPobjednickogNizaPostotak = !samoStatistika && r.plasman === 1 ? bonusPobjednickogNiza(nizPoslije, mod) : 0;
      const bonusPobjednickogNizaXp = Math.round(osnovniXp * bonusPobjednickogNizaPostotak / 100);
      r.iskustvo += bonusPobjednickogNizaXp;
      if (!samoStatistika) {
        await tx.insert(rezultatiFormeIgraca).values({
          igracId: r.igracId,
          partijaId,
          mod,
          plasman: r.plasman,
          bodovi: r.bodovi,
          eliminacije: r.eliminacije,
        }).onConflictDoNothing();
      }
      let forma: ReturnType<typeof izracunajFormu> | null = null;
      if (!samoStatistika) {
        const rezultatiForme = await tx.select({
          partijaId: rezultatiFormeIgraca.partijaId,
          kraj: rezultatiFormeIgraca.zavrseno,
          plasman: rezultatiFormeIgraca.plasman,
          bodovi: rezultatiFormeIgraca.bodovi,
          eliminacije: rezultatiFormeIgraca.eliminacije,
        }).from(rezultatiFormeIgraca).where(and(
          eq(rezultatiFormeIgraca.igracId, r.igracId),
          eq(rezultatiFormeIgraca.mod, mod),
        )).orderBy(desc(rezultatiFormeIgraca.zavrseno), desc(rezultatiFormeIgraca.partijaId)).limit(20);
        forma = izracunajFormu(rezultatiForme.map((rezultat) => ({ ...rezultat, kraj: rezultat.kraj.toISOString() })), mod);
      }
      if (!samoStatistika) {
        await tx
          .update(sudioniciPartije)
          .set({
            plasman: r.plasman,
            bodovi: r.bodovi,
            eliminacije: r.eliminacije,
            iskustvo: r.iskustvo,
            nacinIspadanja: r.nacinIspadanja,
            ...sazetakMetrika(statistike.get(r.igracId)),
          })
          .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, r.igracId)));
      }

      if (!samoStatistika && mod === 'dva_igraca') {
        const [azurirani] = await tx
          .update(igraci)
          .set({
            odigrane1v1: sql`${igraci.odigrane1v1} + 1`,
            pobjede1v1: sql`${igraci.pobjede1v1} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacije1v1: sql`${igraci.eliminacije1v1} + ${r.eliminacije}`,
            bodovi1v1: sql`${igraci.bodovi1v1} + ${r.bodovi}`,
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${r.iskustvo}, ${MAKSIMALNO_ISKUSTVO})`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({ bodoviUkupno: igraci.bodovi1v1, odigrane: igraci.odigrane1v1, pobjede: igraci.pobjede1v1, iskustvoUkupno: igraci.iskustvoUkupno });

        if (azurirani) {
          agregati.set(r.igracId, {
            ...azurirani,
            novaDostignuca: [],
            dnkPrije: prije,
            dnkPoslije: [],
            ocjenaIgre: 0,
            bonusOcjenaIgre: 0,
            nizPrije,
            nizPoslije,
            najboljiNiz,
            osnovniXp,
            bonusPobjednickogNizaPostotak,
            bonusPobjednickogNizaXp,
            forma,
            pohvale: [],
            upravljac,
            vrstaIgraca,
            iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
          });
        }
      } else if (!samoStatistika) {
        const [azurirani] = await tx
          .update(igraci)
          .set({
            odigrane: sql`${igraci.odigrane} + 1`,
            pobjede: sql`${igraci.pobjede} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacijeUkupno: sql`${igraci.eliminacijeUkupno} + ${r.eliminacije}`,
            bodoviUkupno: sql`${igraci.bodoviUkupno} + ${r.bodovi}`,
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${r.iskustvo}, ${MAKSIMALNO_ISKUSTVO})`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({ bodoviUkupno: igraci.bodoviUkupno, odigrane: igraci.odigrane, pobjede: igraci.pobjede, iskustvoUkupno: igraci.iskustvoUkupno });

        if (azurirani) {
          agregati.set(r.igracId, {
            ...azurirani,
            novaDostignuca: [],
            dnkPrije: prije,
            dnkPoslije: [],
            ocjenaIgre: 0,
            bonusOcjenaIgre: 0,
            nizPrije,
            nizPoslije,
            najboljiNiz,
            osnovniXp,
            bonusPobjednickogNizaPostotak,
            bonusPobjednickogNizaXp,
            forma,
            pohvale: [],
            upravljac,
            vrstaIgraca,
            iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
          });
        }
      }

      const statistika = statistike.get(r.igracId);
      if (statistika) {
        if (statistika.grupe.length > 0) {
          const grupeNovootkljucane = await tx.insert(otkljucaneGrupeIgraca)
            .values(statistika.grupe.map(({ grupa, tier }) => ({ igracId: r.igracId, grupa, tier, zaDostignuca: true })))
            .onConflictDoNothing()
            .returning({ grupa: otkljucaneGrupeIgraca.grupa });
          const grupePromovirane = await tx.update(otkljucaneGrupeIgraca)
            .set({ zaDostignuca: true })
            .where(and(
              eq(otkljucaneGrupeIgraca.igracId, r.igracId),
              eq(otkljucaneGrupeIgraca.zaDostignuca, false),
              inArray(otkljucaneGrupeIgraca.grupa, statistika.grupe.map(({ grupa }) => grupa)),
            ))
            .returning({ grupa: otkljucaneGrupeIgraca.grupa });
          const promijenjene = new Set([...grupeNovootkljucane, ...grupePromovirane].map(({ grupa }) => grupa));
          brojNovihRijetkihGrupa.set(r.igracId, statistika.grupe.filter(({ grupa, tier }) => promijenjene.has(grupa) && tier !== null).length);
        }
        if (statistika.otkljucaneRijeci.length > 0) {
          await tx.insert(otkljucaneRijeciIgraca)
            .values(statistika.otkljucaneRijeci.map((redak) => ({ igracId: r.igracId, ...redak })))
            .onConflictDoUpdate({
              target: [otkljucaneRijeciIgraca.igracId, otkljucaneRijeciIgraca.rijec],
              set: { jakoDuga: sql`otkljucane_rijeci_igraca.jako_duga or excluded.jako_duga`, jakoRijetka: sql`otkljucane_rijeci_igraca.jako_rijetka or excluded.jako_rijetka`, dugaTier: sql`coalesce(otkljucane_rijeci_igraca.duga_tier, excluded.duga_tier)`, rijetkaTier: sql`coalesce(otkljucane_rijeci_igraca.rijetka_tier, excluded.rijetka_tier)` },
            });
        }
        if (!samoStatistika) await tx
          .insert(statistikeRijeciIgraca)
          .values({
            igracId: r.igracId,
            mod: modStatistike,
            najduziStreak: statistika.najduziStreak,
            otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe,
            otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe,
            otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe,
            upisaneDugeRijeci: statistika.upisaneDugeRijeci,
            upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
            upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
            najduzaRijec: statistika.najduzaRijec,
            najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
            najrjedaRijec: statistika.najrjedaRijec,
            najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
            najrjedaTier: statistika.najrjedaTier,
          })
          .onConflictDoUpdate({
            target: [statistikeRijeciIgraca.igracId, statistikeRijeciIgraca.mod],
            set: {
              najduziStreak: sql`greatest(${statistikeRijeciIgraca.najduziStreak}, excluded.najduzi_streak)`,
              otkriveneJakoRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneJakoRijetkeGrupe} + excluded.otkrivene_jako_rijetke_grupe`,
              otkriveneSrednjeRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneSrednjeRijetkeGrupe} + excluded.otkrivene_srednje_rijetke_grupe`,
              otkriveneRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneRijetkeGrupe} + excluded.otkrivene_rijetke_grupe`,
              upisaneDugeRijeci: sql`${statistikeRijeciIgraca.upisaneDugeRijeci} + excluded.upisane_duge_rijeci`,
              upisaneSrednjeDugeRijeci: sql`${statistikeRijeciIgraca.upisaneSrednjeDugeRijeci} + excluded.upisane_srednje_duge_rijeci`,
              upisaneJakoDugeRijeci: sql`${statistikeRijeciIgraca.upisaneJakoDugeRijeci} + excluded.upisane_jako_duge_rijeci`,
              najduzaRijec: sql`case when excluded.najduza_rijec_grafemi > ${statistikeRijeciIgraca.najduzaRijecGrafemi} then excluded.najduza_rijec else ${statistikeRijeciIgraca.najduzaRijec} end`,
              najduzaRijecGrafemi: sql`greatest(${statistikeRijeciIgraca.najduzaRijecGrafemi}, excluded.najduza_rijec_grafemi)`,
              najrjedaRijec: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_rijec else ${statistikeRijeciIgraca.najrjedaRijec} end`,
              najrjedaRijecFrekvencija: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_rijec_frekvencija else ${statistikeRijeciIgraca.najrjedaRijecFrekvencija} end`,
              najrjedaTier: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_tier else ${statistikeRijeciIgraca.najrjedaTier} end`,
            },
          });
      }

      if (statistika && !samoStatistika) {
        await tx.insert(dnkStatistikeIgraca).values({
          igracId: r.igracId,
          mod,
          prihvaceniPotezi: statistika.prihvaceniPotezi,
          ukupnoTrajanjePrihvaceniPoteziMs: statistika.ukupnoTrajanjePrihvaceniPoteziMs,
          najduziStreak: statistika.najduziStreak,
          dugeRijeci: statistika.upisaneDugeRijeci,
          srednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
          jakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
          rijetkeRijeci: statistika.otkriveneRijetkeGrupe,
          srednjeRijetkeRijeci: statistika.otkriveneSrednjeRijetkeGrupe,
          jakoRijetkeRijeci: statistika.otkriveneJakoRijetkeGrupe,
          otkljucanAt: null,
        }).onConflictDoUpdate({
          target: [dnkStatistikeIgraca.igracId, dnkStatistikeIgraca.mod],
          set: {
            prihvaceniPotezi: sql`${dnkStatistikeIgraca.prihvaceniPotezi} + excluded.prihvaceni_potezi`,
            ukupnoTrajanjePrihvaceniPoteziMs: sql`${dnkStatistikeIgraca.ukupnoTrajanjePrihvaceniPoteziMs} + excluded.ukupno_trajanje_prihvacenih_poteza_ms`,
            najduziStreak: sql`greatest(${dnkStatistikeIgraca.najduziStreak}, excluded.najduzi_streak)`,
            dugeRijeci: sql`${dnkStatistikeIgraca.dugeRijeci} + excluded.duge_rijeci`,
            srednjeDugeRijeci: sql`${dnkStatistikeIgraca.srednjeDugeRijeci} + excluded.srednje_duge_rijeci`,
            jakoDugeRijeci: sql`${dnkStatistikeIgraca.jakoDugeRijeci} + excluded.jako_duge_rijeci`,
            rijetkeRijeci: sql`${dnkStatistikeIgraca.rijetkeRijeci} + excluded.rijetke_rijeci`,
            srednjeRijetkeRijeci: sql`${dnkStatistikeIgraca.srednjeRijetkeRijeci} + excluded.srednje_rijetke_rijeci`,
            jakoRijetkeRijeci: sql`${dnkStatistikeIgraca.jakoRijetkeRijeci} + excluded.jako_rijetke_rijeci`,
          },
        });
      }

      const zapisNapretka = napredakDostignuca.get(r.igracId);
      if (zapisNapretka && stariIgrac?.vrsta !== 'gost') {
        const delta: DeltaNapretkaDostignuca = { ...zapisNapretka.delta };
        delta.rijetkeLeksemskeGrupe = brojNovihRijetkihGrupa.get(r.igracId) ?? 0;
        if (!samoStatistika && r.plasman === 1) delta.javnePobjede = (delta.javnePobjede ?? 0) + 1;

        const [stariNapredak] = await tx.select().from(napredakDostignucaIgraca)
          .where(eq(napredakDostignucaIgraca.igracId, r.igracId));
        const azuriraniNapredak = await tx.insert(napredakDostignucaIgraca).values({
          igracId: r.igracId,
          valjaniPoteziUkupno: delta.valjaniPoteziUkupno ?? 0,
          rijetkeLeksemskeGrupe: delta.rijetkeLeksemskeGrupe ?? 0,
          dugeRijeci: delta.dugeRijeci ?? 0,
          najduziStreak: delta.najduziStreak ?? 0,
          kaladontIzvedbe: delta.kaladontIzvedbe ?? 0,
          kaladontZrtve: delta.kaladontZrtve ?? 0,
          izazvaneEliminacije: delta.izazvaneEliminacije ?? 0,
          mrtvaSlovaEliminacije: delta.mrtvaSlovaEliminacije ?? 0,
          javnePobjede: delta.javnePobjede ?? 0,
        }).onConflictDoUpdate({
          target: napredakDostignucaIgraca.igracId,
          set: {
            valjaniPoteziUkupno: sql`${napredakDostignucaIgraca.valjaniPoteziUkupno} + ${delta.valjaniPoteziUkupno ?? 0}`,
            rijetkeLeksemskeGrupe: sql`${napredakDostignucaIgraca.rijetkeLeksemskeGrupe} + ${delta.rijetkeLeksemskeGrupe ?? 0}`,
            dugeRijeci: sql`${napredakDostignucaIgraca.dugeRijeci} + ${delta.dugeRijeci ?? 0}`,
            najduziStreak: sql`greatest(${napredakDostignucaIgraca.najduziStreak}, ${delta.najduziStreak ?? 0})`,
            kaladontIzvedbe: sql`${napredakDostignucaIgraca.kaladontIzvedbe} + ${delta.kaladontIzvedbe ?? 0}`,
            kaladontZrtve: sql`${napredakDostignucaIgraca.kaladontZrtve} + ${delta.kaladontZrtve ?? 0}`,
            izazvaneEliminacije: sql`${napredakDostignucaIgraca.izazvaneEliminacije} + ${delta.izazvaneEliminacije ?? 0}`,
            mrtvaSlovaEliminacije: sql`${napredakDostignucaIgraca.mrtvaSlovaEliminacije} + ${delta.mrtvaSlovaEliminacije ?? 0}`,
            javnePobjede: sql`${napredakDostignucaIgraca.javnePobjede} + ${delta.javnePobjede ?? 0}`,
            azurirano: new Date(),
          },
        }).returning();
        const napredak = azuriraniNapredak[0] ?? stariNapredak;
        const napredakPrijeIgre = stariNapredak ?? {
          rijetkeLeksemskeGrupe: 0,
          dugeRijeci: 0,
          najduziStreak: 0,
          kaladontIzvedbe: 0,
          kaladontZrtve: 0,
          izazvaneEliminacije: 0,
          mrtvaSlovaEliminacije: 0,
          javnePobjede: 0,
        };
        if (napredak) {
          const agregat = agregati.get(r.igracId);
          const razina = stanjeIskustva(agregat?.iskustvoUkupno ?? 0).razina;
          const razinaPrije = stanjeIskustva(stariIgrac?.iskustvoUkupno ?? 0).razina;
          const trajniPrije = {
            razina: razinaPrije,
            rijetkeLeksemskeGrupe: napredakPrijeIgre.rijetkeLeksemskeGrupe,
            dugeRijeci: napredakPrijeIgre.dugeRijeci,
            najduziStreak: napredakPrijeIgre.najduziStreak,
            kaladontIzvedbe: napredakPrijeIgre.kaladontIzvedbe,
            kaladontZrtve: napredakPrijeIgre.kaladontZrtve,
            izazvaneEliminacije: napredakPrijeIgre.izazvaneEliminacije,
            mrtvaSlovaEliminacije: napredakPrijeIgre.mrtvaSlovaEliminacije,
            javnePobjede: napredakPrijeIgre.javnePobjede,
          };
          const nova = izracunajNovaDostignuca(trajniPrije, delta, razina, samoStatistika);
          if (nova.length > 0) {
            await tx.insert(dostignucaIgraca).values(nova.map((dostignuce) => ({
              igracId: r.igracId,
              dostignuceId: dostignuce.id,
              razina: dostignuce.novaRazina,
              prvoOtkljucano: new Date(),
              zadnjeOtkljucavanje: new Date(),
            }))).onConflictDoUpdate({
              target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
              set: { razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`, zadnjeOtkljucavanje: new Date() },
            });
            if (agregat) agregat.novaDostignuca = nova;
          }
        }
      }

      const agregatZaDnk = agregati.get(r.igracId);
      if (agregatZaDnk) {
        const statistika = statistike.get(r.igracId);
        const povijesniDnk = {
          prihvaceniPotezi: staraDnkStatistika?.prihvaceniPotezi ?? 0,
          ukupnoTrajanjePrihvaceniPoteziMs: staraDnkStatistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0,
          najduziStreak: staraDnkStatistika?.najduziStreak ?? 0,
          dugeRijeci: staraDnkStatistika?.dugeRijeci ?? 0,
          srednjeDugeRijeci: staraDnkStatistika?.srednjeDugeRijeci ?? 0,
          jakoDugeRijeci: staraDnkStatistika?.jakoDugeRijeci ?? 0,
          rijetkeRijeci: staraDnkStatistika?.rijetkeRijeci ?? 0,
          srednjeRijetkeRijeci: staraDnkStatistika?.srednjeRijetkeRijeci ?? 0,
          jakoRijetkeRijeci: staraDnkStatistika?.jakoRijetkeRijeci ?? 0,
        };
        const ukupniDnk: DnkPodaci = {
          odigrane: agregatZaDnk.odigrane,
          bodovi: agregatZaDnk.bodoviUkupno,
          eliminacije: (stariIgrac?.eliminacije ?? 0) + r.eliminacije,
          prihvaceniPotezi: povijesniDnk.prihvaceniPotezi + (statistika?.prihvaceniPotezi ?? 0),
          ukupnoTrajanjePrihvaceniPoteziMs: povijesniDnk.ukupnoTrajanjePrihvaceniPoteziMs + (statistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0),
          najduziStreak: Math.max(povijesniDnk.najduziStreak, statistika?.najduziStreak ?? 0),
          dugeRijeci: povijesniDnk.dugeRijeci + (statistika?.upisaneDugeRijeci ?? 0),
          srednjeDugeRijeci: povijesniDnk.srednjeDugeRijeci + (statistika?.upisaneSrednjeDugeRijeci ?? 0),
          jakoDugeRijeci: povijesniDnk.jakoDugeRijeci + (statistika?.upisaneJakoDugeRijeci ?? 0),
          rijetkeRijeci: povijesniDnk.rijetkeRijeci + (statistika?.otkriveneRijetkeGrupe ?? 0),
          srednjeRijetkeRijeci: povijesniDnk.srednjeRijetkeRijeci + (statistika?.otkriveneSrednjeRijetkeGrupe ?? 0),
          jakoRijetkeRijeci: povijesniDnk.jakoRijetkeRijeci + (statistika?.otkriveneJakoRijetkeGrupe ?? 0),
        };
        agregatZaDnk.dnkPoslije = izracunajDnk(ukupniDnk, mod);
        agregatZaDnk.ocjenaIgre = izracunajOcjenuIgre({
          pobjeda: r.plasman === 1,
          prihvaceniPotezi: statistika?.prihvaceniPotezi ?? 0,
          bodovi: r.bodovi,
          eliminacije: r.eliminacije,
          iskustvo: r.iskustvo,
        });
        agregatZaDnk.bonusOcjenaIgre = postotakXpZaOcjenu(agregatZaDnk.ocjenaIgre);
        const bonusIskustva = Math.round(r.iskustvo * agregatZaDnk.bonusOcjenaIgre / 100);
        if (bonusIskustva > 0 && !samoStatistika) {
          const [azuriranoIskustvo] = await tx.update(igraci)
            .set({ iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${bonusIskustva}, ${MAKSIMALNO_ISKUSTVO})` })
            .where(eq(igraci.id, r.igracId))
            .returning({ iskustvoUkupno: igraci.iskustvoUkupno });
          if (azuriranoIskustvo) agregatZaDnk.iskustvoUkupno = azuriranoIskustvo.iskustvoUkupno;
        }
        if (agregatZaDnk.ocjenaIgre !== null) {
          await tx.update(dnkStatistikeIgraca)
            .set({
              zbrojOcjenaIgre: sql`${dnkStatistikeIgraca.zbrojOcjenaIgre} + ${agregatZaDnk.ocjenaIgre}`,
              brojOcjenaIgre: sql`${dnkStatistikeIgraca.brojOcjenaIgre} + 1`,
            })
            .where(and(eq(dnkStatistikeIgraca.igracId, r.igracId), eq(dnkStatistikeIgraca.mod, mod)));
        }
      }

      if (
        samoStatistika
        && jeLjudskiRacun(vrstaIgraca, upravljac)
        && (statistike.get(r.igracId)?.prihvaceniPotezi ?? 0) >= 1
        && !jeNamjerniIzlazak(r.nacinIspadanja)
      ) {
        const privatnik = await priznajPrivatnika(tx, { igracId: r.igracId, partijaId, zavrsenoU });
        zapamtiObavijesti(r.igracId, privatnik.noveObavijesti);
        pridruziDostignuca(r.igracId, privatnik.novaDostignuca, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
      }

      if (!samoStatistika && r.plasman === 1 && jeLjudskiRacun(vrstaIgraca, upravljac)) {
        const kruna = await priznajDnevnuPobjeduModa(tx, { igracId: r.igracId, mod, zavrsenoU });
        primijeniDodjelu(r.igracId, kruna, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
      }
    }

    if (!samoStatistika) {
      const sudioniciZaPohvalu = rezultati.map((r) => {
        const agregat = agregati.get(r.igracId);
        const osnovniBruto = osnovniBrutoPoIgracu.get(r.igracId) ?? agregat?.osnovniXp ?? 0;
        const bonusNiza = agregat?.bonusPobjednickogNizaXp ?? 0;
        const bonusOcjenaPostotak = agregat?.bonusOcjenaIgre ?? 0;
        const xpZaOcjenu = (agregat?.osnovniXp ?? 0) + bonusNiza;
        const bonusOcjenaXp = Math.round(xpZaOcjenu * bonusOcjenaPostotak / 100);
        return {
          igracId: r.igracId,
          upravljac: agregat?.upravljac ?? 'covjek',
          najduziStreak: statistike.get(r.igracId)?.najduziStreak ?? 0,
          finalniBrutoXp: osnovniBruto + bonusNiza + bonusOcjenaXp,
        };
      });
      const pohvalePoIgracu = odrediPohvaleIgre(sudioniciZaPohvalu);

      for (const [igracId, pohvale] of pohvalePoIgracu) {
        const agregat = agregati.get(igracId);
        if (!agregat) continue;
        agregat.pohvale = pohvale;

        for (const pohvala of pohvale) {
          const umetnuto = await tx.insert(pohvaleIgre).values({
            igraId: partijaId,
            igracId,
            vrsta: pohvala.vrsta,
            vrijednost: pohvala.vrijednost,
          }).onConflictDoNothing().returning({
            igracId: pohvaleIgre.igracId,
            vrsta: pohvaleIgre.vrsta,
          });
          if (umetnuto.length === 0) continue;
          if (agregat.vrstaIgraca === 'gost' || agregat.upravljac !== 'covjek') continue;

          const deltaPohvale: DeltaNapretkaDostignuca = pohvala.vrsta === 'najduzi_niz'
            ? { pohvaleNizUkupno: 1 }
            : { pohvaleXpUkupno: 1 };
          const [stariNapredakPohvale] = await tx.select().from(napredakDostignucaIgraca)
            .where(eq(napredakDostignucaIgraca.igracId, igracId));
          await tx.insert(napredakDostignucaIgraca).values({
            igracId,
            pohvaleNizUkupno: deltaPohvale.pohvaleNizUkupno ?? 0,
            pohvaleXpUkupno: deltaPohvale.pohvaleXpUkupno ?? 0,
          }).onConflictDoUpdate({
            target: napredakDostignucaIgraca.igracId,
            set: {
              pohvaleNizUkupno: sql`${napredakDostignucaIgraca.pohvaleNizUkupno} + ${deltaPohvale.pohvaleNizUkupno ?? 0}`,
              pohvaleXpUkupno: sql`${napredakDostignucaIgraca.pohvaleXpUkupno} + ${deltaPohvale.pohvaleXpUkupno ?? 0}`,
              azurirano: new Date(),
            },
          });
          // Bez razine iskusnjara vidi 0 i lažno otključava za LVL ≥ 10.
          const razinaNakonIgre = stanjeIskustva(agregat.iskustvoUkupno).razina;
          const trajniPrijePohvale = {
            razina: razinaNakonIgre,
            pohvaleNizUkupno: stariNapredakPohvale?.pohvaleNizUkupno ?? 0,
            pohvaleXpUkupno: stariNapredakPohvale?.pohvaleXpUkupno ?? 0,
          };
          const novaPohvala = izracunajNovaDostignuca(
            trajniPrijePohvale,
            deltaPohvale,
            razinaNakonIgre,
            false,
          );
          if (novaPohvala.length > 0) {
            await tx.insert(dostignucaIgraca).values(novaPohvala.map((dostignuce) => ({
              igracId,
              dostignuceId: dostignuce.id,
              razina: dostignuce.novaRazina,
              prvoOtkljucano: new Date(),
              zadnjeOtkljucavanje: new Date(),
            }))).onConflictDoUpdate({
              target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
              set: { razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`, zadnjeOtkljucavanje: new Date() },
            });
            agregat.novaDostignuca = [...agregat.novaDostignuca, ...novaPohvala];
          }
        }
      }

      for (const [igracId, pohvale] of pohvalePoIgracu) {
        const imaObje = pohvale.some((pohvala) => pohvala.vrsta === 'najduzi_niz')
          && pohvale.some((pohvala) => pohvala.vrsta === 'najvise_xp');
        if (!imaObje) continue;
        const agregat = agregati.get(igracId);
        if (!agregat || agregat.vrstaIgraca === 'gost' || agregat.upravljac !== 'covjek') continue;
        const sve = await priznajSvePohvale(tx, { igracId, partijaId, zavrsenoU });
        primijeniDodjelu(igracId, sve, agregat.upravljac, agregat.vrstaIgraca, agregat.iskustvoPrijePartije);
      }

      // Misije: nakon partijskog XP-a i pohvala, prije commita.
      const igraciZaMisije = [...agregati.entries()]
        .filter(([, a]) => a.upravljac === 'covjek' && (a.vrstaIgraca === 'registriran' || a.vrstaIgraca === 'admin'))
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [igracId, agregat] of igraciZaMisije) {
        const rezultat = rezultati.find((r) => r.igracId === igracId);
        const statistika = statistike.get(igracId);
        if (!rezultat) continue;
        const duge = (statistika?.upisaneDugeRijeci ?? 0)
          + (statistika?.upisaneSrednjeDugeRijeci ?? 0)
          + (statistika?.upisaneJakoDugeRijeci ?? 0);
        const delta = napredakDostignuca.get(igracId)?.delta;
        const metrike: MetrikeMisijaIgre = {
          izvorId: partijaId,
          kontekst: 'javna',
          mod,
          igracId,
          zavrsenoU,
          plasman: rezultat.plasman,
          nacinIspadanja: rezultat.nacinIspadanja,
          prihvaceneRijeci: statistika?.prihvaceniPotezi ?? 0,
          najduziNiz: statistika?.najduziStreak ?? 0,
          dugeRijeci: duge,
          jakoDugeRijeci: statistika?.upisaneJakoDugeRijeci ?? 0,
          rijetkeRijeci: statistika?.prihvaceneRijetkeRijeci ?? 0,
          jakoRijetkeRijeci: statistika?.prihvaceneJakoRijetkeRijeci ?? 0,
          dugeIRijetkeRijeci: statistika?.dugeIRijetkeRijeci ?? 0,
          eliminacije: delta?.izazvaneEliminacije ?? 0,
          kaladontIzvedbe: delta?.kaladontIzvedbe ?? 0,
          razlicitiPoceci: statistika?.razlicitiPoceci ?? [],
        };
        const [xpRed] = await tx.select({ iskustvoUkupno: igraci.iskustvoUkupno })
          .from(igraci).where(eq(igraci.id, igracId)).for('update');
        const nakonPartijeXp = xpRed?.iskustvoUkupno ?? agregat.iskustvoUkupno;
        const ishod = await obracunajMisijeZaIgraca(
          tx,
          metrike,
          nakonPartijeXp,
          agregat.iskustvoPrijePartije,
        );
        agregat.promjeneMisija = ishod.promjeneMisija;
        agregat.ukupnoIskustvo = ishod.ukupnoIskustvo;
        agregat.misijeStanjeVerzija = ishod.misijeStanjeVerzija;
        agregat.iskustvoUkupno = ishod.ukupnoIskustvo.poslije.ukupno;
        if (ishod.novaDostignuca.length > 0) {
          const poId = new Map(agregat.novaDostignuca.map((d) => [d.id, d]));
          for (const d of ishod.novaDostignuca) {
            const staro = poId.get(d.id);
            if (!staro || d.novaRazina > staro.novaRazina) poId.set(d.id, d);
          }
          agregat.novaDostignuca = [...poId.values()];
        }
        zapamtiObavijesti(igracId, ishod.noveObavijesti ?? []);
      }
    }
  });

  for (const [igracId, obavijesti] of obavijestiPoIgracu) {
    emitirajNovostiDostignuca(igracId, obavijesti);
  }

  return agregati;
}
