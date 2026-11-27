/**
 * Dohvat i bojanje SVG dijelova avatara u pregledniku.
 * Mapiranje datoteka i okvira živi u zajedničkom paketu; ovdje ostaje cache dohvata.
 */
import {
  PREFIKS_DIJELOVA_AVATARA,
  nazivDatotekeDijela,
  nazivDatotekeSlicice,
} from 'zajednicko';

export { bojiStroke, okvirDijela, ulogaBojeKategorije } from 'zajednicko';
export type { OkvirDijela } from 'zajednicko';

export function putanjaDijela(kategorija: string, vrijednost: string | null): string | null {
  const naziv = nazivDatotekeDijela(kategorija, vrijednost);
  return naziv ? `${PREFIKS_DIJELOVA_AVATARA}/${naziv}` : null;
}

/** Kao putanjaDijela, ali odvojene uši dobivaju vlastitu sliku jer se na avataru ne crtaju. */
export function putanjaSlicice(kategorija: string, vrijednost: string | null): string | null {
  const naziv = nazivDatotekeSlicice(kategorija, vrijednost);
  return naziv ? `${PREFIKS_DIJELOVA_AVATARA}/${naziv}` : null;
}

const cacheSirovih = new Map<string, Promise<string>>();
/** LRU cache obojenih data URL-ova; 512 drži tipičnu sesiju editora uz custom boje. */
const MAKS_CACHE_OBOJENIH = 512;
const cacheObojenih = new Map<string, string>();
const uTijekuBojanja = new Map<string, Promise<string>>();

function dohvatiSirovi(putanja: string): Promise<string> {
  const spremljeno = cacheSirovih.get(putanja);
  if (spremljeno) return spremljeno;

  const obecanje = fetch(putanja).then((odgovor) => {
    if (!odgovor.ok) throw new Error(`Nije moguće učitati avatar asset: ${putanja}`);
    return odgovor.text();
  });
  // Neuspjeli dohvat se ne smije trajno keširati.
  obecanje.catch(() => cacheSirovih.delete(putanja));
  cacheSirovih.set(putanja, obecanje);
  return obecanje;
}

function zapamtiObojeni(kljuc: string, dataUrl: string): void {
  if (cacheObojenih.has(kljuc)) cacheObojenih.delete(kljuc);
  cacheObojenih.set(kljuc, dataUrl);
  while (cacheObojenih.size > MAKS_CACHE_OBOJENIH) {
    const najstariji = cacheObojenih.keys().next().value;
    if (najstariji === undefined) break;
    cacheObojenih.delete(najstariji);
  }
}

export async function dohvatiObojeniSvg(putanja: string, boja: string, obojiStroke: boolean): Promise<string> {
  const kljuc = `${putanja}|${boja}|${obojiStroke ? 'stroke' : 'fill'}`;
  const spremljeno = cacheObojenih.get(kljuc);
  if (spremljeno) {
    // LRU: pomakni na kraj.
    cacheObojenih.delete(kljuc);
    cacheObojenih.set(kljuc, spremljeno);
    return spremljeno;
  }

  const postojece = uTijekuBojanja.get(kljuc);
  if (postojece) return postojece;

  const obecanje = (async () => {
    const svg = await dohvatiSirovi(putanja);
    let obojeni = svg.replace(/fill="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `fill="${boja}"`);
    if (obojiStroke) obojeni = obojeni.replace(/stroke="(?:#[0-9A-Fa-f]{6}|black|white)"/g, `stroke="${boja}"`);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(obojeni)}`;
    zapamtiObojeni(kljuc, dataUrl);
    return dataUrl;
  })();

  uTijekuBojanja.set(kljuc, obecanje);
  try {
    return await obecanje;
  } finally {
    uTijekuBojanja.delete(kljuc);
  }
}
