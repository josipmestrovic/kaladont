/**
 * PNG → WebP za referencirane ikone (sharp iz poslužitelja).
 * Pokretanje iz root: node skripte/optimiziraj-ikone-webp.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(path.join(root, 'aplikacije/posluzitelj/package.json'));
const sharp = require('sharp');

const IKONE_DIR = path.join(root, 'aplikacije/web/static/ikone');
const CILJNA_STRANA = 160; // 2× tipičnog prikaza 48–80 CSS px
const QUALITY = 80;

/** Referencirani PNG-ovi u kodu (bez većih WebP 61–82). */
const REFERENCIRANI = [
  '01-sto-je-novo.png',
  '02-pomozi-poboljsati-igru.png',
  '03-nazad.png',
  '04-naslovna.png',
  '05-naprijed.png',
  '06-trofej.png',
  '07-igraj.png',
  '08-pravila.png',
  '09-ljestvice.png',
  '15-kaladont-dnk.png',
  '16-soba-4-igraca.png',
  '17-soba-2-igraca.png',
  '18-privatna-soba.png',
  '19-vatra.png',
  '21-kolekcija.png',
  '26-zvjezdica-prazna.png',
  '27-zvjezdica-puna.png',
  '29-random-avatar.png',
  '33-dnk-brzina.png',
  '39-iskusnjara.png',
  '40-rijetkolovac.png',
  '41-dugometras.png',
  '42-jezik-u-plamenu.png',
  '43-kaladont.png',
  '44-ka-zna.png',
  '45-lovac-na-glave.png',
  '46-slijepa-ulica.png',
  '47-zavrsna-rijec.png',
  '48-glas-zajednice.png',
];

async function konvertiraj(imePng) {
  const ulaz = path.join(IKONE_DIR, imePng);
  const izlaz = path.join(IKONE_DIR, imePng.replace(/\.png$/i, '.webp'));
  try {
    await fs.access(ulaz);
  } catch {
    console.warn(`preskočeno (nema): ${imePng}`);
    return false;
  }
  await sharp(ulaz)
    .resize(CILJNA_STRANA, CILJNA_STRANA, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, alphaQuality: 90 })
    .toFile(izlaz);
  const [a, b] = await Promise.all([fs.stat(ulaz), fs.stat(izlaz)]);
  console.log(`${imePng} → ${path.basename(izlaz)} (${a.size} → ${b.size} B)`);
  return true;
}

const rezultati = await Promise.all(REFERENCIRANI.map(konvertiraj));
console.log(`Gotovo: ${rezultati.filter(Boolean).length}/${REFERENCIRANI.length}`);
