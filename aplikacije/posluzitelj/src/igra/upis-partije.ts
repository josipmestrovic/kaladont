/**
 * Upis partije u bazu (model-podataka.md): partije, sudionici_partije, potezi, agregati u igraci.
 * DB pozivi iz motora partije su "fire and forget" (ne blokiraju tijek igre) osim zaključka partije,
 * koji je transakcijski jer mijenja više tablica odjednom.
 */
import { and, eq, sql } from 'drizzle-orm';
import { izracunajKaladontDnk, izracunajNovaDostignuca, izracunajOcjenuIgre, postotakXpZaOcjenu, MAKSIMALNO_ISKUSTVO, stanjeIskustva, type DnkOs, type DeltaNapretkaDostignuca, type NovoDostignuce } from 'zajednicko';
import { jeOcjenaIgreDostupna } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, otkljucaneGrupeIgraca, otkljucaneRijeciIgraca, partije, potezi, statistikeRijeciIgraca, sudioniciPartije } from '../baza/shema.js';
import type { SudionikPartije } from './motor-partije.js';

export function zapisiPocetakPartije(
  partijaId: string,
  sudionici: SudionikPartije[],
  cekanjeMsPoIgracu: Map<string, number>,
  mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
): Promise<void> {
  return baza
    .insert(partije)
    .values({ id: partijaId, mod, status: 'u_tijeku' })
    .then(() =>
      baza.insert(sudioniciPartije).values(
        sudionici.map((s) => ({
          partijaId,
          igracId: s.igracId,
          sjedalo: s.sjedalo,
          cekanjeMs: cekanjeMsPoIgracu.get(s.igracId) ?? 0,
        })),
      ),
    )
    .then(() => undefined)
    .catch((greska) => console.error('Neuspio upis početka partije:', greska));
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

export function zapisiPotez(zapis: ZapisPoteza): void {
  void baza.insert(potezi).values(zapis).catch((greska) => console.error('Neuspio upis poteza:', greska));
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
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
  najrjedaTier: number | null;
}

export interface ZapisNapretkaDostignuca {
  delta: DeltaNapretkaDostignuca;
}

function dnkOs(
  redak: { odigrane: number; bodovi: number; eliminacije: number },
  statistika: ZapisStatistikeRijeci | undefined,
  mod: 'cetiri_igraca' | 'dva_igraca',
): DnkOs[] {
  const odigrano = redak.odigrane;
  const ponderiraneDuge = (statistika?.upisaneDugeRijeci ?? 0) + (statistika?.upisaneSrednjeDugeRijeci ?? 0) * 1.5 + (statistika?.upisaneJakoDugeRijeci ?? 0) * 2;
  const ponderiraneRijetke = (statistika?.otkriveneRijetkeGrupe ?? 0) + (statistika?.otkriveneSrednjeRijetkeGrupe ?? 0) * 1.5 + (statistika?.otkriveneJakoRijetkeGrupe ?? 0) * 2;
  const prosjekPrihvacenogPotezaMs = statistika && statistika.prihvaceniPotezi > 0
    ? statistika.ukupnoTrajanjePrihvaceniPoteziMs / statistika.prihvaceniPotezi
    : 0;
  return izracunajKaladontDnk({
    mod,
    odigrano,
    prosjekBodova: odigrano > 0 ? redak.bodovi / odigrano : 0,
    eliminacijePoPartiji: odigrano > 0 ? redak.eliminacije / odigrano : 0,
    najduziStreak: statistika?.najduziStreak ?? 0,
    prosjekPrihvacenogPotezaMs,
    ponderiraneDuge: ponderiraneDuge / Math.max(1, odigrano),
    ponderiraneRijetke: ponderiraneRijetke / Math.max(1, odigrano),
  }).osi;
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
): Promise<Map<string, { bodoviUkupno: number; odigrane: number; pobjede: number; iskustvoUkupno: number; novaDostignuca: NovoDostignuce[]; dnkPrije: DnkOs[]; dnkPoslije: DnkOs[]; ocjenaIgre: number | null; bonusOcjenaIgre: number }>> {
  const agregati = new Map<string, { bodoviUkupno: number; odigrane: number; pobjede: number; iskustvoUkupno: number; novaDostignuca: NovoDostignuce[]; dnkPrije: DnkOs[]; dnkPoslije: DnkOs[]; ocjenaIgre: number | null; bonusOcjenaIgre: number }>();
  const modStatistike = mod;

  await baza.transaction(async (tx) => {
    if (!samoStatistika) {
      await tx
        .update(partije)
        .set({ status: 'zavrsena', kraj: new Date(), pobjednikId })
        .where(eq(partije.id, partijaId));
    }

    for (const r of rezultati) {
      const [stariIgrac] = await tx.select({
        odigrane: mod === 'dva_igraca' ? igraci.odigrane1v1 : igraci.odigrane,
        bodovi: mod === 'dva_igraca' ? igraci.bodovi1v1 : igraci.bodoviUkupno,
        eliminacije: mod === 'dva_igraca' ? igraci.eliminacije1v1 : igraci.eliminacijeUkupno,
      }).from(igraci).where(eq(igraci.id, r.igracId));
      const [staraStatistika] = await tx.select().from(statistikeRijeciIgraca)
        .where(and(eq(statistikeRijeciIgraca.igracId, r.igracId), eq(statistikeRijeciIgraca.mod, mod === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca')))
        .limit(1);
      const [staraDnkStatistika] = await tx.select().from(dnkStatistikeIgraca)
        .where(and(eq(dnkStatistikeIgraca.igracId, r.igracId), eq(dnkStatistikeIgraca.mod, mod)))
        .limit(1);
      const prije = stariIgrac ? dnkOs(stariIgrac, staraStatistika ? {
        igracId: r.igracId,
        prihvaceniPotezi: staraDnkStatistika?.prihvaceniPotezi ?? 0,
        ukupnoTrajanjePrihvaceniPoteziMs: staraDnkStatistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0,
        grupe: [], otkljucaneRijeci: [],
        najduziStreak: staraStatistika.najduziStreak,
        otkriveneJakoRijetkeGrupe: staraStatistika.otkriveneJakoRijetkeGrupe,
        otkriveneSrednjeRijetkeGrupe: staraStatistika.otkriveneSrednjeRijetkeGrupe,
        otkriveneRijetkeGrupe: staraStatistika.otkriveneRijetkeGrupe,
        upisaneDugeRijeci: staraStatistika.upisaneDugeRijeci,
        upisaneSrednjeDugeRijeci: staraStatistika.upisaneSrednjeDugeRijeci,
        upisaneJakoDugeRijeci: staraStatistika.upisaneJakoDugeRijeci,
        najduzaRijec: null, najduzaRijecGrafemi: 0, najrjedaRijec: null, najrjedaRijecFrekvencija: null, najrjedaTier: null,
      } : undefined, mod) : [];
      if (!samoStatistika) {
        await tx
          .update(sudioniciPartije)
          .set({
            plasman: r.plasman,
            bodovi: r.bodovi,
            eliminacije: r.eliminacije,
            iskustvo: r.iskustvo,
            nacinIspadanja: r.nacinIspadanja,
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
          agregati.set(r.igracId, { ...azurirani, novaDostignuca: [], dnkPrije: prije, dnkPoslije: [], ocjenaIgre: 0, bonusOcjenaIgre: 0 });
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
          agregati.set(r.igracId, { ...azurirani, novaDostignuca: [], dnkPrije: prije, dnkPoslije: [], ocjenaIgre: 0, bonusOcjenaIgre: 0 });
        }
      }

      const statistika = statistike.get(r.igracId);
      if (statistika) {
        if (statistika.grupe.length > 0) {
          await tx.insert(otkljucaneGrupeIgraca)
            .values(statistika.grupe.map(({ grupa, tier }) => ({ igracId: r.igracId, grupa, tier })))
            .onConflictDoNothing();
        }
        if (statistika.otkljucaneRijeci.length > 0) {
          await tx.insert(otkljucaneRijeciIgraca)
            .values(statistika.otkljucaneRijeci.map((redak) => ({ igracId: r.igracId, ...redak })))
            .onConflictDoUpdate({
              target: [otkljucaneRijeciIgraca.igracId, otkljucaneRijeciIgraca.rijec],
              set: { jakoDuga: sql`otkljucane_rijeci_igraca.jako_duga or excluded.jako_duga`, jakoRijetka: sql`otkljucane_rijeci_igraca.jako_rijetka or excluded.jako_rijetka`, dugaTier: sql`coalesce(otkljucane_rijeci_igraca.duga_tier, excluded.duga_tier)`, rijetkaTier: sql`coalesce(otkljucane_rijeci_igraca.rijetka_tier, excluded.rijetka_tier)` },
            });
        }
        await tx
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

      if (statistika) {
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
      if (zapisNapretka) {
        const delta: DeltaNapretkaDostignuca = { ...zapisNapretka.delta };
        if (statistika) {
          delta.rijetkeLeksemskeGrupe = (delta.rijetkeLeksemskeGrupe ?? 0)
            + statistika.otkriveneJakoRijetkeGrupe + statistika.otkriveneSrednjeRijetkeGrupe + statistika.otkriveneRijetkeGrupe;
          delta.dugeRijeci = (delta.dugeRijeci ?? 0)
            + statistika.upisaneDugeRijeci + statistika.upisaneSrednjeDugeRijeci + statistika.upisaneJakoDugeRijeci;
          delta.najduziStreak = Math.max(delta.najduziStreak ?? 0, statistika.najduziStreak);
        }
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
          const nova = izracunajNovaDostignuca({
            rijetkeLeksemskeGrupe: napredakPrijeIgre.rijetkeLeksemskeGrupe,
            dugeRijeci: napredakPrijeIgre.dugeRijeci,
            najduziStreak: napredakPrijeIgre.najduziStreak,
            kaladontIzvedbe: napredakPrijeIgre.kaladontIzvedbe,
            kaladontZrtve: napredakPrijeIgre.kaladontZrtve,
            izazvaneEliminacije: napredakPrijeIgre.izazvaneEliminacije,
            mrtvaSlovaEliminacije: napredakPrijeIgre.mrtvaSlovaEliminacije,
            javnePobjede: napredakPrijeIgre.javnePobjede,
          }, delta, razina, samoStatistika);
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
        const ukupnaStatistika: ZapisStatistikeRijeci | undefined = statistika && staraStatistika ? {
          ...statistika,
          najduziStreak: Math.max(staraStatistika.najduziStreak, statistika.najduziStreak),
          otkriveneJakoRijetkeGrupe: staraStatistika.otkriveneJakoRijetkeGrupe + statistika.otkriveneJakoRijetkeGrupe,
          otkriveneSrednjeRijetkeGrupe: staraStatistika.otkriveneSrednjeRijetkeGrupe + statistika.otkriveneSrednjeRijetkeGrupe,
          otkriveneRijetkeGrupe: staraStatistika.otkriveneRijetkeGrupe + statistika.otkriveneRijetkeGrupe,
          upisaneDugeRijeci: staraStatistika.upisaneDugeRijeci + statistika.upisaneDugeRijeci,
          upisaneSrednjeDugeRijeci: staraStatistika.upisaneSrednjeDugeRijeci + statistika.upisaneSrednjeDugeRijeci,
          upisaneJakoDugeRijeci: staraStatistika.upisaneJakoDugeRijeci + statistika.upisaneJakoDugeRijeci,
        } : statistika;
        agregatZaDnk.dnkPoslije = dnkOs({ odigrane: agregatZaDnk.odigrane, bodovi: agregatZaDnk.bodoviUkupno, eliminacije: (stariIgrac?.eliminacije ?? 0) + r.eliminacije }, ukupnaStatistika, mod);
        const brojPotezaZaOcjenu = ukupnaStatistika?.prihvaceniPotezi ?? 0;
        agregatZaDnk.ocjenaIgre = jeOcjenaIgreDostupna(brojPotezaZaOcjenu)
          ? izracunajOcjenuIgre(agregatZaDnk.dnkPrije, agregatZaDnk.dnkPoslije, r.plasman === 1)
          : null;
        agregatZaDnk.bonusOcjenaIgre = agregatZaDnk.ocjenaIgre === null ? 0 : postotakXpZaOcjenu(agregatZaDnk.ocjenaIgre);
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
    }
  });

  return agregati;
}
