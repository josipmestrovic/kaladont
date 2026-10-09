import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { asc, and, eq, gt } from 'drizzle-orm';
import { createGzip } from 'node:zlib';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';

const VELICINA_SERIJE = 10_000;
const izlazArgument = process.argv.find((argument) => argument.startsWith('--izlaz='))?.slice('--izlaz='.length);

async function* redciRjecnika(): AsyncGenerator<string> {
  const sha256 = createHash('sha256');
  let zadnjaRijec: string | undefined;
  let brojRijeci = 0;
  yield `${JSON.stringify({ vrsta: 'kaladont-rjecnik', verzija: 1 })}\n`;

  while (true) {
    const uvjet = zadnjaRijec
      ? and(eq(rijeci.aktivna, true), gt(rijeci.rijec, zadnjaRijec))
      : eq(rijeci.aktivna, true);
    const serija = await baza
      .select({ rijec: rijeci.rijec, prvaDva: rijeci.prvaDva, grupe: rijeci.grupe })
      .from(rijeci)
      .where(uvjet)
      .orderBy(asc(rijeci.rijec))
      .limit(VELICINA_SERIJE);
    if (serija.length === 0) break;

    for (const zapis of serija) {
      const redak = `${JSON.stringify(zapis)}\n`;
      sha256.update(redak);
      yield redak;
      brojRijeci += 1;
    }
    zadnjaRijec = serija.at(-1)!.rijec;
  }

  console.log(JSON.stringify({ brojRijeci, sha256: sha256.digest('hex') }));
}

async function glavno(): Promise<void> {
  if (!izlazArgument || !path.isAbsolute(izlazArgument)) {
    throw new Error('Navedi apsolutni --izlaz unutar privremenog direktorija sustava.');
  }

  const izlaz = path.resolve(izlazArgument);
  const relativnaPutanja = path.relative(tmpdir(), izlaz);
  if (relativnaPutanja.startsWith('..') || path.isAbsolute(relativnaPutanja) || !izlaz.endsWith('.jsonl.gz')) {
    throw new Error('Rječničku snimku zapisuj kao .jsonl.gz samo unutar privremenog direktorija sustava.');
  }

  await mkdir(path.dirname(izlaz), { recursive: true });
  await pipeline(Readable.from(redciRjecnika()), createGzip(), createWriteStream(izlaz, { flags: 'wx', mode: 0o600 }));
  console.log(`Rječnička snimka spremljena izvan repozitorija: ${izlaz}`);
}

void glavno()
  .catch((greska: unknown) => {
    console.error(greska instanceof Error ? greska.message : greska);
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());