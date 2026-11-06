import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { zahtijevajPrijavu, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { dohvatiNepotvrdeneObavijesti, potvrdiObavijesti } from './obavijesti.js';

const ShemaPotvrde = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
}).strict();

export async function registrirajDostignucaRute(app: FastifyInstance): Promise<void> {
  app.get('/dostignuca/obavijesti', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const obavijesti = await dohvatiNepotvrdeneObavijesti(igrac.id);
    return { ok: true, obavijesti };
  });

  app.post('/dostignuca/obavijesti/potvrdi', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const tijelo = ShemaPotvrde.safeParse(zahtjev.body);
    if (!tijelo.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravan popis obavijesti.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const potvrdene = await potvrdiObavijesti(igrac.id, tijelo.data.ids);
    return { ok: true, potvrdene };
  });
}
