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
  dokaziDostignucaCistaPetica,
  dokaziDostignucaDvostrukaKruna,
  dokaziDostignucaMisija,
  dokaziDostignucaPrivatnik,
  dokaziDostignucaNaDvijeFronte,
  dokaziDostignucaRijetkaGrdosija,
  dokaziDostignucaSvePohvale,
  dokaziDostignucaTjedniPaket,
  dokaziDostignucaTop10,
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
  | { vrsta: 'tjedni_paket'; ciklusId: string }
  | { vrsta: 'dnevna_pobjeda'; lokalniDatum: string }
  | { vrsta: 'cista_petica'; partijaId: string }
  | { vrsta: 'sve_pohvale'; partijaId: string }
  | { vrsta: 'rijetka_grdosija'; normaliziraniOblik: string }
  | { vrsta: 'top10_razdoblje'; kalendarskiPocetak: Date }
  | { vrsta: 'na_dvije_fronte'; vrstaRazdoblja: 'dnevno' | 'tjedno' | 'mjesecno'; kalendarskiPocetak: Date };

const STUPCI_SERVISNIH_BROJACA = {
  dovrseneMisije: napredakDostignucaIgraca.dovrseneMisije,
  privatneIgre: napredakDostignucaIgraca.privatneIgre,
  tjedniPaketi: napredakDostignucaIgraca.tjedniPaketi,
  dvostrukeKrune: napredakDostignucaIgraca.dvostrukeKrune,
  cistePetice: napredakDostignucaIgraca.cistePetice,
  svePohvale: napredakDostignucaIgraca.svePohvale,
  rijetkeGrdosije: napredakDostignucaIgraca.rijetkeGrdosije,
  dnevneDesetke: napredakDostignucaIgraca.dnevneDesetke,
  tjedneElite: napredakDostignucaIgraca.tjedneElite,
  mjesecneElite: napredakDostignucaIgraca.mjesecneElite,
  naDvijeFronte: napredakDostignucaIgraca.naDvijeFronte,
} as const;

type ServisniBrojac = keyof typeof STUPCI_SERVISNIH_BROJACA;

function jeServisniBrojac(brojac: string): brojac is ServisniBrojac {
  return Object.hasOwn(STUPCI_SERVISNIH_BROJACA, brojac);
}

export interface ParametriDodjele {
  igracId: string;
  dostignuceId: string;
  dokaz: DokazDodjele;
  zavrsenoU: Date;
  izvor: string;
  kontekst?: Record<string, unknown> | null;
  /** Više doprinosa istog dostignuća u jednoj obradi dijeli jednu obavijest najviše razine. */
  preskociObavijest?: boolean;
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
  if (dokaz.vrsta === 'tjedni_paket') {
    return tx.insert(dokaziDostignucaTjedniPaket).values({ igracId, ciklusId: dokaz.ciklusId })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaTjedniPaket.igracId });
  }
  if (dokaz.vrsta === 'dnevna_pobjeda') {
    return tx.insert(dokaziDostignucaDvostrukaKruna).values({ igracId, lokalniDatum: dokaz.lokalniDatum })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaDvostrukaKruna.igracId });
  }
  if (dokaz.vrsta === 'cista_petica') {
    return tx.insert(dokaziDostignucaCistaPetica).values({ igracId, partijaId: dokaz.partijaId })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaCistaPetica.igracId });
  }
  if (dokaz.vrsta === 'sve_pohvale') {
    return tx.insert(dokaziDostignucaSvePohvale).values({ igracId, partijaId: dokaz.partijaId })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaSvePohvale.igracId });
  }
  if (dokaz.vrsta === 'rijetka_grdosija') {
    return tx.insert(dokaziDostignucaRijetkaGrdosija).values({ igracId, normaliziraniOblik: dokaz.normaliziraniOblik })
      .onConflictDoNothing()
      .returning({ igracId: dokaziDostignucaRijetkaGrdosija.igracId });
  }
  if (dokaz.vrsta === 'top10_razdoblje') {
    return tx.insert(dokaziDostignucaTop10).values({
      igracId,
      dostignuceId: parametri.dostignuceId,
      kalendarskiPocetak: dokaz.kalendarskiPocetak,
    }).onConflictDoNothing().returning({ igracId: dokaziDostignucaTop10.igracId });
  }
  return tx.insert(dokaziDostignucaNaDvijeFronte).values({
    igracId,
    vrstaRazdoblja: dokaz.vrstaRazdoblja,
    kalendarskiPocetak: dokaz.kalendarskiPocetak,
  }).onConflictDoNothing().returning({ igracId: dokaziDostignucaNaDvijeFronte.igracId });
}

export async function upisiObavijestDostignuca(
  tx: MisijeTx,
  ulaz: {
    igracId: string;
    dostignuceId: string;
    novaRazina: number;
    zavrsenoU: Date;
    izvor: string;
    kontekst?: Record<string, unknown> | null;
  },
): Promise<ObavijestOtkljucanogDostignuca | null> {
  const definicija = dohvatiDefinicijuDostignuca(ulaz.dostignuceId);
  if (!definicija) return null;
  const [obavijest] = await tx.insert(obavijestiIgraca).values({
    igracId: ulaz.igracId,
    vrsta: 'dostignuce_otkljucano',
    dostignuceId: ulaz.dostignuceId,
    novaRazina: ulaz.novaRazina,
    maksimalnaRazina: definicija.pragovi.length,
    izvor: ulaz.izvor,
    kontekst: ulaz.kontekst ?? null,
    stvorenoU: ulaz.zavrsenoU,
  }).onConflictDoNothing({
    target: [obavijestiIgraca.igracId, obavijestiIgraca.dostignuceId, obavijestiIgraca.novaRazina],
  }).returning({
    id: obavijestiIgraca.id,
    dostignuceId: obavijestiIgraca.dostignuceId,
    novaRazina: obavijestiIgraca.novaRazina,
    maksimalnaRazina: obavijestiIgraca.maksimalnaRazina,
    izvor: obavijestiIgraca.izvor,
  });
  if (!obavijest?.id || !obavijest.dostignuceId || obavijest.novaRazina == null || obavijest.maksimalnaRazina == null) return null;
  return {
    id: obavijest.id,
    dostignuceId: obavijest.dostignuceId,
    naziv: definicija.naziv,
    novaRazina: obavijest.novaRazina,
    maksimalnaRazina: obavijest.maksimalnaRazina,
    izvor: obavijest.izvor,
  };
}

async function uvecajBrojac(tx: MisijeTx, igracId: string, brojac: ServisniBrojac, zavrsenoU: Date): Promise<number> {
  const stupac = STUPCI_SERVISNIH_BROJACA[brojac];
  const [red] = await tx.insert(napredakDostignucaIgraca).values({ igracId, [brojac]: 1 }).onConflictDoUpdate({
    target: napredakDostignucaIgraca.igracId,
    set: { [brojac]: sql`${stupac} + 1`, azurirano: zavrsenoU },
  }).returning({ vrijednost: stupac });
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
  if (!definicija || !jeServisniBrojac(definicija.brojac)) {
    throw new Error(`Dostignuće ${parametri.dostignuceId} nije servisni brojač.`);
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
    novaDostignuca.push({
      id: parametri.dostignuceId,
      novaRazina,
      maksimalnaRazina: definicija.pragovi.length,
    });
    if (!parametri.preskociObavijest) {
      const obavijest = await upisiObavijestDostignuca(tx, {
        igracId: parametri.igracId,
        dostignuceId: parametri.dostignuceId,
        novaRazina,
        zavrsenoU: parametri.zavrsenoU,
        izvor: parametri.izvor,
        kontekst: parametri.kontekst,
      });
      if (obavijest) noveObavijesti.push(obavijest);
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
