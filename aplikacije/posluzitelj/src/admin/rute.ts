/**
 * Fastify admin rute - prijave grešaka i administracija rječnika (zamjenjuje privremeni
 * ADMIN_TAJNI_KLJUC iz Faze 4.5 pravom sesijskom provjerom, vidi racuni/autentikacija.ts).
 */
import type { FastifyInstance } from 'fastify';
import { desc, eq, and, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { SVE_VRSTE_RIJECI } from 'zajednicko';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import { dodajRijec, deaktivirajRijec, vratiRijec, NevaljanaRijecError } from '../rjecnik/administracija.js';
import { prijave, rijeci, izmjeneRjecnika } from '../baza/shema.js';
import { baza } from '../baza/klijent.js';
import { zahtijevajAdmina, type ZahtjevSIgracem } from '../racuni/autentikacija.js';

const ShemaRijec = z.object({ rijec: z.string().min(2), razlog: z.string().min(1) });
const ShemaDodajRijec = ShemaRijec.extend({
  vrsta: z.enum(SVE_VRSTE_RIJECI as [string, ...string[]]),
  lema: z.string().min(2).optional(),
});
const ShemaRijesiPrijavu = z.object({
  status: z.enum(['pregledana', 'rijesena']),
  napomenaAdmina: z.string().optional(),
});

export async function registrirajAdminRute(app: FastifyInstance, rjecnik: RjecnikUMemoriji): Promise<void> {
  app.get<{ Querystring: { status?: string } }>(
    '/admin/prijave',
    { preHandler: zahtijevajAdmina },
    async (zahtjev) => {
      const uvjet = zahtjev.query.status
        ? eq(prijave.status, zahtjev.query.status as 'nova' | 'pregledana' | 'rijesena')
        : undefined;
      const retci = await baza
        .select()
        .from(prijave)
        .where(uvjet)
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
      await rjecnik.ponovoUcitaj();
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
    await rjecnik.ponovoUcitaj();
    return { ok: true, brojRijeci: rjecnik.brojRijeci() };
  });

  app.post('/admin/rjecnik/vrati', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const rezultat = ShemaRijec.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Polja "rijec" i "razlog" su obavezna.' });
    }
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    await vratiRijec(rezultat.data.rijec, rezultat.data.razlog, admin.id);
    await rjecnik.ponovoUcitaj();
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
}
