/**
 * Fastify ruta za prijave grešaka (odrzavanje-rjecnika.md).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { baza } from '../baza/klijent.js';
import { igraci, partije, potezi, prijave, sudioniciPartije } from '../baza/shema.js';
import { pokusajPoslatiEmail } from '../email.js';
import { konfiguracija } from '../konfiguracija.js';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';

const ShemaPrijave = z.object({
  partijaId: z.string().uuid(),
  potezId: z.number().int().positive(),
  poruka: z.string().trim().max(1000).optional(),
});

class GreskaPrijave extends Error {
  constructor(public readonly status: 404 | 403 | 409 | 429, poruka: string) {
    super(poruka);
  }
}

export async function registrirajPrijaveRute(app: FastifyInstance): Promise<void> {
  app.post('/prijave', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijave.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;

    let nova: typeof prijave.$inferSelect;
    try {
      const umetnute = await baza.transaction(async (tx) => {
        const [partija] = await tx
          .select({ id: partije.id })
          .from(partije)
          .where(and(eq(partije.id, rezultat.data.partijaId), eq(partije.status, 'zavrsena')))
          .limit(1);
        if (!partija) throw new GreskaPrijave(404, 'Partija ne postoji ili još nije završena.');

        const [potez] = await tx
          .select({ id: potezi.id })
          .from(potezi)
          .where(
            and(
              eq(potezi.id, rezultat.data.potezId),
              eq(potezi.partijaId, rezultat.data.partijaId),
              inArray(potezi.vrsta, ['rijec', 'sustav_rijec']),
              isNotNull(potezi.rijec),
            ),
          )
          .limit(1);
        if (!potez) throw new GreskaPrijave(404, 'Riječ ne pripada navedenoj partiji.');

        const [sudionik] = await tx
          .select({ igracId: sudioniciPartije.igracId })
          .from(sudioniciPartije)
          .where(and(eq(sudioniciPartije.partijaId, rezultat.data.partijaId), eq(sudioniciPartije.igracId, igrac.id)))
          .for('update')
          .limit(1);
        if (!sudionik) throw new GreskaPrijave(403, 'Samo sudionici partije mogu prijaviti riječ.');

        const [duplikat] = await tx
          .select({ id: prijave.id })
          .from(prijave)
          .where(and(eq(prijave.partijaId, rezultat.data.partijaId), eq(prijave.potezId, rezultat.data.potezId), eq(prijave.igracId, igrac.id)))
          .limit(1);
        if (duplikat) throw new GreskaPrijave(409, 'Ovu si riječ već prijavio/la.');

        const [redakBrojaca] = await tx
          .select({ ukupno: count() })
          .from(prijave)
          .where(and(eq(prijave.partijaId, rezultat.data.partijaId), eq(prijave.igracId, igrac.id)));
        if (Number(redakBrojaca?.ukupno ?? 0) >= 3) throw new GreskaPrijave(429, 'Dosegnut je limit od 3 prijave po partiji.');

        return tx
          .insert(prijave)
          .values({
            partijaId: rezultat.data.partijaId,
            potezId: rezultat.data.potezId,
            igracId: igrac.id,
            poruka: rezultat.data.poruka || 'Riječ prijavljena na provjeru.',
          })
          .returning();
      });
          const spremljena = umetnute[0];
          if (!spremljena) throw new Error('Prijava nije spremljena.');
          nova = spremljena;
    } catch (greska) {
      if (greska instanceof GreskaPrijave) {
        return odgovor.code(greska.status).send({ ok: false, greska: greska.message });
      }
      throw greska;
    }

    const [prviAdmin] = await baza.select().from(igraci).where(eq(igraci.vrsta, 'admin')).limit(1);
    const primatelj = konfiguracija.DEV_MAIL || prviAdmin?.email || 'dev@example.com';
    void pokusajPoslatiEmail(app.log, primatelj, `Nova prijava #${nova.id} od ${igrac.nadimak}: ${nova.poruka}`, `prijava:${nova.id}`);

    return {
      ok: true,
      poruka: 'Hvala! Pregledat ćemo prijavu — ovako nam pomažeš da igra bude bolja.',
    };
  });
}
