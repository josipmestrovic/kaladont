import { and, eq, sql } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_STALNO_SI_TU,
  izracunajNizNakonNovogDana,
  lokalniDatumIso,
  trenutniNizZaPrikaz,
  type StanjeNizaAktivnosti,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { aktivnostIgracaDani, dostignucaIgraca, nizAktivnostiIgraca } from '../baza/shema.js';
import { sljedecaPonocNakon } from '../misije/kalendar.js';

export interface SnapshotAktivnostiDana {
  ok: true;
  lokalniDatum: string;
  trenutniNiz: number;
  najboljiNiz: number;
  razinaDostignuca: number;
  novootkljucanaRazina: number | null;
  serverTimeIso: string;
  sljedeciDanOdIso: string;
}

export interface SažetakAktivnostiDana {
  trenutniNiz: number;
  najboljiNiz: number;
  zadnjiAktivniDatum: string | null;
}

type Tx = Parameters<Parameters<typeof baza.transaction>[0]>[0];

async function zakljucajAgregat(tx: Tx, igracId: string, danas: string, sada: Date): Promise<StanjeNizaAktivnosti> {
  // Placeholder osigurava red za FOR UPDATE pri prvom posjetu (paralelni zahtjevi).
  await tx
    .insert(nizAktivnostiIgraca)
    .values({
      igracId,
      zadnjiAktivniDatum: danas,
      trenutniNiz: 1,
      najboljiNiz: 1,
      azuriranoAt: sada,
    })
    .onConflictDoNothing();

  const [red] = await tx
    .select()
    .from(nizAktivnostiIgraca)
    .where(eq(nizAktivnostiIgraca.igracId, igracId))
    .limit(1)
    .for('update');

  return {
    zadnjiAktivniDatum: red!.zadnjiAktivniDatum,
    trenutniNiz: red!.trenutniNiz,
    najboljiNiz: red!.najboljiNiz,
  };
}

async function dohvatiRazinuDostignuca(tx: Tx, igracId: string): Promise<number> {
  const [red] = await tx
    .select({ razina: dostignucaIgraca.razina })
    .from(dostignucaIgraca)
    .where(and(
      eq(dostignucaIgraca.igracId, igracId),
      eq(dostignucaIgraca.dostignuceId, ID_DOSTIGNUCA_STALNO_SI_TU),
    ))
    .limit(1);
  return red?.razina ?? 0;
}

function snapshotIzStanja(
  sada: Date,
  danas: string,
  agregat: StanjeNizaAktivnosti | null,
  razinaDostignuca: number,
  novootkljucanaRazina: number | null,
): SnapshotAktivnostiDana {
  return {
    ok: true,
    lokalniDatum: danas,
    trenutniNiz: trenutniNizZaPrikaz(agregat, danas),
    najboljiNiz: agregat?.najboljiNiz ?? 0,
    razinaDostignuca,
    novootkljucanaRazina,
    serverTimeIso: sada.toISOString(),
    sljedeciDanOdIso: sljedecaPonocNakon(sada).toISOString(),
  };
}

/** Atomarno zabilježi aktivan dan i po potrebi otključaj „Stalno si tu”. */
export async function zabiljeziAktivniDan(
  igracId: string,
  sat: { sada: () => Date } = { sada: () => new Date() },
): Promise<SnapshotAktivnostiDana> {
  const sada = sat.sada();
  const danas = lokalniDatumIso(sada);

  return baza.transaction(async (tx) => {
    const agregatZakljucan = await zakljucajAgregat(tx, igracId, danas, sada);
    const staraRazina = await dohvatiRazinuDostignuca(tx, igracId);

    const umetnuto = await tx
      .insert(aktivnostIgracaDani)
      .values({ igracId, lokalniDatum: danas, zabiljezenAt: sada })
      .onConflictDoNothing()
      .returning({ lokalniDatum: aktivnostIgracaDani.lokalniDatum });

    if (umetnuto.length === 0) {
      return snapshotIzStanja(sada, danas, agregatZakljucan, staraRazina, null);
    }

    // Placeholder s današnjim datumom znači da još nije bilo stvarnog prethodnog dana.
    const prethodno: StanjeNizaAktivnosti | null =
      agregatZakljucan.zadnjiAktivniDatum === danas ? null : agregatZakljucan;

    const ishod = izracunajNizNakonNovogDana(prethodno, danas, staraRazina);

    await tx
      .update(nizAktivnostiIgraca)
      .set({
        zadnjiAktivniDatum: danas,
        trenutniNiz: ishod.trenutniNiz,
        najboljiNiz: ishod.najboljiNiz,
        azuriranoAt: sada,
      })
      .where(eq(nizAktivnostiIgraca.igracId, igracId));

    if (ishod.novootkljucanaRazina !== null) {
      await tx
        .insert(dostignucaIgraca)
        .values({
          igracId,
          dostignuceId: ID_DOSTIGNUCA_STALNO_SI_TU,
          razina: ishod.razinaDostignuca,
          prvoOtkljucano: sada,
          zadnjeOtkljucavanje: sada,
        })
        .onConflictDoUpdate({
          target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
          set: {
            razina: sql`greatest(${dostignucaIgraca.razina}, ${ishod.razinaDostignuca})`,
            zadnjeOtkljucavanje: sada,
          },
        });
    }

    return snapshotIzStanja(
      sada,
      danas,
      {
        zadnjiAktivniDatum: danas,
        trenutniNiz: ishod.trenutniNiz,
        najboljiNiz: ishod.najboljiNiz,
      },
      ishod.razinaDostignuca,
      ishod.novootkljucanaRazina,
    );
  });
}

export async function dohvatiSažetakAktivnostiDana(
  igracId: string,
  sada: Date = new Date(),
): Promise<SažetakAktivnostiDana> {
  const danas = lokalniDatumIso(sada);
  const [agregat] = await baza
    .select()
    .from(nizAktivnostiIgraca)
    .where(eq(nizAktivnostiIgraca.igracId, igracId))
    .limit(1);
  if (!agregat) {
    return { trenutniNiz: 0, najboljiNiz: 0, zadnjiAktivniDatum: null };
  }
  const stanje: StanjeNizaAktivnosti = {
    zadnjiAktivniDatum: agregat.zadnjiAktivniDatum,
    trenutniNiz: agregat.trenutniNiz,
    najboljiNiz: agregat.najboljiNiz,
  };
  return {
    trenutniNiz: trenutniNizZaPrikaz(stanje, danas),
    najboljiNiz: stanje.najboljiNiz,
    zadnjiAktivniDatum: stanje.zadnjiAktivniDatum,
  };
}

export async function dohvatiNajboljiNizAktivnosti(igracId: string): Promise<number> {
  const [agregat] = await baza
    .select({ najboljiNiz: nizAktivnostiIgraca.najboljiNiz })
    .from(nizAktivnostiIgraca)
    .where(eq(nizAktivnostiIgraca.igracId, igracId))
    .limit(1);
  return agregat?.najboljiNiz ?? 0;
}
