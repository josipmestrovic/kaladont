import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { baza } from '../baza/klijent.js';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { izgradiStanjeMisijaDto, oznaciPregledMisija } from './dto.js';
import { dohvatiIshodMisija } from './obracun.js';
import { zamijeniMisiju } from './zamjena.js';

const ShemaPregleda = z.object({
  skupina: z.enum(['dnevna', 'tjedna']),
}).strict();

const ShemaZamjene = z.object({
  idempotencyKey: z.string().min(8).max(128),
}).strict();

const ShemaIshodaParams = z.object({
  kontekst: z.enum(['javna', 'trening']),
  izvorId: z.string().uuid(),
});

export async function registrirajMisijeRute(app: FastifyInstance): Promise<void> {
  app.get('/misije', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (igrac.vrsta === 'gost') {
      return odgovor.code(403).send({ ok: false, kod: 'REGISTRACIJA_POTREBNA', greska: 'Misije su dostupne registriranim igračima.' });
    }
    try {
      return await baza.transaction((tx) => izgradiStanjeMisijaDto(tx, igrac.id));
    } catch {
      return odgovor.code(503).send({ ok: false, kod: 'MISIJE_NEDOSTUPNE', greska: 'Misije trenutačno nisu dostupne.' });
    }
  });

  app.post('/misije/pregled', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (igrac.vrsta === 'gost') {
      return odgovor.code(403).send({ ok: false, kod: 'REGISTRACIJA_POTREBNA', greska: 'Misije su dostupne registriranim igračima.' });
    }
    const parsed = ShemaPregleda.safeParse(zahtjev.body);
    if (!parsed.success) {
      return odgovor.code(400).send({ ok: false, kod: 'NEVALJAN_ZAHTJEV', greska: 'Neispravan zahtjev.' });
    }
    try {
      return await baza.transaction((tx) => oznaciPregledMisija(tx, igrac.id, parsed.data.skupina));
    } catch {
      return odgovor.code(503).send({ ok: false, kod: 'MISIJE_NEDOSTUPNE', greska: 'Misije trenutačno nisu dostupne.' });
    }
  });

  app.post('/misije/:dodjelaId/zamijeni', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (igrac.vrsta === 'gost') {
      return odgovor.code(403).send({ ok: false, kod: 'REGISTRACIJA_POTREBNA', greska: 'Misije su dostupne registriranim igračima.' });
    }
    const dodjelaId = z.string().uuid().safeParse((zahtjev.params as { dodjelaId?: string }).dodjelaId);
    if (!dodjelaId.success) {
      return odgovor.code(400).send({ ok: false, kod: 'NEVALJAN_ZAHTJEV', greska: 'Neispravan ID misije.' });
    }
    const headerKey = typeof zahtjev.headers['idempotency-key'] === 'string'
      ? zahtjev.headers['idempotency-key']
      : undefined;
    const body = ShemaZamjene.safeParse(zahtjev.body ?? {});
    const idempotencyKey = headerKey ?? (body.success ? body.data.idempotencyKey : undefined);
    if (!idempotencyKey) {
      return odgovor.code(400).send({ ok: false, kod: 'NEVALJAN_ZAHTJEV', greska: 'Nedostaje idempotency key.' });
    }

    try {
      const rezultat = await baza.transaction((tx) => zamijeniMisiju(tx, igrac.id, dodjelaId.data, idempotencyKey));
      if (!rezultat.ok) {
        const status = rezultat.greska.kod === 'MISIJA_NIJE_PRONADENA' ? 404
          : rezultat.greska.kod === 'NEVALJAN_ZAHTJEV' ? 400
          : 409;
        return odgovor.code(status).send({ ok: false, kod: rezultat.greska.kod, greska: rezultat.greska.kod });
      }
      return rezultat.stanje;
    } catch {
      return odgovor.code(503).send({ ok: false, kod: 'MISIJE_NEDOSTUPNE', greska: 'Misije trenutačno nisu dostupne.' });
    }
  });

  app.get('/misije/ishod/:kontekst/:izvorId', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (igrac.vrsta === 'gost') {
      return odgovor.code(403).send({ ok: false, kod: 'REGISTRACIJA_POTREBNA', greska: 'Misije su dostupne registriranim igračima.' });
    }
    const params = ShemaIshodaParams.safeParse(zahtjev.params);
    if (!params.success) {
      return odgovor.code(400).send({ ok: false, kod: 'NEVALJAN_ZAHTJEV', greska: 'Neispravan zahtjev.' });
    }
    const ishod = await baza.transaction((tx) => dohvatiIshodMisija(tx, igrac.id, params.data.kontekst, params.data.izvorId));
    if (!ishod) {
      return odgovor.code(404).send({ ok: false, kod: 'MISIJA_NIJE_PRONADENA', greska: 'Ishod nije pronađen.' });
    }
    return { ok: true, ...ishod };
  });
}
