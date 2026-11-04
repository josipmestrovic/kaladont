import { and, asc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  DEFINICIJE_DOSTIGNUCA,
  MAKSIMALNO_ISKUSTVO,
  type MetrikeMisijaIgre,
  type PromjenaMisije,
  type UkupnoIskustvoIshoda,
  izracunajRazinuDostignuca,
  stanjeIskustva,
} from 'zajednicko';
import {
  dodjeleMisija,
  doprinosiMisijama,
  dostignucaIgraca,
  igraci,
  ishodiMisijaIgara,
  nagradeMisija,
  stanjeMisijaIgraca,
} from '../baza/shema.js';
import { osigurajStanjeMisija } from './stanje.js';
import { primijeniMetrikuNaDodjelu, smijePrimitiMisijskiNapredak } from './metrika.js';
import type { MisijeSatRng, MisijeTx, PodstanjeMisije, SnapshotMisije } from './tipovi.js';
import { zadaniSatRng } from './tipovi.js';

export interface IshodMisijaPayload {
  promjeneMisija: PromjenaMisije[];
  ukupnoIskustvo: UkupnoIskustvoIshoda;
  misijeStanjeVerzija: number;
  novaDostignuca: { id: string; novaRazina: number; maksimalnaRazina: number }[];
}

function opisNapretka(naziv: string, prije: number, poslije: number, cilj: number): string {
  return `${naziv} — ${prije} → ${poslije} / ${cilj}`;
}

async function ucitajIliNullIshod(
  tx: MisijeTx,
  igracId: string,
  kontekst: 'javna' | 'trening',
  izvorId: string,
): Promise<IshodMisijaPayload | null> {
  const [red] = await tx.select().from(ishodiMisijaIgara).where(and(
    eq(ishodiMisijaIgara.igracId, igracId),
    eq(ishodiMisijaIgara.kontekstIzvora, kontekst),
    eq(ishodiMisijaIgara.izvorId, izvorId),
  ));
  return red ? red.payload as IshodMisijaPayload : null;
}

/**
 * Obračun misija za jednog igrača unutar postojeće TX (nakon partijskog XP-a).
 * `iskustvoNakonPartije` = zaključano DB stanje nakon partijskog dijela (trening: isto kao prije).
 */
export async function obracunajMisijeZaIgraca(
  tx: MisijeTx,
  metrike: MetrikeMisijaIgre,
  iskustvoNakonPartije: number,
  iskustvoPrijePartije: number,
  satRng: MisijeSatRng = zadaniSatRng,
): Promise<IshodMisijaPayload> {
  const postojeći = await ucitajIliNullIshod(tx, metrike.igracId, metrike.kontekst, metrike.izvorId);
  if (postojeći) return postojeći;

  await osigurajStanjeMisija(tx, metrike.igracId, {
    sada: () => metrike.zavrsenoU,
    rng: satRng.rng,
  });

  const [stanje] = await tx.select().from(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, metrike.igracId)).for('update');
  if (!stanje) throw new Error('Nedostaje stanje misija nakon osiguranja.');

  const prije = stanjeIskustva(iskustvoPrijePartije);
  const nakonPartije = stanjeIskustva(iskustvoNakonPartije);
  let trenutnoUkupno = iskustvoNakonPartije;
  const promjene: PromjenaMisije[] = [];
  const novaDostignuca: IshodMisijaPayload['novaDostignuca'] = [];

  if (!smijePrimitiMisijskiNapredak(metrike)) {
    const payload: IshodMisijaPayload = {
      promjeneMisija: [],
      ukupnoIskustvo: {
        prije,
        nakonPartije,
        poslije: nakonPartije,
        partijskiXpStvarno: Math.max(0, iskustvoNakonPartije - iskustvoPrijePartije),
        misijskiXpNominalno: 0,
        misijskiXpStvarno: 0,
        ukupnoXpStvarno: Math.max(0, iskustvoNakonPartije - iskustvoPrijePartije),
      },
      misijeStanjeVerzija: stanje.verzijaStanja,
      novaDostignuca: [],
    };
    await tx.insert(ishodiMisijaIgara).values({
      igracId: metrike.igracId,
      kontekstIzvora: metrike.kontekst,
      izvorId: metrike.izvorId,
      zavrsenoU: metrike.zavrsenoU,
      payload,
    }).onConflictDoNothing();
    return (await ucitajIliNullIshod(tx, metrike.igracId, metrike.kontekst, metrike.izvorId)) ?? payload;
  }

  // Dnevne: samo aktivne. Tjedne: aktivna ili istekla ako je rok još bio otvoren u trenutku igre
  // (GET/osiguranje u novom tjednu može već označiti prošlotjedne kao istekla prije late settlementa).
  const kandidati = await tx.select().from(dodjeleMisija).where(and(
    eq(dodjeleMisija.igracId, metrike.igracId),
    or(
      and(eq(dodjeleMisija.vrsta, 'dnevna'), eq(dodjeleMisija.status, 'aktivna')),
      and(
        eq(dodjeleMisija.vrsta, 'tjedna'),
        inArray(dodjeleMisija.status, ['aktivna', 'istekla']),
        or(
          isNull(dodjeleMisija.istjeceU),
          gt(dodjeleMisija.istjeceU, metrike.zavrsenoU),
        ),
      ),
    ),
  )).orderBy(asc(dodjeleMisija.vrsta), asc(dodjeleMisija.dostupnaOd), asc(dodjeleMisija.id));

  const dovrseneZaIsplatu: typeof kandidati = [];

  for (const dodjela of kandidati) {
    if (dodjela.dostupnaOd.getTime() > metrike.zavrsenoU.getTime()) continue;

    const [doprinos] = await tx.insert(doprinosiMisijama).values({
      dodjelaId: dodjela.id,
      igracId: metrike.igracId,
      kontekstIzvora: metrike.kontekst,
      izvorId: metrike.izvorId,
      delta: {},
    }).onConflictDoNothing().returning({ id: doprinosiMisijama.id });
    if (!doprinos) continue;

    const snapshot = dodjela.snapshot as SnapshotMisije;
    const prijeNapretka = dodjela.napredak;
    const rezultat = primijeniMetrikuNaDodjelu({
      predlozakId: dodjela.predlozakId,
      snapshot,
      napredak: dodjela.napredak,
      podstanje: (dodjela.podstanje ?? {}) as PodstanjeMisije,
      metrike,
    });

    await tx.update(doprinosiMisijama).set({ delta: rezultat.deltaOpis }).where(eq(doprinosiMisijama.id, doprinos.id));

    if (rezultat.noviNapredak === prijeNapretka) {
      // i bez rasta bilježimo praznu promjenu samo ako želimo audit; UI traži stvarne pomake
      continue;
    }

    const dovrsena = rezultat.noviNapredak >= dodjela.cilj;
    await tx.update(dodjeleMisija).set({
      napredak: rezultat.noviNapredak,
      podstanje: rezultat.novoPodstanje,
      // Ne vraćaj istekla → aktivna: late settlement samo dovršava ili ažurira napredak.
      status: dovrsena ? 'dovrsena' : dodjela.status,
      zavrsenaU: dovrsena ? metrike.zavrsenoU : null,
    }).where(eq(dodjeleMisija.id, dodjela.id));

    const podciljeviPoslije = snapshot.podciljevi?.map((p) => ({
      kljuc: p.kljuc,
      naziv: p.naziv,
      napredak: rezultat.novoPodstanje.podciljevi?.[p.kljuc] ?? 0,
      cilj: p.cilj,
    }));

    promjene.push({
      dodjelaId: dodjela.id,
      predlozakId: dodjela.predlozakId,
      vrsta: dodjela.vrsta,
      naziv: snapshot.naziv,
      opisNapretka: opisNapretka(snapshot.naziv, prijeNapretka, rezultat.noviNapredak, dodjela.cilj),
      prije: prijeNapretka,
      poslije: rezultat.noviNapredak,
      cilj: dodjela.cilj,
      podciljeviPoslije,
      upravoDovrsena: dovrsena,
      xpNominalno: 0,
      xpStvarnoDodijeljeno: 0,
    });

    if (dovrsena) dovrseneZaIsplatu.push({ ...dodjela, napredak: rezultat.noviNapredak });
  }

  // Deterministički red isplate: dnevne po dostupnaOd+id, zatim tjedne po slot+id
  dovrseneZaIsplatu.sort((a, b) => {
    if (a.vrsta !== b.vrsta) return a.vrsta === 'dnevna' ? -1 : 1;
    if (a.vrsta === 'dnevna') {
      const t = a.dostupnaOd.getTime() - b.dostupnaOd.getTime();
      return t !== 0 ? t : a.id.localeCompare(b.id);
    }
    const s = a.slot - b.slot;
    return s !== 0 ? s : a.id.localeCompare(b.id);
  });

  let misijskiXpNominalno = 0;
  let misijskiXpStvarno = 0;

  for (const dodjela of dovrseneZaIsplatu) {
    const snapshot = dodjela.snapshot as SnapshotMisije;
    const nominalno = snapshot.xp;
    const stvarno = Math.min(nominalno, Math.max(0, MAKSIMALNO_ISKUSTVO - trenutnoUkupno));
    misijskiXpNominalno += nominalno;
    misijskiXpStvarno += stvarno;
    trenutnoUkupno += stvarno;

    await tx.insert(nagradeMisija).values({
      dodjelaId: dodjela.id,
      igracId: metrike.igracId,
      xpNominalno: nominalno,
      xpStvarno: stvarno,
      kontekstIzvora: metrike.kontekst,
      izvorId: metrike.izvorId,
      dodijeljenaU: metrike.zavrsenoU,
    }).onConflictDoNothing();

    const promjena = promjene.find((p) => p.dodjelaId === dodjela.id);
    if (promjena) {
      promjena.xpNominalno = nominalno;
      promjena.xpStvarnoDodijeljeno = stvarno;
    }
  }

  if (misijskiXpStvarno > 0) {
    await tx.update(igraci).set({
      iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${misijskiXpStvarno}, ${MAKSIMALNO_ISKUSTVO})`,
    }).where(eq(igraci.id, metrike.igracId));
  }

  const poslije = stanjeIskustva(trenutnoUkupno);
  const iskusnjara = DEFINICIJE_DOSTIGNUCA.find((d) => d.id === 'iskusnjara');
  if (iskusnjara) {
    const prijeZv = izracunajRazinuDostignuca(iskusnjara, nakonPartije.razina);
    const poslijeZv = izracunajRazinuDostignuca(iskusnjara, poslije.razina);
    if (poslijeZv > prijeZv) {
      await tx.insert(dostignucaIgraca).values({
        igracId: metrike.igracId,
        dostignuceId: 'iskusnjara',
        razina: poslijeZv,
        prvoOtkljucano: metrike.zavrsenoU,
        zadnjeOtkljucavanje: metrike.zavrsenoU,
      }).onConflictDoUpdate({
        target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
        set: { razina: poslijeZv, zadnjeOtkljucavanje: metrike.zavrsenoU },
      });
      novaDostignuca.push({
        id: 'iskusnjara',
        novaRazina: poslijeZv,
        maksimalnaRazina: iskusnjara.pragovi.length,
      });
    }
  }

  await tx.update(stanjeMisijaIgraca).set({
    verzijaStanja: sql`${stanjeMisijaIgraca.verzijaStanja} + 1`,
  }).where(eq(stanjeMisijaIgraca.igracId, metrike.igracId));

  const [novoStanje] = await tx.select({ verzijaStanja: stanjeMisijaIgraca.verzijaStanja })
    .from(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, metrike.igracId));

  const payload: IshodMisijaPayload = {
    promjeneMisija: promjene,
    ukupnoIskustvo: {
      prije,
      nakonPartije,
      poslije,
      partijskiXpStvarno: Math.max(0, iskustvoNakonPartije - iskustvoPrijePartije),
      misijskiXpNominalno,
      misijskiXpStvarno,
      ukupnoXpStvarno: Math.max(0, iskustvoNakonPartije - iskustvoPrijePartije) + misijskiXpStvarno,
    },
    misijeStanjeVerzija: novoStanje?.verzijaStanja ?? stanje.verzijaStanja + 1,
    novaDostignuca,
  };

  await tx.insert(ishodiMisijaIgara).values({
    igracId: metrike.igracId,
    kontekstIzvora: metrike.kontekst,
    izvorId: metrike.izvorId,
    zavrsenoU: metrike.zavrsenoU,
    payload,
  }).onConflictDoNothing();

  return (await ucitajIliNullIshod(tx, metrike.igracId, metrike.kontekst, metrike.izvorId)) ?? payload;
}

export async function dohvatiIshodMisija(
  tx: MisijeTx,
  igracId: string,
  kontekst: 'javna' | 'trening',
  izvorId: string,
): Promise<IshodMisijaPayload | null> {
  return ucitajIliNullIshod(tx, igracId, kontekst, izvorId);
}
