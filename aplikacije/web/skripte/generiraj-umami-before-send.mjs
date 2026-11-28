/**
 * Generira static/umami-before-send.js iz TS entryja (esbuild IIFE).
 * Koristi Vite plugin i artifact test.
 */
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const korijen = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(korijen, 'src/lib/umami-before-send-entry.ts');
const outfile = join(korijen, 'static/umami-before-send.js');

const BANNER = `/*! GENERIRANO — ne uređuj ručno.
 * Izvor: src/lib/umami-sanitizacija.ts + umami-before-send-entry.ts
 * Regeneriraj: Vite plugin ili node skripte/generiraj-umami-before-send.mjs
 */
`;

export async function generirajUmamiBeforeSend() {
  mkdirSync(dirname(outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    outfile,
    banner: { js: BANNER },
    logLevel: 'silent',
  });
  return outfile;
}

const jeDirektniPokretaj =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (jeDirektniPokretaj) {
  generirajUmamiBeforeSend()
    .then((p) => {
      console.log(`umami-before-send: ${p}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
