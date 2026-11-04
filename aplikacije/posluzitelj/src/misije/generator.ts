import {
  DEFINICIJE_MISIJA,
  type DefinicijaMisije,
  type VrstaMisije,
  definicijeMisijaPoVrsti,
  jePristupacnaTjedna,
} from 'zajednicko';
import { jeW06IzvedivZaNovuDodjelu } from './kalendar.js';

export type Rng = () => number;

export interface OgranicenjaOdabira {
  vrsta: VrstaMisije;
  zauzetiPredlosci: ReadonlySet<string>;
  zauzeteObitelji: ReadonlySet<string>;
  imaZahtjevniju: boolean;
  /** Za tjedni paket: treba li još pristupačna. */
  trebaPristupacnu: boolean;
  sada: Date;
  nedavniPredlosci?: readonly string[];
}

function jeKandidat(d: DefinicijaMisije, o: OgranicenjaOdabira): boolean {
  if (!d.aktivna || d.vrsta !== o.vrsta) return false;
  if (o.zauzetiPredlosci.has(d.predlozakId)) return false;
  if (o.zauzeteObitelji.has(d.obitelj)) return false;
  if (o.imaZahtjevniju && d.zahtjevnija) return false;
  if (d.predlozakId === 'W06' && !jeW06IzvedivZaNovuDodjelu(o.sada)) return false;
  return true;
}

function izaberiJednog(kandidati: DefinicijaMisije[], rng: Rng): DefinicijaMisije | null {
  if (kandidati.length === 0) return null;
  const indeks = Math.min(kandidati.length - 1, Math.floor(rng() * kandidati.length));
  return kandidati[indeks] ?? null;
}

function sMekomPreferencijom(kandidati: DefinicijaMisije[], nedavni: readonly string[] | undefined, rng: Rng): DefinicijaMisije | null {
  if (!nedavni?.length) return izaberiJednog(kandidati, rng);
  const nedavniSet = new Set(nedavni);
  const svjezi = kandidati.filter((k) => !nedavniSet.has(k.predlozakId));
  return izaberiJednog(svjezi.length > 0 ? svjezi : kandidati, rng);
}

/** Jedna dnevna dodjela uz aktivna ograničenja. */
export function odaberiDnevnuMisiju(o: OgranicenjaOdabira, rng: Rng): DefinicijaMisije | null {
  const kandidati = definicijeMisijaPoVrsti('dnevna').filter((d) => jeKandidat(d, o));
  return sMekomPreferencijom(kandidati, o.nedavniPredlosci, rng);
}

/**
 * Odabir cijelog tjednog paketa od 3 (tvrdi uvjeti).
 * Vraća null ako nema valjane kombinacije.
 */
export function odaberiTjedniPaket(
  sada: Date,
  rng: Rng,
  zabranjeniPredlosci: ReadonlySet<string> = new Set(),
): DefinicijaMisije[] | null {
  const bazni = definicijeMisijaPoVrsti('tjedna').filter((d) => {
    if (zabranjeniPredlosci.has(d.predlozakId)) return false;
    if (d.predlozakId === 'W06' && !jeW06IzvedivZaNovuDodjelu(sada)) return false;
    return true;
  });

  // Pretraži valjane trojke; 20 predložaka je dovoljno malo.
  const rezultat: DefinicijaMisije[] = [];
  const koristeno = new Set<string>();
  const obitelji = new Set<string>();
  let zahtjevnija = false;

  function dfs(slot: number): boolean {
    if (slot === 3) {
      const imaPristupacnu = rezultat.some((d) => jePristupacnaTjedna(d.predlozakId));
      return imaPristupacnu;
    }
    const kandidati = bazni.filter((d) => {
      if (koristeno.has(d.predlozakId)) return false;
      if (obitelji.has(d.obitelj)) return false;
      if (zahtjevnija && d.zahtjevnija) return false;
      return true;
    });
    // Nasumični redoslijed kandidata.
    const pomijesani = [...kandidati];
    for (let i = pomijesani.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [pomijesani[i], pomijesani[j]] = [pomijesani[j]!, pomijesani[i]!];
    }
    for (const d of pomijesani) {
      koristeno.add(d.predlozakId);
      obitelji.add(d.obitelj);
      const bilaZahtjevnija = zahtjevnija;
      if (d.zahtjevnija) zahtjevnija = true;
      rezultat.push(d);
      if (dfs(slot + 1)) return true;
      rezultat.pop();
      koristeno.delete(d.predlozakId);
      obitelji.delete(d.obitelj);
      zahtjevnija = bilaZahtjevnija;
    }
    return false;
  }

  return dfs(0) ? [...rezultat] : null;
}

/** Zamjena jednog slota uz fiksna ostala dva (aktivna ili dovršena u paketu). */
export function odaberiZamjenu(
  vrsta: VrstaMisije,
  ostale: readonly DefinicijaMisije[],
  sada: Date,
  rng: Rng,
  zabranjeniPredlosci: ReadonlySet<string>,
  nedavniPredlosci?: readonly string[],
): DefinicijaMisije | null {
  const zauzetiPredlosci = new Set([...zabranjeniPredlosci, ...ostale.map((d) => d.predlozakId)]);
  const zauzeteObitelji = new Set(ostale.map((d) => d.obitelj));
  const imaZahtjevniju = ostale.some((d) => d.zahtjevnija);
  const trebaPristupacnu = vrsta === 'tjedna' && !ostale.some((d) => jePristupacnaTjedna(d.predlozakId));

  const o: OgranicenjaOdabira = {
    vrsta,
    zauzetiPredlosci,
    zauzeteObitelji,
    imaZahtjevniju,
    trebaPristupacnu,
    sada,
    nedavniPredlosci,
  };

  let kandidati = DEFINICIJE_MISIJA.filter((d) => jeKandidat(d, o));
  if (trebaPristupacnu) {
    const pristupacne = kandidati.filter((d) => jePristupacnaTjedna(d.predlozakId));
    if (pristupacne.length === 0) return null;
    kandidati = pristupacne;
  }
  return sMekomPreferencijom(kandidati, nedavniPredlosci, rng);
}

export function snapshotIzDefinicije(d: DefinicijaMisije) {
  return {
    predlozakId: d.predlozakId,
    verzijaDefinicije: d.verzijaDefinicije,
    naziv: d.naziv,
    opis: d.opis,
    metrika: d.metrika,
    cilj: d.cilj,
    pragMetrike: d.pragMetrike ?? null,
    podciljevi: d.podciljevi ? d.podciljevi.map((p) => ({ ...p })) : null,
    xp: d.xp,
    obitelj: d.obitelj,
    zahtjevnija: d.zahtjevnija,
    kontekst: d.kontekst,
    mod: d.mod,
  };
}
