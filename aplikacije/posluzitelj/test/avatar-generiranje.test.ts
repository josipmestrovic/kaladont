import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ZADANI_AVATAR_CONFIG, kanonskiZapisAvatara, type AvatarConfigV1 } from 'zajednicko';
import { hashAvataraConfig } from '../src/avatar/hash.js';

process.env.BAZA_URL ??= 'postgresql://127.0.0.1:5432/kaladont_test';
process.env.SESIJA_TAJNA ??= 'tajna-test';

async function moduliAvatara() {
  const [{ osigurajGeneriraneAvatare }, { registrirajRuteGeneriranihAvatara }] = await Promise.all([
    import('../src/avatar/generator.js'),
    import('../src/avatar/rute.js'),
  ]);
  return { osigurajGeneriraneAvatare, registrirajRuteGeneriranihAvatara };
}

const dijelovi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/static/avatari/dijelovi');

function konfiguracijaObrnutihKljuceva(): AvatarConfigV1 {
  return {
    colors: Object.fromEntries(Object.entries(ZADANI_AVATAR_CONFIG.colors).reverse()),
    parts: Object.fromEntries(Object.entries(ZADANI_AVATAR_CONFIG.parts).reverse()),
    assetVersion: ZADANI_AVATAR_CONFIG.assetVersion,
    schemaVersion: ZADANI_AVATAR_CONFIG.schemaVersion,
  } as AvatarConfigV1;
}

describe('hash i generiranje avatara', () => {
  it('hash je stabilan SHA-256 kanonskog zapisa', () => {
    const hash = hashAvataraConfig(ZADANI_AVATAR_CONFIG);
    expect(hash).toBe(hashAvataraConfig(konfiguracijaObrnutihKljuceva()));
    expect(hash).toBe(createHash('sha256').update(kanonskiZapisAvatara(ZADANI_AVATAR_CONFIG)).digest('hex'));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    const drugaBoja: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      colors: { ...ZADANI_AVATAR_CONFIG.colors, skin: '#000000' },
    };
    expect(hashAvataraConfig(drugaBoja)).not.toBe(hash);
  });

  it('preskače generiranje kad sve veličine već postoje', async () => {
    const korijen = await mkdtemp(path.join(tmpdir(), 'kaladont-avatar-skip-'));
    try {
      const hash = hashAvataraConfig(ZADANI_AVATAR_CONFIG);
      const mapa = path.join(korijen, hash);
      await mkdir(mapa, { recursive: true });
      for (const velicina of [64, 128, 320]) {
        await writeFile(path.join(mapa, `${velicina}.webp`), `postoji-${velicina}`);
      }
      const { osigurajGeneriraneAvatare } = await moduliAvatara();
      const rezultat = await osigurajGeneriraneAvatare(ZADANI_AVATAR_CONFIG, {
        direktorijGeneriranih: korijen,
        direktorijDijelova: path.join(korijen, 'nema-dijelova'),
      });
      expect(rezultat).toBe(hash);
      expect(await readFile(path.join(mapa, '64.webp'), 'utf8')).toBe('postoji-64');
    } finally {
      await rm(korijen, { recursive: true, force: true });
    }
  });

  it('zapisuje WebP 64, 128 i 320 iz SVG dijelova', async () => {
    const korijen = await mkdtemp(path.join(tmpdir(), 'kaladont-avatar-gen-'));
    try {
      const { osigurajGeneriraneAvatare } = await moduliAvatara();
      const hash = await osigurajGeneriraneAvatare(ZADANI_AVATAR_CONFIG, {
        direktorijGeneriranih: korijen,
        direktorijDijelova: dijelovi,
      });
      expect(hash).toBe(hashAvataraConfig(ZADANI_AVATAR_CONFIG));
      for (const velicina of [64, 128, 320]) {
        const sadrzaj = await readFile(path.join(korijen, hash, `${velicina}.webp`));
        expect(sadrzaj.subarray(0, 4).toString('ascii')).toBe('RIFF');
        expect(sadrzaj.subarray(8, 12).toString('ascii')).toBe('WEBP');
        const meta = await sharp(sadrzaj).metadata();
        expect(meta.width).toBe(velicina);
        expect(meta.height).toBe(velicina);
        const statistika = await sharp(sadrzaj).stats();
        const imaTamneISvijetle = statistika.channels.some((kanal) => kanal.max - kanal.min > 80);
        expect(imaTamneISvijetle).toBe(true);
      }
      const ponovno = await osigurajGeneriraneAvatare(ZADANI_AVATAR_CONFIG, {
        direktorijGeneriranih: korijen,
        direktorijDijelova: path.join(korijen, 'nema-dijelova'),
      });
      expect(ponovno).toBe(hash);
    } finally {
      await rm(korijen, { recursive: true, force: true });
    }
  });
});

describe('GET /avatari/g', () => {
  it('vraća nepromjenjivi WebP i 404 za nevaljan zahtjev', async () => {
    const korijen = await mkdtemp(path.join(tmpdir(), 'kaladont-avatar-ruta-'));
    const app = Fastify();
    try {
      const hash = 'ab'.repeat(32);
      await mkdir(path.join(korijen, hash), { recursive: true });
      await writeFile(path.join(korijen, hash, '128.webp'), Buffer.from('RIFF----WEBP'));
      const { registrirajRuteGeneriranihAvatara } = await moduliAvatara();
      await registrirajRuteGeneriranihAvatara(app, { direktorij: korijen });

      const odgovor = await app.inject({ method: 'GET', url: `/avatari/g/${hash}/128.webp` });
      expect(odgovor.statusCode).toBe(200);
      expect(odgovor.headers['content-type']).toContain('image/webp');
      expect(String(odgovor.headers['cache-control'])).toContain('immutable');

      const krivaVelicina = await app.inject({ method: 'GET', url: `/avatari/g/${hash}/96.webp` });
      expect(krivaVelicina.statusCode).toBe(404);
      const kriviHash = await app.inject({ method: 'GET', url: `/avatari/g/${'g'.repeat(64)}/64.webp` });
      expect(kriviHash.statusCode).toBe(404);
      const nemaDatoteke = await app.inject({ method: 'GET', url: `/avatari/g/${hash}/64.webp` });
      expect(nemaDatoteke.statusCode).toBe(404);
    } finally {
      await app.close();
      await rm(korijen, { recursive: true, force: true });
    }
  });
});
