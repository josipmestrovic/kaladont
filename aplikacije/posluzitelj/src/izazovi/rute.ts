import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { konfiguracija } from '../konfiguracija.js';
import { zahtijevajAdmina, zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { dohvatiPokusajPoId, izgradiOdgovorKataloga } from './pohrana.js';

function izazovOmogucen(): boolean {
  return konfiguracija.IZAZOV_OMOGUCEN === 'true';
}

export async function registrirajIzazoviRute(app: FastifyInstance): Promise<void> {
  app.get('/izazovi', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    return izgradiOdgovorKataloga(igrac.id, izazovOmogucen());
  });

  app.get('/izazovi/pokusaji/:id', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const id = z.string().uuid().safeParse((zahtjev.params as { id?: string }).id);
    if (!id.success) {
      return odgovor.code(400).send({ ok: false, kod: 'NEVALJAN_ZAHTJEV', greska: 'Neispravan ID pokušaja.' });
    }
    const pokusaj = await dohvatiPokusajPoId(id.data);
    if (!pokusaj) {
      return odgovor.code(404).send({ ok: false, kod: 'NIJE_PRONADENO', greska: 'Pokušaj nije pronađen.' });
    }
    const jeAdmin = igrac.vrsta === 'admin';
    if (pokusaj.igracId !== igrac.id && !jeAdmin) {
      return odgovor.code(403).send({ ok: false, kod: 'ZABRANJENO', greska: 'Nemate pristup ovom pokušaju.' });
    }
    const metrics = (pokusaj.metrics ?? {}) as {
      goalProgress?: unknown;
      dugeRijeci?: number;
      rijetkeRijeci?: number;
      uspjesniDokazi?: number;
      imaPravuPogresku?: boolean;
    };
    return {
      ok: true,
      pokusaj: {
        attemptId: pokusaj.id,
        challengeId: pokusaj.challengeId,
        status: pokusaj.status,
        reason: pokusaj.reason,
        partijaId: pokusaj.partijaId,
        startedAt: pokusaj.startedAt.toISOString(),
        terminalAt: pokusaj.terminalAt?.toISOString() ?? null,
        resultsVisibleAt: pokusaj.resultsVisibleAt?.toISOString() ?? null,
        gameWon: pokusaj.gameWon,
        metrics: pokusaj.metrics,
        goalProgress: metrics.goalProgress ?? null,
        snapshot: pokusaj.snapshot,
        settlementState: pokusaj.settlementState,
        accountTypeAtStart: pokusaj.accountTypeAtStart,
        definitionVersion: pokusaj.definitionVersion,
      },
    };
  });

  // Admin-only smoke za flag (opcionalno; ne izlaže tuđi napredak).
  app.get('/admin/izazovi/status', { preHandler: zahtijevajAdmina }, async (_zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    return { ok: true, omogucen: izazovOmogucen() };
  });
}
