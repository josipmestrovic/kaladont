import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
  ID_DOSTIGNUCA_PRIVATNIK,
  ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
  dohvatiDefinicijuDostignuca,
  izracunajRazinuDostignuca,
  type NovoDostignuce,
  type ObavijestOtkljucanogDostignuca,
} from 'zajednicko';
import {
  dostignucaIgraca,
  dodjeleMisija,
  dokaziDostignucaMisija,
  dokaziDostignucaPrivatnik,
  dokaziDostignucaTjedniPaket,
  napredakDostignucaIgraca,
  obavijestiIgraca,
} from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';

export interface IshodDodjele {
  doprinosUmetnut: boolean;
  novaDostignuca: NovoDostignuce[];
  noveObavijesti: ObavijestOtkljucanogDostignuca[];
}

function prazanIshod(): IshodDodjele {
  return { doprinosUmetnut: false, novaDostignuca: [], noveObavijesti: [] };
}

type DokazDodjele =
  | { vrsta: 'misija'; dodjelaId: string }
  | { vrsta: 'privatnik'; partijaId: string }
  | { vrsta: 'tjedni_paket'; ciklusId: string };

export interface ParametriDodjele {
  igracId: string;
  dostignuceId: string;
  dokaz: DokazDodjele;
  zavrsenoU: Date;
  izvor: string;
  kontekst?: Record<string, unknown> | null;
}

async function umetniDokaz(tx: MisijeTx, parametri: ParametriDodjele) {
  const { igracId, dokaz } = parametri;
  if (dokaz.vrsta === 'misija') {
    return tx.insert(dokaziDostignucaMisija).values({ igracId, dodjelaId: dokaz.dodjelaId })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaMisija.igracId });
  }
  if (dokaz.vrsta === 'privatnik') {
    return tx.insert(dokaziDostignucaPrivatnik).values({ igracId, partijaId: dokaz.partijaId })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaPrivatnik.igracId });
  }
  return tx.insert(dokaziDostignucaTjedniPaket).values({ igracId, ciklusId: dokaz.ciklusId })
    .onConflictDoNothing()
    .returning({ igracId: dokaziDostignucaTjedniPaket.igracId });
}

async function uvecajBrojac(tx: MisijeTx, igracId: string, brojac: 'dovrseneMisije' | 'privatneIgre' | 'tjedniPaketi', zavrsenoU: Date): Promise<number> {
  if (brojac === 'dovrseneMisije') {
    const [red] = await tx.insert(napredakDostignucaIgraca).values({ igracId, dovrseneMisije: 1 }).onConflictDoUpdate({
      target: napredakDostignucaIgraca.igracId,
      set: { dovrseneMisije: sql`${napredakDostignucaIgraca.dovrseneMisije} + 1`, azurirano: zavrsenoU },
    }).returning({ vrijednost: napredakDostignucaIgraca.dovrseneMisije });
    return red?.vrijednost ?? 0;
  }
  if (brojac === 'privatneIgre') {
    const [red] = await tx.insert(napredakDostignucaIgraca).values({ igracId, privatneIgre: 1 }).onConflictDoUpdate({
      target: napredakDostignucaIgraca.igracId,
      set: { privatneIgre: sql`${napredakDostignucaIgraca.privatneIgre} + 1`, azurirano: zavrsenoU },
    }).returning({ vrijednost: napredakDostignucaIgraca.privatneIgre });
    return red?.vrijednost ?? 0;
  }
  const [red] = await tx.insert(napredakDostignucaIgraca).values({ igracId, tjedniPaketi: 1 }).onConflictDoUpdate({
    target: napredakDostignucaIgraca.igracId,
    set: { tjedniPaketi: sql`${napredakDostignucaIgraca.tjedniPaketi} + 1`, azurirano: zavrsenoU },
  }).returning({ vrijednost: napredakDostignucaIgraca.tjedniPaketi });
  return red?.vrijednost ?? 0;
}

/**
 * Umetne dokaz, poveća brojač i po potrebi podigne razinu + trajnu obavijest.
 * Ponovljeni dokaz je no-op (ON CONFLICT DO NOTHING).
 */
export async function dodijeliDoprinos(tx: MisijeTx, parametri: ParametriDodjele): Promise<IshodDodjele> {
  const umetnuto = await umetniDokaz(tx, parametri);
  if (umetnuto.length === 0) return prazanIshod();

  const definicija = dohvatiDefinicijuDostignuca(parametri.dostignuceId);
  if (!definicija || (definicija.brojac !== 'dovrseneMisije' && definicija.brojac !== 'privatneIgre' && definicija.brojac !== 'tjedniPaketi')) {
    throw new Error(`Dostignuće ${parametri.dostignuceId} nije servisni brojač D01.`);
  }

  const vrijednost = await uvecajBrojac(tx, parametri.igracId, definicija.brojac, parametri.zavrsenoU);
  const novaRazina = izracunajRazinuDostignuca(definicija, vrijednost);
  const [postojeca] = await tx.select({ razina: dostignucaIgraca.razina }).from(dostignucaIgraca).where(and(
    eq(dostignucaIgraca.igracId, parametri.igracId),
    eq(dostignucaIgraca.dostignuceId, parametri.dostignuceId),
  )).for('update');
  const staraRazina = postojeca?.razina ?? 0;

  if (novaRazina > 0) {
    await tx.insert(dostignucaIgraca).values({
      igracId: parametri.igracId,
      dostignuceId: parametri.dostignuceId,
      razina: novaRazina,
      prvoOtkljucano: parametri.zavrsenoU,
      zadnjeOtkljucavanje: parametri.zavrsenoU,
    }).onConflictDoUpdate({
      target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
      set: {
        razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`,
        prvoOtkljucano: sql`coalesce(${dostignucaIgraca.prvoOtkljucano}, excluded.prvo_otkljucano)`,
        zadnjeOtkljucavanje: sql`case when excluded.razina > ${dostignucaIgraca.razina} then excluded.zadnje_otkljucavanje else ${dostignucaIgraca.zadnjeOtkljucavanje} end`,
      },
    });
  }

  const novaDostignuca: NovoDostignuce[] = [];
  const noveObavijesti: ObavijestOtkljucanogDostignuca[] = [];
  if (novaRazina > staraRazina) {
    const [obavijest] = await tx.insert(obavijestiIgraca).values({
      igracId: parametri.igracId,
      vrsta: 'dostignuce_otkljucano',
      dostignuceId: parametri.dostignuceId,
      novaRazina,
      maksimalnaRazina: definicija.pragovi.length,
      izvor: parametri.izvor,
      kontekst: parametri.kontekst ?? null,
      stvorenoU: parametri.zavrsenoU,
    }).onConflictDoNothing({
      target: [obavijestiIgraca.igracId, obavijestiIgraca.dostignuceId, obavijestiIgraca.novaRazina],
    }).returning({
      id: obavijestiIgraca.id,
      dostignuceId: obavijestiIgraca.dostignuceId,
      novaRazina: obavijestiIgraca.novaRazina,
      maksimalnaRazina: obavijestiIgraca.maksimalnaRazina,
      izvor: obavijestiIgraca.izvor,
    });
    novaDostignuca.push({
      id: parametri.dostignuceId,
      novaRazina,
      maksimalnaRazina: definicija.pragovi.length,
    });
    if (obavijest?.id && obavijest.dostignuceId && obavijest.novaRazina != null && obavijest.maksimalnaRazina != null) {
      noveObavijesti.push({
        id: obavijest.id,
        dostignuceId: obavijest.dostignuceId,
        naziv: definicija.naziv,
        novaRazina: obavijest.novaRazina,
        maksimalnaRazina: obavijest.maksimalnaRazina,
        izvor: obavijest.izvor,
      });
    }
  }

  return { doprinosUmetnut: true, novaDostignuca, noveObavijesti };
}

export function priznajDovrsenuMisiju(
  tx: MisijeTx,
  ulaz: { igracId: string; dodjelaId: string; zavrsenoU: Date },
): Promise<IshodDodjele> {
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_COVJEK_NA_MISIJI,
    dokaz: { vrsta: 'misija', dodjelaId: ulaz.dodjelaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'misija',
    kontekst: { dodjelaId: ulaz.dodjelaId },
  });
}

export async function priznajTjedniPaketAkoKompletan(
  tx: MisijeTx,
  ulaz: { igracId: string; ciklusId: string; zavrsenoU: Date },
): Promise<IshodDodjele> {
  const [red] = await tx.select({
    broj: sql<number>`count(distinct ${dodjeleMisija.slot})::int`,
  }).from(dodjeleMisija).where(and(
    eq(dodjeleMisija.igracId, ulaz.igracId),
    eq(dodjeleMisija.ciklusId, ulaz.ciklusId),
    eq(dodjeleMisija.vrsta, 'tjedna'),
    eq(dodjeleMisija.status, 'dovrsena'),
    inArray(dodjeleMisija.slot, [1, 2, 3]),
  ));
  if (Number(red?.broj ?? 0) < 3) return prazanIshod();
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_TJEDAN_POD_KONTROLOM,
    dokaz: { vrsta: 'tjedni_paket', ciklusId: ulaz.ciklusId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'tjedni_paket',
    kontekst: { ciklusId: ulaz.ciklusId },
  });
}

export function priznajPrivatnika(
  tx: MisijeTx,
  ulaz: { igracId: string; partijaId: string; zavrsenoU: Date },
): Promise<IshodDodjele> {
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_PRIVATNIK,
    dokaz: { vrsta: 'privatnik', partijaId: ulaz.partijaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'privatna_igra',
    kontekst: { partijaId: ulaz.partijaId },
  });
}
