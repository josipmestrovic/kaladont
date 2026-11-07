import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TIP_SANDUCIC_TEST } from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import {
  dohvatiJednu,
  dohvatiListu,
  dohvatiSazetak,
  oznaciProcitane,
  oznaciSveProcitane,
  potvrdiNajavu,
  stvoriPoruku,
} from './servis.js';

const ShemaIds = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
}).strict();

const ShemaProcitanoSve = z.object({
  doAt: z.string().datetime({ offset: true }).optional(),
}).strict();

const ShemaTest = z.object({
  tip: z.string().min(1).max(64).optional(),
  tekst: z.string().max(500).optional(),
  deduplikacijskiKljuc: z.string().min(1).max(200).optional(),
}).strict();

export async function registrirajSanducicRute(app: FastifyInstance): Promise<void> {
  app.get('/sanducic/sazetak', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const sazetak = await dohvatiSazetak(igrac.id);
    return { ok: true, ...sazetak };
  });

  app.get('/sanducic', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const query = zahtjev.query as { filter?: string; cursor?: string; limit?: string };
    const lista = await dohvatiListu(igrac.id, {
      samoNeprocitane: query.filter === 'neprocitane',
      cursor: query.cursor ?? null,
      limit: query.limit ? Number(query.limit) : undefined,
    });
    return { ok: true, ...lista };
  });

  app.get<{ Params: { id: string } }>('/sanducic/:id', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const id = z.string().uuid().safeParse(zahtjev.params.id);
    if (!id.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan ID.' });
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const poruka = await dohvatiJednu(igrac.id, id.data);
    if (!poruka) return odgovor.code(404).send({ ok: false, greska: 'Poruka nije pronađena.' });
    return { ok: true, poruka };
  });

  app.post('/sanducic/procitano', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const tijelo = ShemaIds.safeParse(zahtjev.body);
    if (!tijelo.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan popis poruka.' });
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const procitane = await oznaciProcitane(igrac.id, tijelo.data.ids);
    return { ok: true, procitane };
  });

  app.post('/sanducic/procitano-sve', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const tijelo = ShemaProcitanoSve.safeParse(zahtjev.body ?? {});
    if (!tijelo.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan zahtjev.' });
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const doAt = tijelo.data.doAt ? new Date(tijelo.data.doAt) : new Date();
    const broj = await oznaciSveProcitane(igrac.id, doAt);
    return { ok: true, broj };
  });

  app.post('/sanducic/najavi', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const tijelo = ShemaIds.safeParse(zahtjev.body);
    if (!tijelo.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan popis poruka.' });
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const najavljene = await potvrdiNajavu(igrac.id, tijelo.data.ids);
    return { ok: true, najavljene };
  });

  // Samo lokalni razvoj — omogućuje ručno testiranje UI-ja bez produkcijskih okidača.
  if (konfiguracija.NODE_ENV === 'development') {
    app.post('/sanducic/test', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
      odgovor.header('Cache-Control', 'private, no-store');
      const tijelo = ShemaTest.safeParse(zahtjev.body ?? {});
      if (!tijelo.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan zahtjev.' });
      const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
      const tip = tijelo.data.tip ?? TIP_SANDUCIC_TEST;
      const kljuc = tijelo.data.deduplikacijskiKljuc ?? `test:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const poruka = await stvoriPoruku({
        igracId: igrac.id,
        tip,
        deduplikacijskiKljuc: kljuc,
        podaci: tijelo.data.tekst ? { tekst: tijelo.data.tekst } : {},
        izvorTip: 'test',
      });
      if (!poruka) return odgovor.code(409).send({ ok: false, greska: 'Poruka s tim ključem već postoji.' });
      return { ok: true, id: poruka.id };
    });
  }
}
