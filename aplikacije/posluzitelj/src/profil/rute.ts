/**
 * Fastify rute za profil, ljestvicu i povijest partija (javno čitljivi agregati).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { izracunajRang } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { igraci, partije, potezi, sudioniciPartije } from '../baza/shema.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import { posaljiEmail } from '../email.js';
import { izdajTokenPotvrdeEmaila } from '../racuni/tokeni.js';
import {
  pokusajIdentifikaciju,
  zahtijevajIdentifikaciju,
  zahtijevajPrijavu,
  type ZahtjevSIgracem,
} from '../racuni/autentikacija.js';

const ShemaAvatar = z.object({ avatarId: z.number().int().min(0).max(BROJ_AVATARA - 1) });
const ShemaNadimak = z.object({ nadimak: z.string().trim().min(2).max(20) });
const ShemaLimit = z.object({ limit: z.coerce.number().int().refine((n) => n === 10 || n === 100, 'limit mora biti 10 ili 100').optional() });
const ShemaEmail = z.object({ noviEmail: z.string().email(), lozinka: z.string().min(1) });
const ShemaLozinka = z.object({ trenutnaLozinka: z.string().min(1), novaLozinka: z.string().min(8) });

function prosjekBodova(bodoviUkupno: number, odigrane: number): number {
  return odigrane > 0 ? bodoviUkupno / odigrane : 0;
}

export async function registrirajProfilRute(app: FastifyInstance): Promise<void> {
  app.get('/profil', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const prosjek = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
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
      prosjekBodova: prosjek,
      rang: izracunajRang(igrac.odigrane, prosjek),
      stvoren: igrac.stvoren,
    };
  });

  // Onboarding dopušta i gostima da odaberu avatar (jednokratno, prvi ulazak - dobrodoslica/+page.svelte)
  app.put('/profil/avatar', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaAvatar.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravan avatarId.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza.update(igraci).set({ avatarId: rezultat.data.avatarId }).where(eq(igraci.id, igrac.id));
    return { ok: true, avatarId: rezultat.data.avatarId };
  });

  app.put('/profil/nadimak', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaNadimak.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Ime mora imati 2-20 znakova.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza.update(igraci).set({ nadimak: rezultat.data.nadimak }).where(eq(igraci.id, igrac.id));
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
    const [postojeci] = await baza.select().from(igraci).where(eq(igraci.email, rezultat.data.noviEmail)).limit(1);
    if (postojeci && postojeci.id !== igrac.id) {
      return odgovor.code(409).send({ ok: false, greska: 'Ta email adresa je ve\u0107 registrirana.' });
    }
    await baza
      .update(igraci)
      .set({ email: rezultat.data.noviEmail, emailPotvrdjen: false })
      .where(eq(igraci.id, igrac.id));
    const tokenPotvrde = izdajTokenPotvrdeEmaila(igrac.id);
    await posaljiEmail(app.log, rezultat.data.noviEmail, `Potvrdi novi email: /racuni/potvrdi-email?token=${tokenPotvrde}`);
    return { ok: true };
  });

  app.put('/profil/lozinka', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaLozinka.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (!igrac.lozinkaHash || !(await argonVerify(igrac.lozinkaHash, rezultat.data.trenutnaLozinka))) {
      return odgovor.code(401).send({ ok: false, greska: 'Pogre\u0161na trenutna lozinka.' });
    }
    const lozinkaHash = await argonHash(rezultat.data.novaLozinka);
    await baza.update(igraci).set({ lozinkaHash }).where(eq(igraci.id, igrac.id));
    return { ok: true };
  });

  app.get<{ Querystring: { limit?: string } }>('/ljestvica', { preHandler: pokusajIdentifikaciju }, async (zahtjev) => {
    const rezultatLimita = ShemaLimit.safeParse(zahtjev.query);
    const limit = rezultatLimita.success ? (rezultatLimita.data.limit ?? 10) : 10;

    const kandidati = await baza
      .select()
      .from(igraci)
      .where(gte(igraci.odigrane, 10))
      .orderBy(desc(sql`${igraci.bodoviUkupno}::float / ${igraci.odigrane}`))
      .limit(limit);

    const ljestvica = kandidati.map((igrac, indeks) => {
      const prosjek = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
      return {
        mjesto: indeks + 1,
        nadimak: igrac.nadimak,
        rang: izracunajRang(igrac.odigrane, prosjek),
        prosjekBodova: prosjek,
        odigrane: igrac.odigrane,
        postotakPobjeda: igrac.odigrane > 0 ? (igrac.pobjede / igrac.odigrane) * 100 : 0,
      };
    });

    let mojeMjesto: (typeof ljestvica)[number] | null = null;
    const igrac = (zahtjev as ZahtjevSIgracem).igrac;
    if (igrac && igrac.odigrane >= 10) {
      const prosjekMoj = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
      const [redakBoljih] = await baza
        .select({ boljihOdMene: sql<number>`count(*)::int` })
        .from(igraci)
        .where(sql`${igraci.odigrane} >= 10 and ${igraci.bodoviUkupno}::float / ${igraci.odigrane} > ${prosjekMoj}`);
      mojeMjesto = {
        mjesto: (redakBoljih?.boljihOdMene ?? 0) + 1,
        nadimak: igrac.nadimak,
        rang: izracunajRang(igrac.odigrane, prosjekMoj),
        prosjekBodova: prosjekMoj,
        odigrane: igrac.odigrane,
        postotakPobjeda: (igrac.pobjede / igrac.odigrane) * 100,
      };
    }

    return { ok: true, ljestvica, mojeMjesto };
  });

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

  app.get<{ Params: { igracId: string } }>('/povijest/:igracId', async (zahtjev) => {
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
      .limit(50);

    return { ok: true, partije: retci };
  });

  app.get<{ Params: { partijaId: string } }>('/partije/:partijaId/potezi', async (zahtjev) => {
    const retci = await baza
      .select()
      .from(potezi)
      .where(eq(potezi.partijaId, zahtjev.params.partijaId))
      .orderBy(potezi.redniBroj);

    return { ok: true, potezi: retci };
  });
}
