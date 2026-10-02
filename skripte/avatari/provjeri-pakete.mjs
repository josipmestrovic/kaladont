import { readFileSync } from 'node:fs';

const paketi = [
  { naziv: 'pack 02', manifest: 'skripte/avatari/pack-02/manifest.json' },
  { naziv: 'pack 03', manifest: 'skripte/avatari/pack-03/manifest.json' },
];

const dijelovi = readFileSync('paketi/zajednicko/src/avatar.ts', 'utf8');
const render = readFileSync('aplikacije/web/src/lib/avatar-render.ts', 'utf8');
const editor = readFileSync('aplikacije/web/src/lib/komponente/AvatarEditor.svelte', 'utf8');

const greske = [];
let ukupno = 0;

for (const paket of paketi) {
  const assets = JSON.parse(readFileSync(paket.manifest, 'utf8')).assets;
  ukupno += assets.length;
  for (const dio of assets) {
    if (!dijelovi.includes(`'${dio.id}'`)) greske.push(`${paket.naziv}: avatar.ts nema ${dio.category}/${dio.id}`);
    if (!render.includes(`'${dio.id}': '${dio.productionFile}'`)) greske.push(`${paket.naziv}: avatar-render.ts nema ${dio.id} -> ${dio.productionFile}`);
    if (!editor.includes(`'${dio.id}':`)) greske.push(`${paket.naziv}: editor nema naziv za ${dio.id}`);

    // Dijelovi s vlastitim okvirom moraju biti u tablici okvira, a ostali ne smiju biti.
    const imaOkvir = new RegExp(`'${dio.id}': \\{ x: ${dio.frame?.x},`).test(render);
    if (dio.requiresFrameOverride && !imaOkvir) greske.push(`${paket.naziv}: nedostaje okvir za ${dio.id}`);
    if (dio.requiresFrameOverride === false && imaOkvir) greske.push(`${paket.naziv}: ${dio.id} ne bi smio imati okvir`);
  }
}

console.log(greske.length ? greske.join('\n') : `OK: svih ${ukupno} dijelova registrirano, okviri se slažu s manifestima`);
process.exit(greske.length ? 1 : 0);
