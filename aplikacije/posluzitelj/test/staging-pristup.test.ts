import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { izgradiPosluzitelj } from '../src/server.js';
import {
  NAZIV_STAGING_PRISTUP_KOLACICA,
  izdajCookieVrijednost,
  procitajCookieIzZaglavlja,
  sifraTočna,
  valjanCookie,
} from '../src/sigurnost/staging-pristup.js';

describe('staging pristup tokeni', () => {
  it('izdaje i validira HMAC cookie', () => {
    const vrijednost = izdajCookieVrijednost(1_700_000_000_000);
    expect(valjanCookie(vrijednost, 1_700_000_000_000)).toBe(true);
    expect(valjanCookie(vrijednost, 1_700_000_000_000 + 15 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(valjanCookie(`${vrijednost}x`, 1_700_000_000_000)).toBe(false);
    expect(valjanCookie(undefined)).toBe(false);
  });

  it('uspoređuje šifru timing-safe', () => {
    expect(sifraTočna('tajna', 'tajna')).toBe(true);
    expect(sifraTočna('tajna', 'krivo')).toBe(false);
    expect(sifraTočna('kratko', 'duze-vrijednosti')).toBe(false);
  });

  it('čita cookie iz Cookie zaglavlja', () => {
    const vrijednost = izdajCookieVrijednost();
    const zaglavlje = `drugo=1; ${NAZIV_STAGING_PRISTUP_KOLACICA}=${encodeURIComponent(vrijednost)}; x=y`;
    expect(procitajCookieIzZaglavlja(zaglavlje)).toBe(vrijednost);
    expect(procitajCookieIzZaglavlja('a=b')).toBeUndefined();
  });
});

describe('staging pristup HTTP i Socket.IO gate', () => {
  let app: FastifyInstance;
  let zaustavi: () => Promise<void>;
  let adresa: string;
  const sifra = 'test-staging-sifra';

  beforeAll(async () => {
    ({ app, zaustavi } = await izgradiPosluzitelj({
      okruzenjeSigurnosti: 'staging',
      stagingPristup: { aktivan: true, sifra },
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      authRateLimit: { omogucen: false },
    }));
    await app.listen({ port: 0, host: '127.0.0.1' });
    const adresaServera = app.server.address();
    const port = typeof adresaServera === 'object' && adresaServera ? adresaServera.port : 0;
    adresa = `http://127.0.0.1:${port}`;
  }, 120_000);

  afterAll(async () => {
    await zaustavi();
  });

  it('propušta /zdravlje bez cookieja', async () => {
    const odgovor = await app.inject({ method: 'GET', url: '/zdravlje' });
    expect(odgovor.statusCode).toBe(200);
    expect(odgovor.json()).toMatchObject({ ok: expect.any(Boolean) });
  });

  it('preusmjerava HTML dokumente na /pristup', async () => {
    const odgovor = await app.inject({
      method: 'GET',
      url: '/',
      headers: { accept: 'text/html' },
    });
    expect(odgovor.statusCode).toBe(302);
    expect(odgovor.headers.location).toMatch(/^\/pristup\?next=/);
  });

  it('vraća 401 za API bez cookieja', async () => {
    const odgovor = await app.inject({ method: 'GET', url: '/api/profil' });
    expect(odgovor.statusCode).toBe(401);
    expect(odgovor.json()).toEqual({ ok: false, greska: 'Staging zahtijeva pristupnu šifru.' });
  });

  it('prikazuje formu i otključava točnom šifrom', async () => {
    const forma = await app.inject({ method: 'GET', url: '/pristup' });
    expect(forma.statusCode).toBe(200);
    expect(forma.headers['content-type']).toContain('text/html');
    expect(forma.body).toContain('Staging pristup');

    const krivo = await app.inject({
      method: 'POST',
      url: '/pristup',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'sifra=krivo&next=%2F',
    });
    expect(krivo.statusCode).toBe(401);
    expect(krivo.body).toContain('Šifra nije točna');

    const tocno = await app.inject({
      method: 'POST',
      url: '/pristup',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `sifra=${encodeURIComponent(sifra)}&next=%2Fapi%2Frjecnik%2Fstatistika`,
    });
    expect(tocno.statusCode).toBe(302);
    expect(tocno.headers.location).toBe('/api/rjecnik/statistika');
    const setCookie = tocno.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieRedci = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
    const cookieRed = cookieRedci.find((red) => red.includes(NAZIV_STAGING_PRISTUP_KOLACICA));
    expect(cookieRed).toBeTruthy();
    const cookieVrijednost = cookieRed!.match(new RegExp(`${NAZIV_STAGING_PRISTUP_KOLACICA}=([^;]+)`))?.[1];
    expect(cookieVrijednost).toBeTruthy();
    expect(valjanCookie(decodeURIComponent(cookieVrijednost!))).toBe(true);

    const otkljucano = await app.inject({
      method: 'GET',
      url: '/api/rjecnik/statistika',
      headers: { cookie: `${NAZIV_STAGING_PRISTUP_KOLACICA}=${cookieVrijednost}` },
    });
    expect(otkljucano.statusCode).toBe(200);
    expect(otkljucano.json()).not.toMatchObject({ greska: 'Staging zahtijeva pristupnu šifru.' });
  });

  it('odbija Socket.IO bez cookieja i prima s cookiejem', async () => {
    await expect(spojiSe(adresa)).rejects.toThrow();

    const cookie = izdajCookieVrijednost();
    const socket = await spojiSe(adresa, cookie);
    try {
      expect(socket.connected).toBe(true);
    } finally {
      socket.disconnect();
    }
  });
});

function spojiSe(adresaSocketa: string, cookie?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresaSocketa, {
      auth: { token: `gost.${randomUUID().replaceAll('-', '')}` },
      extraHeaders: cookie ? { cookie: `${NAZIV_STAGING_PRISTUP_KOLACICA}=${cookie}` } : {},
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      timeout: 2_000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (greska) => {
      socket.disconnect();
      reject(greska);
    });
  });
}
