/**
 * Javne rute rječnika — statistika za naslovnicu (ADR-013, ekrani.md).
 */
import type { FastifyInstance } from 'fastify';
import type { StatistikaRjecnika } from 'zajednicko';
import type { RjecnikUMemoriji } from './ucitaj.js';

export async function registrirajRjecnikRute(app: FastifyInstance, rjecnik: RjecnikUMemoriji): Promise<void> {
  app.get('/rjecnik/statistika', async (): Promise<StatistikaRjecnika> => {
    return {
      ukupno: rjecnik.brojRijeci(),
      kategorije: rjecnik.brojPoKategoriji(),
    };
  });
}
