import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { dohvatiDefinicijuDostignuca, type NovostiDostignuca, type ObavijestOtkljucanogDostignuca } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { obavijestiIgraca } from '../baza/shema.js';

type SocketZaNovosti = {
  emit(dogadaj: 'dostignuca:novosti', payload: NovostiDostignuca): void;
};

export interface VezeZaObavijestiDostignuca {
  dohvatiSocket(igracId: string): SocketZaNovosti | undefined;
}

let veze: VezeZaObavijestiDostignuca | null = null;

export function postaviVezeZaObavijestiDostignuca(aktivneVeze: VezeZaObavijestiDostignuca): void {
  veze = aktivneVeze;
}

function uObavijest(red: {
  id: string;
  dostignuceId: string | null;
  novaRazina: number | null;
  maksimalnaRazina: number | null;
  izvor: string | null;
}): ObavijestOtkljucanogDostignuca | null {
  if (!red.dostignuceId || red.novaRazina == null || red.maksimalnaRazina == null) return null;
  const definicija = dohvatiDefinicijuDostignuca(red.dostignuceId);
  return {
    id: red.id,
    dostignuceId: red.dostignuceId,
    naziv: definicija?.naziv ?? red.dostignuceId,
    novaRazina: red.novaRazina,
    maksimalnaRazina: red.maksimalnaRazina,
    izvor: red.izvor,
  };
}

export async function dohvatiNepotvrdeneObavijesti(igracId: string): Promise<ObavijestOtkljucanogDostignuca[]> {
  const redovi = await baza.select({
    id: obavijestiIgraca.id,
    dostignuceId: obavijestiIgraca.dostignuceId,
    novaRazina: obavijestiIgraca.novaRazina,
    maksimalnaRazina: obavijestiIgraca.maksimalnaRazina,
    izvor: obavijestiIgraca.izvor,
  }).from(obavijestiIgraca).where(and(
    eq(obavijestiIgraca.igracId, igracId),
    isNull(obavijestiIgraca.prikazanoU),
    eq(obavijestiIgraca.vrsta, 'dostignuce_otkljucano'),
  )).orderBy(asc(obavijestiIgraca.stvorenoU));
  return redovi.flatMap((red) => {
    const obavijest = uObavijest(red);
    return obavijest ? [obavijest] : [];
  });
}

export async function potvrdiObavijesti(igracId: string, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const potvrdene = await baza.update(obavijestiIgraca).set({ prikazanoU: new Date() }).where(and(
    eq(obavijestiIgraca.igracId, igracId),
    inArray(obavijestiIgraca.id, [...ids]),
    isNull(obavijestiIgraca.prikazanoU),
  )).returning({ id: obavijestiIgraca.id });
  return potvrdene.map((red) => red.id);
}

/** Šalje novosti nakon commita. Bez registriranih veza je tihi no-op. */
export function emitirajNovostiDostignuca(igracId: string, obavijesti: readonly ObavijestOtkljucanogDostignuca[]): void {
  if (obavijesti.length === 0) return;
  veze?.dohvatiSocket(igracId)?.emit('dostignuca:novosti', { obavijesti: [...obavijesti] });
}
