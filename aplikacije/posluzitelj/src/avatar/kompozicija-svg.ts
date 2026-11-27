/**
 * Sastavlja puni SVG avatara iz dijelova na disku.
 * Bojanje prati klijentski pregled: fill, a stroke samo za obrve, naočale i naušnice.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AVATAR_POZADINA,
  AVATAR_VIEWBOX,
  slojeviKompozicije,
  type AvatarConfigV1,
  type SlojKompozicijeAvatara,
} from 'zajednicko';

const cacheSirovih = new Map<string, Promise<string>>();

function ucitajDio(putanja: string): Promise<string> {
  const postojece = cacheSirovih.get(putanja);
  if (postojece) return postojece;
  const citanje = readFile(putanja, 'utf8');
  cacheSirovih.set(putanja, citanje);
  citanje.catch(() => {
    if (cacheSirovih.get(putanja) === citanje) cacheSirovih.delete(putanja);
  });
  return citanje;
}

export function obojiSvgDijela(svg: string, boja: string | null, obojiLiniju: boolean): string {
  if (!boja) return svg;
  let obojeni = svg.replace(/fill="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `fill="${boja}"`);
  if (obojiLiniju) {
    obojeni = obojeni.replace(/stroke="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `stroke="${boja}"`);
  }
  return obojeni;
}

function ugradiSloj(svg: string, sloj: SlojKompozicijeAvatara, indeks: number): string {
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1] ?? '0 0 100 100';
  const unutrasnjost = svg.replace(/^\uFEFF?[\s\S]*?<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const prefiks = `s${indeks}_`;
  const sIdentitetom = unutrasnjost
    .replace(/\bid="([^"]+)"/g, (_poklapanje, id: string) => `id="${prefiks}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_poklapanje, id: string) => `url(#${prefiks}${id})`)
    .replace(/(href|xlink:href)="#([^"]+)"/g, (_poklapanje, atribut: string, id: string) => `${atribut}="#${prefiks}${id}"`);
  return `<svg x="${sloj.x}" y="${sloj.y}" width="${sloj.sirina}" height="${sloj.visina}" viewBox="${viewBox}" preserveAspectRatio="none" overflow="visible">${sIdentitetom}</svg>`;
}

export async function sastaviSvgAvatara(config: AvatarConfigV1, direktorijDijelova: string): Promise<string> {
  const slojevi = slojeviKompozicije(config).filter((sloj) => sloj.vidljiv && sloj.nazivDatoteke);
  const dijelovi = await Promise.all(slojevi.map(async (sloj, indeks) => {
    const naziv = path.basename(sloj.nazivDatoteke!);
    const sirovi = await ucitajDio(path.join(direktorijDijelova, naziv));
    return ugradiSloj(obojiSvgDijela(sirovi, sloj.boja, sloj.obojiStroke), sloj, indeks);
  }));
  const { sirina, visina } = AVATAR_VIEWBOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sirina}" height="${visina}" viewBox="0 0 ${sirina} ${visina}">` +
    `<circle cx="${sirina / 2}" cy="${visina / 2}" r="${sirina / 2}" fill="${AVATAR_POZADINA}"/>` +
    dijelovi.join('') +
    '</svg>';
}
