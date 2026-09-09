/**
 * Rječnik u memoriji (ADR-007 + ADR-013): Map<rijec, grupe> + Map<prvaDva, rijec[]>.
 * Baza je izvor istine, ali igra ne pita bazu ni za jedan potez. Nazivi grupa se
 * kanoniziraju (jedan string objekt po grupi) pa su reference jeftine kao brojevi.
 */
import type { RjecnikSucelje, VrstaRijeci } from 'zajednicko';
import { asc, eq, gt, and } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';
import { zadnjaDva } from 'zajednicko';

const VELICINA_STRANICE = 50_000; // keyset paginacija - 1,2 M redaka ne materijalizirati odjednom

export interface KategorijaRjecnika {
  vrsta: VrstaRijeci;
  brojOblika: number;
}

export interface RjecnikUMemoriji extends RjecnikSucelje {
  brojRijeci(): number;
  /** Broj oblika po kategoriji, sortirano silazno (GET /rjecnik/statistika, naslovnica). */
  brojPoKategoriji(): KategorijaRjecnika[];
  /** Ponovno učita rječnik iz baze i zamijeni podatke in-place (RS-21: signal ponovnog učitavanja). */
  ponovoUcitaj(): Promise<void>;
}

export async function ucitajRjecnik(): Promise<RjecnikUMemoriji> {
  // let (ne const) - ponovoUcitaj() mora moći zamijeniti sadržaj bez mijenjanja referenci koje
  // motor-partije.ts već drži na ovaj objekt (closures ispod vide novo stanje odmah)
  let rijecGrupe = new Map<string, string | readonly string[]>();
  let poPrefiksu = new Map<string, string[]>();
  let sviOblici: string[] = [];
  let kategorije: KategorijaRjecnika[] = [];

  async function ucitaj(): Promise<void> {
    const novoRijecGrupe = new Map<string, string | readonly string[]>();
    const novoPoPrefiksu = new Map<string, string[]>();
    const noviBrojPoVrsti = new Map<VrstaRijeci, number>();
    const kanon = new Map<string, string>();
    const kanoniziraj = (vrijednost: string): string => {
      const postojeci = kanon.get(vrijednost);
      if (postojeci) return postojeci;
      kanon.set(vrijednost, vrijednost);
      return vrijednost;
    };

    let zadnjaRijec = '';
    for (;;) {
      const stranica = await baza
        .select({ rijec: rijeci.rijec, prvaDva: rijeci.prvaDva, vrste: rijeci.vrste, grupe: rijeci.grupe })
        .from(rijeci)
        .where(zadnjaRijec ? and(eq(rijeci.aktivna, true), gt(rijeci.rijec, zadnjaRijec)) : eq(rijeci.aktivna, true))
        .orderBy(asc(rijeci.rijec))
        .limit(VELICINA_STRANICE);
      if (stranica.length === 0) break;
      zadnjaRijec = stranica[stranica.length - 1]!.rijec;

      for (const redak of stranica) {
        const grupe = redak.grupe.map(kanoniziraj);
        novoRijecGrupe.set(redak.rijec, grupe.length === 1 ? grupe[0]! : grupe);
        const kljucPrefiksa = kanoniziraj(redak.prvaDva);
        const lista = novoPoPrefiksu.get(kljucPrefiksa);
        if (lista) lista.push(redak.rijec);
        else novoPoPrefiksu.set(kljucPrefiksa, [redak.rijec]);
        for (const vrsta of redak.vrste as VrstaRijeci[]) {
          noviBrojPoVrsti.set(vrsta, (noviBrojPoVrsti.get(vrsta) ?? 0) + 1);
        }
      }
      if (stranica.length < VELICINA_STRANICE) break;
    }

    rijecGrupe = novoRijecGrupe;
    poPrefiksu = novoPoPrefiksu;
    sviOblici = [...novoRijecGrupe.keys()];
    kategorije = [...noviBrojPoVrsti.entries()]
      .map(([vrsta, brojOblika]) => ({ vrsta, brojOblika }))
      .sort((a, b) => b.brojOblika - a.brojOblika);
  }

  function grupeZa(rijec: string): readonly string[] {
    const grupe = rijecGrupe.get(rijec);
    if (grupe === undefined) return [];
    return typeof grupe === 'string' ? [grupe] : grupe;
  }

  /** Igriva = postoji u bazi i nijedna njena grupa nije potrošena (RS-28/RS-29). */
  function jeIgriva(rijec: string, iskoristeneGrupe: ReadonlySet<string>): boolean {
    const grupe = rijecGrupe.get(rijec);
    if (grupe === undefined) return false;
    if (typeof grupe === 'string') return !iskoristeneGrupe.has(grupe);
    return grupe.every((grupa) => !iskoristeneGrupe.has(grupa));
  }

  function imaSlobodnuRijecNa(dvaGrafema: string, iskoristeneGrupe: ReadonlySet<string>): boolean {
    const lista = poPrefiksu.get(dvaGrafema);
    if (!lista) return false;
    for (const rijec of lista) {
      if (jeIgriva(rijec, iskoristeneGrupe)) return true;
    }
    return false;
  }

  await ucitaj();

  return {
    brojRijeci: () => rijecGrupe.size,
    brojPoKategoriji: () => kategorije,
    jePostojecaRijec: (rijec) => rijecGrupe.has(rijec),
    grupeZa,
    postojeRijeciNa: (dvaGrafema) => (poPrefiksu.get(dvaGrafema)?.length ?? 0) > 0,
    imaSlobodnuRijecNa,
    nasumicnaValjanaRijec: (iskoristeneGrupe) => {
      // Nasumično sondiranje umjesto kopije cijelog skupa (1,2 M riječi): potrošeni dio
      // rječnika je u partiji zanemariv, pa prvi pogodak gotovo uvijek prolazi.
      const ukupno = sviOblici.length;
      if (ukupno === 0) return null;
      const pomak = Math.floor(Math.random() * ukupno);
      for (let i = 0; i < ukupno; i += 1) {
        const rijec = sviOblici[(pomak + i) % ukupno]!;
        if (!jeIgriva(rijec, iskoristeneGrupe)) continue;
        const nakonOdabira = new Set(iskoristeneGrupe);
        for (const grupa of grupeZa(rijec)) nakonOdabira.add(grupa);
        if (imaSlobodnuRijecNa(zadnjaDva(rijec), nakonOdabira)) return rijec;
      }
      return null;
    },
    ponovoUcitaj: ucitaj,
  };
}
