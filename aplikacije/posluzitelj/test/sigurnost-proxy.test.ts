import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { jeDopustenOrigin, jePouzdaniProxy, stvoriCorsOrigin } from '../src/sigurnost/origin.js';

function provjeriCors(okruzenje: 'development' | 'test' | 'staging' | 'production', origin?: string, javnaAdresaOrigin?: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    stvoriCorsOrigin(okruzenje, javnaAdresaOrigin)(origin, (greska, dopusten) => {
      if (greska) reject(greska);
      else resolve(dopusten);
    });
  });
}

describe('CORS i trusted proxy', () => {
  it('dopušta samo lokalne origin-e u razvoju i testu', async () => {
    await expect(provjeriCors('development', 'http://localhost:5173')).resolves.toBe(true);
    await expect(provjeriCors('test', 'http://127.0.0.1:5174')).resolves.toBe(true);
    await expect(provjeriCors('development', 'https://nepoznata.example')).resolves.toBe(false);
  });

  it('dopušta samo canonical same-origin na stagingu i produkciji', async () => {
    expect(jeDopustenOrigin('staging', 'https://staging.kaladont.hr', 'https://staging.kaladont.hr')).toBe(true);
    expect(jeDopustenOrigin('production', 'https://kaladont.hr', 'https://kaladont.hr')).toBe(true);
    expect(jeDopustenOrigin('production', 'https://www.kaladont.hr', 'https://www.kaladont.hr')).toBe(true);
    expect(jeDopustenOrigin('staging', 'https://tudja.example', 'https://staging.kaladont.hr')).toBe(false);
    expect(jeDopustenOrigin('staging', 'http://staging.kaladont.hr', 'https://staging.kaladont.hr')).toBe(false);
    expect(jeDopustenOrigin('staging', undefined, 'https://staging.kaladont.hr')).toBe(true);
    await expect(provjeriCors('staging', 'https://staging.kaladont.hr', 'https://staging.kaladont.hr')).resolves.toBe(true);
  });

  it('vjeruje proxy zaglavljima samo iza Caddyja', async () => {
    const staging = Fastify({ trustProxy: jePouzdaniProxy('staging') });
    const razvoj = Fastify({ trustProxy: jePouzdaniProxy('development') });
    for (const app of [staging, razvoj]) {
      app.get('/proxy', (zahtjev) => ({ ip: zahtjev.ip, protokol: zahtjev.protocol }));
    }

    const zaglavlja = { 'x-forwarded-for': '203.0.113.10', 'x-forwarded-proto': 'https' };
    const stagingOdgovor = await staging.inject({ method: 'GET', url: '/proxy', headers: zaglavlja });
    const razvojOdgovor = await razvoj.inject({ method: 'GET', url: '/proxy', headers: zaglavlja });

    expect(stagingOdgovor.json()).toEqual({ ip: '203.0.113.10', protokol: 'https' });
    expect(razvojOdgovor.json()).not.toEqual({ ip: '203.0.113.10', protokol: 'https' });
    await staging.close();
    await razvoj.close();
  });
});