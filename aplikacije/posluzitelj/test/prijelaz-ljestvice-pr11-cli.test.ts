import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const korijenPaketa = fileURLToPath(new URL('../', import.meta.url));
const distCli = path.join(korijenPaketa, 'dist', 'cli', 'prijelaz-ljestvice-pr11.js');
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');

describe('prijelaz-ljestvice-pr11 CLI (produkcijski .js ulaz)', () => {
  beforeAll(() => {
    if (existsSync(distCli)) return;
    const izgradnja = spawnSync(process.execPath, [tscBin, '-p', '.'], {
      cwd: korijenPaketa,
      encoding: 'utf8',
      timeout: 120_000,
    });
    expect(izgradnja.status, izgradnja.stderr || izgradnja.stdout).toBe(0);
    expect(existsSync(distCli)).toBe(true);
  }, 120_000);

  it('node dist/cli/prijelaz-ljestvice-pr11.js --usporedi izvrši upit i ispiše rezultat', () => {
    const rezultat = spawnSync(process.execPath, [distCli, '--usporedi'], {
      cwd: korijenPaketa,
      encoding: 'utf8',
      env: process.env,
      timeout: 60_000,
    });
    expect(rezultat.status, rezultat.stderr || rezultat.stdout).toBe(0);
    expect(rezultat.stdout).toContain('"usporedba"');
    expect(rezultat.stdout).toContain('"sazetak"');
  });
});
