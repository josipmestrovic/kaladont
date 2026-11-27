import type { FastifyInstance } from 'fastify';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { izgradiNaslovnicaSazetak } from './servis.js';

export async function registrirajNaslovnicaRute(app: FastifyInstance): Promise<void> {
  app.get('/naslovnica/sazetak', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    odgovor.header('Cache-Control', 'private, no-store');
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    return izgradiNaslovnicaSazetak(igrac);
  });
}
