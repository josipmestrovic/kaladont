import { createHmac, timingSafeEqual } from 'node:crypto';
import querystring from 'node:querystring';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { konfiguracija } from '../konfiguracija.js';
import { dohvatiIpKlijenta, jeDopustenaTestnaIp } from './socket-ogranicenja.js';
import type { Okruzenje } from './origin.js';

export const NAZIV_STAGING_PRISTUP_KOLACICA = 'kaladont_staging_pristup';
export const TRAJANJE_STAGING_PRISTUPA_MS = 14 * 24 * 60 * 60 * 1000;
const PREFIKS_TOKENA = 'staging-pristup';

export interface PostavkeStagingPristupa {
  aktivan: boolean;
  sifra: string;
  okruzenje: Okruzenje;
}

export function postavkeStagingPristupa(
  okruzenje: Okruzenje,
  override?: Partial<Pick<PostavkeStagingPristupa, 'aktivan' | 'sifra'>>,
): PostavkeStagingPristupa {
  const sifra = override?.sifra ?? konfiguracija.STAGING_PRISTUP_SIFRA;
  const aktivan = override?.aktivan ?? (okruzenje === 'staging' && sifra.length > 0);
  return { aktivan, sifra, okruzenje };
}

function potpisi(sadrzaj: string): string {
  return createHmac('sha256', konfiguracija.SESIJA_TAJNA).update(sadrzaj).digest('base64url');
}

export function izdajCookieVrijednost(sada = Date.now()): string {
  const istekMs = sada + TRAJANJE_STAGING_PRISTUPA_MS;
  const sadrzaj = `${PREFIKS_TOKENA}.ok.${istekMs}`;
  return `${sadrzaj}.${potpisi(sadrzaj)}`;
}

export function valjanCookie(vrijednost: string | undefined, sada = Date.now()): boolean {
  if (!vrijednost) return false;
  const dijelovi = vrijednost.split('.');
  if (dijelovi.length !== 4) return false;
  const [svrha, oznaka, istekStr, potpis] = dijelovi;
  if (svrha !== PREFIKS_TOKENA || oznaka !== 'ok' || !istekStr || !potpis) return false;
  if (!/^\d+$/.test(istekStr) || sada > Number(istekStr)) return false;
  const ocekivani = potpisi(`${svrha}.${oznaka}.${istekStr}`);
  const a = Buffer.from(potpis);
  const b = Buffer.from(ocekivani);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sifraTočna(unesena: string, ocekivana: string): boolean {
  const a = Buffer.from(unesena);
  const b = Buffer.from(ocekivana);
  if (a.length !== b.length) {
    // Ista duljina usporedbe radi otpora timing napadu na duljinu: usporedi sa samom sobom.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function procitajCookieIzZaglavlja(
  cookieZaglavlje: string | string[] | undefined,
  ime = NAZIV_STAGING_PRISTUP_KOLACICA,
): string | undefined {
  const sirovo = Array.isArray(cookieZaglavlje) ? cookieZaglavlje.join(';') : cookieZaglavlje;
  if (!sirovo) return undefined;
  for (const dio of sirovo.split(';')) {
    const odvoji = dio.trim().indexOf('=');
    if (odvoji <= 0) continue;
    const kljuc = dio.trim().slice(0, odvoji);
    if (kljuc !== ime) continue;
    try {
      return decodeURIComponent(dio.trim().slice(odvoji + 1));
    } catch {
      return dio.trim().slice(odvoji + 1);
    }
  }
  return undefined;
}

export function imaValjanPristupCookie(
  cookieZaglavlje: string | string[] | undefined,
  sada = Date.now(),
): boolean {
  return valjanCookie(procitajCookieIzZaglavlja(cookieZaglavlje), sada);
}

function putanjaZahtjeva(zahtjev: FastifyRequest): string {
  return (zahtjev.url ?? '/').split('?', 1)[0] || '/';
}

function jeIzuzeće(putanja: string): boolean {
  return putanja === '/zdravlje' || putanja === '/pristup';
}

function siguranNext(kandidat: unknown): string {
  if (typeof kandidat !== 'string' || !kandidat.startsWith('/') || kandidat.startsWith('//')) {
    return '/';
  }
  if (kandidat.startsWith('/pristup')) return '/';
  return kandidat;
}

function htmlPristupa(greska: string | null, next: string): string {
  const poruka = greska
    ? `<p style="color:#b00020;margin:0 0 1rem">${escapeHtml(greska)}</p>`
    : '';
  return `<!doctype html>
<html lang="hr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Staging pristup — Kaladont</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: Georgia, "Times New Roman", serif; background: #f3efe6; color: #1c1a16; }
    main { width: min(22rem, calc(100% - 2rem)); padding: 1.5rem; }
    h1 { font-size: 1.4rem; margin: 0 0 .5rem; }
    p { margin: 0 0 1rem; line-height: 1.4; }
    label { display: block; font-size: .9rem; margin-bottom: .35rem; }
    input[type=password] { width: 100%; box-sizing: border-box; padding: .65rem .75rem;
      border: 1px solid #8a8170; border-radius: .35rem; font: inherit; background: #fffdf8; }
    button { margin-top: 1rem; width: 100%; padding: .7rem 1rem; border: 0; border-radius: .35rem;
      background: #1c1a16; color: #fffdf8; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Staging pristup</h1>
    <p>Unesi šifru da otvoriš testno okruženje.</p>
    ${poruka}
    <form method="post" action="/pristup">
      <input type="hidden" name="next" value="${escapeHtml(next)}">
      <label for="sifra">Šifra</label>
      <input id="sifra" name="sifra" type="password" autocomplete="current-password" required autofocus>
      <button type="submit">Otvori</button>
    </form>
  </main>
</body>
</html>`;
}

function escapeHtml(tekst: string): string {
  return tekst
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function postaviPristupniKolacic(odgovor: FastifyReply, okruzenje: Okruzenje): void {
  odgovor.setCookie(NAZIV_STAGING_PRISTUP_KOLACICA, izdajCookieVrijednost(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: okruzenje === 'staging' || okruzenje === 'production',
    maxAge: TRAJANJE_STAGING_PRISTUPA_MS / 1000,
    path: '/',
  });
}

export function registrirajStagingPristup(
  app: FastifyInstance,
  postavke: PostavkeStagingPristupa,
): void {
  if (!postavke.aktivan) return;

  if (!app.hasContentTypeParser('application/x-www-form-urlencoded')) {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_zahtjev, tijelo, gotovo) => {
        try {
          gotovo(null, querystring.parse(String(tijelo)));
        } catch (greska) {
          gotovo(greska as Error, undefined);
        }
      },
    );
  }

  app.addHook('onRequest', async (zahtjev, odgovor) => {
    const putanja = putanjaZahtjeva(zahtjev);
    if (jeIzuzeće(putanja)) return;

    const ip = dohvatiIpKlijenta(
      postavke.okruzenje,
      zahtjev.headers['x-kaladont-ip-klijenta'],
      zahtjev.headers['x-forwarded-for'],
      zahtjev.socket.remoteAddress,
    );
    if (jeDopustenaTestnaIp(postavke.okruzenje, konfiguracija.STAGING_TEST_IP, ip)) return;
    if (imaValjanPristupCookie(zahtjev.headers.cookie)) return;

    const prihvat = zahtjev.headers.accept;
    const traziHtml = typeof prihvat === 'string' && prihvat.includes('text/html');
    if (traziHtml && (zahtjev.method === 'GET' || zahtjev.method === 'HEAD')) {
      const next = encodeURIComponent(siguranNext(zahtjev.url));
      return odgovor.redirect(`/pristup?next=${next}`, 302);
    }

    return odgovor.code(401).send({ ok: false, greska: 'Staging zahtijeva pristupnu šifru.' });
  });

  app.get('/pristup', { config: { rateLimit: false } }, async (zahtjev, odgovor) => {
    if (imaValjanPristupCookie(zahtjev.headers.cookie)) {
      return odgovor.redirect(siguranNext((zahtjev.query as { next?: string }).next), 302);
    }
    const next = siguranNext((zahtjev.query as { next?: string }).next);
    return odgovor.type('text/html; charset=utf-8').send(htmlPristupa(null, next));
  });

  app.post('/pristup', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
      },
    },
  }, async (zahtjev, odgovor) => {
    const tijelo = (zahtjev.body ?? {}) as { sifra?: string; next?: string };
    const next = siguranNext(tijelo.next ?? (zahtjev.query as { next?: string }).next);
    const unesena = typeof tijelo.sifra === 'string' ? tijelo.sifra : '';
    if (!sifraTočna(unesena, postavke.sifra)) {
      return odgovor
        .code(401)
        .type('text/html; charset=utf-8')
        .send(htmlPristupa('Šifra nije točna.', next));
    }
    postaviPristupniKolacic(odgovor, postavke.okruzenje);
    return odgovor.redirect(next, 302);
  });
}
