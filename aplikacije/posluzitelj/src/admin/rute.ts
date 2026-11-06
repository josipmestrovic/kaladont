/**
 * Fastify admin rute - prijave grešaka i administracija rječnika (zamjenjuje privremeni
 * ADMIN_TAJNI_KLJUC iz Faze 4.5 pravom sesijskom provjerom, vidi racuni/autentikacija.ts).
 */
import type { FastifyInstance } from 'fastify';
import { desc, eq, and, isNotNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { SVE_VRSTE_RIJECI, type PregledNadzora } from 'zajednicko';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import { dodajRijec, deaktivirajRijec, vratiRijec, NevaljanaRijecError } from '../rjecnik/administracija.js';
import { igraci, prijave, prijaveIgraca, rijeci, izmjeneRjecnika } from '../baza/shema.js';
import { baza } from '../baza/klijent.js';
import { zahtijevajAdmina, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { dovrsiTop10NakonBrisanja } from '../racuni/brisanje.js';
import { potvrdiIspravakRjecnika, potvrdiUklanjanjeRacuna } from '../dostignuca/potvrde-prijava.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import { izracunajStatistikuCekanja } from './statistika-cekanja.js';
import { ShemaKonfiguracijeBota, type KonfiguracijaBota } from '../bot/konfiguracija-bota.js';
import { SukobRevizijeBotova, type ZapisPostavkiBotova } from '../bot/trajne-postavke.js';
import {
  agregirajPocetneRijeci,
  danasZagrebIso,
  dohvatiIncidentPoId,
  listajRaneIncidente,
  rasponOdDoZagreb,
  type KontekstOtvaranjaAnalitike,
} from '../analitika/otvaranja.js';
import { agregirajDnevneIgre } from '../analitika/igre.js';
import { dohvatiStatusAnalitike } from '../analitika/status.js';

/** Živi brojači iz memorije procesa; nisu trajni i vrijede od zadnjeg pokretanja. */
export interface ZivoStanjeBotova {
  fond: { ukupno: number; slobodni: number; rezervirani: number; uPartiji: number; iscrpljenja: number };
  bot: { planirano: number; odigranihRijeci: number; namjernihPropusta: number; bezRijeci: number; zastarjelo: number; tehnickeGreske: number; dobrovoljniKa: number; prisilniKa: number; propustPrimljenogKa: number };
  trening: { aktivni: number; zapoceti: number; odbijeni: number; neuspjeli: number };
  zastavice: { trening: boolean; botoviDvoboj: boolean; botoviCetveroboj: boolean };
}

async function uskladiRjecnikNakonUbaci(rjecnik: RjecnikUMemoriji, rijecUlaz: string): Promise<void> {
  const rijec = rijecUlaz.normalize('NFC').trim().toLowerCase();
  const [redak] = await baza
    .select({
      rijec: rijeci.rijec,
      prvaDva: rijeci.prvaDva,
      vrste: rijeci.vrste,
      grupe: rijeci.grupe,
      frekvencija: rijeci.frekvencija,
      aktivna: rijeci.aktivna,
    })
    .from(rijeci)
    .where(eq(rijeci.rijec, rijec))
    .limit(1);
  if (!redak || !redak.aktivna) {
    rjecnik.primijeniUklanjanje(rijec);
    return;
  }
  rjecnik.primijeniUbaci({
    rijec: redak.rijec,
    prvaDva: redak.prvaDva,
    vrste: redak.vrste as typeof SVE_VRSTE_RIJECI[number][],
    grupe: redak.grupe,
    frekvencija: redak.frekvencija,
  });
}

const ShemaRijec = z.object({ rijec: z.string().min(2), razlog: z.string().min(1) });
const ShemaDodajRijec = ShemaRijec.extend({
  vrsta: z.enum(SVE_VRSTE_RIJECI as [string, ...string[]]),
  lema: z.string().min(2).optional(),
});
const ShemaRijesiPrijavu = z.object({
  status: z.enum(['pregledana', 'rijesena']),
  napomenaAdmina: z.string().optional(),
});

export async function registrirajAdminRute(
  app: FastifyInstance,
  rjecnik: RjecnikUMemoriji,
  dohvatiZivoStanje: () => ZivoStanjeBotova | null = () => null,
  nadzor?: { pregled: () => PregledNadzora; probnaObavijest: () => Promise<boolean> },
  postavke?: { pregled: () => ZapisPostavkiBotova; zadano: KonfiguracijaBota; brziRazvojDopusten: boolean; pregledBotova?: () => unknown; promijeniAktivacijuBota?: (igracId: string, aktivan: boolean, adminId: string) => Promise<{ aktivan: boolean; dovrsavaIgru: boolean } | null>; stvoriBotove?: (broj: number, tip: 'imenovani' | 'gost', adminId: string) => Promise<{ stvoreno: { igracId: string; kljucSeeda: string; nadimak: string; tip: 'imenovani' | 'gost' }[]; postojalo: number; aktivnoPrije: number; aktivnoPoslije: number }>; spremi: (konfiguracija: KonfiguracijaBota, revizija: number, adminId: string) => Promise<ZapisPostavkiBotova> },
): Promise<void> {
  app.post('/admin/botovi', { preHandler: zahtijevajAdmina, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!postavke?.stvoriBotove) return odgovor.code(503).send({ ok: false, greska: 'Stvaranje botova nije dostupno.' });
    const ulaz = z.object({ broj: z.number().int().min(1).max(30), tip: z.enum(['imenovani', 'gost']) }).strict().safeParse(zahtjev.body);
    if (!ulaz.success) return odgovor.code(400).send({ ok: false, greska: 'Odaberi 1–30 botova i tip imenovani ili gost.' });
    try {
      const rezultat = await postavke.stvoriBotove(ulaz.data.broj, ulaz.data.tip, (zahtjev as ZahtjevSIgracem).igrac!.id);
      return { ok: true, ...rezultat };
    } catch (pogreska) {
      if (pogreska instanceof Error && /Fond može imati najviše|Nema slobodnog nadimka/.test(pogreska.message)) return odgovor.code(409).send({ ok: false, greska: pogreska.message });
      throw pogreska;
    }
  });
  app.put<{ Params: { igracId: string } }>('/admin/botovi/:igracId/aktivacija', { preHandler: zahtijevajAdmina, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!postavke?.promijeniAktivacijuBota) return odgovor.code(503).send({ ok: false, greska: 'Upravljanje botovima nije dostupno.' });
    const ulaz = z.object({ aktivan: z.boolean() }).strict().safeParse(zahtjev.body);
    if (!z.string().uuid().safeParse(zahtjev.params.igracId).success || !ulaz.success) return odgovor.code(400).send({ ok: false, greska: 'Nevaljani podaci aktivacije bota.' });
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    let rezultat: { aktivan: boolean; dovrsavaIgru: boolean } | null;
    try { rezultat = await postavke.promijeniAktivacijuBota(zahtjev.params.igracId, ulaz.data.aktivan, admin.id); }
    catch (pogreska) {
      if (pogreska instanceof Error && pogreska.message.startsWith('Fond je dosegnuo limit')) return odgovor.code(409).send({ ok: false, greska: pogreska.message });
      throw pogreska;
    }
    if (!rezultat) return odgovor.code(404).send({ ok: false, greska: 'Bot nije pronađen.' });
    return { ok: true, ...rezultat };
  });
  app.get('/admin/botovi/pregled', { preHandler: zahtijevajAdmina }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!postavke?.pregledBotova) return odgovor.code(503).send({ ok: false, greska: 'Pregled botova nije dostupan.' });
    return postavke.pregledBotova();
  });
  app.get('/admin/botovi/postavke', { preHandler: zahtijevajAdmina }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!postavke) return odgovor.code(503).send({ ok: false, greska: 'Postavke botova nisu dostupne.' });
    return { ok: true, ...postavke.pregled(), zadano: postavke.zadano, brziRazvojDopusten: postavke.brziRazvojDopusten };
  });
  app.put('/admin/botovi/postavke', { preHandler: zahtijevajAdmina, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!postavke) return odgovor.code(503).send({ ok: false, greska: 'Postavke botova nisu dostupne.' });
    const podaci = z.object({ revizija: z.number().int().min(0).max(1_999_999_999), konfiguracija: ShemaKonfiguracijeBota }).strict().safeParse(zahtjev.body);
    if (!podaci.success) return odgovor.code(400).send({ ok: false, greska: 'Nevaljane postavke botova.', polja: podaci.error.issues.map((stavka) => ({ putanja: stavka.path.join('.'), poruka: stavka.message })) });
    if (podaci.data.konfiguracija.brziRazvoj && !postavke.brziRazvojDopusten) return odgovor.code(400).send({ ok: false, greska: 'Brzi razvoj dopušten je samo u razvojnom okruženju.' });
    try {
      const zapis = await postavke.spremi(podaci.data.konfiguracija, podaci.data.revizija, (zahtjev as ZahtjevSIgracem).igrac!.id);
      return { ok: true, ...zapis };
    } catch (greska) {
      if (greska instanceof SukobRevizijeBotova) return odgovor.code(409).send({ ok: false, greska: greska.message });
      if (greska instanceof Error && greska.message.startsWith('Aktivni fond')) return odgovor.code(400).send({ ok: false, greska: greska.message });
      throw greska;
    }
  });
  app.get('/admin/statistike/posluzitelj', { preHandler: zahtijevajAdmina }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!nadzor) return odgovor.code(503).send({ ok: false, greska: 'Nadzor nije dostupan.' });
    return nadzor.pregled();
  });
  app.post('/admin/nadzor/probna-obavijest', { preHandler: zahtijevajAdmina, config: { rateLimit: { max: 1, timeWindow: '1 minute' } } }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    if (!nadzor || !nadzor.pregled().emailOmogucen) return odgovor.code(409).send({ ok: false, greska: 'Email alarmi nisu uključeni.' });
    try {
      const prihvaceno = await nadzor.probnaObavijest();
      if (!prihvaceno) return odgovor.code(502).send({ ok: false, greska: 'Mail servis nije prihvatio obavijest.' });
      return { ok: true, poruka: 'Mail servis je prihvatio obavijest. Provjeri inbox.' };
    } catch {
      return odgovor.code(429).send({ ok: false, greska: 'Pričekaj minutu prije ponovnog slanja.' });
    }
  });
  app.get<{ Querystring: { dani?: string } }>(
    '/admin/statistike/cekanje',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const dani = Number(zahtjev.query.dani ?? 7);
      if (!Number.isInteger(dani) || dani < 1 || dani > 90) {
        return odgovor.code(400).send({ ok: false, greska: 'Razdoblje mora biti od 1 do 90 dana.' });
      }
      const statistika = await izracunajStatistikuCekanja(dani);
      return { ok: true, ...statistika, zivo: dohvatiZivoStanje() };
    },
  );

  app.get<{ Querystring: { status?: string; tip?: string } }>(
    '/admin/prijave',
    { preHandler: zahtijevajAdmina },
    async (zahtjev) => {
      const status = (zahtjev.query.status as 'nova' | 'pregledana' | 'rijesena' | undefined) ?? 'nova';
      const tip = zahtjev.query.tip as 'za_brisanje' | 'za_dodavanje' | undefined;
      const uvjeti = [eq(prijave.status, status)];
      if (tip === 'za_brisanje' || tip === 'za_dodavanje') uvjeti.push(eq(prijave.tip, tip));
      const retci = await baza
        .select({
          id: prijave.id,
          tip: prijave.tip,
          rijec: prijave.rijec,
          status: prijave.status,
          vrijeme: prijave.vrijeme,
          partijaId: prijave.partijaId,
        })
        .from(prijave)
        .where(and(...uvjeti))
        .orderBy(desc(prijave.vrijeme))
        .limit(200);
      return { ok: true, prijave: retci };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave/:id/rijesi',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const rezultat = ShemaRijesiPrijavu.safeParse(zahtjev.body);
      if (!rezultat.success) {
        return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
      }
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      await baza
        .update(prijave)
        .set({
          status: rezultat.data.status,
          napomenaAdmina: rezultat.data.napomenaAdmina ?? null,
          rijesioId: admin.id,
        })
        .where(eq(prijave.id, Number(zahtjev.params.id)));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave/:id/dismiss',
    { preHandler: zahtijevajAdmina },
    async (zahtjev) => {
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      await baza
        .update(prijave)
        .set({ status: 'rijesena', napomenaAdmina: 'dismiss', rijesioId: admin.id })
        .where(eq(prijave.id, Number(zahtjev.params.id)));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave/:id/obrisi-rijec',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      const rezultat = await potvrdiIspravakRjecnika({
        prijavaId: Number(zahtjev.params.id),
        adminId: admin.id,
        smjer: 'deaktiviraj',
      });
      if (!rezultat.ok) return odgovor.code(rezultat.status).send({ ok: false, greska: rezultat.greska });
      rjecnik.primijeniUklanjanje(rezultat.rijec);
      for (const stavka of rezultat.obavijesti) emitirajNovostiDostignuca(stavka.igracId, stavka.obavijesti);
      return { ok: true, brojRijeci: rjecnik.brojRijeci() };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave/:id/dodaj-rijec',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      const rezultat = await potvrdiIspravakRjecnika({
        prijavaId: Number(zahtjev.params.id),
        adminId: admin.id,
        smjer: 'dodaj',
      });
      if (!rezultat.ok) return odgovor.code(rezultat.status).send({ ok: false, greska: rezultat.greska });
      await uskladiRjecnikNakonUbaci(rjecnik, rezultat.rijec);
      for (const stavka of rezultat.obavijesti) emitirajNovostiDostignuca(stavka.igracId, stavka.obavijesti);
      return { ok: true, brojRijeci: rjecnik.brojRijeci() };
    },
  );

  app.get<{ Querystring: { status?: string } }>('/admin/prijave-igraca', { preHandler: zahtijevajAdmina }, async (zahtjev) => {
    const status = (zahtjev.query.status as 'nova' | 'pregledana' | 'rijesena' | undefined) ?? 'nova';
    const prijavljeni = alias(igraci, 'prijavljeni_igrac');
    const retci = await baza
      .select({
        id: prijaveIgraca.id,
        partijaId: prijaveIgraca.partijaId,
        prijavljeniIgracId: prijaveIgraca.prijavljeniIgracId,
        nadimak: prijavljeni.nadimak,
        razlog: prijaveIgraca.razlog,
        status: prijaveIgraca.status,
        vrijeme: prijaveIgraca.vrijeme,
      })
      .from(prijaveIgraca)
      .innerJoin(prijavljeni, eq(prijaveIgraca.prijavljeniIgracId, prijavljeni.id))
      .where(eq(prijaveIgraca.status, status))
      .orderBy(desc(prijaveIgraca.vrijeme))
      .limit(200);
    return { ok: true, prijave: retci };
  });

  app.post<{ Params: { id: string } }>(
    '/admin/prijave-igraca/:id/rijesi',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const rezultat = ShemaRijesiPrijavu.safeParse(zahtjev.body);
      if (!rezultat.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      await baza.update(prijaveIgraca).set({
        status: rezultat.data.status,
        napomenaAdmina: rezultat.data.napomenaAdmina ?? null,
        rijesioId: admin.id,
      }).where(eq(prijaveIgraca.id, Number(zahtjev.params.id)));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave-igraca/:id/dismiss',
    { preHandler: zahtijevajAdmina },
    async (zahtjev) => {
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      await baza.update(prijaveIgraca).set({
        status: 'rijesena',
        napomenaAdmina: 'dismiss',
        rijesioId: admin.id,
      }).where(eq(prijaveIgraca.id, Number(zahtjev.params.id)));
      return { ok: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/admin/prijave-igraca/:id/obrisi-racun',
    { preHandler: zahtijevajAdmina },
    async (zahtjev, odgovor) => {
      const admin = (zahtjev as ZahtjevSIgracem).igrac!;
      const rezultat = await potvrdiUklanjanjeRacuna({
        prijavaId: Number(zahtjev.params.id),
        adminId: admin.id,
      });
      if (!rezultat.ok) return odgovor.code(rezultat.status).send({ ok: false, greska: rezultat.greska });
      if (rezultat.osvjeziLjestvicu) await dovrsiTop10NakonBrisanja();
      for (const stavka of rezultat.obavijesti) emitirajNovostiDostignuca(stavka.igracId, stavka.obavijesti);
      return { ok: true, ishod: rezultat.ishod };
    },
  );

  app.post('/admin/rjecnik/dodaj', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const rezultat = ShemaDodajRijec.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor
        .code(400)
        .send({ ok: false, greska: 'Polja "rijec", "razlog" i "vrsta" su obavezna ("lema" opcionalna).' });
    }
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    try {
      await dodajRijec(
        rezultat.data.rijec,
        rezultat.data.razlog,
        admin.id,
        rezultat.data.vrsta as (typeof SVE_VRSTE_RIJECI)[number],
        rezultat.data.lema,
      );
      await uskladiRjecnikNakonUbaci(rjecnik, rezultat.data.rijec);
      return { ok: true, brojRijeci: rjecnik.brojRijeci() };
    } catch (greska) {
      if (greska instanceof NevaljanaRijecError) {
        return odgovor.code(400).send({ ok: false, greska: greska.message });
      }
      throw greska;
    }
  });

  app.post('/admin/rjecnik/deaktiviraj', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const rezultat = ShemaRijec.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Polja "rijec" i "razlog" su obavezna.' });
    }
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    await deaktivirajRijec(rezultat.data.rijec, rezultat.data.razlog, admin.id);
    rjecnik.primijeniUklanjanje(rezultat.data.rijec);
    return { ok: true, brojRijeci: rjecnik.brojRijeci() };
  });

  app.post('/admin/rjecnik/vrati', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const rezultat = ShemaRijec.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Polja "rijec" i "razlog" su obavezna.' });
    }
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    await vratiRijec(rezultat.data.rijec, rezultat.data.razlog, admin.id);
    await uskladiRjecnikNakonUbaci(rjecnik, rezultat.data.rijec);
    return { ok: true, brojRijeci: rjecnik.brojRijeci() };
  });

  app.get('/admin/rjecnik/rucno-dodano', { preHandler: zahtijevajAdmina }, async () => {
    const retci = await baza
      .select()
      .from(izmjeneRjecnika)
      .where(isNotNull(izmjeneRjecnika.adminId))
      .orderBy(desc(izmjeneRjecnika.vrijeme))
      .limit(500);
    return { ok: true, izmjene: retci };
  });

  app.get<{ Params: { rijec: string } }>(
    '/admin/rjecnik/rijec/:rijec',
    { preHandler: zahtijevajAdmina },
    async (zahtjev) => {
      const trazena = zahtjev.params.rijec.toLowerCase();
      const [word] = await baza.select().from(rijeci).where(eq(rijeci.rijec, trazena)).limit(1);
      if (!word) {
        return { ok: true, rijec: null, nastavci: [], prethodnici: [], izmjene: [] };
      }

      const [nastavci, prethodnici, izmjene] = await Promise.all([
        baza
          .select()
          .from(rijeci)
          .where(and(eq(rijeci.prvaDva, word.zadnjaDva), eq(rijeci.aktivna, true)))
          .limit(20),
        baza
          .select()
          .from(rijeci)
          .where(and(eq(rijeci.zadnjaDva, word.prvaDva), eq(rijeci.aktivna, true)))
          .limit(20),
        baza
          .select()
          .from(izmjeneRjecnika)
          .where(eq(izmjeneRjecnika.rijec, trazena))
          .orderBy(desc(izmjeneRjecnika.vrijeme))
          .limit(50),
      ]);

      return { ok: true, rijec: word, nastavci, prethodnici, izmjene };
    },
  );

  const ShemaFilteraAnalitike = z.object({
    od: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    do: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    kontekst: z.enum(['javna', 'privatna', 'trening']).optional(),
    stranica: z.coerce.number().int().min(1).max(1000).optional(),
  });

  function parsirajFilterAnalitike(query: unknown):
    | { ok: true; od: string; do: string; kontekst?: KontekstOtvaranjaAnalitike; stranica: number; raspon: { od: Date; do: Date } }
    | { ok: false; greska: string } {
    const parsed = ShemaFilteraAnalitike.safeParse(query);
    if (!parsed.success) return { ok: false, greska: 'Neispravni filteri analitike.' };
    const danas = danasZagrebIso();
    const doDan = parsed.data.do ?? danas;
    const odDan = parsed.data.od ?? (() => {
      const bazaDatuma = new Date(`${doDan}T12:00:00.000Z`);
      bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() - 6);
      return bazaDatuma.toISOString().slice(0, 10);
    })();
    if (odDan > doDan) return { ok: false, greska: 'Datum od ne smije biti nakon datuma do.' };
    const raspon = rasponOdDoZagreb(odDan, doDan);
    const rasponDana = Math.round((raspon.do.getTime() - raspon.od.getTime()) / 86_400_000);
    if (rasponDana > 90) return { ok: false, greska: 'Raspon smije biti najviše 90 dana.' };
    return {
      ok: true,
      od: odDan,
      do: doDan,
      kontekst: parsed.data.kontekst,
      stranica: parsed.data.stranica ?? 1,
      raspon,
    };
  }

  app.get('/admin/analitika/pocetne-rijeci', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    const filter = parsirajFilterAnalitike(zahtjev.query);
    if (!filter.ok) return odgovor.code(400).send({ ok: false, greska: filter.greska });
    const agregat = await agregirajPocetneRijeci({
      od: filter.raspon.od,
      do: filter.raspon.do,
      kontekst: filter.kontekst,
    });
    return {
      ok: true,
      od: filter.od,
      do: filter.do,
      kontekst: filter.kontekst ?? null,
      posjecenost: 'Posjećenost još nije uključena',
      ...agregat,
    };
  });

  app.get('/admin/analitika/incidenti', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    const filter = parsirajFilterAnalitike(zahtjev.query);
    if (!filter.ok) return odgovor.code(400).send({ ok: false, greska: filter.greska });
    const lista = await listajRaneIncidente({
      od: filter.raspon.od,
      do: filter.raspon.do,
      kontekst: filter.kontekst,
      stranica: filter.stranica,
      poStranici: 50,
    });
    return { ok: true, od: filter.od, do: filter.do, kontekst: filter.kontekst ?? null, ...lista };
  });

  app.get<{ Params: { id: string } }>('/admin/analitika/incidenti/:id', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    const id = z.string().uuid().safeParse(zahtjev.params.id);
    if (!id.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan ID incidenta.' });
    const incident = await dohvatiIncidentPoId(id.data);
    if (!incident) return odgovor.code(404).send({ ok: false, greska: 'Incident nije pronađen.' });
    return { ok: true, incident };
  });

  app.get('/admin/analitika/dnevno', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    const filter = parsirajFilterAnalitike(zahtjev.query);
    if (!filter.ok) return odgovor.code(400).send({ ok: false, greska: filter.greska });
    const dnevno = await agregirajDnevneIgre({
      odDan: filter.od,
      doDan: filter.do,
      kontekst: filter.kontekst,
    });
    return {
      ok: true,
      od: filter.od,
      do: filter.do,
      kontekst: filter.kontekst ?? null,
      ...dnevno,
    };
  });

  app.get('/admin/analitika/status', { preHandler: zahtijevajAdmina }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'no-store');
    const status = await dohvatiStatusAnalitike();
    return { ok: true, ...status };
  });
}
