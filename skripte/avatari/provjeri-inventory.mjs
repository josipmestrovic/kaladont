import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { avatarKategorije, ignoriraniTopLevelExporti, ocekivaniBrojKomponenti, pozadina } from './manifest.mjs';

const korijen = path.resolve(process.cwd(), 'skripte/avatari/izvor/avatar-assets');
let ukupno = 0;
const greske = [];

for (const [kategorija, datoteke] of Object.entries(avatarKategorije)) {
  const direktorij = path.join(korijen, kategorija === 'ears' ? 'Ear' : kategorija === 'earrings' ? 'Ear Ring' : kategorija === 'facialHair' ? 'Facial Hair' : kategorija[0].toUpperCase() + kategorija.slice(1));
  const postojece = new Set(await readdir(direktorij));
  for (const datoteka of datoteke) {
    ukupno += 1;
    if (!postojece.has(datoteka)) greske.push(`${kategorija}/${datoteka}: datoteka nedostaje`);
    else {
      const sadrzaj = await readFile(path.join(direktorij, datoteka), 'utf8');
      if (!sadrzaj.startsWith('<svg')) greske.push(`${kategorija}/${datoteka}: nije SVG root`);
      if (!/<svg\b[^>]*\bviewBox=/.test(sadrzaj)) greske.push(`${kategorija}/${datoteka}: nema viewBox`);
    }
  }
}

const pozadinaSadrzaj = await readFile(path.join(korijen, pozadina), 'utf8');
if (!pozadinaSadrzaj.startsWith('<svg')) greske.push(`${pozadina}: nije SVG root`);

const topLevel = await readdir(korijen);
const neocekivani = topLevel.filter((ime) => ime.endsWith('.svg') && ime !== pozadina && !ignoriraniTopLevelExporti.includes(ime));
if (neocekivani.length > 0) greske.push(`Neočekivani top-level SVG exporti: ${neocekivani.join(', ')}`);

if (ukupno !== ocekivaniBrojKomponenti) greske.push(`Očekivano ${ocekivaniBrojKomponenti} komponenti, pronađeno ${ukupno}`);
if (greske.length > 0) {
  console.error(greske.join('\n'));
  process.exit(1);
}

console.log(`Avatar inventory OK: ${ukupno} komponenti + ${pozadina}`);
console.log('Top-level katalog/label SVG-ovi su izuzeti iz produkcijskih komponenti.');
