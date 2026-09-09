/**
 * Fastify ruta za prijave grešaka (odrzavanje-rjecnika.md).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { baza } from '../baza/klijent.js';
import { igraci, prijave } from '../baza/shema.js';
import { posaljiEmail } from '../email.js';
import { konfiguracija } from '../konfiguracija.js';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { eq } from 'drizzle-orm';

const ShemaPrijave = z.object({
  partijaId: z.string().uuid(),
  potezId: z.number().int().positive().optional(),
  poruka: z.string().min(1).max(1000),
});

export async function registrirajPrijaveRute(app: FastifyInstance): Promise<void> {
  app.post('/prijave', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijave.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;

    const [nova] = await baza
      .insert(prijave)
      .values({
        partijaId: rezultat.data.partijaId,
        potezId: rezultat.data.potezId ?? null,
        igracId: igrac.id,
        poruka: rezultat.data.poruka,
      })
      .returning();

    const [prviAdmin] = await baza.select().from(igraci).where(eq(igraci.vrsta, 'admin')).limit(1);
    const primatelj = konfiguracija.DEV_MAIL || prviAdmin?.email || 'dev@example.com';
    await posaljiEmail(app.log, primatelj, `Nova prijava #${nova?.id} od ${igrac.nadimak}: ${rezultat.data.poruka}`);

    return {
      ok: true,
      poruka: 'Hvala! Pregledat ćemo prijavu — ovako nam pomažeš da igra bude bolja.',
    };
  });
}
