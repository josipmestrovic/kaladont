/**
 * PR13 — četiri nova servisna dostignuća.
 * HINT: trening/privatno ne zovu ove funkcije (caller: !samoStatistika + javni kontekst).
 * HINT: ne miješati `stara_skola` s katalogom `ka_zna` (žrtva) ni pravilnikom tipa.
 */
import { and, asc, eq } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_IMAM_NASTAVAK,
  ID_DOSTIGNUCA_SALJI_DALJE,
  ID_DOSTIGNUCA_STARA_SKOLA,
  ID_DOSTIGNUCA_TRECA_SRECA,
  type ModPartije,
  type ObavijestOtkljucanogDostignuca,
  type PravilnikPartije,
} from 'zajednicko';
import { ucinakPosebneRijeci } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';
import {
  dodijeliDoprinos,
  upisiObavijestDostignuca,
  type IshodDodjele,
} from './dodjela.js';

function prazanIshod(): IshodDodjele {
  return { doprinosUmetnut: false, novaDostignuca: [], noveObavijesti: [] };
}

function spojiIshode(ishodi: IshodDodjele[]): IshodDodjele {
  return {
    doprinosUmetnut: ishodi.some((i) => i.doprinosUmetnut),
    novaDostignuca: ishodi.flatMap((i) => i.novaDostignuca),
    noveObavijesti: ishodi.flatMap((i) => i.noveObavijesti),
  };
}

/** Javna Troboj pobjeda — jedan doprinos po partiji. */
export function priznajTrecuSrecu(
  tx: MisijeTx,
  ulaz: { igracId: string; partijaId: string; mod: ModPartije; zavrsenoU: Date },
): Promise<IshodDodjele> {
  if (ulaz.mod !== 'tri_igraca') return Promise.resolve(prazanIshod());
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_TRECA_SRECA,
    dokaz: { vrsta: 'treca_sreca', partijaId: ulaz.partijaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'treca_sreca',
    kontekst: { partijaId: ulaz.partijaId, mod: ulaz.mod },
  });
}

/**
 * Imam nastavak — max 1 doprinos po igri čak i uz više uspješnih dokaza.
 * HINT: uspjesniDokazi dolazi iz in-memory statistike (isto što W22 misije).
 */
export function priznajImamNastavak(
  tx: MisijeTx,
  ulaz: { igracId: string; partijaId: string; uspjesniDokazi: number; zavrsenoU: Date },
): Promise<IshodDodjele> {
  if (ulaz.uspjesniDokazi < 1) return Promise.resolve(prazanIshod());
  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_IMAM_NASTAVAK,
    dokaz: { vrsta: 'imam_nastavak', partijaId: ulaz.partijaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'imam_nastavak',
    kontekst: { partijaId: ulaz.partijaId },
  });
}

/**
 * Šalji dalje — čita ucinak_posebne_rijeci, ne kaladontSljedeciUzTriPlus (max 1/igra).
 * HINT: više događaja po igri; jedna obavijest za najvišu novu razinu (ne zadnji red).
 * HINT: dokaz-kaladont ne ide ovim putem (obični Klasični efekt → vrsta_mete=sljedeci).
 */
export async function priznajSaljiDalje(
  tx: MisijeTx,
  ulaz: {
    igracId: string;
    partijaId: string;
    pravila: PravilnikPartije;
    zavrsenoU: Date;
  },
): Promise<IshodDodjele> {
  if (ulaz.pravila !== 'klasicni') return prazanIshod();

  const redovi = await tx
    .select({
      redniBroj: ucinakPosebneRijeci.redniBroj,
      brojAktivnihPrije: ucinakPosebneRijeci.brojAktivnihPrije,
    })
    .from(ucinakPosebneRijeci)
    .where(and(
      eq(ucinakPosebneRijeci.partijaId, ulaz.partijaId),
      eq(ucinakPosebneRijeci.uzrocnikId, ulaz.igracId),
      eq(ucinakPosebneRijeci.vrstaMete, 'sljedeci'),
      eq(ucinakPosebneRijeci.ucinak, 'eliminacija'),
    ))
    .orderBy(asc(ucinakPosebneRijeci.redniBroj));

  const kandidati = redovi.filter((r) => r.brojAktivnihPrije >= 3);
  if (kandidati.length === 0) return prazanIshod();

  // HINT Bugbot: razina često skoči na ranijem događaju (prag 1/3/10…), ne na zadnjem.
  // Stoga sve doprinose s preskociObavijest, pa obavijesti za sve nove razine u seriji.
  const ishodi: IshodDodjele[] = [];
  for (const red of kandidati) {
    ishodi.push(await dodijeliDoprinos(tx, {
      igracId: ulaz.igracId,
      dostignuceId: ID_DOSTIGNUCA_SALJI_DALJE,
      dokaz: { vrsta: 'salji_dalje', partijaId: ulaz.partijaId, redniBroj: red.redniBroj },
      zavrsenoU: ulaz.zavrsenoU,
      izvor: 'salji_dalje',
      kontekst: { partijaId: ulaz.partijaId, redniBroj: red.redniBroj },
      preskociObavijest: true,
    }));
  }

  const spojeno = spojiIshode(ishodi);
  if (spojeno.novaDostignuca.length === 0) return spojeno;

  const noveObavijesti: ObavijestOtkljucanogDostignuca[] = [];
  for (const nova of spojeno.novaDostignuca) {
    const obavijest = await upisiObavijestDostignuca(tx, {
      igracId: ulaz.igracId,
      dostignuceId: ID_DOSTIGNUCA_SALJI_DALJE,
      novaRazina: nova.novaRazina,
      zavrsenoU: ulaz.zavrsenoU,
      izvor: 'salji_dalje',
      kontekst: { partijaId: ulaz.partijaId, grupirano: true },
    });
    if (obavijest) noveObavijesti.push(obavijest);
  }
  return {
    doprinosUmetnut: spojeno.doprinosUmetnut,
    novaDostignuca: spojeno.novaDostignuca,
    noveObavijesti,
  };
}

/**
 * Stara škola — pobjeda + eliminacija autora „ka” u KA-ZNA.
 * HINT: u spojenom Dvoboju odlučuje odabranaPravila kartice; inače stvarni pravilnik stola.
 * HINT: 1 doprinos po pobjedničkoj igri.
 */
export async function priznajStaruSkolu(
  tx: MisijeTx,
  ulaz: {
    igracId: string;
    partijaId: string;
    pravila: PravilnikPartije;
    odabranaPravila: PravilnikPartije;
    spojeniDvoboj: boolean;
    zavrsenoU: Date;
  },
): Promise<IshodDodjele> {
  const pravilnikZaFilter = ulaz.spojeniDvoboj ? ulaz.odabranaPravila : ulaz.pravila;
  if (pravilnikZaFilter !== 'ka_zna') return prazanIshod();

  const [pogodak] = await tx
    .select({ redniBroj: ucinakPosebneRijeci.redniBroj })
    .from(ucinakPosebneRijeci)
    .where(and(
      eq(ucinakPosebneRijeci.partijaId, ulaz.partijaId),
      eq(ucinakPosebneRijeci.uzrocnikId, ulaz.igracId),
      eq(ucinakPosebneRijeci.vrstaMete, 'prethodni'),
      eq(ucinakPosebneRijeci.ucinak, 'eliminacija'),
    ))
    .limit(1);

  if (!pogodak) return prazanIshod();

  return dodijeliDoprinos(tx, {
    igracId: ulaz.igracId,
    dostignuceId: ID_DOSTIGNUCA_STARA_SKOLA,
    dokaz: { vrsta: 'stara_skola', partijaId: ulaz.partijaId },
    zavrsenoU: ulaz.zavrsenoU,
    izvor: 'stara_skola',
    kontekst: { partijaId: ulaz.partijaId },
  });
}
