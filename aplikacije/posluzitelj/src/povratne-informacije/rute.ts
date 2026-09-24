import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { dohvatiDefinicijuDostignuca, izracunajNovaDostignuca } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { dostignucaIgraca, igraci, napredakDostignucaIgraca, povratneInformacije } from '../baza/shema.js';
import { zahtijevajAdmina, zahtijevajPrijavu, type ZahtjevSIgracem } from '../racuni/autentikacija.js';

const ShemaOcjena = z.object({
  pravila: z.number().int().min(1).max(5),
  rjecnik: z.number().int().min(1).max(5),
  vrijemePoteza: z.number().int().min(1).max(5),
  snalazenjeUAplikaciji: z.number().int().min(1).max(5),
  brzinaUcitavanja: z.number().int().min(1).max(5),
  gamifikacija: z.number().int().min(1).max(5),
}).strict();

const ShemaSlanja = z.object({
  poruka: z.string().trim().min(20, 'Prekratka poruka.').max(2000),
  ocjene: ShemaOcjena.optional(),
}).strict();

const ShemaStatusa = z.object({ status: z.enum(['pregledana', 'arhivirana']) }).strict();

function prazniNapredak() {
  return {
    rijetkeLeksemskeGrupe: 0,
    dugeRijeci: 0,
    najduziStreak: 0,
    kaladontIzvedbe: 0,
    kaladontZrtve: 0,
    izazvaneEliminacije: 0,
    mrtvaSlovaEliminacije: 0,
    javnePobjede: 0,
    povratneInformacije: 0,
  };
}

export async function registrirajPovratneInformacijeRute(app: FastifyInstance): Promise<void> {
  app.get('/povratne-informacije/stanje', { preHandler: zahtijevajPrijavu }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const [napredak] = await baza
      .select({ anketaIspunjena: napredakDostignucaIgraca.anketaIspunjena, broj: napredakDostignucaIgraca.povratneInformacije })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igrac.id));
    return { ok: true, anketaIspunjena: napredak?.anketaIspunjena ?? false, brojPoslanih: napredak?.broj ?? 0 };
  });

  app.post('/povratne-informacije', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaSlanja.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: rezultat.error.issues[0]?.message ?? 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;

    const ishod = await baza.transaction(async (tx) => {
      await tx.insert(napredakDostignucaIgraca).values({ igracId: igrac.id }).onConflictDoNothing();
      const [prije] = await tx
        .select()
        .from(napredakDostignucaIgraca)
        .where(eq(napredakDostignucaIgraca.igracId, igrac.id))
        .for('update');
      if (!prije) throw new Error('Napredak igrača nije dostupan.');
      if (prije.anketaIspunjena && rezultat.data.ocjene) {
        return { greska: 'Detaljnu anketu možeš poslati samo jednom.' };
      }

      const ocjene = rezultat.data.ocjene;
      const [povratnaInformacija] = await tx
        .insert(povratneInformacije)
        .values({ igracId: igrac.id, poruka: rezultat.data.poruka, ...ocjene })
        .returning({ id: povratneInformacije.id });
      const delta = { povratneInformacije: 1 };
      const [nakon] = await tx
        .update(napredakDostignucaIgraca)
        .set({
          povratneInformacije: sql`${napredakDostignucaIgraca.povratneInformacije} + 1`,
          anketaIspunjena: true,
          azurirano: new Date(),
        })
        .where(eq(napredakDostignucaIgraca.igracId, igrac.id))
        .returning();
      const definicija = dohvatiDefinicijuDostignuca('glas_zajednice')!;
      const novaDostignuca = izracunajNovaDostignuca(
        { ...prazniNapredak(), povratneInformacije: prije.povratneInformacije },
        delta,
        0,
        false,
      );
      if (novaDostignuca.length > 0) {
        await tx.insert(dostignucaIgraca).values(novaDostignuca.map((dostignuce) => ({
          igracId: igrac.id,
          dostignuceId: dostignuce.id,
          razina: dostignuce.novaRazina,
          prvoOtkljucano: new Date(),
          zadnjeOtkljucavanje: new Date(),
        }))).onConflictDoUpdate({
          target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
          set: { razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`, zadnjeOtkljucavanje: new Date() },
        });
      }
      return {
        id: povratnaInformacija!.id,
        anketaIspunjena: nakon!.anketaIspunjena,
        brojPoslanih: nakon!.povratneInformacije,
        novaDostignuca: novaDostignuca.filter((dostignuce) => dostignuce.id === definicija.id),
      };
    });

    if ('greska' in ishod) return odgovor.code(409).send({ ok: false, greska: ishod.greska });
    return { ok: true, ...ishod };
  });

  app.get<{ Querystring: { status?: string } }>('/admin/povratne-informacije', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const status = zahtjev.query.status;
    if (status && !['nova', 'pregledana', 'arhivirana'].includes(status)) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravan status.' });
    }
    const retci = await baza
      .select({
        id: povratneInformacije.id,
        poruka: povratneInformacije.poruka,
        pravila: povratneInformacije.pravila,
        rjecnik: povratneInformacije.rjecnik,
        vrijemePoteza: povratneInformacije.vrijemePoteza,
        snalazenjeUAplikaciji: povratneInformacije.snalazenjeUAplikaciji,
        brzinaUcitavanja: povratneInformacije.brzinaUcitavanja,
        gamifikacija: povratneInformacije.gamifikacija,
        status: povratneInformacije.status,
        vrijeme: povratneInformacije.vrijeme,
        nadimak: igraci.nadimak,
        email: igraci.email,
      })
      .from(povratneInformacije)
      .innerJoin(igraci, eq(povratneInformacije.igracId, igraci.id))
      .where(status ? eq(povratneInformacije.status, status as 'nova' | 'pregledana' | 'arhivirana') : undefined)
      .orderBy(desc(povratneInformacije.vrijeme))
      .limit(200);
    return { ok: true, povratneInformacije: retci };
  });

  app.post<{ Params: { id: string } }>('/admin/povratne-informacije/:id/status', { preHandler: zahtijevajAdmina }, async (zahtjev, odgovor) => {
    const rezultat = ShemaStatusa.safeParse(zahtjev.body);
    const id = Number(zahtjev.params.id);
    if (!rezultat.success || !Number.isInteger(id) || id <= 0) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const admin = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza.update(povratneInformacije).set({
      status: rezultat.data.status,
      pregledaoId: admin.id,
      pregledano: new Date(),
    }).where(eq(povratneInformacije.id, id));
    return { ok: true };
  });
}
