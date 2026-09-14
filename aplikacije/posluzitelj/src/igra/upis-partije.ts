/**
 * Upis partije u bazu (model-podataka.md): partije, sudionici_partije, potezi, agregati u igraci.
 * DB pozivi iz motora partije su "fire and forget" (ne blokiraju tijek igre) osim zaključka partije,
 * koji je transakcijski jer mijenja više tablica odjednom.
 */
import { and, eq, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { igraci, otkljucaneGrupeIgraca, otkljucaneRijeciIgraca, partije, potezi, statistikeRijeciIgraca, sudioniciPartije } from '../baza/shema.js';
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
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'pobjednik' | 'kaladont';
}

export interface ZapisStatistikeRijeci {
  igracId: string;
  grupe: { grupa: string; tier: number | null }[];
  otkljucaneRijeci: { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[];
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

/** Zaključuje partiju transakcijski i vraća ažurirane agregate (bodovi_ukupno, odigrane) po igraču. */
export async function zakljuciPartijuUBazi(
  partijaId: string,
  pobjednikId: string,
  rezultati: ZapisSudionika[],
  mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
  statistike: Map<string, ZapisStatistikeRijeci> = new Map(),
  samoStatistika = false,
): Promise<Map<string, { bodoviUkupno: number; odigrane: number }>> {
  const agregati = new Map<string, { bodoviUkupno: number; odigrane: number }>();
  const modStatistike = 'cetiri_igraca' as const;

  await baza.transaction(async (tx) => {
    if (!samoStatistika) {
      await tx
        .update(partije)
        .set({ status: 'zavrsena', kraj: new Date(), pobjednikId })
        .where(eq(partije.id, partijaId));
    }

    for (const r of rezultati) {
      if (!samoStatistika) {
        await tx
          .update(sudioniciPartije)
          .set({
            plasman: r.plasman,
            bodovi: r.bodovi,
            eliminacije: r.eliminacije,
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
          })
          .where(eq(igraci.id, r.igracId))
          .returning({ bodoviUkupno: igraci.bodovi1v1, odigrane: igraci.odigrane1v1 });

        if (azurirani) {
          agregati.set(r.igracId, azurirani);
        }
      } else if (!samoStatistika) {
        const [azurirani] = await tx
          .update(igraci)
          .set({
            odigrane: sql`${igraci.odigrane} + 1`,
            pobjede: sql`${igraci.pobjede} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacijeUkupno: sql`${igraci.eliminacijeUkupno} + ${r.eliminacije}`,
            bodoviUkupno: sql`${igraci.bodoviUkupno} + ${r.bodovi}`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({ bodoviUkupno: igraci.bodoviUkupno, odigrane: igraci.odigrane });

        if (azurirani) {
          agregati.set(r.igracId, azurirani);
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
    }
  });

  return agregati;
}
