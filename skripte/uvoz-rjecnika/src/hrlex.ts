/**
 * Zajedničko preuzimanje, parsiranje i agregacija hrLexa za uvoz i analizu (ADR-013).
 * Kategorije se filtriraju po UPOS stupcu; grupe se računaju iz leme (kljucGrupe iz zajednicko).
 */
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import path from 'node:path';
import { grafemi, kljucGrupe, type StupanjRijeci, type VrstaRijeci } from 'zajednicko';

export const PODACI_DIR = path.resolve(import.meta.dirname, '../podaci');
export const PUTANJA_GZ = path.join(PODACI_DIR, 'hrLex_v1.3.gz');

const URL_HRLEX =
  'https://www.clarin.si/repository/xmlui/bitstream/handle/11356/1232/hrLex_v1.3.gz';
const MD5_OCEKIVANI = 'e55a21f10bbb4f6c22afe31a65803649';

// Mala slova hrvatske abecede (bez q/w/x/y); š/đ/č/ć/ž su dopušteni.
const DOPUSTENA_SLOVA = /^[a-zšđčćž]+$/;

/** UPOS -> kategorija u igri (uvoz-rjecnika.md); null = otpada. */
export const UPOS_U_VRSTU: Record<string, VrstaRijeci | null> = {
  NOUN: 'imenica',
  PROPN: null,
  ADJ: 'pridjev',
  VERB: 'glagol',
  AUX: 'glagol',
  ADV: 'prilog',
  PRON: 'zamjenica',
  DET: 'zamjenica',
  NUM: 'broj',
  ADP: 'prijedlog',
  CCONJ: 'veznik',
  SCONJ: 'veznik',
  PART: 'cestica',
  INTJ: 'uzvik',
};

export interface AgregiraniOblik {
  frekvencija: number;
  vrste: Set<VrstaRijeci>;
  grupe: Set<string>;
  prvaDva: string;
  zadnjaDva: string;
  brojGrafema: number;
}

export interface RezultatAgregacije {
  agregat: Map<string, AgregiraniOblik>;
  ukupnoRedaka: number;
  odbaceniUpos: number;
  odbaceniCiscenje: number;
  odbaceniMaloGrafema: number;
  odbaceniRimski: number;
  /** Koliko bi redaka prošlo kroz stari Nc.sn filtar (usporedba u izvještaju). */
  stariFiltar: number;
}

export async function preuzmiAkoNedostaje(): Promise<void> {
  await mkdir(PODACI_DIR, { recursive: true });
  if (existsSync(PUTANJA_GZ)) {
    console.log('hrLex već preuzet, preskačem preuzimanje.');
    return;
  }
  console.log(`Preuzimam ${URL_HRLEX} ...`);
  const odgovor = await fetch(URL_HRLEX);
  if (!odgovor.ok || !odgovor.body) {
    throw new Error(`Preuzimanje nije uspjelo: HTTP ${odgovor.status}`);
  }
  const izlaz = createWriteStream(PUTANJA_GZ);
  await finished(Readable.fromWeb(odgovor.body as never).pipe(izlaz));
}

export async function provjeriMd5(): Promise<void> {
  const sadrzaj = await readFile(PUTANJA_GZ);
  const md5 = createHash('md5').update(sadrzaj).digest('hex');
  if (md5 !== MD5_OCEKIVANI) {
    throw new Error(`MD5 ne odgovara: očekivano ${MD5_OCEKIVANI}, dobiveno ${md5}`);
  }
  console.log('MD5 provjera prošla.');
}

async function* citajRetke(): AsyncGenerator<string> {
  const tok = createReadStream(PUTANJA_GZ).pipe(createGunzip());
  let ostatak = '';
  for await (const dio of tok) {
    ostatak += (dio as Buffer).toString('utf8');
    const retci = ostatak.split('\n');
    ostatak = retci.pop() ?? '';
    yield* retci;
  }
  if (ostatak) yield ostatak;
}

function stupanj(udObiljezja: string, msd: string): StupanjRijeci {
  if (udObiljezja.includes('Degree=Cmp')) return 'komp';
  if (udObiljezja.includes('Degree=Sup')) return 'sup';
  // MSD fallback (MULTEXT-East V6): A/R na 3. poziciji nose p/c/s
  if ((msd[0] === 'A' || msd[0] === 'R') && msd.length >= 3) {
    if (msd[2] === 'c') return 'komp';
    if (msd[2] === 's') return 'sup';
  }
  return 'poz';
}

/** V8 sliced-string zamka: substring iz split()-a zadržava cijeli roditeljski chunk u memoriji. */
function ravno(s: string): string {
  return Buffer.from(s).toString();
}

/** Parsira cijeli hrLex i agregira po jedinstvenom obliku (unija vrsta i grupa, zbroj frekvencija). */
export async function agregirajHrLex(): Promise<RezultatAgregacije> {
  const agregat = new Map<string, AgregiraniOblik>();
  let ukupnoRedaka = 0;
  let odbaceniUpos = 0;
  let odbaceniCiscenje = 0;
  let odbaceniMaloGrafema = 0;
  let odbaceniRimski = 0;
  let stariFiltar = 0;

  for await (const redak of citajRetke()) {
    const stupci = redak.split('\t');
    if (stupci.length < 7) continue;
    const [oblik, lema, msd, , upos, udObiljezja, frekvencija] = stupci;
    if (!oblik || !upos) continue;
    ukupnoRedaka += 1;

    if (msd && /^Nc.sn/.test(msd) && oblik.length >= 2 && DOPUSTENA_SLOVA.test(oblik)) {
      stariFiltar += 1;
    }

    const vrsta = UPOS_U_VRSTU[upos] ?? null;
    if (!vrsta) {
      odbaceniUpos += 1;
      continue;
    }
    // Rimski brojevi malim slovima (vi, xi, mc...) prolaze slovni filtar - izbaci ih eksplicitno
    if (vrsta === 'broj' && ((udObiljezja ?? '').includes('NumForm=Roman') || /^Mr/.test(msd ?? ''))) {
      odbaceniRimski += 1;
      continue;
    }
    if (oblik !== oblik.toLowerCase() || !DOPUSTENA_SLOVA.test(oblik)) {
      odbaceniCiscenje += 1;
      continue;
    }

    const lemaKljuc = (lema || oblik).toLowerCase();
    const grupaSirova = kljucGrupe(vrsta, lemaKljuc, stupanj(udObiljezja ?? '', msd ?? ''));

    const postojeci = agregat.get(oblik);
    if (postojeci) {
      postojeci.frekvencija += Number(frekvencija) || 0;
      postojeci.vrste.add(vrsta);
      if (!postojeci.grupe.has(grupaSirova)) postojeci.grupe.add(ravno(grupaSirova));
    } else {
      const svi = grafemi(oblik);
      if (svi.length < 2) {
        odbaceniMaloGrafema += 1;
        continue;
      }
      agregat.set(ravno(oblik), {
        frekvencija: Number(frekvencija) || 0,
        vrste: new Set([vrsta]),
        grupe: new Set([ravno(grupaSirova)]),
        prvaDva: ravno(svi.slice(0, 2).join('')),
        zadnjaDva: ravno(svi.slice(-2).join('')),
        brojGrafema: svi.length,
      });
    }
  }

  return { agregat, ukupnoRedaka, odbaceniUpos, odbaceniCiscenje, odbaceniMaloGrafema, odbaceniRimski, stariFiltar };
}
