/**
 * PR04: transakcijski settlement Izazova — XP, zavrseci, Izazivač, misije.
 */
import { and, eq, sql } from 'drizzle-orm';
import {
  DEFINICIJE_DOSTIGNUCA,
  ID_DOSTIGNUCA_IZAZIVAC,
  MAKSIMALNO_ISKUSTVO,
  ZADANI_PRAVILNIK,
  izracunajRazinuDostignuca,
  izracunajZvjezdiceIzazivaca,
  pokusajDefinicijuIzazova,
  stanjeIskustva,
  type MetrikeMisijaIgre,
  type ModPartije,
  type ObavijestOtkljucanogDostignuca,
  type PravilnikPartije,
  type RazlogNeuspjehaIzazova,
  type StatusSpremanjaIzazova,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  pokusajiIzazova,
  zavrseciIzazova,
} from '../baza/shema.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import {
  dohvatiIshodMisija,
  obracunajMisijeZaIgraca,
  type IshodMisijaPayload,
} from '../misije/obracun.js';
import {
  emitirajPromjeneSanducica,
  stvoriPorukeXpRazina,
  stvoriPorukeZvjezdica,
} from '../sanducic/okidaci.js';
import type { RedakPokusajaIzazova, SnapshotPokusajaIzazova } from './pohrana.js';

const MISIJA_RAZLOZI = new Set<RazlogNeuspjehaIzazova>([
  'eliminiran',
  'nevaljana_rijec',
  'cilj_neispunjen',
]);

export interface ChallengeXpSettlement {
  nominal: number;
  awarded: number;
}

export interface SettlementIzazova {
  firstCompletion: boolean;
  challengeXp: ChallengeXpSettlement;
  missionXp: { nominal: number; awarded: number };
  izazivac: { zvjezdice: number; novaRazina: number };
  settlementState: StatusSpremanjaIzazova;
  ishodMisija: IshodMisijaPayload | null;
  novaDostignuca: { id: string; novaRazina: number; maksimalnaRazina: number }[];
}

function prazanSettlement(state: StatusSpremanjaIzazova = 'nije_potrebno'): SettlementIzazova {
  return {
    firstCompletion: false,
    challengeXp: { nominal: 0, awarded: 0 },
    missionXp: { nominal: 0, awarded: 0 },
    izazivac: { zvjezdice: 0, novaRazina: 0 },
    settlementState: state,
    ishodMisija: null,
    novaDostignuca: [],
  };
}

export function izazovKvalificiraZaMisiju(ulaz: {
  status: string;
  reason: string | null | undefined;
  prihvaceneRijeci: number;
}): boolean {
  if (ulaz.prihvaceneRijeci < 1) return false;
  if (ulaz.status === 'uspjeh') return true;
  if (ulaz.status === 'neuspjeh' && ulaz.reason && MISIJA_RAZLOZI.has(ulaz.reason as RazlogNeuspjehaIzazova)) {
    return true;
  }
  return false;
}

function citajPrihvaceneRijeci(metrics: Record<string, unknown>): number {
  const n = metrics.prihvaceneRijeci;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function citajSpremljeniSettlement(metrics: Record<string, unknown>): SettlementIzazova | null {
  const s = metrics.settlement;
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  const challengeXp = o.challengeXp as ChallengeXpSettlement | undefined;
  const missionXp = o.missionXp as { nominal: number; awarded: number } | undefined;
  const izazivac = o.izazivac as { zvjezdice: number; novaRazina: number } | undefined;
  if (!challengeXp || !missionXp || !izazivac) return null;
  return {
    firstCompletion: Boolean(o.firstCompletion),
    challengeXp: {
      nominal: Number(challengeXp.nominal) || 0,
      awarded: Number(challengeXp.awarded) || 0,
    },
    missionXp: {
      nominal: Number(missionXp.nominal) || 0,
      awarded: Number(missionXp.awarded) || 0,
    },
    izazivac: {
      zvjezdice: Number(izazivac.zvjezdice) || 0,
      novaRazina: Number(izazivac.novaRazina) || 0,
    },
    settlementState: 'spremljeno',
    ishodMisija: null,
    novaDostignuca: Array.isArray(o.novaDostignuca)
      ? o.novaDostignuca as SettlementIzazova['novaDostignuca']
      : [],
  };
}

function snapshotIzRetka(redak: RedakPokusajaIzazova): SnapshotPokusajaIzazova {
  return redak.snapshot as SnapshotPokusajaIzazova;
}

function nacinIspadanjaZaMisiju(
  status: string,
  reason: string | null,
): string {
  if (status === 'uspjeh') return 'pobjednik';
  if (reason === 'odustao' || reason === 'prekid_veze') return 'prekid';
  return reason ?? 'eliminiran';
}

/**
 * Obračunaj nagrade nakon terminalnog CAS-a.
 * Idempotentno: `spremljeno` → postojeći payload; UNIQUE na zavrseci / ishodi sprječava duplikate.
 */
export async function obracunajSettlementIzazova(
  redak: RedakPokusajaIzazova,
): Promise<SettlementIzazova> {
  if (redak.status === 'tehnicki_prekinuto') {
    return prazanSettlement('nije_potrebno');
  }
  if (redak.status !== 'uspjeh' && redak.status !== 'neuspjeh') {
    return prazanSettlement('nije_potrebno');
  }

  const metrics = (redak.metrics ?? {}) as Record<string, unknown>;
  if (redak.settlementState === 'spremljeno') {
    return citajSpremljeniSettlement(metrics) ?? prazanSettlement('spremljeno');
  }

  const snapshot = snapshotIzRetka(redak);
  const definicija = pokusajDefinicijuIzazova(redak.challengeId);
  const nominalXp =
    (typeof snapshot.xp === 'number' && Number.isFinite(snapshot.xp) ? snapshot.xp : null)
    ?? definicija?.xp
    ?? 0;
  const terminalAt = redak.terminalAt ?? new Date();
  const prihvaceneRijeci = citajPrihvaceneRijeci(metrics);

  type TxRezultat = {
    settlement: SettlementIzazova;
    obavijesti: ObavijestOtkljucanogDostignuca[];
    sanducic: number;
  };

  const rezultat = await baza.transaction(async (tx): Promise<TxRezultat> => {
    const [igrac] = await tx.select({
      vrsta: igraci.vrsta,
      upravljac: igraci.upravljac,
      obrisanAt: igraci.obrisanAt,
      iskustvoUkupno: igraci.iskustvoUkupno,
    })
      .from(igraci)
      .where(eq(igraci.id, redak.igracId))
      .for('update');

    if (!igrac || igrac.upravljac !== 'covjek' || igrac.obrisanAt !== null) {
      return {
        settlement: prazanSettlement('nije_potrebno'),
        obavijesti: [],
        sanducic: 0,
      };
    }

    await tx.update(pokusajiIzazova).set({
      settlementState: 'spremanje_u_tijeku',
    }).where(eq(pokusajiIzazova.id, redak.id));

    const jeRegistriran = igrac.vrsta === 'registriran' || igrac.vrsta === 'admin';
    let firstCompletion = false;
    let challengeXp: ChallengeXpSettlement = { nominal: 0, awarded: 0 };
    const iskustvoPrije = igrac.iskustvoUkupno;
    let iskustvoNakonKampanje = igrac.iskustvoUkupno;
    const novaDostignuca: SettlementIzazova['novaDostignuca'] = [];
    let izazivacNovaRazina = 0;
    let izazivacZvjezdice = 0;
    let sanducic = 0;
    const obavijesti: ObavijestOtkljucanogDostignuca[] = [];

    if (redak.status === 'uspjeh') {
      const room = Math.max(0, MAKSIMALNO_ISKUSTVO - igrac.iskustvoUkupno);
      const awardedXp = Math.min(nominalXp, room);
      challengeXp = { nominal: nominalXp, awarded: awardedXp };

      const [umetnut] = await tx.insert(zavrseciIzazova).values({
        igracId: redak.igracId,
        challengeId: redak.challengeId,
        firstSuccessAttemptId: redak.id,
        vrijeme: terminalAt,
        nominalXp,
        awardedXp,
        rewardEpoch: 1,
      }).onConflictDoNothing().returning({
        challengeId: zavrseciIzazova.challengeId,
        awardedXp: zavrseciIzazova.awardedXp,
        firstSuccessAttemptId: zavrseciIzazova.firstSuccessAttemptId,
      });

      if (umetnut) {
        firstCompletion = true;
        if (awardedXp > 0) {
          const prije = stanjeIskustva(igrac.iskustvoUkupno);
          await tx.update(igraci).set({
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${awardedXp}, ${MAKSIMALNO_ISKUSTVO})`,
          }).where(eq(igraci.id, redak.igracId));
          iskustvoNakonKampanje = Math.min(MAKSIMALNO_ISKUSTVO, igrac.iskustvoUkupno + awardedXp);
          const poslije = stanjeIskustva(iskustvoNakonKampanje);
          sanducic += await stvoriPorukeXpRazina({
            igracId: redak.igracId,
            razinaPrije: prije.razina,
            razinaPoslije: poslije.razina,
            tx,
            izvorTip: 'izazov',
            izvorId: redak.id,
          });
          const iskusnjara = DEFINICIJE_DOSTIGNUCA.find((d) => d.id === 'iskusnjara');
          if (iskusnjara) {
            const prijeZv = izracunajRazinuDostignuca(iskusnjara, prije.razina);
            const poslijeZv = izracunajRazinuDostignuca(iskusnjara, poslije.razina);
            if (poslijeZv > prijeZv) {
              await tx.insert(dostignucaIgraca).values({
                igracId: redak.igracId,
                dostignuceId: 'iskusnjara',
                razina: poslijeZv,
                prvoOtkljucano: terminalAt,
                zadnjeOtkljucavanje: terminalAt,
              }).onConflictDoUpdate({
                target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
                set: { razina: poslijeZv, zadnjeOtkljucavanje: terminalAt },
              });
              sanducic += await stvoriPorukeZvjezdica({
                igracId: redak.igracId,
                dostignuceId: 'iskusnjara',
                staraRazina: prijeZv,
                novaRazina: poslijeZv,
                tx,
                izvorTip: 'izazov',
                izvorId: redak.id,
              });
              novaDostignuca.push({
                id: 'iskusnjara',
                novaRazina: poslijeZv,
                maksimalnaRazina: iskusnjara.pragovi.length,
              });
            }
          }
        }

        const zavrseniRedovi = await tx
          .select({ challengeId: zavrseciIzazova.challengeId })
          .from(zavrseciIzazova)
          .where(eq(zavrseciIzazova.igracId, redak.igracId));
        const zavrseni = new Set(zavrseniRedovi.map((r) => r.challengeId));
        izazivacZvjezdice = izracunajZvjezdiceIzazivaca(zavrseni);

        const definicijaIzazivac = DEFINICIJE_DOSTIGNUCA.find((d) => d.id === ID_DOSTIGNUCA_IZAZIVAC);
        if (!definicijaIzazivac) throw new Error('Nedostaje definicija dostignuća Izazivač.');

        const [napredakPrije] = await tx
          .select({ izazivacZvjezdice: napredakDostignucaIgraca.izazivacZvjezdice })
          .from(napredakDostignucaIgraca)
          .where(eq(napredakDostignucaIgraca.igracId, redak.igracId));
        const stareZvijezde = napredakPrije?.izazivacZvjezdice ?? 0;

        await tx.insert(napredakDostignucaIgraca).values({
          igracId: redak.igracId,
          izazivacZvjezdice,
        }).onConflictDoUpdate({
          target: napredakDostignucaIgraca.igracId,
          set: {
            izazivacZvjezdice,
            azurirano: new Date(),
          },
        });

        const prijeRazina = izracunajRazinuDostignuca(definicijaIzazivac, stareZvijezde);
        const poslijeRazina = izracunajRazinuDostignuca(definicijaIzazivac, izazivacZvjezdice);
        if (poslijeRazina > prijeRazina) {
          izazivacNovaRazina = poslijeRazina;
          await tx.insert(dostignucaIgraca).values({
            igracId: redak.igracId,
            dostignuceId: ID_DOSTIGNUCA_IZAZIVAC,
            razina: poslijeRazina,
            prvoOtkljucano: terminalAt,
            zadnjeOtkljucavanje: terminalAt,
          }).onConflictDoUpdate({
            target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
            set: { razina: poslijeRazina, zadnjeOtkljucavanje: terminalAt },
          });
          sanducic += await stvoriPorukeZvjezdica({
            igracId: redak.igracId,
            dostignuceId: ID_DOSTIGNUCA_IZAZIVAC,
            staraRazina: prijeRazina,
            novaRazina: poslijeRazina,
            tx,
            izvorTip: 'izazov',
            izvorId: redak.id,
          });
          novaDostignuca.push({
            id: ID_DOSTIGNUCA_IZAZIVAC,
            novaRazina: poslijeRazina,
            maksimalnaRazina: definicijaIzazivac.pragovi.length,
          });
        }
      } else {
        // Repeat uspjeh ili utrka — nagrada već postoji; pročitaj nominal/awarded.
        const [postojeci] = await tx.select({
          nominalXp: zavrseciIzazova.nominalXp,
          awardedXp: zavrseciIzazova.awardedXp,
          firstSuccessAttemptId: zavrseciIzazova.firstSuccessAttemptId,
        })
          .from(zavrseciIzazova)
          .where(and(
            eq(zavrseciIzazova.igracId, redak.igracId),
            eq(zavrseciIzazova.challengeId, redak.challengeId),
          ));
        if (postojeci) {
          firstCompletion = postojeci.firstSuccessAttemptId === redak.id;
          challengeXp = {
            nominal: firstCompletion ? postojeci.nominalXp : 0,
            awarded: firstCompletion ? postojeci.awardedXp : 0,
          };
        } else {
          challengeXp = { nominal: 0, awarded: 0 };
        }
        const [napredak] = await tx
          .select({ izazivacZvjezdice: napredakDostignucaIgraca.izazivacZvjezdice })
          .from(napredakDostignucaIgraca)
          .where(eq(napredakDostignucaIgraca.igracId, redak.igracId));
        izazivacZvjezdice = napredak?.izazivacZvjezdice ?? 0;
      }
    } else {
      const [napredak] = await tx
        .select({ izazivacZvjezdice: napredakDostignucaIgraca.izazivacZvjezdice })
        .from(napredakDostignucaIgraca)
        .where(eq(napredakDostignucaIgraca.igracId, redak.igracId));
      izazivacZvjezdice = napredak?.izazivacZvjezdice ?? 0;
    }

    let ishodMisija: IshodMisijaPayload | null = null;
    const kvalificira = izazovKvalificiraZaMisiju({
      status: redak.status,
      reason: redak.reason,
      prihvaceneRijeci,
    });

    if (jeRegistriran && kvalificira) {
      const postojeći = await dohvatiIshodMisija(tx, redak.igracId, 'izazov', redak.id);
      if (postojeći) {
        ishodMisija = postojeći;
      } else {
        const mod = (snapshot.mod ?? 'dva_igraca') as ModPartije;
        const pravila = (snapshot.pravila ?? ZADANI_PRAVILNIK) as PravilnikPartije;
        const metrike: MetrikeMisijaIgre = {
          izvorId: redak.id,
          kontekst: 'izazov',
          mod: mod === 'tri_igraca' || mod === 'cetiri_igraca' ? mod : 'dva_igraca',
          igracId: redak.igracId,
          zavrsenoU: terminalAt,
          plasman: redak.status === 'uspjeh' ? 1 : 99,
          nacinIspadanja: nacinIspadanjaZaMisiju(redak.status, redak.reason),
          prihvaceneRijeci,
          najduziNiz: 0,
          dugeRijeci: typeof metrics.dugeRijeci === 'number' ? metrics.dugeRijeci : 0,
          jakoDugeRijeci: 0,
          rijetkeRijeci: typeof metrics.rijetkeRijeci === 'number' ? metrics.rijetkeRijeci : 0,
          jakoRijetkeRijeci: 0,
          dugeIRijetkeRijeci: 0,
          eliminacije: 0,
          kaladontIzvedbe: 0,
          razlicitiPoceci: [],
          pravila,
          odabranaPravila: pravila,
          spojeniDvoboj: false,
          uspjesniDokazi: typeof metrics.uspjesniDokazi === 'number' ? metrics.uspjesniDokazi : 0,
          kaladontSljedeciUzTriPlus: 0,
        };
        ishodMisija = await obracunajMisijeZaIgraca(
          tx,
          metrike,
          iskustvoNakonKampanje,
          iskustvoPrije,
        );
      }
      if (ishodMisija?.noveObavijesti?.length) {
        obavijesti.push(...ishodMisija.noveObavijesti);
      }
      if (ishodMisija?.novaDostignuca?.length) {
        novaDostignuca.push(...ishodMisija.novaDostignuca);
      }
    }

    const settlement: SettlementIzazova = {
      firstCompletion,
      challengeXp,
      missionXp: {
        nominal: ishodMisija?.ukupnoIskustvo.misijskiXpNominalno ?? 0,
        awarded: ishodMisija?.ukupnoIskustvo.misijskiXpStvarno ?? 0,
      },
      izazivac: {
        zvjezdice: izazivacZvjezdice,
        novaRazina: izazivacNovaRazina,
      },
      settlementState: 'spremljeno',
      ishodMisija,
      novaDostignuca,
    };

    const settlementZaMetrics = {
      firstCompletion: settlement.firstCompletion,
      challengeXp: settlement.challengeXp,
      missionXp: settlement.missionXp,
      izazivac: settlement.izazivac,
      novaDostignuca: settlement.novaDostignuca,
    };

    await tx.update(pokusajiIzazova).set({
      settlementState: 'spremljeno',
      metrics: {
        ...metrics,
        prihvaceneRijeci,
        settlement: settlementZaMetrics,
      },
    }).where(eq(pokusajiIzazova.id, redak.id));

    return { settlement, obavijesti, sanducic };
  });

  if (rezultat.obavijesti.length) {
    emitirajNovostiDostignuca(redak.igracId, rezultat.obavijesti);
  }
  if (
    rezultat.sanducic > 0
    || (rezultat.settlement.ishodMisija?.novaDostignuca.length ?? 0) > 0
    || rezultat.settlement.novaDostignuca.length > 0
  ) {
    emitirajPromjeneSanducica([redak.igracId]);
  }

  return rezultat.settlement;
}
