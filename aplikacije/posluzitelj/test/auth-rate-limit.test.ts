import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { izgradiPosluzitelj } from '../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj({
    okruzenjeSigurnosti: 'staging',
    authRateLimit: { omogucen: true, maxPokusaja: 10, vremenskiProzor: '1 minute' },
  }));
});

afterAll(async () => {
  await app.close();
});

async function prijaviSe(ip: string) {
  return app.inject({
    method: 'POST',
    url: '/api/racuni/prijava',
    headers: { 'x-forwarded-for': ip },
    payload: { email: 'ne-postoji@example.com', lozinka: 'pogresna-lozinka' },
  });
}

describe('auth rate limit', () => {
  it('ograničava pokušaje prijave po stvarnom klijentskom IP-u', async () => {
    for (let pokusaj = 0; pokusaj < 10; pokusaj += 1) {
      expect((await prijaviSe('203.0.113.10')).statusCode).toBe(401);
    }

    const ogranicen = await prijaviSe('203.0.113.10');
    expect(ogranicen.statusCode).toBe(429);
    expect(ogranicen.headers['retry-after']).toBeDefined();

    expect((await prijaviSe('203.0.113.11')).statusCode).toBe(401);
  });
});
