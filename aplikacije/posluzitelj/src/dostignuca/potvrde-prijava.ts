/**
 * Potvrda prijave mora donijeti stvarnu posljedicu. Sam status „riješena” ne dodjeljuje dostignuće.
 */
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_CINKAROS,
  ID_DOSTIGNUCA_JEZICNI_DETEKTIV,
  type ObavijestOtkljucanogDostignuca,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { igraci, prijave, prijaveIgraca } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';
import { obrisiRacunPoId, type IshodBrisanja } from '../racuni/brisanje.js';
import {
  FREKVENCIJA_ZA_TIER_RIJETKOSTI,
  normalizirajRijecRjecnika,
  type TierRijetkostiRucno,
} from '../rjecnik/administracija.js';
import {
  izracunajPregledDodavanja,
  izracunajPregledUklanjanja,
  potvrdiGrupnoDodavanje,
  potvrdiGrupnoUklanjanje,
  type PregledGrupneIzmjene,
  type UlazPregledaGrupnogDodavanja,
} from '../rjecnik/grupne-izmjene.js';
import { dodijeliDoprinos } from './dodjela.js';
import {
  emitirajPromjeneSanducica,
  stvoriPorukeOdbacenihPrijaveIgraca,
  stvoriPorukeOdbacenihPrijaveRijeci,
  stvoriPorukeUvazenePrijaveIgraca,
  stvoriPorukeUvazenePrijaveRijeci,
} from '../sanducic/okidaci.js';

const RAZLOZI_PRIJAVE_IGRACA = ['pogrdan_nadimak', 'neprimjereno_ponasanje', 'drugo'] as const;
type RazlogPrijaveIgraca = (typeof RAZLOZI_PRIJAVE_IGRACA)[number];

export interface ObavijestiPotvrde {
  igracId: string;
  obavijesti: ObavijestOtkljucanogDostignuca[];
}

export type RezultatPotvrdeRijeci =
  | { ok: false; status: 400 | 404 | 409; greska: string; kod?: string; pregled?: PregledGrupneIzmjene }
  | {
      ok: true;
      rijec: string;
      promjena: 'nema' | 'dodana' | 'reaktivirana' | 'deaktivirana';
      obavijesti: ObavijestiPotvrde[];
      deaktivirane?: string[];
      promijenjene?: string[];
      brojPromjena?: number;
    };

export type RezultatPotvrdeRacuna =
  | { ok: false; status: 400 | 404; greska: string }
  | {
      ok: true;
      ishod: IshodBrisanja;
      osvjeziLjestvicu: boolean;
      obavijesti: ObavijestiPotvrde[];
    };

export type RezultatOdbacivanja =
  | { ok: false; status: 400 | 404; greska: string }
  | { ok: true };

function jeRazlogPrijave(razlog: string): razlog is RazlogPrijaveIgraca {
  return (RAZLOZI_PRIJAVE_IGRACA as readonly string[]).includes(razlog);
}

function tierIzFrekvencije(frekvencija: number | undefined): TierRijetkostiRucno | undefined {
  if (frekvencija === undefined) return undefined;
  for (const [tier, vrijednost] of Object.entries(FREKVENCIJA_ZA_TIER_RIJETKOSTI)) {
    if (vrijednost === frekvencija) return tier as TierRijetkostiRucno;
  }
  return undefined;
}

async function kvalificiraniPrijavitelji(tx: MisijeTx, ids: readonly string[], iskljuciId?: string): Promise<string[]> {
  const jedinstveni = [...new Set(ids)].filter((id) => id !== iskljuciId);
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

async function nagradi(
  tx: MisijeTx,
  prijavitelji: readonly string[],
  dodjela: {
    dostignuceId: string;
    dokaz: { vrsta: 'jezicni_detektiv'; normaliziranaRijec: string } | { vrsta: 'cinkaros'; prijavljeniIgracId: string };
    izvor: string;
    kontekst: Record<string, unknown> | null;
  },
): Promise<ObavijestiPotvrde[]> {
  const sada = new Date();
  const obavijesti: ObavijestiPotvrde[] = [];
  for (const igracId of prijavitelji) {
    const ishod = await dodijeliDoprinos(tx, {
      igracId,
      dostignuceId: dodjela.dostignuceId,
      dokaz: dodjela.dokaz,
      zavrsenoU: sada,
      izvor: dodjela.izvor,
      kontekst: dodjela.kontekst,
    });
    if (ishod.noveObavijesti.length > 0) obavijesti.push({ igracId, obavijesti: ishod.noveObavijesti });
  }
  return obavijesti;
}

async function nadimakIgraca(tx: MisijeTx, igracId: string): Promise<string> {
  const [red] = await tx.select({ nadimak: igraci.nadimak }).from(igraci).where(eq(igraci.id, igracId)).limit(1);
  return red?.nadimak?.trim() || '???';
}

export async function potvrdiIspravakRjecnika(ulaz: {
  prijavaId: number;
  adminId: string;
  smjer: 'dodaj' | 'deaktiviraj';
  /** Samo za smjer `dodaj`: reprezentativna frekvencija (tier rijetkosti). */
  frekvencija?: number;
  napomena?: string;
  /** Grupno uklanjanje (#75) / dodavanje (#89): otisak pregleda + ključ operacije. */
  otisak?: string;
  kljucOperacije?: string;
  /** Grupno dodavanje (#89): puni payload uz otisak. */
  grupno?: Partial<UlazPregledaGrupnogDodavanja> & {
    otisak: string;
    kljucOperacije: string;
    potvrdiPreklapanja?: boolean;
  };
}): Promise<RezultatPotvrdeRijeci> {
  if (ulaz.smjer === 'deaktiviraj') {
    let otisak = ulaz.otisak;
    let kljucOperacije = ulaz.kljucOperacije;
    if (!otisak || !kljucOperacije) {
      const [prijava] = await baza.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).limit(1);
      if (!prijava) return { ok: false, status: 404, greska: 'Prijava nije pronađena.' };
      if (prijava.tip !== 'za_brisanje') {
        return { ok: false, status: 400, greska: 'Ova prijava nije za brisanje riječi.' };
      }
      if (prijava.potvrdenaAkcija || prijava.status === 'rijesena') {
        return { ok: true, rijec: normalizirajRijecRjecnika(prijava.rijec), promjena: 'nema', obavijesti: [] };
      }
      const pregled = await izracunajPregledUklanjanja(baza, prijava.rijec);
      if (pregled.brojAktivnih > 1) {
        return {
          ok: false,
          status: 409,
          greska: 'Potreban je pregled grupnog uklanjanja.',
          kod: 'zastarjeli_pregled',
          pregled,
        };
      }
      otisak = pregled.otisak;
      kljucOperacije = `legacy-obrisi-${ulaz.prijavaId}-${otisak.slice(0, 16)}`;
    }

    const grupno = await potvrdiGrupnoUklanjanje({
      adminId: ulaz.adminId,
      otisak,
      kljucOperacije,
      prijavaId: ulaz.prijavaId,
      napomena: ulaz.napomena,
    });
    if (!grupno.ok) {
      return {
        ok: false,
        status: grupno.status,
        greska: grupno.greska,
        kod: grupno.kod,
        pregled: grupno.pregled,
      };
    }
    return {
      ok: true,
      rijec: grupno.ishod.izvornaRijec,
      promjena: grupno.ishod.nemaPromjene ? 'nema' : 'deaktivirana',
      obavijesti: grupno.obavijesti,
      deaktivirane: grupno.ishod.deaktivirane,
      brojPromjena: grupno.ishod.brojPromjena,
    };
  }

  let otisak = ulaz.otisak;
  let kljucOperacije = ulaz.kljucOperacije;
  let grupnoUlaz: UlazPregledaGrupnogDodavanja | null = null;
  let potvrdiPreklapanja = ulaz.grupno?.potvrdiPreklapanja ?? false;

  if (ulaz.grupno?.otisak && ulaz.grupno.kljucOperacije) {
    otisak = ulaz.grupno.otisak;
    kljucOperacije = ulaz.grupno.kljucOperacije;
    potvrdiPreklapanja = ulaz.grupno.potvrdiPreklapanja ?? false;
    grupnoUlaz = ulaz.grupno;
  }

  if (!otisak || !kljucOperacije) {
    const [prijava] = await baza.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).limit(1);
    if (!prijava) return { ok: false, status: 404, greska: 'Prijava nije pronađena.' };
    if (prijava.tip !== 'za_dodavanje') {
      return { ok: false, status: 400, greska: 'Ova prijava nije za dodavanje riječi.' };
    }
    if (prijava.potvrdenaAkcija || prijava.status === 'rijesena') {
      return { ok: true, rijec: normalizirajRijecRjecnika(prijava.rijec), promjena: 'nema', obavijesti: [] };
    }
    const lema = grupnoUlaz?.lema ?? normalizirajRijecRjecnika(prijava.rijec);
    const vrsta = grupnoUlaz?.vrsta ?? 'imenica';
    const tierIzvora = grupnoUlaz?.tierIzvora ?? tierIzFrekvencije(ulaz.frekvencija);
    const pregled = await izracunajPregledDodavanja(baza, {
      izvornaRijec: prijava.rijec,
      vrsta,
      lema,
      stupanj: grupnoUlaz?.stupanj,
      tierIzvora,
      dodatniOblici: grupnoUlaz?.dodatniOblici ?? [],
    });
    if (pregled.brojOblici > 1 || pregled.imaPreklapanja) {
      return {
        ok: false,
        status: 409,
        greska: 'Potreban je pregled grupnog dodavanja.',
        kod: 'zastarjeli_pregled',
        pregled,
      };
    }
    otisak = pregled.otisak;
    kljucOperacije = `legacy-dodaj-${ulaz.prijavaId}-${otisak.slice(0, 16)}`;
    grupnoUlaz = {
      izvornaRijec: prijava.rijec,
      vrsta,
      lema,
      stupanj: grupnoUlaz?.stupanj,
      tierIzvora,
      dodatniOblici: grupnoUlaz?.dodatniOblici ?? [],
    };
  }

  const [prijavaZaglavlje] = await baza.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).limit(1);
  if (!prijavaZaglavlje) return { ok: false, status: 404, greska: 'Prijava nije pronađena.' };
  const ulazDodavanja: UlazPregledaGrupnogDodavanja = grupnoUlaz ?? {
    izvornaRijec: prijavaZaglavlje.rijec,
    vrsta: 'imenica',
    lema: normalizirajRijecRjecnika(prijavaZaglavlje.rijec),
    tierIzvora: tierIzFrekvencije(ulaz.frekvencija),
    dodatniOblici: [],
  };

  const grupno = await potvrdiGrupnoDodavanje({
    adminId: ulaz.adminId,
    otisak,
    kljucOperacije,
    potvrdiPreklapanja,
    prijavaId: ulaz.prijavaId,
    napomena: ulaz.napomena,
    ...ulazDodavanja,
  });
  if (!grupno.ok) {
    return {
      ok: false,
      status: grupno.status,
      greska: grupno.greska,
      kod: grupno.kod,
      pregled: grupno.pregled,
    };
  }
  return {
    ok: true,
    rijec: grupno.ishod.izvornaRijec,
    promjena: grupno.ishod.nemaPromjene ? 'nema' : 'dodana',
    obavijesti: grupno.obavijesti,
    promijenjene: grupno.ishod.promijenjene,
    brojPromjena: grupno.ishod.brojPromjena,
  };
}

export async function odbaciPrijavuRijeci(ulaz: {
  prijavaId: number;
  adminId: string;
  napomena?: string;
}): Promise<RezultatOdbacivanja> {
  let sanducicIgraci: string[] = [];
  const rezultat = await baza.transaction(async (tx) => {
    const [prijava] = await tx.select().from(prijave).where(eq(prijave.id, ulaz.prijavaId)).for('update').limit(1);
    if (!prijava) return { ok: false as const, status: 404 as const, greska: 'Prijava nije pronađena.' };
    if (prijava.status === 'rijesena' || prijava.potvrdenaAkcija) {
      return { ok: true as const };
    }

    const rijec = normalizirajRijecRjecnika(prijava.rijec);
    const povezane = await tx.select({ id: prijave.id, igracId: prijave.igracId }).from(prijave).where(and(
      eq(prijave.tip, prijava.tip),
      isNull(prijave.potvrdenaAkcija),
      sql`normalize(lower(btrim(${prijave.rijec})), NFC) = ${rijec}`,
      or(inArray(prijave.status, ['nova', 'pregledana']), eq(prijave.id, prijava.id)),
    )).for('update');
    const ids = [...new Set([...povezane.map((red) => red.id), prijava.id])];
    await tx.update(prijave).set({
      status: 'rijesena',
      napomenaAdmina: 'dismiss',
      rijesioId: ulaz.adminId,
    }).where(inArray(prijave.id, ids));

    sanducicIgraci = await stvoriPorukeOdbacenihPrijaveRijeci({
      prijavitelji: [
        { prijavaId: prijava.id, igracId: prijava.igracId },
        ...povezane.map((red) => ({ prijavaId: red.id, igracId: red.igracId })),
      ],
      rijec,
      tipPrijave: prijava.tip,
      napomena: ulaz.napomena,
      tx,
    });
    return { ok: true as const };
  });
  if (rezultat.ok && sanducicIgraci.length > 0) emitirajPromjeneSanducica(sanducicIgraci);
  return rezultat;
}

export async function potvrdiUklanjanjeRacuna(ulaz: {
  prijavaId: number;
  adminId: string;
  napomena?: string;
}): Promise<RezultatPotvrdeRacuna> {
  let sanducicIgraci: string[] = [];
  const rezultat = await baza.transaction(async (tx) => {
    const [prijava] = await tx.select().from(prijaveIgraca).where(eq(prijaveIgraca.id, ulaz.prijavaId)).for('update').limit(1);
    if (!prijava) return { ok: false as const, status: 404 as const, greska: 'Prijava nije pronađena.' };
    if (prijava.prijaviteljId === prijava.prijavljeniIgracId) {
      return { ok: false as const, status: 400 as const, greska: 'Prijava samog sebe nije valjana.' };
    }
    if (prijava.potvrdenaAkcija || prijava.status === 'rijesena') {
      return { ok: true as const, ishod: 'vec-obrisan' as const, osvjeziLjestvicu: false, obavijesti: [] };
    }

    const nadimak = await nadimakIgraca(tx, prijava.prijavljeniIgracId);
    const brisanje = await obrisiRacunPoId(prijava.prijavljeniIgracId, tx);

    if (brisanje.ishod === 'nije-pronaden') return { ok: false as const, status: 404 as const, greska: 'Račun nije pronađen.' };
    if (brisanje.ishod === 'zasticen') {
      return { ok: false as const, status: 400 as const, greska: 'Botove i admin račune nije moguće obrisati ovim putem.' };
    }
    if (brisanje.ishod === 'vec-obrisan') {
      await tx.update(prijaveIgraca).set({
        status: 'rijesena',
        napomenaAdmina: 'racun_vec_obrisan',
        rijesioId: ulaz.adminId,
      }).where(eq(prijaveIgraca.id, prijava.id));
      return { ok: true as const, ishod: 'vec-obrisan' as const, osvjeziLjestvicu: false, obavijesti: [] };
    }

    const razlog = jeRazlogPrijave(prijava.razlog) ? prijava.razlog : 'drugo';
    if (razlog !== 'pogrdan_nadimak') {
      await tx.update(prijaveIgraca).set({
        status: 'rijesena',
        napomenaAdmina: 'racun_obrisan',
        rijesioId: ulaz.adminId,
        potvrdenaAkcija: 'soft_brisanje',
        potvrdeniRazlog: razlog,
      }).where(eq(prijaveIgraca.id, prijava.id));
      sanducicIgraci = await stvoriPorukeUvazenePrijaveIgraca({
        prijavitelji: [{ prijavaId: prijava.id, igracId: prijava.prijaviteljId }],
        razlog,
        nadimak,
        napomena: ulaz.napomena,
        tx,
      });
      return { ok: true as const, ishod: 'obrisan' as const, osvjeziLjestvicu: brisanje.osvjeziLjestvicu, obavijesti: [] };
    }

    const povezane = await tx.select({
      id: prijaveIgraca.id,
      prijaviteljId: prijaveIgraca.prijaviteljId,
    }).from(prijaveIgraca).where(and(
      eq(prijaveIgraca.prijavljeniIgracId, prijava.prijavljeniIgracId),
      eq(prijaveIgraca.razlog, 'pogrdan_nadimak'),
      isNull(prijaveIgraca.potvrdenaAkcija),
      or(inArray(prijaveIgraca.status, ['nova', 'pregledana']), eq(prijaveIgraca.id, prijava.id)),
    )).for('update');
    const ids = [...new Set([...povezane.map((red) => red.id), prijava.id])];
    await tx.update(prijaveIgraca).set({
      status: 'rijesena',
      napomenaAdmina: 'racun_obrisan',
      rijesioId: ulaz.adminId,
      potvrdenaAkcija: 'soft_brisanje',
      potvrdeniRazlog: 'pogrdan_nadimak',
    }).where(inArray(prijaveIgraca.id, ids));

    sanducicIgraci = await stvoriPorukeUvazenePrijaveIgraca({
      prijavitelji: [
        { prijavaId: prijava.id, igracId: prijava.prijaviteljId },
        ...povezane.map((red) => ({ prijavaId: red.id, igracId: red.prijaviteljId })),
      ],
      razlog: 'pogrdan_nadimak',
      nadimak,
      napomena: ulaz.napomena,
      tx,
    });

    const prijavitelji = await kvalificiraniPrijavitelji(
      tx,
      [prijava.prijaviteljId, ...povezane.map((red) => red.prijaviteljId)],
      prijava.prijavljeniIgracId,
    );
    const obavijesti = await nagradi(tx, prijavitelji, {
      dostignuceId: ID_DOSTIGNUCA_CINKAROS,
      dokaz: { vrsta: 'cinkaros', prijavljeniIgracId: prijava.prijavljeniIgracId },
      izvor: 'potvrda_prijave_igraca',
      kontekst: null,
    });
    return { ok: true as const, ishod: 'obrisan' as const, osvjeziLjestvicu: brisanje.osvjeziLjestvicu, obavijesti };
  });
  if (rezultat.ok && sanducicIgraci.length > 0) emitirajPromjeneSanducica(sanducicIgraci);
  return rezultat;
}

export async function odbaciPrijavuIgraca(ulaz: {
  prijavaId: number;
  adminId: string;
  napomena?: string;
}): Promise<RezultatOdbacivanja> {
  let sanducicIgraci: string[] = [];
  const rezultat = await baza.transaction(async (tx) => {
    const [prijava] = await tx.select().from(prijaveIgraca).where(eq(prijaveIgraca.id, ulaz.prijavaId)).for('update').limit(1);
    if (!prijava) return { ok: false as const, status: 404 as const, greska: 'Prijava nije pronađena.' };
    if (prijava.status === 'rijesena' || prijava.potvrdenaAkcija) {
      return { ok: true as const };
    }

    const nadimak = await nadimakIgraca(tx, prijava.prijavljeniIgracId);
    const razlog = jeRazlogPrijave(prijava.razlog) ? prijava.razlog : 'drugo';

    if (razlog !== 'pogrdan_nadimak') {
      await tx.update(prijaveIgraca).set({
        status: 'rijesena',
        napomenaAdmina: 'dismiss',
        rijesioId: ulaz.adminId,
      }).where(eq(prijaveIgraca.id, prijava.id));
      sanducicIgraci = await stvoriPorukeOdbacenihPrijaveIgraca({
        prijavitelji: [{ prijavaId: prijava.id, igracId: prijava.prijaviteljId }],
        razlog,
        nadimak,
        napomena: ulaz.napomena,
        tx,
      });
      return { ok: true as const };
    }

    const povezane = await tx.select({
      id: prijaveIgraca.id,
      prijaviteljId: prijaveIgraca.prijaviteljId,
    }).from(prijaveIgraca).where(and(
      eq(prijaveIgraca.prijavljeniIgracId, prijava.prijavljeniIgracId),
      eq(prijaveIgraca.razlog, 'pogrdan_nadimak'),
      isNull(prijaveIgraca.potvrdenaAkcija),
      or(inArray(prijaveIgraca.status, ['nova', 'pregledana']), eq(prijaveIgraca.id, prijava.id)),
    )).for('update');
    const ids = [...new Set([...povezane.map((red) => red.id), prijava.id])];
    await tx.update(prijaveIgraca).set({
      status: 'rijesena',
      napomenaAdmina: 'dismiss',
      rijesioId: ulaz.adminId,
    }).where(inArray(prijaveIgraca.id, ids));

    sanducicIgraci = await stvoriPorukeOdbacenihPrijaveIgraca({
      prijavitelji: [
        { prijavaId: prijava.id, igracId: prijava.prijaviteljId },
        ...povezane.map((red) => ({ prijavaId: red.id, igracId: red.prijaviteljId })),
      ],
      razlog: 'pogrdan_nadimak',
      nadimak,
      napomena: ulaz.napomena,
      tx,
    });
    return { ok: true as const };
  });
  if (rezultat.ok && sanducicIgraci.length > 0) emitirajPromjeneSanducica(sanducicIgraci);
  return rezultat;
}
