import { describe, expect, it } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { pokusajPoslatiEmail } from '../src/email.js';
import { konfiguracija } from '../src/konfiguracija.js';

const dnevnik = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as unknown as FastifyBaseLogger;

describe('email adapter', () => {
  it('provider failure ne propagira grešku best-effort pozivatelju', async () => {
    const stariKljuc = konfiguracija.EMAIL_API_KLJUC;
    const stariFetch = globalThis.fetch;
    konfiguracija.EMAIL_API_KLJUC = 'test-provider-key';
    globalThis.fetch = async () => new Response('provider failure', { status: 503 });
    try {
      const uspjeh = await pokusajPoslatiEmail(
        dnevnik,
        'test@example.com',
        'test poruka',
        'test-provider-failure',
      );
      expect(uspjeh).toBe(false);
    } finally {
      konfiguracija.EMAIL_API_KLJUC = stariKljuc;
      globalThis.fetch = stariFetch;
    }
  });
});