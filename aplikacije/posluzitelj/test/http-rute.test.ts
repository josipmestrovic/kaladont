import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
});

afterAll(async () => {
  await app.close();
});

describe('HTTP API namespace', () => {
  it('poznate poslovne rute postoje pod /api i vraćaju JSON', async () => {
    const rijec = encodeURIComponent('baba');
    const rute: Array<{ method: 'GET' | 'POST' | 'PUT'; url: string }> = [
      { method: 'POST', url: '/api/racuni/registracija' },
      { method: 'POST', url: '/api/racuni/gost-sesija' },
      { method: 'POST', url: '/api/racuni/prijava' },
      { method: 'POST', url: '/api/racuni/odjava' },
      { method: 'GET', url: '/api/racuni/potvrdi-email' },
      { method: 'POST', url: '/api/racuni/potvrdi-email' },
      { method: 'POST', url: '/api/racuni/zaboravljena-lozinka' },
      { method: 'POST', url: '/api/racuni/resetiraj-lozinku' },
      { method: 'GET', url: '/api/dostignuca' },
      { method: 'GET', url: '/api/profil' },
      { method: 'GET', url: `/api/profil/javni/${randomUUID()}` },
      { method: 'PUT', url: '/api/profil/avatar' },
      { method: 'PUT', url: '/api/profil/nadimak' },
      { method: 'PUT', url: '/api/profil/email' },
      { method: 'PUT', url: '/api/profil/lozinka' },
      { method: 'GET', url: '/api/ljestvica' },
      { method: 'GET', url: '/api/rijeci/top' },
      { method: 'GET', url: `/api/povijest/${randomUUID()}` },
      { method: 'GET', url: `/api/partije/${randomUUID()}/potezi` },
      { method: 'GET', url: '/api/admin/prijave' },
      { method: 'POST', url: '/api/admin/prijave/1/rijesi' },
      { method: 'POST', url: '/api/admin/rjecnik/dodaj' },
      { method: 'POST', url: '/api/admin/rjecnik/deaktiviraj' },
      { method: 'POST', url: '/api/admin/rjecnik/vrati' },
      { method: 'GET', url: '/api/admin/rjecnik/rucno-dodano' },
      { method: 'GET', url: `/api/admin/rjecnik/rijec/${rijec}` },
      { method: 'POST', url: '/api/prijave' },
      { method: 'GET', url: '/api/rjecnik/statistika' },
    ];

    for (const ruta of rute) {
      const odgovor = await app.inject({ method: ruta.method, url: ruta.url });
      const poznataRutaBezResursa = ruta.url.startsWith('/api/profil/javni/');
      if (!poznataRutaBezResursa) expect(odgovor.statusCode, ruta.url).not.toBe(404);
      if (ruta.method === 'GET' && ruta.url === '/api/racuni/potvrdi-email') {
        expect(odgovor.statusCode, ruta.url).toBe(302);
      } else {
        expect(odgovor.headers['content-type'], ruta.url).toContain('application/json');
      }
    }
  });

  it('nepoznate API putanje ne završavaju u SvelteKit handleru', async () => {
    for (const zahtjev of [
      { method: 'GET' as const, url: '/api' },
      { method: 'GET' as const, url: '/api/' },
      { method: 'GET' as const, url: '/api/ne-postoji?x=1' },
      { method: 'POST' as const, url: '/api/ne-postoji' },
      { method: 'PUT' as const, url: '/api/ne-postoji' },
    ]) {
      const odgovor = await app.inject({ ...zahtjev, headers: { accept: 'text/html' } });
      expect(odgovor.statusCode, zahtjev.url).toBe(404);
      expect(odgovor.json()).toEqual({ ok: false, greska: 'API ruta ne postoji.' });
    }
  });

  it('stari GET link potvrde emaila ostaje redirect, ali stari JSON endpointi ne postoje', async () => {
    const stari = await app.inject({ method: 'GET', url: '/racuni/potvrdi-email?token=test' });
    expect(stari.statusCode).toBe(302);
    expect(stari.headers.location).toContain('/potvrda-emaila?token=test');

    const stariProfil = await app.inject({ method: 'GET', url: '/profil' });
    expect(stariProfil.statusCode).toBe(404);
  });

  it('health vraća 503 i razlog kada baza nije dostupna', async () => {
    const originalExecute = baza.execute;
    baza.execute = (async () => {
      throw new Error('simulirani pad baze');
    }) as typeof baza.execute;
    try {
      const odgovor = await app.inject({ method: 'GET', url: '/zdravlje' });
      expect(odgovor.statusCode).toBe(503);
      expect(odgovor.json()).toEqual(expect.objectContaining({ ok: false, baza: 'nedostupna' }));
    } finally {
      baza.execute = originalExecute;
    }
  });
});