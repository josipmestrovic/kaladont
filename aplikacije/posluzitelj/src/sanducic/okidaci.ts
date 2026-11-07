import { eq, sql } from 'drizzle-orm';
import {
  dohvatiDefinicijuDostignuca,
  kljucPrekretniceDovrseneIgre,
  kljucPrekretniceForme10,
  kljucPrekretniceGostSazetak,
  noviKolekcionarskiPragovi,
  stanjeIskustva,
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_EMAIL_POTVRDEN,
  TIP_SANDUCIC_FEEDBACK,
  TIP_SANDUCIC_FORMA_10,
  TIP_SANDUCIC_GOST_SAZETAK_5,
  TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA,
  TIP_SANDUCIC_NOVA_XP_RAZINA,
  TIP_SANDUCIC_NOVA_ZVJEZDICA,
  TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
  TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA,
  TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA,
  TIP_SANDUCIC_PROMJENA_RANGA,
  TIP_SANDUCIC_PRVA_IGRA,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca } from '../baza/shema.js';
import {
  azurirajPodatkePorukePoTipu,
  emitirajPromjenuSanducica,
  stvoriPoruku,
} from './servis.js';
import { pokusajOstvaritiPrekretnicu, pokusajOstvaritiPrvuIgru, type TxSanducic } from './prekretnice.js';

export async function stvoriDobrodoslicu(igracId: string, email: string): Promise<void> {
  await stvoriPoruku({
    igracId,
    tip: TIP_SANDUCIC_DOBRODOSLICA,
    deduplikacijskiKljuc: 'dobrodoslica',
    podaci: { email, emailPotvrdjen: false },
    izvorTip: 'registracija',
    izvorId: igracId,
  });
  // Gost→reg: stara „prva igra” više ne smije voditi na /registracija.
  await azurirajPodatkePorukePoTipu(igracId, TIP_SANDUCIC_PRVA_IGRA, { gost: false });
  await azurirajPodatkePorukePoTipu(igracId, TIP_SANDUCIC_GOST_SAZETAK_5, { registriran: true });
}

export async function stvoriPorukuPotvrdeEmaila(igracId: string): Promise<void> {
  await baza.transaction(async (tx) => {
    await stvoriPoruku({
      igracId,
      tip: TIP_SANDUCIC_EMAIL_POTVRDEN,
      deduplikacijskiKljuc: 'email_potvrden',
      izvorTip: 'email_potvrda',
      izvorId: igracId,
    }, { tx, emitiraj: false });
    await azurirajPodatkePorukePoTipu(
      igracId,
      TIP_SANDUCIC_DOBRODOSLICA,
      { emailPotvrdjen: true },
      { tx, emitiraj: false },
    );
  });
  emitirajPromjenuSanducica(igracId, 'nova');
}

/** Prva dovršena igra (javna/privatna/trening) za ljudskog sudionika. */
export async function mozdaObavijestiPrvuIgru(ulaz: {
  igracId: string;
  jeGost: boolean;
  jeBot: boolean;
  izvorId: string;
  kontekst: 'javna' | 'privatna' | 'trening';
  mod?: string | null;
}): Promise<void> {
  if (ulaz.jeBot) return;
  let stvorena = false;
  await baza.transaction(async (tx) => {
    const nova = await pokusajOstvaritiPrvuIgru(ulaz.igracId, tx);
    if (!nova) return;
    const red = await stvoriPoruku({
      igracId: ulaz.igracId,
      tip: TIP_SANDUCIC_PRVA_IGRA,
      deduplikacijskiKljuc: 'prva_igra',
      podaci: { gost: ulaz.jeGost, kontekst: ulaz.kontekst },
      izvorTip: ulaz.kontekst === 'trening' ? 'trening' : 'partija',
      izvorId: ulaz.izvorId,
      mod: ulaz.mod ?? null,
    }, { tx, emitiraj: false });
    stvorena = red != null;
  });
  if (stvorena) emitirajPromjenuSanducica(ulaz.igracId, 'nova');
}

export async function stvoriZahvaluZaFeedback(
  igracId: string,
  povratnaId: number,
  tx: TxSanducic,
): Promise<boolean> {
  const red = await stvoriPoruku({
    igracId,
    tip: TIP_SANDUCIC_FEEDBACK,
    deduplikacijskiKljuc: `feedback:${povratnaId}`,
    izvorTip: 'feedback',
    izvorId: String(povratnaId),
  }, { tx, emitiraj: false });
  return red != null;
}

export async function stvoriPorukeUvazenePrijaveRijeci(ulaz: {
  prijavitelji: readonly { prijavaId: number; igracId: string }[];
  rijec: string;
  smjer: 'dodaj' | 'deaktiviraj';
  tx: TxSanducic;
}): Promise<string[]> {
  const tip = ulaz.smjer === 'dodaj'
    ? TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA
    : TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA;
  const obavijesteni: string[] = [];
  for (const prijavitelj of ulaz.prijavitelji) {
    const red = await stvoriPoruku({
      igracId: prijavitelj.igracId,
      tip,
      deduplikacijskiKljuc: `prijava:${prijavitelj.prijavaId}`,
      podaci: { rijec: ulaz.rijec },
      izvorTip: 'prijava_rijeci',
      izvorId: String(prijavitelj.prijavaId),
    }, { tx: ulaz.tx, emitiraj: false });
    if (red) obavijesteni.push(prijavitelj.igracId);
  }
  return obavijesteni;
}

export async function stvoriPorukeUvazenePrijaveIgraca(ulaz: {
  prijavitelji: readonly { prijavaId: number; igracId: string }[];
  razlog: string;
  tx: TxSanducic;
}): Promise<string[]> {
  const obavijesteni: string[] = [];
  for (const prijavitelj of ulaz.prijavitelji) {
    const red = await stvoriPoruku({
      igracId: prijavitelj.igracId,
      tip: TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
      deduplikacijskiKljuc: `prijava_igraca:${prijavitelj.prijavaId}`,
      podaci: { razlog: ulaz.razlog },
      izvorTip: 'prijava_igraca',
      izvorId: String(prijavitelj.prijavaId),
    }, { tx: ulaz.tx, emitiraj: false });
    if (red) obavijesteni.push(prijavitelj.igracId);
  }
  return obavijesteni;
}

export function emitirajPromjeneSanducica(igracIds: readonly string[]): void {
  for (const igracId of new Set(igracIds)) {
    emitirajPromjenuSanducica(igracId, 'nova');
  }
}

/** Lazy baseline: potroši postojeće razine bez pošte, pa pošalji samo nove. */
export async function stvoriPorukeXpRazina(ulaz: {
  igracId: string;
  razinaPrije: number;
  razinaPoslije: number;
  tx: TxSanducic;
  izvorTip?: string;
  izvorId?: string;
}): Promise<number> {
  if (ulaz.razinaPoslije <= ulaz.razinaPrije) return 0;
  for (let razina = 1; razina <= ulaz.razinaPrije; razina += 1) {
    await pokusajOstvaritiPrekretnicu(ulaz.igracId, `xp_razina:${razina}`, ulaz.tx);
  }
  let broj = 0;
  for (let razina = ulaz.razinaPrije + 1; razina <= ulaz.razinaPoslije; razina += 1) {
    if (razina < 2) continue;
    const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, `xp_razina:${razina}`, ulaz.tx);
    if (!nova) continue;
    const red = await stvoriPoruku({
      igracId: ulaz.igracId,
      tip: TIP_SANDUCIC_NOVA_XP_RAZINA,
      deduplikacijskiKljuc: `xp_razina:${razina}`,
      podaci: { razina },
      izvorTip: ulaz.izvorTip ?? 'xp',
      izvorId: ulaz.izvorId ?? null,
    }, { tx: ulaz.tx, emitiraj: false });
    if (red) broj += 1;
  }
  return broj;
}

export async function stvoriPorukeZvjezdica(ulaz: {
  igracId: string;
  dostignuceId: string;
  staraRazina: number;
  novaRazina: number;
  tx: TxSanducic;
  izvorTip?: string;
  izvorId?: string;
}): Promise<number> {
  if (ulaz.novaRazina <= ulaz.staraRazina) return 0;
  const definicija = dohvatiDefinicijuDostignuca(ulaz.dostignuceId);
  const naziv = definicija?.naziv ?? ulaz.dostignuceId;
  for (let razina = 1; razina <= ulaz.staraRazina; razina += 1) {
    await pokusajOstvaritiPrekretnicu(ulaz.igracId, `zvjezdica:${ulaz.dostignuceId}:${razina}`, ulaz.tx);
  }
  let broj = 0;
  for (let razina = ulaz.staraRazina + 1; razina <= ulaz.novaRazina; razina += 1) {
    const kljuc = `zvjezdica:${ulaz.dostignuceId}:${razina}`;
    const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
    if (!nova) continue;
    const red = await stvoriPoruku({
      igracId: ulaz.igracId,
      tip: TIP_SANDUCIC_NOVA_ZVJEZDICA,
      deduplikacijskiKljuc: kljuc,
      podaci: { naziv, zvjezdice: razina, dostignuceId: ulaz.dostignuceId },
      izvorTip: ulaz.izvorTip ?? 'dostignuce',
      izvorId: ulaz.izvorId ?? ulaz.dostignuceId,
    }, { tx: ulaz.tx, emitiraj: false });
    if (red) broj += 1;
  }
  return broj;
}

export async function stvoriPorukeKolekcije(ulaz: {
  igracId: string;
  brojPrije: number;
  brojPoslije: number;
  tx: TxSanducic;
  izvorTip?: string;
  izvorId?: string;
}): Promise<number> {
  const novi = noviKolekcionarskiPragovi(ulaz.brojPrije, ulaz.brojPoslije);
  if (novi.length === 0) return 0;
  // Lazy baseline: svi pragovi već dosegnuti prije ove igre
  for (const prag of noviKolekcionarskiPragovi(0, ulaz.brojPrije)) {
    await pokusajOstvaritiPrekretnicu(ulaz.igracId, `kolekcija:${prag.prag}`, ulaz.tx);
  }
  let broj = 0;
  for (const prag of novi) {
    const kljuc = `kolekcija:${prag.prag}`;
    const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
    if (!nova) continue;
    const red = await stvoriPoruku({
      igracId: ulaz.igracId,
      tip: TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA,
      deduplikacijskiKljuc: kljuc,
      podaci: { naziv: prag.naziv, prag: prag.prag },
      izvorTip: ulaz.izvorTip ?? 'kolekcija',
      izvorId: ulaz.izvorId ?? null,
    }, { tx: ulaz.tx, emitiraj: false });
    if (red) broj += 1;
  }
  return broj;
}

export async function stvoriPorukuPromjeneRanga(ulaz: {
  igracId: string;
  mod: 'dva_igraca' | 'cetiri_igraca';
  rangPrije: string;
  rangPoslije: string;
  napredak: boolean;
  tx: TxSanducic;
  izvorId: string;
}): Promise<boolean> {
  if (ulaz.rangPrije === ulaz.rangPoslije) return false;
  const nazivModa = ulaz.mod === 'dva_igraca' ? 'Dvoboj' : 'Četveroboj';
  const red = await stvoriPoruku({
    igracId: ulaz.igracId,
    tip: TIP_SANDUCIC_PROMJENA_RANGA,
    deduplikacijskiKljuc: `rang:${ulaz.mod}:${ulaz.izvorId}`,
    podaci: {
      mod: nazivModa,
      rang: ulaz.rangPoslije,
      rangPrije: ulaz.rangPrije,
      napredak: ulaz.napredak,
    },
    izvorTip: 'partija',
    izvorId: ulaz.izvorId,
    mod: ulaz.mod,
  }, { tx: ulaz.tx, emitiraj: false });
  return red != null;
}

/** Forma svakih 10 javnih igara po modu (O1). Lazy baseline nižih pragova. */
export async function stvoriPorukuForme10(ulaz: {
  igracId: string;
  mod: 'dva_igraca' | 'cetiri_igraca';
  odigraneNakon: number;
  nazivForme: string | null;
  pobjede: number;
  trenutniNiz: number;
  tx: TxSanducic;
  izvorId: string;
}): Promise<boolean> {
  const potrosenoDo = Math.floor(ulaz.odigraneNakon / 10) * 10;
  for (let prag = 10; prag <= potrosenoDo; prag += 10) {
    const kljuc = kljucPrekretniceForme10(ulaz.mod, prag);
    if (prag === ulaz.odigraneNakon) {
      const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
      if (!nova) return false;
      const nazivModa = ulaz.mod === 'dva_igraca' ? 'Dvoboj' : 'Četveroboj';
      const red = await stvoriPoruku({
        igracId: ulaz.igracId,
        tip: TIP_SANDUCIC_FORMA_10,
        deduplikacijskiKljuc: kljuc,
        podaci: {
          mod: nazivModa,
          nazivForme: ulaz.nazivForme,
          pobjede: ulaz.pobjede,
          trenutniNiz: ulaz.trenutniNiz,
          prag,
        },
        izvorTip: 'partija',
        izvorId: ulaz.izvorId,
        mod: ulaz.mod,
      }, { tx: ulaz.tx, emitiraj: false });
      return red != null;
    }
    await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
  }
  return false;
}

/** Gostujući sažetak svakih 5 dovršenih igara svih načina (O2). */
export async function stvoriPorukuGostSazetak(ulaz: {
  igracId: string;
  jeGost: boolean;
  dovrseneNakon: number;
  tx: TxSanducic;
  izvorTip: string;
  izvorId: string;
  mod?: string | null;
}): Promise<boolean> {
  if (!ulaz.jeGost || ulaz.dovrseneNakon <= 0) return false;
  const potrosenoDo = Math.floor(ulaz.dovrseneNakon / 5) * 5;
  for (let prag = 5; prag <= potrosenoDo; prag += 5) {
    const kljuc = kljucPrekretniceGostSazetak(prag);
    if (prag === ulaz.dovrseneNakon) {
      // Utrka registracija ↔ kraj igre: pri stvaranju ponovno provjeri vrstu.
      const [stanje] = await ulaz.tx
        .select({ vrsta: igraci.vrsta })
        .from(igraci)
        .where(eq(igraci.id, ulaz.igracId));
      if (stanje?.vrsta !== 'gost') {
        await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
        return false;
      }
      const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
      if (!nova) return false;
      const snapshot = await dohvatiSnapshotGostSazetka(ulaz.igracId, ulaz.dovrseneNakon, ulaz.tx);
      const red = await stvoriPoruku({
        igracId: ulaz.igracId,
        tip: TIP_SANDUCIC_GOST_SAZETAK_5,
        deduplikacijskiKljuc: kljuc,
        podaci: { ...snapshot, prag, registriran: false },
        izvorTip: ulaz.izvorTip,
        izvorId: ulaz.izvorId,
        mod: ulaz.mod ?? null,
      }, { tx: ulaz.tx, emitiraj: false });
      return red != null;
    }
    await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, ulaz.tx);
  }
  return false;
}

async function dohvatiSnapshotGostSazetka(
  igracId: string,
  odigrano: number,
  tx: TxSanducic,
): Promise<Record<string, unknown>> {
  const [igrac] = await tx
    .select({
      pobjede: igraci.pobjede,
      pobjede1v1: igraci.pobjede1v1,
      iskustvoUkupno: igraci.iskustvoUkupno,
    })
    .from(igraci)
    .where(eq(igraci.id, igracId));
  const [napredak] = await tx
    .select({ treningPobjede: napredakDostignucaIgraca.treningPobjede })
    .from(napredakDostignucaIgraca)
    .where(eq(napredakDostignucaIgraca.igracId, igracId));
  const dostignuca = await tx
    .select({
      dostignuceId: dostignucaIgraca.dostignuceId,
      razina: dostignucaIgraca.razina,
    })
    .from(dostignucaIgraca)
    .where(eq(dostignucaIgraca.igracId, igracId));
  const otkljucana = dostignuca.filter((d) => d.razina > 0);
  const brojZvjezdica = otkljucana.reduce((zbroj, d) => zbroj + d.razina, 0);
  const nazivi = otkljucana
    .slice(0, 2)
    .map((d) => dohvatiDefinicijuDostignuca(d.dostignuceId)?.naziv ?? d.dostignuceId);
  return {
    odigrano,
    pobjede: (igrac?.pobjede ?? 0) + (igrac?.pobjede1v1 ?? 0) + (napredak?.treningPobjede ?? 0),
    razina: stanjeIskustva(igrac?.iskustvoUkupno ?? 0).razina,
    brojDostignuca: otkljucana.length,
    brojZvjezdica,
    naziviDostignuca: nazivi,
  };
}

/**
 * Idempotentan upis dovršene igre (svi načini) + eventualni gost sažetak.
 * Claim prekretnicom sprječava dupli brojač kod retryja (npr. trening).
 */
export async function obradiDovrsenuIgruSanducic(ulaz: {
  igracId: string;
  jeBot: boolean;
  izvorTip: 'javna' | 'privatna' | 'trening';
  izvorId: string;
  mod?: string | null;
  /** Ako je brojač već povećan u istoj transakciji (javna partija). */
  dovrseneNakon?: number;
  jeGost?: boolean;
  tx?: TxSanducic;
  emitiraj?: boolean;
}): Promise<boolean> {
  if (ulaz.jeBot) return false;
  const db = ulaz.tx ?? baza;
  const kljuc = kljucPrekretniceDovrseneIgre(ulaz.izvorTip, ulaz.izvorId);
  let dovrseneNakon = ulaz.dovrseneNakon;
  let jeGost = ulaz.jeGost;

  if (dovrseneNakon == null) {
    const nova = await pokusajOstvaritiPrekretnicu(ulaz.igracId, kljuc, db);
    if (!nova) return false;
    const [azurirani] = await db
      .update(igraci)
      .set({ dovrseneIgre: sql`${igraci.dovrseneIgre} + 1` })
      .where(eq(igraci.id, ulaz.igracId))
      .returning({ dovrseneIgre: igraci.dovrseneIgre, vrsta: igraci.vrsta });
    if (!azurirani) return false;
    dovrseneNakon = azurirani.dovrseneIgre;
    jeGost = azurirani.vrsta === 'gost';
  } else if (jeGost == null) {
    const [red] = await db
      .select({ vrsta: igraci.vrsta })
      .from(igraci)
      .where(eq(igraci.id, ulaz.igracId));
    jeGost = red?.vrsta === 'gost';
  }

  const stvorena = await stvoriPorukuGostSazetak({
    igracId: ulaz.igracId,
    jeGost: jeGost === true,
    dovrseneNakon,
    tx: db,
    izvorTip: ulaz.izvorTip,
    izvorId: ulaz.izvorId,
    mod: ulaz.mod,
  });
  if (stvorena && ulaz.emitiraj !== false && !ulaz.tx) {
    emitirajPromjenuSanducica(ulaz.igracId, 'nova');
  }
  return stvorena;
}
