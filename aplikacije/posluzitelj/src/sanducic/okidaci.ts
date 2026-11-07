import {
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_EMAIL_POTVRDEN,
  TIP_SANDUCIC_FEEDBACK,
  TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
  TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA,
  TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA,
  TIP_SANDUCIC_PRVA_IGRA,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  azurirajPodatkePorukePoTipu,
  emitirajPromjenuSanducica,
  stvoriPoruku,
} from './servis.js';
import { pokusajOstvaritiPrvuIgru, type TxSanducic } from './prekretnice.js';

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
