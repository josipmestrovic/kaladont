/**
 * Trenutni Top 10 (D03). Nema backfilla: postojeći poredak se ne skenira pri uključivanju.
 * Nagrada nastaje tek uz sljedeću promjenu konkurencije. Pad s ljestvice ne briše dokaz.
 *
 * Red zaključavanja:
 * 1. Transakcija koja mijenja poredak (javni završetak ili soft-delete) prvo odradi svoje
 *    retke, pa neposredno prije čitanja uzme pg_advisory_xact_lock moda.
 *    Fiksni red modova: cetiri_igraca (1), zatim dva_igraca (2). Jedan završetak zaključava
 *    samo svoj mod; brisanje zaključava oba. U toj transakciji se ne diraju tuđa dostignuća.
 * 2. Top 10 se računa istim SQL-om kao javna ljestvica, u toj transakciji, za dnevno/tjedno/
 *    mjesečno i obje metrike. Umeće se samo prvi dokaz po igraču, modu i kalendarskom početku.
 *    Prolazni ulazak ostaje zapisan iako sljedeća promjena igrača više ne vidi u Top 10.
 * 3. Nakon commita obrada nagrada uzima pg_advisory_xact_lock po igraču (klasa 872005) i
 *    tek onda FOR UPDATE na njegovim dokazima. Ne uzima lock moda, pa Dvoboj i Četveroboj
 *    ne mogu deadlockati preko tuđih dostignuća. Par „Na dvije fronte” vidi se pod tim
 *    igračevim lockom: drugi proces čeka i ne može oba promašiti već commitani dokaz.
 */
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_DNEVNA_DESETKA,
  ID_DOSTIGNUCA_MJESECNA_ELITA,
  ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
  ID_DOSTIGNUCA_TJEDNA_ELITA,
  kalendarskeGranice,
  type MetrikaLjestvice,
  type ModPartije,
  type ObavijestOtkljucanogDostignuca,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dokaziTop10Ulazaka, igraci } from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';
import { izracunajPoredak, obuhvatiRazdoblja, type IzvrsiteljPoretka } from '../ljestvice/servis.js';
import type { MisijeTx } from '../misije/tipovi.js';
import { dodijeliDoprinos, upisiObavijestDostignuca } from './dodjela.js';

const KLASA_ZAKLJUCAVANJA_MODA = 872003;
const KLASA_ZAKLJUCAVANJA_IGRACA = 872005;
const REDOSLIJED_MODOVA = ['cetiri_igraca', 'dva_igraca'] as const;
const RAZDOBLJA_TOP10 = ['dnevno', 'tjedno', 'mjesecno'] as const;
const METRIKE_TOP10 = ['prosjek_bodova', 'niz_pobjeda'] as const satisfies readonly MetrikaLjestvice[];

const DOSTIGNUCE_PO_VRSTI = {
  dnevno: ID_DOSTIGNUCA_DNEVNA_DESETKA,
  tjedno: ID_DOSTIGNUCA_TJEDNA_ELITA,
  mjesecno: ID_DOSTIGNUCA_MJESECNA_ELITA,
} as const;

type VrstaTop10 = keyof typeof DOSTIGNUCE_PO_VRSTI;

export interface ParametriTop10Snimke {
  modovi: readonly ModPartije[];
  opazenoU: Date;
  izvor: 'partija' | 'brisanje';
  partijaId: string | null;
  /** Za testove izoliranog prozora. Inače LJESTVICE_POCETAK, isti rez kao javni prikaz. */
  pocetakPracenja?: Date;
}

function kodModa(mod: ModPartije): number {
  return mod === 'cetiri_igraca' ? 1 : 2;
}

function kljucIgraca(igracId: string): number {
  let hash = 0;
  for (let i = 0; i < igracId.length; i += 1) hash = Math.imul(hash, 31) + igracId.charCodeAt(i) | 0;
  return hash;
}

function jePrimatelj(igrac: { vrsta: string; upravljac: string; obrisanAt: Date | null } | undefined): boolean {
  if (!igrac || igrac.obrisanAt) return false;
  return igrac.upravljac === 'covjek' && (igrac.vrsta === 'registriran' || igrac.vrsta === 'admin');
}

async function zakljucajMod(tx: MisijeTx, mod: ModPartije): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${KLASA_ZAKLJUCAVANJA_MODA}, ${kodModa(mod)})`);
}

async function zakljucajIgraca(tx: MisijeTx, igracId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${KLASA_ZAKLJUCAVANJA_IGRACA}, ${kljucIgraca(igracId)})`);
}

/**
 * Pod lockom moda upisuje prve dokaze iz konzistentne snimke. Ne dodjeljuje zvjezdice.
 */
export async function zabiljeziTop10NakonPromjene(tx: MisijeTx, parametri: ParametriTop10Snimke): Promise<void> {
  const pocetak = parametri.pocetakPracenja ?? new Date(konfiguracija.LJESTVICE_POCETAK);
  const obuhvati = obuhvatiRazdoblja(parametri.opazenoU, pocetak);
  const izvrsitelj = tx as unknown as IzvrsiteljPoretka;

  for (const mod of REDOSLIJED_MODOVA) {
    if (!parametri.modovi.includes(mod)) continue;
    await zakljucajMod(tx, mod);

    for (const vrsta of RAZDOBLJA_TOP10) {
      const kalendar = kalendarskeGranice(vrsta, parametri.opazenoU);
      const obuhvat = obuhvati[vrsta];
      const najbolje = new Map<string, { mjesto: number; metrika: MetrikaLjestvice }>();

      for (const metrika of METRIKE_TOP10) {
        const poredak = await izracunajPoredak(mod, metrika, vrsta, obuhvat.od, obuhvat.doUpita, izvrsitelj);
        for (const stavka of poredak.rangirani) {
          if (stavka.mjesto === null || stavka.mjesto > 10) continue;
          const postojece = najbolje.get(stavka.igracId);
          if (!postojece || stavka.mjesto < postojece.mjesto) {
            najbolje.set(stavka.igracId, { mjesto: stavka.mjesto, metrika });
          }
        }
      }

      if (najbolje.size === 0) continue;
      const idovi = [...najbolje.keys()];
      const ljudi = await tx.select({
        id: igraci.id,
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
        obrisanAt: igraci.obrisanAt,
      }).from(igraci).where(inArray(igraci.id, idovi));
      const poIgracu = new Map(ljudi.map((igrac) => [igrac.id, igrac]));
      const vrijednosti = [];
      for (const [igracId, ulaz] of najbolje) {
        if (!jePrimatelj(poIgracu.get(igracId))) continue;
        vrijednosti.push({
          igracId,
          vrstaRazdoblja: vrsta,
          kalendarskiPocetak: kalendar.od,
          mod,
          metrika: ulaz.metrika,
          mjesto: ulaz.mjesto,
          opazenoU: parametri.opazenoU,
          izvor: parametri.izvor,
          izvorPartijaId: parametri.partijaId,
        });
      }
      if (vrijednosti.length === 0) continue;
      await tx.insert(dokaziTop10Ulazaka).values(vrijednosti).onConflictDoNothing({
        target: [
          dokaziTop10Ulazaka.igracId,
          dokaziTop10Ulazaka.vrstaRazdoblja,
          dokaziTop10Ulazaka.kalendarskiPocetak,
          dokaziTop10Ulazaka.mod,
        ],
      });
    }
  }
}

/** Igrač ima završenu javnu partiju u otvorenom mjesečnom prozoru (pokriva i dan i tjedan). */
export async function imaJavnuIgruUOtvorenomMjesecu(
  tx: MisijeTx,
  igracId: string,
  opazenoU: Date,
  pocetakPracenja = new Date(konfiguracija.LJESTVICE_POCETAK),
): Promise<boolean> {
  const mjesec = obuhvatiRazdoblja(opazenoU, pocetakPracenja).mjesecno;
  const redci = await tx.execute(sql`
    select 1 as postoji
    from sudionici_partije s
    join partije p on p.id = s.partija_id
    where s.igrac_id = ${igracId}
      and p.status = 'zavrsena'
      and p.kraj >= ${mjesec.od.toISOString()}::timestamptz
      and p.kraj < ${mjesec.doUpita.toISOString()}::timestamptz
      and not exists (
        select 1 from obracuni_partija o
        where o.partija_id = p.id and o.vrsta = 'privatna_gamifikacija'
      )
    limit 1
  `);
  return [...redci as Iterable<unknown>].length > 0;
}

async function obradiIgraca(
  igracId: string,
  partijaId: string | null,
): Promise<ObavijestOtkljucanogDostignuca[]> {
  return baza.transaction(async (tx) => {
    await zakljucajIgraca(tx, igracId);
    const uvjeti: SQL[] = [
      eq(dokaziTop10Ulazaka.igracId, igracId),
      isNull(dokaziTop10Ulazaka.obradjenoU),
    ];
    if (partijaId) uvjeti.push(eq(dokaziTop10Ulazaka.izvorPartijaId, partijaId));
    const dokazi = await tx.select().from(dokaziTop10Ulazaka).where(and(...uvjeti)).for('update');
    if (dokazi.length === 0) return [];

    const obavijesti: ObavijestOtkljucanogDostignuca[] = [];
    let najvisaParRazina: number | null = null;
    let opazenoPara: Date | null = null;

    for (const dokaz of dokazi) {
      const vrsta = dokaz.vrstaRazdoblja as VrstaTop10;
      const dostignuceId = DOSTIGNUCE_PO_VRSTI[vrsta];
      if (!dostignuceId) continue;
      const pojedinacno = await dodijeliDoprinos(tx, {
        igracId,
        dostignuceId,
        dokaz: { vrsta: 'top10_razdoblje', kalendarskiPocetak: dokaz.kalendarskiPocetak },
        zavrsenoU: dokaz.opazenoU,
        izvor: 'top10',
        kontekst: {
          vrstaRazdoblja: dokaz.vrstaRazdoblja,
          mod: dokaz.mod,
          metrika: dokaz.metrika,
          mjesto: dokaz.mjesto,
          partijaId: dokaz.izvorPartijaId,
        },
      });
      obavijesti.push(...pojedinacno.noveObavijesti);

      const drugiMod: ModPartije = dokaz.mod === 'cetiri_igraca' ? 'dva_igraca' : 'cetiri_igraca';
      const [drugi] = await tx.select({ igracId: dokaziTop10Ulazaka.igracId }).from(dokaziTop10Ulazaka).where(and(
        eq(dokaziTop10Ulazaka.igracId, igracId),
        eq(dokaziTop10Ulazaka.vrstaRazdoblja, dokaz.vrstaRazdoblja),
        eq(dokaziTop10Ulazaka.kalendarskiPocetak, dokaz.kalendarskiPocetak),
        eq(dokaziTop10Ulazaka.mod, drugiMod),
      )).limit(1);
      if (!drugi) continue;

      const par = await dodijeliDoprinos(tx, {
        igracId,
        dostignuceId: ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
        dokaz: {
          vrsta: 'na_dvije_fronte',
          vrstaRazdoblja: vrsta,
          kalendarskiPocetak: dokaz.kalendarskiPocetak,
        },
        zavrsenoU: dokaz.opazenoU,
        izvor: 'top10',
        kontekst: { vrstaRazdoblja: vrsta, kalendarskiPocetak: dokaz.kalendarskiPocetak.toISOString() },
        preskociObavijest: true,
      });
      for (const novo of par.novaDostignuca) {
        najvisaParRazina = najvisaParRazina === null ? novo.novaRazina : Math.max(najvisaParRazina, novo.novaRazina);
        opazenoPara = dokaz.opazenoU;
      }
    }

    if (najvisaParRazina !== null && opazenoPara) {
      const obavijest = await upisiObavijestDostignuca(tx, {
        igracId,
        dostignuceId: ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
        novaRazina: najvisaParRazina,
        zavrsenoU: opazenoPara,
        izvor: 'top10',
        kontekst: { grupirano: true },
      });
      if (obavijest) obavijesti.push(obavijest);
    }

    const sada = new Date();
    for (const dokaz of dokazi) {
      await tx.update(dokaziTop10Ulazaka).set({ obradjenoU: sada }).where(and(
        eq(dokaziTop10Ulazaka.igracId, dokaz.igracId),
        eq(dokaziTop10Ulazaka.vrstaRazdoblja, dokaz.vrstaRazdoblja),
        eq(dokaziTop10Ulazaka.kalendarskiPocetak, dokaz.kalendarskiPocetak),
        eq(dokaziTop10Ulazaka.mod, dokaz.mod),
        isNull(dokaziTop10Ulazaka.obradjenoU),
      ));
    }
    return obavijesti;
  });
}

async function igraciSNeobradenim(partijaId: string | null, limit: number): Promise<string[]> {
  const uvjeti: SQL[] = [isNull(dokaziTop10Ulazaka.obradjenoU)];
  if (partijaId) uvjeti.push(eq(dokaziTop10Ulazaka.izvorPartijaId, partijaId));
  const redovi = await baza.selectDistinct({ igracId: dokaziTop10Ulazaka.igracId }).from(dokaziTop10Ulazaka).where(and(...uvjeti)).orderBy(asc(dokaziTop10Ulazaka.igracId)).limit(limit);
  return redovi.map((red) => red.igracId);
}

/** Obrađuje već spremljene dokaze. Prazan partijaId uzima cijeli neobrađeni red, ograničeno. */
export async function obradiNeobradeneTop10Dokaze(
  opcije: { partijaId?: string | null; limit?: number } = {},
): Promise<Map<string, ObavijestOtkljucanogDostignuca[]>> {
  const partijaId = opcije.partijaId ?? null;
  const igraciNaRedu = await igraciSNeobradenim(partijaId, opcije.limit ?? 100);
  const poIgracu = new Map<string, ObavijestOtkljucanogDostignuca[]>();
  for (const igracId of igraciNaRedu) {
    try {
      const obavijesti = await obradiIgraca(igracId, partijaId);
      if (obavijesti.length > 0) poIgracu.set(igracId, obavijesti);
    } catch (greska) {
      console.error('Obrada Top 10 dokaza nije uspjela:', igracId, greska);
    }
  }
  return poIgracu;
}
