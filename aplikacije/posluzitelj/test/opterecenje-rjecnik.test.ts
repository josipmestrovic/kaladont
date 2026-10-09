import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { describe, expect, it } from 'vitest';
import { ucitajSnimkuRjecnika } from '../src/cli/opterecenje-rjecnik.js';

describe('ucitajSnimkuRjecnika', () => {
  it('učita lokalni gzip snapshot i ne nudi potrošene leksičke grupe', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-rjecnik-test-'));
    const izvor = path.join(direktorij, 'rjecnik.jsonl');
    const snimka = path.join(direktorij, 'rjecnik.jsonl.gz');
    const retci = [
      JSON.stringify({ vrsta: 'kaladont-rjecnik', verzija: 1 }),
      JSON.stringify({ rijec: 'kapa', prvaDva: 'ka', grupe: ['imenica:kapa'] }),
      JSON.stringify({ rijec: 'karta', prvaDva: 'ka', grupe: ['imenica:karta'] }),
    ];
    try {
      await writeFile(izvor, `${retci.join('\n')}\n`);
      await pipeline(createReadStream(izvor), createGzip(), createWriteStream(snimka));
      const rjecnik = await ucitajSnimkuRjecnika(snimka);

      expect(rjecnik.brojRijeci).toBe(2);
      expect(rjecnik.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(rjecnik.grupeZaRijec('kapa')).toEqual(['imenica:kapa']);
      await expect(rjecnik.nasumicnaRijec('ka', new Set(['imenica:kapa']), new Set())).resolves.toBe('karta');
      await expect(rjecnik.nasumicnaRijec('ka', new Set(['imenica:kapa', 'imenica:karta']), new Set())).resolves.toBeNull();
      await expect(rjecnik.nasumicnaRijec('xy', new Set(), new Set())).resolves.toBeNull();
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });

  it('odbija nepoznat format snapshot zaglavlja', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-rjecnik-test-'));
    const snimka = path.join(direktorij, 'rjecnik.jsonl');
    try {
      await writeFile(snimka, `${JSON.stringify({ vrsta: 'drugi-format', verzija: 1 })}\n`);
      await expect(ucitajSnimkuRjecnika(snimka)).rejects.toThrow('Nepodržan format snimke rječnika');
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });
});