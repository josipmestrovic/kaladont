/**
 * Fastify rute za profil, ljestvicu i povijest partija (javno čitljivi agregati).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  DEFINICIJE_DOSTIGNUCA,
  izracunajKaladontDnk,
  izracunajRang,
  izracunajRazinuDostignuca,
  stanjeIskustva,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  dnkStatistikeIgraca,
  igraci,
  napredakDostignucaIgraca,
  otkljucaneRijeciIgraca,
  partije,
  potezi,
  statistikeRijeciIgraca,
  sudioniciPartije,
} from '../baza/shema.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import { porukaPotvrdeEmaila, posaljiEmail } from '../email.js';
import { konfiguracija } from '../konfiguracija.js';
import { izdajTokenPotvrdeEmaila } from '../racuni/tokeni.js';
import {
  pokusajIdentifikaciju,
  zahtijevajIdentifikaciju,
  zahtijevajPrijavu,
  type ZahtjevSIgracem,
} from '../racuni/autentikacija.js';

const ShemaAvatar = z.object({
  avatarId: z
    .number()
    .int()
    .min(0)
    .max(BROJ_AVATARA - 1),
});
const ShemaNadimak = z.object({ nadimak: z.string().trim().min(2).max(12) });
const ShemaLimit = z.object({
  limit: z.coerce
    .number()
    .int()
    .refine((n) => n === 10 || n === 100, 'limit mora biti 10 ili 100')
    .optional(),
});
const ShemaEmail = z.object({ noviEmail: z.string().email(), lozinka: z.string().min(1) });
const ShemaLozinka = z.object({
  trenutnaLozinka: z.string().min(1),
  novaLozinka: z.string().min(8),
});

function prosjekBodova(bodoviUkupno: number, odigrane: number): number {
  return odigrane > 0 ? bodoviUkupno / odigrane : 0;
}

function stilIgre(
  odigrane: number,
  eliminacije: number,
): 'agresivan' | 'uravnotežen' | 'pacifist' | 'neodređen' {
  if (odigrane === 0) return 'neodređen';
  const eliminacijePoPartiji = odigrane > 0 ? eliminacije / odigrane : 0;
  if (eliminacijePoPartiji > 0.4) return 'agresivan';
  if (eliminacijePoPartiji >= 0.2) return 'uravnotežen';
  return 'pacifist';
}

async function dohvatiStatistiku(igracId: string) {
  const [statistika] = await baza
    .select()
    .from(statistikeRijeciIgraca)
    .where(
      sql`${statistikeRijeciIgraca.igracId} = ${igracId} and ${statistikeRijeciIgraca.mod} = 'cetiri_igraca'`,
    )
    .limit(1);
  return statistika ?? null;
}

async function dohvatiDnkStatistiku(igracId: string, mod: 'cetiri_igraca' | 'dva_igraca') {
  const [statistika] = await baza
    .select()
    .from(dnkStatistikeIgraca)
    .where(sql`${dnkStatistikeIgraca.igracId} = ${igracId} and ${dnkStatistikeIgraca.mod} = ${mod}`)
    .limit(1);
  return statistika ?? null;
}

function prosjecnaOcjena(
  statistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
): number | null {
  if (!statistika || statistika.brojOcjenaIgre === 0) return null;
  return statistika.zbrojOcjenaIgre / statistika.brojOcjenaIgre;
}

async function dohvatiOtkljucaneRijeci(igracId: string) {
  const retci = await baza
    .select({
      rijec: otkljucaneRijeciIgraca.rijec,
      dugaTier: otkljucaneRijeciIgraca.dugaTier,
      rijetkaTier: otkljucaneRijeciIgraca.rijetkaTier,
    })
    .from(otkljucaneRijeciIgraca)
    .where(eq(otkljucaneRijeciIgraca.igracId, igracId));
  return {
    duge: retci
      .filter((redak) => redak.dugaTier === 0)
      .map((redak) => redak.rijec)
      .sort(),
    srednjeDuge: retci
      .filter((redak) => redak.dugaTier === 1)
      .map((redak) => redak.rijec)
      .sort(),
    jakoDuge: retci
      .filter((redak) => redak.dugaTier === 2)
      .map((redak) => redak.rijec)
      .sort(),
    rijetke: retci
      .filter((redak) => redak.rijetkaTier === 2)
      .map((redak) => redak.rijec)
      .sort(),
    srednjeRijetke: retci
      .filter((redak) => redak.rijetkaTier === 1)
      .map((redak) => redak.rijec)
      .sort(),
    jakoRijetke: retci
      .filter((redak) => redak.rijetkaTier === 0)
      .map((redak) => redak.rijec)
      .sort(),
  };
}

function javnaStatistika(statistika: Awaited<ReturnType<typeof dohvatiStatistiku>>) {
  if (!statistika) return null;
  return {
    najduziStreak: statistika.najduziStreak,
    otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe,
    otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe,
    otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe,
    upisaneDugeRijeci: statistika.upisaneDugeRijeci,
    upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
    upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
    najduzaRijec: statistika.najduzaRijec,
    najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
    najrjedaRijec: statistika.najrjedaRijec,
    najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
  };
}

function izracunajDnkProfil(
  igrac: {
    odigrane: number;
    odigrane1v1: number;
    bodoviUkupno: number;
    bodovi1v1: number;
    eliminacijeUkupno: number;
    eliminacije1v1: number;
  },
  statistika: Awaited<ReturnType<typeof dohvatiStatistiku>> | null,
  dnkStatistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  mod: 'cetiri_igraca' | 'dva_igraca',
) {
  const odigrano = mod === 'dva_igraca' ? igrac.odigrane1v1 : igrac.odigrane;
  const bodovi = mod === 'dva_igraca' ? igrac.bodovi1v1 : igrac.bodoviUkupno;
  const eliminacije = mod === 'dva_igraca' ? igrac.eliminacije1v1 : igrac.eliminacijeUkupno;
  const prosjekBodova = odigrano > 0 ? bodovi / odigrano : 0;
  const eliminacijePoPartiji = odigrano > 0 ? eliminacije / odigrano : 0;
  const najduziStreak = statistika?.najduziStreak ?? 0;
  const prosjekPrihvacenogPotezaMs =
    dnkStatistika && dnkStatistika.prihvaceniPotezi > 0
      ? dnkStatistika.ukupnoTrajanjePrihvaceniPoteziMs / dnkStatistika.prihvaceniPotezi
      : 0;
  const ponderiraneDuge =
    (statistika?.upisaneDugeRijeci ?? 0) +
    (statistika?.upisaneSrednjeDugeRijeci ?? 0) * 1.5 +
    (statistika?.upisaneJakoDugeRijeci ?? 0) * 2;
  const ponderiraneRijetke =
    (statistika?.otkriveneRijetkeGrupe ?? 0) +
    (statistika?.otkriveneSrednjeRijetkeGrupe ?? 0) * 1.5 +
    (statistika?.otkriveneJakoRijetkeGrupe ?? 0) * 2;

  const profil = izracunajKaladontDnk({
    mod,
    odigrano,
    prosjekBodova,
    eliminacijePoPartiji,
    najduziStreak,
    prosjekPrihvacenogPotezaMs,
    ponderiraneDuge: ponderiraneDuge / Math.max(1, odigrano),
    ponderiraneRijetke: ponderiraneRijetke / Math.max(1, odigrano),
  });

  return {
    ...profil,
    odigrano,
    preostaloDoOtkljucavanja: Math.max(0, 10 - odigrano),
  };
}

async function dohvatiDostignucaZaIgraca(igracId: string, iskustvoUkupno: number) {
  const [napredak, otkljucana] = await Promise.all([
    baza
      .select()
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId))
      .limit(1),
    baza.select().from(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId)),
  ]);
  const brojac = napredak[0];
  const razinaIskustva = stanjeIskustva(iskustvoUkupno).razina;
  const razine = new Map(otkljucana.map((redak) => [redak.dostignuceId, redak.razina]));
  const dostignuca = DEFINICIJE_DOSTIGNUCA.map((definicija) => {
    const vrijednost =
      definicija.brojac === 'razina' ? razinaIskustva : Number(brojac?.[definicija.brojac] ?? 0);
    const izracunataRazina = izracunajRazinuDostignuca(definicija, vrijednost);
    const razina = Math.max(razine.get(definicija.id) ?? 0, izracunataRazina);
    return { ...definicija, razina, vrijednost, sljedeciPrag: definicija.pragovi[razina] ?? null };
  });
  return {
    ukupnoZvjezdica: dostignuca.reduce((zbroj, dostignuce) => zbroj + dostignuce.razina, 0),
    ukupnoOtkljucanih: dostignuca.filter((dostignuce) => dostignuce.razina > 0).length,
    maksimalnoZvjezdica: DEFINICIJE_DOSTIGNUCA.reduce(
      (zbroj, definicija) => zbroj + definicija.pragovi.length,
      0,
    ),
    dostignuca,
  };
}

export async function registrirajProfilRute(
  app: FastifyInstance,
  rjecnik: RjecnikUMemoriji,
): Promise<void> {
  app.get('/dostignuca', { preHandler: zahtijevajPrijavu }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    return { ok: true, ...(await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno)) };
  });

  app.get('/profil', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const statistikaRijeci = await dohvatiStatistiku(igrac.id);
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const otkljucaneRijeci = await dohvatiOtkljucaneRijeci(igrac.id);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    return {
      ok: true,
      igracId: igrac.id,
      nadimak: igrac.nadimak,
      avatarId: igrac.avatarId,
      email: igrac.email,
      emailPotvrdjen: igrac.emailPotvrdjen,
      odigrane: igrac.odigrane,
      pobjede: igrac.pobjede,
      eliminacijeUkupno: igrac.eliminacijeUkupno,
      bodoviUkupno: igrac.bodoviUkupno,
      prosjekBodova: prosjek4p,
      rang: izracunajRang(igrac.odigrane, prosjek4p, 'cetiri_igraca'),
      odigrane1v1: igrac.odigrane1v1,
      pobjede1v1: igrac.pobjede1v1,
      eliminacije1v1: igrac.eliminacije1v1,
      bodovi1v1: igrac.bodovi1v1,
      prosjekBodova1v1: prosjek1v1,
      rang1v1: izracunajRang(igrac.odigrane1v1, prosjek1v1, 'dva_igraca'),
      dnk: {
        cetiriIgraca: izracunajDnkProfil(igrac, statistikaRijeci, dnkCetiri, 'cetiri_igraca'),
        dvaIgraca: izracunajDnkProfil(igrac, statistikaRijeci, dnkDva, 'dva_igraca'),
      },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      stvoren: igrac.stvoren,
      statistikaRijeci: javnaStatistika(statistikaRijeci),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      otkljucaneRijeci,
      dostignuca,
    };
  });

  app.get<{ Params: { igracId: string } }>('/profil/javni/:igracId', async (zahtjev, odgovor) => {
    const [igrac] = await baza
      .select()
      .from(igraci)
      .where(
        sql`${igraci.id} = ${zahtjev.params.igracId} and ${igraci.vrsta} in ('registriran', 'admin')`,
      )
      .limit(1);
    if (!igrac) return odgovor.code(404).send({ ok: false, greska: 'Profil nije pronađen.' });

    const statistikaRijeci = await dohvatiStatistiku(igrac.id);
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const otkljucaneRijeci = await dohvatiOtkljucaneRijeci(igrac.id);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    return {
      ok: true,
      igracId: igrac.id,
      nadimak: igrac.nadimak,
      avatarId: igrac.avatarId,
      odigrane: igrac.odigrane,
      pobjede: igrac.pobjede,
      eliminacijeUkupno: igrac.eliminacijeUkupno,
      bodoviUkupno: igrac.bodoviUkupno,
      prosjekBodova: prosjek4p,
      rang: izracunajRang(igrac.odigrane, prosjek4p, 'cetiri_igraca'),
      odigrane1v1: igrac.odigrane1v1,
      pobjede1v1: igrac.pobjede1v1,
      eliminacije1v1: igrac.eliminacije1v1,
      bodovi1v1: igrac.bodovi1v1,
      prosjekBodova1v1: prosjek1v1,
      rang1v1: izracunajRang(igrac.odigrane1v1, prosjek1v1, 'dva_igraca'),
      dnk: {
        cetiriIgraca: izracunajDnkProfil(igrac, statistikaRijeci, dnkCetiri, 'cetiri_igraca'),
        dvaIgraca: izracunajDnkProfil(igrac, statistikaRijeci, dnkDva, 'dva_igraca'),
      },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      statistikaRijeci: javnaStatistika(statistikaRijeci),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      otkljucaneRijeci,
      dostignuca,
    };
  });

  // Onboarding dopušta i gostima da odaberu avatar (jednokratno, prvi ulazak - dobrodoslica/+page.svelte)
  app.put('/profil/avatar', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaAvatar.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravan avatarId.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza
      .update(igraci)
      .set({ avatarId: rezultat.data.avatarId })
      .where(eq(igraci.id, igrac.id));
    return { ok: true, avatarId: rezultat.data.avatarId };
  });

  app.put('/profil/nadimak', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaNadimak.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Ime mora imati 2-20 znakova.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza
      .update(igraci)
      .set({ nadimak: rezultat.data.nadimak })
      .where(eq(igraci.id, igrac.id));
    return { ok: true, nadimak: rezultat.data.nadimak };
  });

  app.put('/profil/email', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaEmail.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (!igrac.lozinkaHash || !(await argonVerify(igrac.lozinkaHash, rezultat.data.lozinka))) {
      return odgovor.code(401).send({ ok: false, greska: 'Pogre\u0161na lozinka.' });
    }
    const [postojeci] = await baza
      .select()
      .from(igraci)
      .where(eq(igraci.email, rezultat.data.noviEmail))
      .limit(1);
    if (postojeci && postojeci.id !== igrac.id) {
      return odgovor
        .code(409)
        .send({ ok: false, greska: 'Ta email adresa je ve\u0107 registrirana.' });
    }
    await baza
      .update(igraci)
      .set({ email: rezultat.data.noviEmail, emailPotvrdjen: false })
      .where(eq(igraci.id, igrac.id));
    const tokenPotvrde = izdajTokenPotvrdeEmaila(igrac.id);
    const poveznica = new URL(
      `/potvrda-emaila?token=${tokenPotvrde}`,
      konfiguracija.JAVNA_ADRESA,
    ).toString();
    await posaljiEmail(app.log, rezultat.data.noviEmail, porukaPotvrdeEmaila(poveznica, true));
    return { ok: true };
  });

  app.put('/profil/lozinka', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaLozinka.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (
      !igrac.lozinkaHash ||
      !(await argonVerify(igrac.lozinkaHash, rezultat.data.trenutnaLozinka))
    ) {
      return odgovor.code(401).send({ ok: false, greska: 'Pogre\u0161na trenutna lozinka.' });
    }
    const lozinkaHash = await argonHash(rezultat.data.novaLozinka);
    await baza.update(igraci).set({ lozinkaHash }).where(eq(igraci.id, igrac.id));
    return { ok: true };
  });

  app.get<{ Querystring: { limit?: string; mod?: string } }>(
    '/ljestvica',
    { preHandler: pokusajIdentifikaciju },
    async (zahtjev) => {
      const rezultatLimita = ShemaLimit.safeParse(zahtjev.query);
      const limit = rezultatLimita.success ? (rezultatLimita.data.limit ?? 10) : 10;
      const je1v1 = zahtjev.query.mod === 'dva_igraca' || zahtjev.query.mod === '1v1';

      const colOdigrane = je1v1 ? igraci.odigrane1v1 : igraci.odigrane;
      const colBodovi = je1v1 ? igraci.bodovi1v1 : igraci.bodoviUkupno;

      const kandidati = await baza
        .select()
        .from(igraci)
        .where(gte(colOdigrane, 10))
        .orderBy(desc(sql`${colBodovi}::float / ${colOdigrane}`))
        .limit(limit);

      const ljestvica = kandidati.map((igrac, indeks) => {
        const odig = je1v1 ? igrac.odigrane1v1 : igrac.odigrane;
        const bod = je1v1 ? igrac.bodovi1v1 : igrac.bodoviUkupno;
        const pobj = je1v1 ? igrac.pobjede1v1 : igrac.pobjede;
        const prosjek = prosjekBodova(bod, odig);

        return {
          mjesto: indeks + 1,
          igracId: igrac.id,
          jeJavan: igrac.vrsta !== 'gost',
          nadimak: igrac.nadimak,
          rang: izracunajRang(odig, prosjek),
          prosjekBodova: prosjek,
          odigrane: odig,
          postotakPobjeda: odig > 0 ? (pobj / odig) * 100 : 0,
        };
      });

      let mojeMjesto: (typeof ljestvica)[number] | null = null;
      const igrac = (zahtjev as ZahtjevSIgracem).igrac;
      if (igrac) {
        const odigMoj = je1v1 ? igrac.odigrane1v1 : igrac.odigrane;
        const bodMoj = je1v1 ? igrac.bodovi1v1 : igrac.bodoviUkupno;
        const pobjMoj = je1v1 ? igrac.pobjede1v1 : igrac.pobjede;

        if (odigMoj >= 10) {
          const prosjekMoj = prosjekBodova(bodMoj, odigMoj);
          const [redakBoljih] = await baza
            .select({ boljihOdMene: sql<number>`count(*)::int` })
            .from(igraci)
            .where(
              sql`${colOdigrane} >= 10 and ${colBodovi}::float / ${colOdigrane} > ${prosjekMoj}`,
            );
          mojeMjesto = {
            mjesto: (redakBoljih?.boljihOdMene ?? 0) + 1,
            igracId: igrac.id,
            jeJavan: igrac.vrsta !== 'gost',
            nadimak: igrac.nadimak,
            rang: izracunajRang(odigMoj, prosjekMoj),
            prosjekBodova: prosjekMoj,
            odigrane: odigMoj,
            postotakPobjeda: (pobjMoj / odigMoj) * 100,
          };
        }
      }

      return { ok: true, ljestvica, mojeMjesto };
    },
  );

  app.get<{ Querystring: { limit?: string } }>('/rijeci/top', async (zahtjev) => {
    const rezultatLimita = ShemaLimit.safeParse(zahtjev.query);
    const limit = rezultatLimita.success ? (rezultatLimita.data.limit ?? 10) : 10;

    const [redakUkupno] = await baza
      .select({ ukupnoPartija: sql<number>`count(*)::int` })
      .from(partije);
    const ukupnoPartija = redakUkupno?.ukupnoPartija ?? 0;

    const retci = await baza
      .select({
        rijec: potezi.rijec,
        brojUpotreba: sql<number>`count(*)::int`,
        brojPartija: sql<number>`count(distinct ${potezi.partijaId})::int`,
      })
      .from(potezi)
      .where(sql`${potezi.vrsta} = 'rijec' and ${potezi.rijec} is not null`)
      .groupBy(potezi.rijec)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return {
      ok: true,
      rijeci: retci.map((redak, indeks) => ({
        mjesto: indeks + 1,
        rijec: redak.rijec,
        brojUpotreba: redak.brojUpotreba,
        postotakPartija: ukupnoPartija > 0 ? (redak.brojPartija / ukupnoPartija) * 100 : 0,
      })),
    };
  });

  app.get<{ Params: { igracId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/povijest/:igracId',
    async (zahtjev) => {
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '10', 10) || 10, 1), 50);
      const offset = Math.max(parseInt(zahtjev.query.offset ?? '0', 10) || 0, 0);

      const retci = await baza
        .select({
          partijaId: sudioniciPartije.partijaId,
          plasman: sudioniciPartije.plasman,
          bodovi: sudioniciPartije.bodovi,
          eliminacije: sudioniciPartije.eliminacije,
          nacinIspadanja: sudioniciPartije.nacinIspadanja,
          pocetak: partije.pocetak,
          kraj: partije.kraj,
        })
        .from(sudioniciPartije)
        .innerJoin(partije, eq(partije.id, sudioniciPartije.partijaId))
        .where(eq(sudioniciPartije.igracId, zahtjev.params.igracId))
        .orderBy(desc(partije.pocetak))
        .limit(limit)
        .offset(offset);

      return { ok: true, partije: retci };
    },
  );

  app.get<{ Params: { partijaId: string } }>('/partije/:partijaId/potezi', async (zahtjev) => {
    const retci = await baza
      .select()
      .from(potezi)
      .where(eq(potezi.partijaId, zahtjev.params.partijaId))
      .orderBy(potezi.redniBroj);

    return { ok: true, potezi: retci };
  });
}
