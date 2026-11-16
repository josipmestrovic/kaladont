/**
 * Zajednički sloj za grupne admin izmjene rječnika (#75 uklanjanje, #89 dodavanje).
 * Pregled je read-only; potvrda ponovno računa obuhvat u transakciji.
 */
import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
  grafemi,
  jeDopustenOblikRijeci,
  kljucGrupe,
  type ObavijestOtkljucanogDostignuca,
  type StupanjRijeci,
  type VrstaRijeci,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { igraci, izmjeneRjecnika, operacijeRjecnika, prijave, rijeci } from '../baza/shema.js';
import { dodijeliDoprinos } from '../dostignuca/dodjela.js';
import type { MisijeTx } from '../misije/tipovi.js';
import {
  emitirajPromjeneSanducica,
  stvoriPorukeUvazenePrijaveRijeci,
} from '../sanducic/okidaci.js';
import {
  DEFAULT_FREKVENCIJA_RUCNO,
  FREKVENCIJA_ZA_TIER_RIJETKOSTI,
  NevaljanaRijecError,
  normalizirajRijecRjecnika,
  type TierRijetkostiRucno,
} from './administracija.js';

/** Advisory lock klasa za izmjene rječnika (odvojeno od top10 / fond botova). */
export const KLASA_ZAKLJUCAVANJA_RJECNIKA = 872010;

export type SmjerGrupneIzmjene = 'ukloni' | 'dodaj';

export interface OblikPregleda {
  rijec: string;
  aktivna: boolean;
  frekvencija: number;
  grupe: string[];
  vrste: string[];
}

export interface PregledGrupnogUklanjanja {
  smjer: 'ukloni';
  izvornaRijec: string;
  izvorniKljucevi: string[];
  oblici: OblikPregleda[];
  brojAktivnih: number;
  samoOvajOblik: boolean;
  otisak: string;
  poruka?: string;
}

export type StanjeOblikaDodavanja = 'novi' | 'reaktivacija' | 'postojeci' | 'preklapanje';

export interface OblikPregledaDodavanja {
  rijec: string;
  stanje: StanjeOblikaDodavanja;
  aktivna: boolean;
  frekvencija: number;
  grupe: string[];
  zahtijevaPotvrduPreklapanja: boolean;
}

export interface PregledGrupnogDodavanja {
  smjer: 'dodaj';
  izvornaRijec: string;
  kljucGrupe: string;
  vrsta: VrstaRijeci;
  lema: string;
  stupanj?: StupanjRijeci;
  oblici: OblikPregledaDodavanja[];
  brojOblici: number;
  imaPreklapanja: boolean;
  otisak: string;
  poruka?: string;
}

export type PregledGrupneIzmjene = PregledGrupnogUklanjanja | PregledGrupnogDodavanja;

export interface OblikUlazaDodavanja {
  rijec: string;
  tier?: TierRijetkostiRucno;
}

export interface UlazPregledaGrupnogDodavanja {
  izvornaRijec: string;
  vrsta: VrstaRijeci;
  lema: string;
  stupanj?: StupanjRijeci;
  tierIzvora?: TierRijetkostiRucno;
  dodatniOblici?: OblikUlazaDodavanja[];
}

export interface UlazPotvrdeGrupnogDodavanja extends UlazPregledaGrupnogDodavanja {
  adminId: string;
  otisak: string;
  kljucOperacije: string;
  potvrdiPreklapanja: boolean;
  prijavaId?: number;
  napomena?: string;
  razlog?: string;
}

export interface IshodGrupnogUklanjanja {
  smjer: 'ukloni';
  izvornaRijec: string;
  operacijaId: string;
  deaktivirane: string[];
  brojPromjena: number;
  nemaPromjene: boolean;
  prijavaIds: number[];
}

export interface IshodGrupnogDodavanja {
  smjer: 'dodaj';
  izvornaRijec: string;
  operacijaId: string;
  dodane: string[];
  reaktivirane: string[];
  azurirane: string[];
  promijenjene: string[];
  brojPromjena: number;
  nemaPromjene: boolean;
  prijavaIds: number[];
}

export type RezultatPotvrdeDodavanja =
  | {
      ok: true;
      ishod: IshodGrupnogDodavanja;
      obavijesti: ObavijestiGrupnePotvrde[];
    }
  | {
      ok: false;
      status: 400 | 404 | 409;
      greska: string;
      kod?: 'zastarjeli_pregled' | 'sukob_kljuca' | 'preklapanje' | 'nije_implementirano';
      pregled?: PregledGrupnogDodavanja;
    };

export type RezultatPregleda =
  | { ok: true; pregled: PregledGrupneIzmjene }
  | { ok: false; status: 400 | 404; greska: string };

export type ObavijestiGrupnePotvrde = {
  igracId: string;
  obavijesti: ObavijestOtkljucanogDostignuca[];
};

export type RezultatPotvrdeUklanjanja =
  | {
      ok: true;
      ishod: IshodGrupnogUklanjanja;
      obavijesti: ObavijestiGrupnePotvrde[];
    }
  | {
      ok: false;
      status: 400 | 404 | 409;
      greska: string;
      kod?: 'zastarjeli_pregled' | 'sukob_kljuca' | 'nije_implementirano';
      pregled?: PregledGrupneIzmjene;
    };

type Izvrsitelj = MisijeTx | typeof baza;

function sortirajJedinstvene(vrijednosti: readonly string[]): string[] {
  return [...new Set(vrijednosti)].sort((a, b) => a.localeCompare(b, 'hr'));
}

export function izracunajOtisakPregleda(ulaz: {
  smjer: SmjerGrupneIzmjene;
  izvornaRijec: string;
  izvorniKljucevi: readonly string[];
  aktivniOblici: readonly string[];
}): string {
  const payload = JSON.stringify({
    smjer: ulaz.smjer,
    izvor: ulaz.izvornaRijec,
    kljucevi: sortirajJedinstvene(ulaz.izvorniKljucevi),
    oblici: sortirajJedinstvene(ulaz.aktivniOblici),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function izracunajOtisakZahtjeva(ulaz: {
  smjer: SmjerGrupneIzmjene;
  otisak: string;
  napomena?: string | null;
  razlog?: string | null;
}): string {
  const payload = JSON.stringify({
    smjer: ulaz.smjer,
    otisak: ulaz.otisak,
    napomena: ulaz.napomena?.trim() || null,
    razlog: ulaz.razlog?.trim() || null,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function zakljucajIzmjeneRjecnika(tx: MisijeTx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(${KLASA_ZAKLJUCAVANJA_RJECNIKA})`);
}

async function ucitajIzvor(
  db: Izvrsitelj,
  rijec: string,
): Promise<{ rijec: string; aktivna: boolean; grupe: string[]; frekvencija: number; vrste: string[] } | null> {
  const [red] = await db
    .select({
      rijec: rijeci.rijec,
      aktivna: rijeci.aktivna,
      grupe: rijeci.grupe,
      frekvencija: rijeci.frekvencija,
      vrste: rijeci.vrste,
    })
    .from(rijeci)
    .where(eq(rijeci.rijec, rijec))
    .limit(1);
  return red ?? null;
}

async function dohvatiClanoveZaKljuceve(
  db: Izvrsitelj,
  kljucevi: readonly string[],
): Promise<OblikPregleda[]> {
  if (kljucevi.length === 0) return [];
  const retci = await db
    .select({
      rijec: rijeci.rijec,
      aktivna: rijeci.aktivna,
      frekvencija: rijeci.frekvencija,
      grupe: rijeci.grupe,
      vrste: rijeci.vrste,
    })
    .from(rijeci)
    .where(and(
      eq(rijeci.aktivna, true),
      sql`${rijeci.grupe} && array[${sql.join(
        kljucevi.map((k) => sql`${k}`),
        sql`, `,
      )}]::text[]`,
    ))
    .orderBy(asc(rijeci.rijec));
  return retci.map((red) => ({
    rijec: red.rijec,
    aktivna: red.aktivna,
    frekvencija: red.frekvencija,
    grupe: red.grupe,
    vrste: red.vrste,
  }));
}

function grafemiRijeci(rijecUlaz: string): { rijec: string; prvaDva: string; zadnjaDva: string } {
  const rijec = normalizirajRijecRjecnika(rijecUlaz);
  if (rijec.length < 2 || !jeDopustenOblikRijeci(rijec)) {
    throw new NevaljanaRijecError(`Neispravan oblik riječi: "${rijecUlaz}"`);
  }
  const svi = grafemi(rijec);
  if (svi.length < 2) throw new NevaljanaRijecError(`Riječ mora imati barem 2 slova: "${rijecUlaz}"`);
  return { rijec, prvaDva: svi.slice(0, 2).join(''), zadnjaDva: svi.slice(-2).join('') };
}

function frekvencijaIzTiera(tier: TierRijetkostiRucno | undefined): number | undefined {
  if (!tier) return undefined;
  return FREKVENCIJA_ZA_TIER_RIJETKOSTI[tier];
}

function unijaGrupe(postojece: readonly string[], dodati: string): string[] {
  return sortirajJedinstvene([...postojece, dodati]);
}

function sviObliciDodavanja(ulaz: UlazPregledaGrupnogDodavanja): Array<{ rijec: string; tier?: TierRijetkostiRucno }> {
  const izvorna = normalizirajRijecRjecnika(ulaz.izvornaRijec);
  const dodatni = (ulaz.dodatniOblici ?? []).map((o) => ({
    rijec: normalizirajRijecRjecnika(o.rijec),
    tier: o.tier,
  }));
  const mapa = new Map<string, { rijec: string; tier?: TierRijetkostiRucno }>();
  mapa.set(izvorna, { rijec: izvorna, tier: ulaz.tierIzvora });
  for (const oblik of dodatni) {
    if (!mapa.has(oblik.rijec)) mapa.set(oblik.rijec, oblik);
  }
  return [...mapa.values()].sort((a, b) => a.rijec.localeCompare(b.rijec, 'hr'));
}

async function ucitajOblikZaDodavanje(
  db: Izvrsitelj,
  rijec: string,
): Promise<{
  rijec: string;
  aktivna: boolean;
  grupe: string[];
  rucnoDodaneGrupe: string[];
  frekvencija: number;
  rucnaFrekvencija: number | null;
  vrste: string[];
} | null> {
  const [red] = await db
    .select({
      rijec: rijeci.rijec,
      aktivna: rijeci.aktivna,
      grupe: rijeci.grupe,
      rucnoDodaneGrupe: rijeci.rucnoDodaneGrupe,
      frekvencija: rijeci.frekvencija,
      rucnaFrekvencija: rijeci.rucnaFrekvencija,
      vrste: rijeci.vrste,
    })
    .from(rijeci)
    .where(eq(rijeci.rijec, rijec))
    .limit(1);
  if (!red) return null;
  return {
    rijec: red.rijec,
    aktivna: red.aktivna,
    grupe: red.grupe,
    rucnoDodaneGrupe: red.rucnoDodaneGrupe,
    frekvencija: red.frekvencija,
    rucnaFrekvencija: red.rucnaFrekvencija,
    vrste: red.vrste,
  };
}

function klasificirajOblikDodavanja(
  red: Awaited<ReturnType<typeof ucitajOblikZaDodavanje>>,
  kljucGrupeCilj: string,
): { stanje: StanjeOblikaDodavanja; zahtijevaPotvrduPreklapanja: boolean } {
  if (!red) return { stanje: 'novi', zahtijevaPotvrduPreklapanja: false };
  if (!red.aktivna) return { stanje: 'reaktivacija', zahtijevaPotvrduPreklapanja: false };
  const imaCilj = red.grupe.includes(kljucGrupeCilj);
  const imaDruge = red.grupe.some((g) => g !== kljucGrupeCilj);
  if (imaCilj) return { stanje: 'postojeci', zahtijevaPotvrduPreklapanja: false };
  if (imaDruge) return { stanje: 'preklapanje', zahtijevaPotvrduPreklapanja: true };
  return { stanje: 'postojeci', zahtijevaPotvrduPreklapanja: false };
}

export function izracunajOtisakPregledaDodavanja(ulaz: {
  izvornaRijec: string;
  kljucGrupe: string;
  vrsta: VrstaRijeci;
  lema: string;
  stupanj?: StupanjRijeci;
  oblici: Array<{ rijec: string; stanje: StanjeOblikaDodavanja; tier?: TierRijetkostiRucno | null }>;
}): string {
  const payload = JSON.stringify({
    smjer: 'dodaj' as const,
    izvor: ulaz.izvornaRijec,
    kljuc: ulaz.kljucGrupe,
    vrsta: ulaz.vrsta,
    lema: ulaz.lema,
    stupanj: ulaz.stupanj ?? null,
    oblici: ulaz.oblici
      .map((o) => ({ rijec: o.rijec, stanje: o.stanje, tier: o.tier ?? null }))
      .sort((a, b) => a.rijec.localeCompare(b.rijec, 'hr')),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function izracunajPregledDodavanja(
  db: Izvrsitelj,
  ulaz: UlazPregledaGrupnogDodavanja,
): Promise<PregledGrupnogDodavanja> {
  const izvornaRijec = normalizirajRijecRjecnika(ulaz.izvornaRijec);
  const lema = normalizirajRijecRjecnika(ulaz.lema);
  const kljuc = kljucGrupe(ulaz.vrsta, lema, ulaz.stupanj);
  grafemiRijeci(izvornaRijec);
  const obliciUlaza = sviObliciDodavanja({ ...ulaz, izvornaRijec, lema });

  const oblici: OblikPregledaDodavanja[] = [];
  for (const { rijec, tier } of obliciUlaza) {
    grafemiRijeci(rijec);
    const red = await ucitajOblikZaDodavanje(db, rijec);
    const { stanje, zahtijevaPotvrduPreklapanja } = klasificirajOblikDodavanja(red, kljuc);
    oblici.push({
      rijec,
      stanje,
      aktivna: red?.aktivna ?? false,
      frekvencija: red?.frekvencija ?? (frekvencijaIzTiera(tier) ?? DEFAULT_FREKVENCIJA_RUCNO),
      grupe: red?.grupe ?? [],
      zahtijevaPotvrduPreklapanja,
    });
  }

  const imaPreklapanja = oblici.some((o) => o.zahtijevaPotvrduPreklapanja);
  const otisak = izracunajOtisakPregledaDodavanja({
    izvornaRijec,
    kljucGrupe: kljuc,
    vrsta: ulaz.vrsta,
    lema,
    stupanj: ulaz.stupanj,
    oblici: obliciUlaza.map((o) => {
      const p = oblici.find((x) => x.rijec === o.rijec)!;
      return { rijec: o.rijec, stanje: p.stanje, tier: o.tier ?? null };
    }),
  });

  return {
    smjer: 'dodaj',
    izvornaRijec,
    kljucGrupe: kljuc,
    vrsta: ulaz.vrsta,
    lema,
    stupanj: ulaz.stupanj,
    oblici,
    brojOblici: oblici.length,
    imaPreklapanja,
    otisak,
    poruka: imaPreklapanja
      ? 'Neki aktivni oblici pripadaju drugim grupama — potrebna potvrda preklapanja.'
      : undefined,
  };
}

export async function izracunajPregledUklanjanja(
  db: Izvrsitelj,
  izvornaRijecUlaz: string,
): Promise<PregledGrupnogUklanjanja> {
  const izvornaRijec = normalizirajRijecRjecnika(izvornaRijecUlaz);
  const izvor = await ucitajIzvor(db, izvornaRijec);
  const izvorniKljucevi = sortirajJedinstvene(izvor?.grupe ?? []);
  const samoOvajOblik = izvorniKljucevi.length === 0;

  let oblici: OblikPregleda[];
  if (samoOvajOblik) {
    if (izvor?.aktivna) {
      oblici = [{
        rijec: izvor.rijec,
        aktivna: true,
        frekvencija: izvor.frekvencija,
        grupe: izvor.grupe,
        vrste: izvor.vrste,
      }];
    } else {
      oblici = [];
    }
  } else {
    oblici = await dohvatiClanoveZaKljuceve(db, izvorniKljucevi);
  }

  const aktivni = oblici.filter((o) => o.aktivna);
  return {
    smjer: 'ukloni',
    izvornaRijec,
    izvorniKljucevi,
    oblici: aktivni,
    brojAktivnih: aktivni.length,
    samoOvajOblik,
    otisak: izracunajOtisakPregleda({
      smjer: 'ukloni',
      izvornaRijec,
      izvorniKljucevi,
      aktivniOblici: aktivni.map((o) => o.rijec),
    }),
    poruka: samoOvajOblik
      ? 'Samo ovaj oblik'
      : izvorniKljucevi.length > 1
        ? 'Višeznačni oblik: deaktivacija pogađa sva značenja.'
        : undefined,
  };
}

export async function pregledGrupneIzmjene(
  ulaz:
    | { smjer: 'ukloni'; rijec?: string; prijavaId?: number }
    | ({ smjer: 'dodaj' } & UlazPregledaGrupnogDodavanja & { prijavaId?: number }),
): Promise<RezultatPregleda> {
  if (ulaz.smjer === 'dodaj') {
    try {
      let izvornaRijec = normalizirajRijecRjecnika(ulaz.izvornaRijec);
      let vrsta = ulaz.vrsta;
      let lema = ulaz.lema;
      if (ulaz.prijavaId != null) {
        const [prijava] = await baza.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).limit(1);
        if (!prijava) return { ok: false, status: 404, greska: 'Prijava nije pronađena.' };
        if (prijava.tip !== 'za_dodavanje') {
          return { ok: false, status: 400, greska: 'Ova prijava nije za dodavanje riječi.' };
        }
        izvornaRijec = normalizirajRijecRjecnika(prijava.rijec);
        if (!lema || lema.length < 2) lema = izvornaRijec;
        if (!vrsta) vrsta = 'imenica';
      }
      const pregled = await izracunajPregledDodavanja(baza, {
        ...ulaz,
        izvornaRijec,
        lema: normalizirajRijecRjecnika(lema),
        vrsta: vrsta ?? 'imenica',
      });
      return { ok: true, pregled };
    } catch (greska) {
      if (greska instanceof NevaljanaRijecError) {
        return { ok: false, status: 400, greska: greska.message };
      }
      throw greska;
    }
  }

  let izvornaRijec = ulaz.rijec ? normalizirajRijecRjecnika(ulaz.rijec) : '';
  if (ulaz.prijavaId != null) {
    const [prijava] = await baza.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).limit(1);
    if (!prijava) return { ok: false, status: 404, greska: 'Prijava nije pronađena.' };
    if (prijava.tip !== 'za_brisanje') {
      return { ok: false, status: 400, greska: 'Ova prijava nije za brisanje riječi.' };
    }
    izvornaRijec = normalizirajRijecRjecnika(prijava.rijec);
  }
  if (!izvornaRijec || izvornaRijec.length < 2) {
    return { ok: false, status: 400, greska: 'Nedostaje izvorna riječ.' };
  }

  const pregled = await izracunajPregledUklanjanja(baza, izvornaRijec);
  return { ok: true, pregled };
}

async function deaktivirajPopis(
  tx: MisijeTx,
  oblici: readonly string[],
  razlog: string,
  adminId: string | null,
  prijavaId: number | null,
  operacijaId: string,
): Promise<{ deaktivirane: string[]; prvaIzmjenaId: number | null }> {
  if (oblici.length === 0) return { deaktivirane: [], prvaIzmjenaId: null };

  const sortirani = sortirajJedinstvene(oblici);
  const deaktivirane = await tx
    .update(rijeci)
    .set({ aktivna: false })
    .where(and(eq(rijeci.aktivna, true), inArray(rijeci.rijec, sortirani)))
    .returning({ rijec: rijeci.rijec });

  if (deaktivirane.length === 0) return { deaktivirane: [], prvaIzmjenaId: null };

  const sortirane = deaktivirane.map((r) => r.rijec).sort((a, b) => a.localeCompare(b, 'hr'));
  const uneseni = await tx.insert(izmjeneRjecnika).values(
    sortirane.map((rijec) => ({
      rijec,
      akcija: 'uklonjena' as const,
      razlog,
      adminId,
      prijavaId,
      operacijaId,
    })),
  ).returning({ id: izmjeneRjecnika.id, rijec: izmjeneRjecnika.rijec });

  const prva = uneseni.find((u) => u.rijec === sortirane[0]) ?? uneseni[0];
  return { deaktivirane: sortirane, prvaIzmjenaId: prva?.id ?? null };
}

async function kvalificiraniPrijavitelji(tx: MisijeTx, ids: readonly string[]): Promise<string[]> {
  const jedinstveni = [...new Set(ids)];
  if (jedinstveni.length === 0) return [];
  const redovi = await tx.select({
    id: igraci.id,
    vrsta: igraci.vrsta,
    upravljac: igraci.upravljac,
    obrisanAt: igraci.obrisanAt,
  }).from(igraci).where(inArray(igraci.id, jedinstveni));
  return redovi
    .filter((red) => red.obrisanAt == null && red.upravljac === 'covjek' && (red.vrsta === 'registriran' || red.vrsta === 'admin'))
    .map((red) => red.id);
}

export async function potvrdiGrupnoUklanjanje(ulaz: {
  adminId: string;
  otisak: string;
  kljucOperacije: string;
  rijec?: string;
  prijavaId?: number;
  razlog?: string;
  napomena?: string;
}): Promise<RezultatPotvrdeUklanjanja> {
  const kljuc = ulaz.kljucOperacije.trim();
  if (!kljuc || kljuc.length > 128) {
    return { ok: false, status: 400, greska: 'Ključ operacije je obavezan (do 128 znakova).' };
  }
  if (!ulaz.otisak || !/^[a-f0-9]{64}$/i.test(ulaz.otisak)) {
    return { ok: false, status: 400, greska: 'Otisak pregleda nije ispravan.' };
  }

  let sanducicIgraci: string[] = [];

  const rezultat = await baza.transaction(async (tx) => {
    await zakljucajIzmjeneRjecnika(tx);

    const [postojeca] = await tx
      .select()
      .from(operacijeRjecnika)
      .where(eq(operacijeRjecnika.kljuc, kljuc))
      .for('update')
      .limit(1);

    const otisakZahtjeva = izracunajOtisakZahtjeva({
      smjer: 'ukloni',
      otisak: ulaz.otisak,
      napomena: ulaz.napomena,
      razlog: ulaz.razlog,
    });

    if (postojeca) {
      if (postojeca.otisakZahtjeva !== otisakZahtjeva) {
        return {
          ok: false as const,
          status: 409 as const,
          greska: 'Isti ključ operacije već postoji s drugim sadržajem.',
          kod: 'sukob_kljuca' as const,
        };
      }
      return {
        ok: true as const,
        ishod: postojeca.ishod as IshodGrupnogUklanjanja,
        obavijesti: [] as ObavijestiGrupnePotvrde[],
        izCachea: true as const,
      };
    }

    let izvornaRijec = ulaz.rijec ? normalizirajRijecRjecnika(ulaz.rijec) : '';
    let izvornaPrijava: typeof prijave.$inferSelect | null = null;
    if (ulaz.prijavaId != null) {
      const [prijava] = await tx.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).for('update').limit(1);
      if (!prijava) return { ok: false as const, status: 404 as const, greska: 'Prijava nije pronađena.' };
      if (prijava.tip !== 'za_brisanje') {
        return { ok: false as const, status: 400 as const, greska: 'Ova prijava nije za brisanje riječi.' };
      }
      if (prijava.potvrdenaAkcija || prijava.status === 'rijesena') {
        const operacijaId = randomUUID();
        const noOp: IshodGrupnogUklanjanja = {
          smjer: 'ukloni',
          izvornaRijec: normalizirajRijecRjecnika(prijava.rijec),
          operacijaId,
          deaktivirane: [],
          brojPromjena: 0,
          nemaPromjene: true,
          prijavaIds: [prijava.id],
        };
        await tx.insert(operacijeRjecnika).values({
          id: operacijaId,
          kljuc,
          smjer: 'ukloni',
          otisak: ulaz.otisak,
          otisakZahtjeva,
          adminId: ulaz.adminId,
          izvornaRijec: noOp.izvornaRijec,
          prijavaId: prijava.id,
          ishod: noOp,
        });
        return { ok: true as const, ishod: noOp, obavijesti: [] as ObavijestiGrupnePotvrde[], izCachea: false as const };
      }
      izvornaPrijava = prijava;
      izvornaRijec = normalizirajRijecRjecnika(prijava.rijec);
    }

    if (!izvornaRijec) {
      return { ok: false as const, status: 400 as const, greska: 'Nedostaje izvorna riječ.' };
    }

    const pregled = await izracunajPregledUklanjanja(tx, izvornaRijec);
    if (pregled.otisak !== ulaz.otisak) {
      return {
        ok: false as const,
        status: 409 as const,
        greska: 'Pregled je zastario. Potvrdi novi popis.',
        kod: 'zastarjeli_pregled' as const,
        pregled,
      };
    }

    const operacijaId = randomUUID();
    const razlog =
      ulaz.razlog?.trim() ||
      (izvornaPrijava ? 'Prijava igrača — grupno uklanjanje' : 'Ručna grupna deaktivacija');

    const { deaktivirane, prvaIzmjenaId } = await deaktivirajPopis(
      tx,
      pregled.oblici.map((o) => o.rijec),
      razlog,
      ulaz.adminId,
      izvornaPrijava?.id ?? null,
      operacijaId,
    );

    const pogođene = sortirajJedinstvene(deaktivirane.length > 0 ? deaktivirane : [izvornaRijec]);
    let prijavaIds: number[] = [];
    let mailboxPrijavitelji: Array<{ prijavaId: number; igracId: string; rijec: string }> = [];
    let prijaviteljiZaNagradu: Array<{ igracId: string; rijec: string }> = [];
    const obavijesti: ObavijestiGrupnePotvrde[] = [];

    if (izvornaPrijava || deaktivirane.length > 0) {
      const uvjetRijeci = pogođene.length === 1
        ? sql`normalize(lower(btrim(${prijave.rijec})), NFC) = ${pogođene[0]}`
        : sql`normalize(lower(btrim(${prijave.rijec})), NFC) = any(array[${sql.join(
          pogođene.map((r) => sql`${r}`),
          sql`, `,
        )}]::text[])`;
      const otvorene = await tx
        .select({
          id: prijave.id,
          igracId: prijave.igracId,
          rijec: prijave.rijec,
        })
        .from(prijave)
        .where(and(
          eq(prijave.tip, 'za_brisanje'),
          isNull(prijave.potvrdenaAkcija),
          or(inArray(prijave.status, ['nova', 'pregledana']), izvornaPrijava ? eq(prijave.id, izvornaPrijava.id) : sql`false`),
          uvjetRijeci,
        ))
        .for('update');

      const zaRijesiti = otvorene.length > 0
        ? otvorene
        : izvornaPrijava
          ? [{ id: izvornaPrijava.id, igracId: izvornaPrijava.igracId, rijec: izvornaPrijava.rijec }]
          : [];

      if (zaRijesiti.length > 0) {
        prijavaIds = zaRijesiti.map((p) => p.id).sort((a, b) => a - b);
        const ids = zaRijesiti.map((p) => p.id);
        const imaPromjene = deaktivirane.length > 0;
        await tx.update(prijave).set({
          status: 'rijesena',
          napomenaAdmina: imaPromjene ? 'obrisana' : 'nema_promjene',
          rijesioId: ulaz.adminId,
          potvrdenaAkcija: imaPromjene ? 'deaktivirana' : null,
          izmjenaRjecnikaId: imaPromjene ? prvaIzmjenaId : null,
        }).where(inArray(prijave.id, ids));

        if (imaPromjene) {
          mailboxPrijavitelji = zaRijesiti.map((p) => ({
            prijavaId: p.id,
            igracId: p.igracId,
            rijec: normalizirajRijecRjecnika(p.rijec),
          }));
          const poIgracu = new Map<string, string>();
          for (const p of [...zaRijesiti].sort((a, b) => a.id - b.id)) {
            if (!poIgracu.has(p.igracId)) {
              poIgracu.set(p.igracId, normalizirajRijecRjecnika(p.rijec));
            }
          }
          prijaviteljiZaNagradu = [...poIgracu.entries()].map(([igracId, rijec]) => ({ igracId, rijec }));
        }
      }
    }

    if (mailboxPrijavitelji.length > 0) {
      const poRijeci = new Map<string, Array<{ prijavaId: number; igracId: string }>>();
      for (const p of mailboxPrijavitelji) {
        const lista = poRijeci.get(p.rijec) ?? [];
        lista.push({ prijavaId: p.prijavaId, igracId: p.igracId });
        poRijeci.set(p.rijec, lista);
      }
      for (const [rijec, prijavitelji] of poRijeci) {
        const obavijesteni = await stvoriPorukeUvazenePrijaveRijeci({
          prijavitelji,
          rijec,
          smjer: 'deaktiviraj',
          napomena: ulaz.napomena,
          tx,
        });
        sanducicIgraci.push(...obavijesteni);
      }
    }

    if (prijaviteljiZaNagradu.length > 0) {
      const kvalificirani = new Set(await kvalificiraniPrijavitelji(
        tx,
        prijaviteljiZaNagradu.map((p) => p.igracId),
      ));
      const sada = new Date();
      for (const p of prijaviteljiZaNagradu) {
        if (!kvalificirani.has(p.igracId)) continue;
        const ishodNagrade = await dodijeliDoprinos(tx, {
          igracId: p.igracId,
          dostignuceId: ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
          dokaz: { vrsta: 'jezicni_detektiv', normaliziranaRijec: p.rijec },
          zavrsenoU: sada,
          izvor: 'potvrda_prijave_rijeci',
          kontekst: { rijec: p.rijec },
        });
        if (ishodNagrade.noveObavijesti.length > 0) {
          obavijesti.push({ igracId: p.igracId, obavijesti: ishodNagrade.noveObavijesti });
        }
      }
    }

    const ishod: IshodGrupnogUklanjanja = {
      smjer: 'ukloni',
      izvornaRijec,
      operacijaId,
      deaktivirane,
      brojPromjena: deaktivirane.length,
      nemaPromjene: deaktivirane.length === 0,
      prijavaIds,
    };

    await tx.insert(operacijeRjecnika).values({
      id: operacijaId,
      kljuc,
      smjer: 'ukloni',
      otisak: ulaz.otisak,
      otisakZahtjeva,
      adminId: ulaz.adminId,
      izvornaRijec,
      prijavaId: izvornaPrijava?.id ?? null,
      ishod,
    });

    return {
      ok: true as const,
      ishod,
      obavijesti,
      izCachea: false as const,
    };
  });

  if (!rezultat.ok) return rezultat;
  if (sanducicIgraci.length > 0) emitirajPromjeneSanducica(sanducicIgraci);
  return { ok: true, ishod: rezultat.ishod, obavijesti: rezultat.obavijesti };
}

type PrimjenaOblikaDodavanja = {
  promjena: 'nema' | 'dodana' | 'reaktivirana' | 'azurirana';
  rijec: string;
  izmjenaId: number | null;
};

async function primijeniDodavanjeOblika(
  tx: MisijeTx,
  ulaz: {
    rijec: string;
    tier?: TierRijetkostiRucno;
    vrsta: VrstaRijeci;
    kljucGrupe: string;
    stanje: StanjeOblikaDodavanja;
    potvrdiPreklapanja: boolean;
    razlog: string;
    adminId: string;
    prijavaId: number | null;
    operacijaId: string;
  },
): Promise<PrimjenaOblikaDodavanja> {
  const { rijec, prvaDva, zadnjaDva } = grafemiRijeci(ulaz.rijec);
  const eksplicitna = frekvencijaIzTiera(ulaz.tier);
  const [postojeca] = await tx
    .select({
      aktivna: rijeci.aktivna,
      grupe: rijeci.grupe,
      rucnoDodaneGrupe: rijeci.rucnoDodaneGrupe,
      frekvencija: rijeci.frekvencija,
      rucnaFrekvencija: rijeci.rucnaFrekvencija,
      vrste: rijeci.vrste,
    })
    .from(rijeci)
    .where(eq(rijeci.rijec, rijec))
    .for('update')
    .limit(1);

  if (ulaz.stanje === 'preklapanje' && !ulaz.potvrdiPreklapanja) {
    throw new Error('preklapanje_bez_potvrde');
  }

  const dodajRucnu = (liste: string[]) => unijaGrupe(liste, ulaz.kljucGrupe);

  if (!postojeca) {
    const frekvencija = eksplicitna ?? DEFAULT_FREKVENCIJA_RUCNO;
    const rucnaFrekvencija = eksplicitna ?? null;
    await tx.insert(rijeci).values({
      rijec,
      prvaDva,
      zadnjaDva,
      vrste: [ulaz.vrsta],
      grupe: [ulaz.kljucGrupe],
      rucnoDodaneGrupe: [ulaz.kljucGrupe],
      frekvencija,
      rucnaFrekvencija,
      aktivna: true,
      napomena: 'ručno dodano',
    });
    const [red] = await tx.insert(izmjeneRjecnika).values({
      rijec,
      akcija: 'dodana',
      razlog: ulaz.razlog,
      adminId: ulaz.adminId,
      prijavaId: ulaz.prijavaId,
      operacijaId: ulaz.operacijaId,
    }).returning({ id: izmjeneRjecnika.id });
    return { promjena: 'dodana', rijec, izmjenaId: red?.id ?? null };
  }

  if (!postojeca.aktivna) {
    const noveGrupe = unijaGrupe(postojeca.grupe, ulaz.kljucGrupe);
    const rucno = dodajRucnu(postojeca.rucnoDodaneGrupe);
    const set: {
      aktivna: boolean;
      grupe: string[];
      rucnoDodaneGrupe: string[];
      vrste: string[];
      frekvencija?: number;
      rucnaFrekvencija?: number | null;
    } = {
      aktivna: true,
      grupe: noveGrupe,
      rucnoDodaneGrupe: rucno,
      vrste: sortirajJedinstvene([...postojeca.vrste, ulaz.vrsta]),
    };
    if (eksplicitna !== undefined) {
      set.frekvencija = eksplicitna;
      set.rucnaFrekvencija = eksplicitna;
    }
    await tx.update(rijeci).set(set).where(eq(rijeci.rijec, rijec));
    const [red] = await tx.insert(izmjeneRjecnika).values({
      rijec,
      akcija: 'vracena',
      razlog: ulaz.razlog,
      adminId: ulaz.adminId,
      prijavaId: ulaz.prijavaId,
      operacijaId: ulaz.operacijaId,
    }).returning({ id: izmjeneRjecnika.id });
    return { promjena: 'reaktivirana', rijec, izmjenaId: red?.id ?? null };
  }

  const imaCilj = postojeca.grupe.includes(ulaz.kljucGrupe);
  const imaDruge = postojeca.grupe.some((g) => g !== ulaz.kljucGrupe);
  let grupe = postojeca.grupe;
  let rucno = postojeca.rucnoDodaneGrupe;
  let trebaZapis = false;

  if (!imaCilj && imaDruge) {
    grupe = unijaGrupe(grupe, ulaz.kljucGrupe);
    rucno = dodajRucnu(rucno);
    trebaZapis = true;
  } else if (!imaCilj) {
    grupe = unijaGrupe(grupe, ulaz.kljucGrupe);
    rucno = dodajRucnu(rucno);
    trebaZapis = true;
  } else {
    const novaRucna = dodajRucnu(rucno);
    if (novaRucna.length !== rucno.length) {
      rucno = novaRucna;
      trebaZapis = true;
    }
  }

  const set: {
    grupe?: string[];
    rucnoDodaneGrupe?: string[];
    vrste?: string[];
    frekvencija?: number;
    rucnaFrekvencija?: number | null;
  } = {};
  if (trebaZapis) {
    set.grupe = grupe;
    set.rucnoDodaneGrupe = rucno;
    set.vrste = sortirajJedinstvene([...postojeca.vrste, ulaz.vrsta]);
  }
  if (eksplicitna !== undefined) {
    set.frekvencija = eksplicitna;
    set.rucnaFrekvencija = eksplicitna;
    trebaZapis = true;
  }

  if (!trebaZapis) return { promjena: 'nema', rijec, izmjenaId: null };

  await tx.update(rijeci).set(set).where(eq(rijeci.rijec, rijec));
  const [red] = await tx.insert(izmjeneRjecnika).values({
    rijec,
    akcija: 'dodana',
    razlog: ulaz.razlog,
    adminId: ulaz.adminId,
    prijavaId: ulaz.prijavaId,
    operacijaId: ulaz.operacijaId,
  }).returning({ id: izmjeneRjecnika.id });
  return { promjena: ulaz.stanje === 'postojeci' && eksplicitna === undefined ? 'azurirana' : 'dodana', rijec, izmjenaId: red?.id ?? null };
}

export async function potvrdiGrupnoDodavanje(
  ulaz: UlazPotvrdeGrupnogDodavanja,
): Promise<RezultatPotvrdeDodavanja> {
  const kljuc = ulaz.kljucOperacije.trim();
  if (!kljuc || kljuc.length > 128) {
    return { ok: false, status: 400, greska: 'Ključ operacije je obavezan (do 128 znakova).' };
  }
  if (!ulaz.otisak || !/^[a-f0-9]{64}$/i.test(ulaz.otisak)) {
    return { ok: false, status: 400, greska: 'Otisak pregleda nije ispravan.' };
  }

  let sanducicIgraci: string[] = [];

  const rezultat = await baza.transaction(async (tx) => {
    await zakljucajIzmjeneRjecnika(tx);

    const [postojeca] = await tx
      .select()
      .from(operacijeRjecnika)
      .where(eq(operacijeRjecnika.kljuc, kljuc))
      .for('update')
      .limit(1);

    const otisakZahtjeva = izracunajOtisakZahtjeva({
      smjer: 'dodaj',
      otisak: ulaz.otisak,
      napomena: ulaz.napomena,
      razlog: ulaz.razlog,
    });

    if (postojeca) {
      if (postojeca.otisakZahtjeva !== otisakZahtjeva) {
        return {
          ok: false as const,
          status: 409 as const,
          greska: 'Isti ključ operacije već postoji s drugim sadržajem.',
          kod: 'sukob_kljuca' as const,
        };
      }
      return {
        ok: true as const,
        ishod: postojeca.ishod as IshodGrupnogDodavanja,
        obavijesti: [] as ObavijestiGrupnePotvrde[],
        izCachea: true as const,
      };
    }

    let izvornaRijec = normalizirajRijecRjecnika(ulaz.izvornaRijec);
    let izvornaPrijava: typeof prijave.$inferSelect | null = null;
    if (ulaz.prijavaId != null) {
      const [prijava] = await tx.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).for('update').limit(1);
      if (!prijava) return { ok: false as const, status: 404 as const, greska: 'Prijava nije pronađena.' };
      if (prijava.tip !== 'za_dodavanje') {
        return { ok: false as const, status: 400 as const, greska: 'Ova prijava nije za dodavanje riječi.' };
      }
      if (prijava.potvrdenaAkcija || prijava.status === 'rijesena') {
        const operacijaId = randomUUID();
        const noOp: IshodGrupnogDodavanja = {
          smjer: 'dodaj',
          izvornaRijec: normalizirajRijecRjecnika(prijava.rijec),
          operacijaId,
          dodane: [],
          reaktivirane: [],
          azurirane: [],
          promijenjene: [],
          brojPromjena: 0,
          nemaPromjene: true,
          prijavaIds: [prijava.id],
        };
        await tx.insert(operacijeRjecnika).values({
          id: operacijaId,
          kljuc,
          smjer: 'dodaj',
          otisak: ulaz.otisak,
          otisakZahtjeva,
          adminId: ulaz.adminId,
          izvornaRijec: noOp.izvornaRijec,
          prijavaId: prijava.id,
          ishod: noOp,
        });
        return { ok: true as const, ishod: noOp, obavijesti: [] as ObavijestiGrupnePotvrde[], izCachea: false as const };
      }
      izvornaPrijava = prijava;
      izvornaRijec = normalizirajRijecRjecnika(prijava.rijec);
    }

    const pregled = await izracunajPregledDodavanja(tx, {
      ...ulaz,
      izvornaRijec,
      lema: normalizirajRijecRjecnika(ulaz.lema),
    });
    if (pregled.otisak !== ulaz.otisak) {
      return {
        ok: false as const,
        status: 409 as const,
        greska: 'Pregled je zastario. Potvrdi novi popis.',
        kod: 'zastarjeli_pregled' as const,
        pregled,
      };
    }
    if (pregled.imaPreklapanja && !ulaz.potvrdiPreklapanja) {
      return {
        ok: false as const,
        status: 400 as const,
        greska: 'Potrebna je potvrda preklapanja grupa.',
        kod: 'preklapanje' as const,
        pregled,
      };
    }

    const operacijaId = randomUUID();
    const razlog =
      ulaz.razlog?.trim() ||
      (izvornaPrijava ? 'Prijava igrača — grupno dodavanje' : 'Ručno grupno dodavanje');

    const obliciUlaza = sviObliciDodavanja({ ...ulaz, izvornaRijec });
    const mapaPregleda = new Map(pregled.oblici.map((o) => [o.rijec, o]));

    const dodane: string[] = [];
    const reaktivirane: string[] = [];
    const azurirane: string[] = [];
    let prvaIzmjenaId: number | null = null;

    for (const { rijec, tier } of obliciUlaza) {
      const stavka = mapaPregleda.get(rijec);
      if (!stavka) continue;
      try {
        const ishodOblika = await primijeniDodavanjeOblika(tx, {
          rijec,
          tier,
          vrsta: pregled.vrsta,
          kljucGrupe: pregled.kljucGrupe,
          stanje: stavka.stanje,
          potvrdiPreklapanja: ulaz.potvrdiPreklapanja,
          razlog,
          adminId: ulaz.adminId,
          prijavaId: izvornaPrijava?.id ?? null,
          operacijaId,
        });
        if (ishodOblika.promjena === 'dodana') {
          dodane.push(rijec);
          if (prvaIzmjenaId == null) prvaIzmjenaId = ishodOblika.izmjenaId;
        } else if (ishodOblika.promjena === 'reaktivirana') {
          reaktivirane.push(rijec);
          if (prvaIzmjenaId == null) prvaIzmjenaId = ishodOblika.izmjenaId;
        } else if (ishodOblika.promjena === 'azurirana') {
          azurirane.push(rijec);
          if (prvaIzmjenaId == null) prvaIzmjenaId = ishodOblika.izmjenaId;
        }
      } catch (greska) {
        if (greska instanceof Error && greska.message === 'preklapanje_bez_potvrde') {
          return {
            ok: false as const,
            status: 400 as const,
            greska: 'Potrebna je potvrda preklapanja grupa.',
            kod: 'preklapanje' as const,
            pregled,
          };
        }
        throw greska;
      }
    }

    const promijenjene = sortirajJedinstvene([...dodane, ...reaktivirane, ...azurirane]);
    let prijavaIds: number[] = [];
    let mailboxPrijavitelji: Array<{ prijavaId: number; igracId: string; rijec: string }> = [];
    let prijaviteljiZaNagradu: Array<{ igracId: string; rijec: string }> = [];
    const obavijesti: ObavijestiGrupnePotvrde[] = [];

    if (izvornaPrijava || promijenjene.length > 0) {
      const pogođene = promijenjene.length > 0
        ? promijenjene
        : sortirajJedinstvene([izvornaRijec]);
      const uvjetRijeci = pogođene.length === 1
        ? sql`normalize(lower(btrim(${prijave.rijec})), NFC) = ${pogođene[0]}`
        : sql`normalize(lower(btrim(${prijave.rijec})), NFC) = any(array[${sql.join(
          pogođene.map((r) => sql`${r}`),
          sql`, `,
        )}]::text[])`;
      const otvorene = await tx
        .select({
          id: prijave.id,
          igracId: prijave.igracId,
          rijec: prijave.rijec,
        })
        .from(prijave)
        .where(and(
          eq(prijave.tip, 'za_dodavanje'),
          isNull(prijave.potvrdenaAkcija),
          or(inArray(prijave.status, ['nova', 'pregledana']), izvornaPrijava ? eq(prijave.id, izvornaPrijava.id) : sql`false`),
          uvjetRijeci,
        ))
        .for('update');

      const zaRijesiti = otvorene.length > 0
        ? otvorene
        : izvornaPrijava
          ? [{ id: izvornaPrijava.id, igracId: izvornaPrijava.igracId, rijec: izvornaPrijava.rijec }]
          : [];

      if (zaRijesiti.length > 0) {
        prijavaIds = zaRijesiti.map((p) => p.id).sort((a, b) => a - b);
        const ids = zaRijesiti.map((p) => p.id);
        const imaPromjene = promijenjene.length > 0;
        await tx.update(prijave).set({
          status: 'rijesena',
          napomenaAdmina: imaPromjene ? 'dodana' : 'nema_promjene',
          rijesioId: ulaz.adminId,
          potvrdenaAkcija: imaPromjene ? 'dodana' : null,
          izmjenaRjecnikaId: imaPromjene ? prvaIzmjenaId : null,
        }).where(inArray(prijave.id, ids));

        if (imaPromjene) {
          const poIgracu = new Map<string, string>();
          for (const p of [...zaRijesiti].sort((a, b) => a.id - b.id)) {
            const rijecNorm = normalizirajRijecRjecnika(p.rijec);
            mailboxPrijavitelji.push({
              prijavaId: p.id,
              igracId: p.igracId,
              rijec: rijecNorm,
            });
            if (!poIgracu.has(p.igracId)) poIgracu.set(p.igracId, rijecNorm);
          }
          prijaviteljiZaNagradu = [...poIgracu.entries()].map(([igracId, rijec]) => ({ igracId, rijec }));
        }
      }
    }

    if (mailboxPrijavitelji.length > 0) {
      const poRijeci = new Map<string, Array<{ prijavaId: number; igracId: string }>>();
      for (const p of mailboxPrijavitelji) {
        const lista = poRijeci.get(p.rijec) ?? [];
        lista.push({ prijavaId: p.prijavaId, igracId: p.igracId });
        poRijeci.set(p.rijec, lista);
      }
      for (const [rijec, prijavitelji] of poRijeci) {
        const obavijesteni = await stvoriPorukeUvazenePrijaveRijeci({
          prijavitelji,
          rijec,
          smjer: 'dodaj',
          napomena: ulaz.napomena,
          tx,
        });
        sanducicIgraci.push(...obavijesteni);
      }
    }

    if (prijaviteljiZaNagradu.length > 0) {
      const kvalificirani = new Set(await kvalificiraniPrijavitelji(
        tx,
        prijaviteljiZaNagradu.map((p) => p.igracId),
      ));
      const sada = new Date();
      for (const p of prijaviteljiZaNagradu) {
        if (!kvalificirani.has(p.igracId)) continue;
        const ishodNagrade = await dodijeliDoprinos(tx, {
          igracId: p.igracId,
          dostignuceId: ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
          dokaz: { vrsta: 'jezicni_detektiv', normaliziranaRijec: p.rijec },
          zavrsenoU: sada,
          izvor: 'potvrda_prijave_rijeci',
          kontekst: { rijec: p.rijec },
        });
        if (ishodNagrade.noveObavijesti.length > 0) {
          obavijesti.push({ igracId: p.igracId, obavijesti: ishodNagrade.noveObavijesti });
        }
      }
    }

    const ishod: IshodGrupnogDodavanja = {
      smjer: 'dodaj',
      izvornaRijec,
      operacijaId,
      dodane,
      reaktivirane,
      azurirane,
      promijenjene,
      brojPromjena: promijenjene.length,
      nemaPromjene: promijenjene.length === 0,
      prijavaIds,
    };

    await tx.insert(operacijeRjecnika).values({
      id: operacijaId,
      kljuc,
      smjer: 'dodaj',
      otisak: ulaz.otisak,
      otisakZahtjeva,
      adminId: ulaz.adminId,
      izvornaRijec,
      prijavaId: izvornaPrijava?.id ?? null,
      ishod,
    });

    return {
      ok: true as const,
      ishod,
      obavijesti,
      izCachea: false as const,
    };
  });

  if (!rezultat.ok) return rezultat;
  if (sanducicIgraci.length > 0) emitirajPromjeneSanducica(sanducicIgraci);
  return { ok: true, ishod: rezultat.ishod, obavijesti: rezultat.obavijesti };
}
