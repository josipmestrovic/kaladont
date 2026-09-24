import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { avatarKategorije, pozadina } from './manifest.mjs';

const korijen = path.resolve(process.cwd(), 'skripte/avatari/izvor/avatar-assets');
const izlaz = path.resolve(process.cwd(), 'docs/09-brainstorm/avatar-assets/contact-sheet.svg');
const karticaSirina = 180;
const karticaVisina = 150;
const stupci = 4;
const stavke = [{ kategorija: 'background', datoteka: pozadina }, ...Object.entries(avatarKategorije).flatMap(([kategorija, datoteke]) => datoteke.map((datoteka) => ({ kategorija, datoteka })) )];
const redci = Math.ceil(stavke.length / stupci);

function esc(tekst) {
  return tekst.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const slike = [];
for (const [indeks, stavka] of stavke.entries()) {
  const mapa = stavka.kategorija === 'background'
    ? korijen
    : path.join(korijen, stavka.kategorija === 'ears' ? 'Ear' : stavka.kategorija === 'earrings' ? 'Ear Ring' : stavka.kategorija === 'facialHair' ? 'Facial Hair' : stavka.kategorija[0].toUpperCase() + stavka.kategorija.slice(1));
  const svg = await readFile(path.join(mapa, stavka.datoteka));
  const x = (indeks % stupci) * karticaSirina;
  const y = Math.floor(indeks / stupci) * karticaVisina;
  const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  slike.push(`<g transform="translate(${x} ${y})"><rect width="${karticaSirina - 8}" height="${karticaVisina - 8}" rx="10" fill="#fff" stroke="#e5ddc8"/><image href="${data}" x="12" y="12" width="${karticaSirina - 32}" height="${karticaVisina - 48}" preserveAspectRatio="xMidYMid meet"/><text x="12" y="${karticaVisina - 20}" fill="#1a1815" font-family="sans-serif" font-size="12">${esc(`${stavka.kategorija}/${stavka.datoteka}`)}</text></g>`);
}

await mkdir(path.dirname(izlaz), { recursive: true });
await writeFile(izlaz, `<svg xmlns="http://www.w3.org/2000/svg" width="${stupci * karticaSirina}" height="${redci * karticaVisina}" viewBox="0 0 ${stupci * karticaSirina} ${redci * karticaVisina}"><rect width="100%" height="100%" fill="#fdfaf2"/>${slike.join('')}</svg>\n`);
console.log(`Generirana kontaktna tabla: ${path.relative(process.cwd(), izlaz)}`);
