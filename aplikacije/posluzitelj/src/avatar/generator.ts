/**
 * Generira WebP 64/128/320 iz konfiguracije avatara.
 * Postojeće datoteke se preskaču; pisanje je atomsko (privremena datoteka pa preimenovanje).
 */
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { VELICINE_GENERIRANOG_AVATARA, validirajAvatarConfig, type AvatarConfigV1 } from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { hashAvataraConfig } from './hash.js';
import { sastaviSvgAvatara } from './kompozicija-svg.js';

export interface OpcijeGeneriranjaAvatara {
  direktorijGeneriranih?: string;
  direktorijDijelova?: string;
}

const uTijeku = new Map<string, Promise<string>>();

async function postoji(putanja: string): Promise<boolean> {
  try {
    await access(putanja);
    return true;
  } catch {
    return false;
  }
}

function mapaHasha(korijen: string, hash: string): string {
  return path.join(korijen, hash);
}

async function sveVelicinePostoje(mapa: string): Promise<boolean> {
  const provjere = await Promise.all(
    VELICINE_GENERIRANOG_AVATARA.map((velicina) => postoji(path.join(mapa, `${velicina}.webp`))),
  );
  return provjere.every(Boolean);
}

async function zapisiAtomski(cilj: string, sadrzaj: Buffer): Promise<void> {
  const privremeno = `${cilj}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(privremeno, sadrzaj);
  try {
    await rename(privremeno, cilj);
  } catch (greska) {
    await rm(privremeno, { force: true });
    if (await postoji(cilj)) return;
    throw greska;
  }
}

async function generiraj(config: AvatarConfigV1, hash: string, opcije: OpcijeGeneriranjaAvatara): Promise<string> {
  const korijen = opcije.direktorijGeneriranih ?? konfiguracija.AVATARI_GENERIRANI_DIR;
  const dijelovi = opcije.direktorijDijelova ?? konfiguracija.AVATAR_DIJELOVI_DIR;
  const mapa = mapaHasha(korijen, hash);
  await mkdir(mapa, { recursive: true });
  if (await sveVelicinePostoje(mapa)) return hash;

  const svg = await sastaviSvgAvatara(config, dijelovi);
  for (const velicina of VELICINE_GENERIRANOG_AVATARA) {
    const cilj = path.join(mapa, `${velicina}.webp`);
    if (await postoji(cilj)) continue;
    const slika = await sharp(Buffer.from(svg))
      .resize(velicina, velicina, { fit: 'fill' })
      .webp({ quality: 80 })
      .toBuffer();
    await zapisiAtomski(cilj, slika);
  }
  return hash;
}

export async function osigurajGeneriraneAvatare(
  config: AvatarConfigV1,
  opcije: OpcijeGeneriranjaAvatara = {},
): Promise<string> {
  const hash = hashAvataraConfig(config);
  const korijen = opcije.direktorijGeneriranih ?? konfiguracija.AVATARI_GENERIRANI_DIR;
  if (await sveVelicinePostoje(mapaHasha(korijen, hash))) return hash;

  const kljuc = `${korijen}\0${hash}`;
  const postojece = uTijeku.get(kljuc);
  if (postojece) return postojece;

  const posao = generiraj(config, hash, opcije);
  uTijeku.set(kljuc, posao);
  try {
    return await posao;
  } finally {
    if (uTijeku.get(kljuc) === posao) uTijeku.delete(kljuc);
  }
}

/**
 * Hash + osiguranje WebP datoteka na disku (postojeći korisnici bez backfilla).
 * Pri grešci generiranja i dalje vraća hash ako je konfiguracija valjana.
 */
export async function osigurajHashSlikeAvatara(
  config: unknown,
  naGresku?: (greska: unknown) => void,
): Promise<string | null> {
  if (!validirajAvatarConfig(config)) return null;
  try {
    return await osigurajGeneriraneAvatare(config);
  } catch (greska) {
    naGresku?.(greska);
    return hashAvataraConfig(config);
  }
}
