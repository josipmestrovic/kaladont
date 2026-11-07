import {
  dohvatiDefinicijuDostignuca,
  noviKolekcionarskiPragovi,
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_EMAIL_POTVRDEN,
  TIP_SANDUCIC_FEEDBACK,
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
