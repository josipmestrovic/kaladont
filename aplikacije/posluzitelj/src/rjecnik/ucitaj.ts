/**
 * Rječnik u memoriji (ADR-007 + ADR-013): Map<rijec, grupe> + Map<prvaDva, rijec[]>.
 * Baza je izvor istine, ali igra ne pita bazu ni za jedan potez. Nazivi grupa se
 * kanoniziraju (jedan string objekt po grupi) pa su reference jeftine kao brojevi.
 */
import type { RjecnikSucelje, VrstaRijeci } from 'zajednicko';
import { asc, eq, gt, and } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { rijeci, vlastitaImena } from '../baza/shema.js';
import { grafemi, prvaDva, zadnjaDva } from 'zajednicko';
import { odaberiSigurnuPocetnuRijec } from './pocetne-rijeci.js';

const VELICINA_STRANICE = 50_000; // keyset paginacija - 1,2 M redaka ne materijalizirati odjednom

export interface KategorijaRjecnika {
  vrsta: VrstaRijeci;
  brojOblika: number;
}

export interface CiljeviRijeci {
  rijetke: { ukupno: number; niska: number; srednja: number; jaka: number };
  duge: { ukupno: number; duga: number; srednja: number; jaka: number };
}

export interface RjecnikUMemoriji extends RjecnikSucelje {
  brojRijeci(): number;
  brojKolekcijskihGrupa(): number;
  brojKolekcijskihGrupaPoVrsti(): Map<VrstaRijeci, number>;
  brojKolekcijskihGrupaZaVrste(vrste: readonly VrstaRijeci[]): number;
  brojDugihOblika(): number;
  brojRijetkihOblika(): number;
  brojDugihOblikaPoTieru(): readonly number[];
  brojRijetkihOblikaPoTieru(): readonly number[];
  /** Broj oblika po kategoriji, sortirano silazno (GET /rjecnik/statistika, naslovnica). */
  brojPoKategoriji(): KategorijaRjecnika[];
  ciljeviRijeci(): CiljeviRijeci;
  /** Ponovno učita rječnik iz baze i zamijeni zajedničke podatke in-place. */
  ponovoUcitaj(): Promise<void>;
}

export async function ucitajRjecnik(): Promise<RjecnikUMemoriji> {
  // let (ne const) - ponovoUcitaj() mora moći zamijeniti sadržaj bez mijenjanja referenci koje
  // motor-partije.ts već drži na ovaj objekt (closures ispod vide novo stanje odmah)
  let rijecGrupe = new Map<string, string | readonly string[]>();
  let rijecFrekvencija = new Map<string, number>();
  let rijecVrste = new Map<string, VrstaRijeci | readonly VrstaRijeci[]>();
  let skupVlastitihImena = new Set<string>();
  let poPrefiksu = new Map<string, string[]>();
  let pocetneImenickeRijeci: string[] = [];
  let kategorije: KategorijaRjecnika[] = [];
  let brojKolekcijskih = 0;
  let kolekcijskihPoVrsti = new Map<VrstaRijeci, number>();
  let kolekcijskihKljuceviPoVrsti = new Map<VrstaRijeci, Set<string>>();
  let brojDugih = 0;
  let brojRijetkih = 0;
  let brojDugihPoTieru: readonly number[] = [0, 0, 0];
  let brojRijetkihPoTieru: readonly number[] = [0, 0, 0];
  let ciljevi: CiljeviRijeci = { rijetke: { ukupno: 0, niska: 0, srednja: 0, jaka: 0 }, duge: { ukupno: 0, duga: 0, srednja: 0, jaka: 0 } };

  async function ucitaj(): Promise<void> {
    const novoRijecGrupe = new Map<string, string | readonly string[]>();
    const novoRijecFrekvencija = new Map<string, number>();
    const novoRijecVrste = new Map<string, VrstaRijeci | readonly VrstaRijeci[]>();
    const noviSkupVlastitihImena = new Set<string>();
    const novoPoPrefiksu = new Map<string, string[]>();
    const novePocetneImenickeRijeci: string[] = [];
    const noviBrojPoVrsti = new Map<VrstaRijeci, number>();
    const noveKolekcijske = new Set<string>();
    const noveKolekcijskePoVrsti = new Map<VrstaRijeci, Set<string>>();
    const rijetkeGrupe = [new Set<string>(), new Set<string>(), new Set<string>()];
    const rijetkiOblici = [new Set<string>(), new Set<string>(), new Set<string>()];
    const dugeRijeci = [new Set<string>(), new Set<string>(), new Set<string>()];
    const kanon = new Map<string, string>();
    const kanoniziraj = (vrijednost: string): string => {
      const postojeci = kanon.get(vrijednost);
      if (postojeci) return postojeci;
      kanon.set(vrijednost, vrijednost);
      return vrijednost;
    };

    const propnRetci = await baza.select({ rijec: vlastitaImena.rijec, leme: vlastitaImena.leme, frekvencija: vlastitaImena.frekvencija }).from(vlastitaImena);
    for (const redak of propnRetci) {
      noviSkupVlastitihImena.add(redak.rijec);
      if (novoRijecGrupe.has(redak.rijec)) continue;
      const svi = grafemi(redak.rijec);
      if (svi.length < 2) continue;
      const grupe = (redak.leme.length > 0 ? redak.leme : [redak.rijec]).map((lema) => kanoniziraj(`vlastito_ime:${lema}`));
      for (const grupa of grupe) {
        const kljuc = grupa.split(':').slice(0, 2).join(':');
        noveKolekcijske.add(kljuc);
        const skup = noveKolekcijskePoVrsti.get('vlastito_ime') ?? new Set<string>();
        skup.add(kljuc);
        noveKolekcijskePoVrsti.set('vlastito_ime', skup);
      }
      novoRijecGrupe.set(redak.rijec, grupe.length === 1 ? grupe[0]! : grupe);
      novoRijecFrekvencija.set(redak.rijec, redak.frekvencija);
      novoRijecVrste.set(redak.rijec, 'vlastito_ime');
      noviBrojPoVrsti.set('vlastito_ime', (noviBrojPoVrsti.get('vlastito_ime') ?? 0) + 1);
      const prefiks = kanoniziraj(prvaDva(redak.rijec));
      const lista = novoPoPrefiksu.get(prefiks);
      if (lista) lista.push(redak.rijec);
      else novoPoPrefiksu.set(prefiks, [redak.rijec]);
    }

    let zadnjaRijec = '';
    for (;;) {
      const stranica = await baza
        .select({ rijec: rijeci.rijec, prvaDva: rijeci.prvaDva, vrste: rijeci.vrste, grupe: rijeci.grupe, frekvencija: rijeci.frekvencija })
        .from(rijeci)
        .where(zadnjaRijec ? and(eq(rijeci.aktivna, true), gt(rijeci.rijec, zadnjaRijec)) : eq(rijeci.aktivna, true))
        .orderBy(asc(rijeci.rijec))
        .limit(VELICINA_STRANICE);
      if (stranica.length === 0) break;
      zadnjaRijec = stranica[stranica.length - 1]!.rijec;

      for (const redak of stranica) {
        const grupe = redak.grupe.map(kanoniziraj);
        for (const grupa of grupe) {
          const kljuc = grupa.split(':').slice(0, 2).join(':');
          noveKolekcijske.add(kljuc);
          for (const vrsta of redak.vrste as VrstaRijeci[]) {
            const skup = noveKolekcijskePoVrsti.get(vrsta) ?? new Set<string>();
            skup.add(kljuc);
            noveKolekcijskePoVrsti.set(vrsta, skup);
          }
        }
        const brojGrafema = grafemi(redak.rijec).length;
        const rarityTier = redak.frekvencija === 0 && brojGrafema >= 4 ? 2 : redak.frekvencija <= 9 ? 1 : redak.frekvencija <= 99 ? 0 : -1;
        if (rarityTier >= 0) {
          rijetkiOblici[rarityTier]!.add(redak.rijec);
          for (const grupa of grupe) rijetkeGrupe[rarityTier]!.add(grupa);
        }
        const duljinaTier = brojGrafema >= 15 ? 2 : brojGrafema >= 12 ? 1 : brojGrafema >= 10 ? 0 : -1;
        if (duljinaTier >= 0) dugeRijeci[duljinaTier]!.add(redak.rijec);
        const vrste = (redak.vrste as VrstaRijeci[]).map(kanoniziraj) as VrstaRijeci[];
        novoRijecGrupe.set(redak.rijec, grupe.length === 1 ? grupe[0]! : grupe);
        novoRijecFrekvencija.set(redak.rijec, redak.frekvencija);
        novoRijecVrste.set(redak.rijec, vrste.length === 1 ? vrste[0]! : vrste);
        if (redak.rijec.length < 6 && grupe.includes(`imenica:${redak.rijec}`)) {
          novePocetneImenickeRijeci.push(redak.rijec);
        }
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
    rijecFrekvencija = novoRijecFrekvencija;
    rijecVrste = novoRijecVrste;
    skupVlastitihImena = noviSkupVlastitihImena;
    poPrefiksu = novoPoPrefiksu;
    pocetneImenickeRijeci = novePocetneImenickeRijeci;
    kategorije = [...noviBrojPoVrsti.entries()]
      .map(([vrsta, brojOblika]) => ({ vrsta, brojOblika }))
      .sort((a, b) => b.brojOblika - a.brojOblika);
    brojKolekcijskih = noveKolekcijske.size;
    kolekcijskihPoVrsti = new Map([...noveKolekcijskePoVrsti.entries()].map(([vrsta, skup]) => [vrsta, skup.size]));
    kolekcijskihKljuceviPoVrsti = noveKolekcijskePoVrsti;
    brojDugih = dugeRijeci.reduce((zbroj, skup) => zbroj + skup.size, 0);
    brojRijetkih = rijetkiOblici.reduce((zbroj, skup) => zbroj + skup.size, 0);
    brojDugihPoTieru = dugeRijeci.map((skup) => skup.size);
    brojRijetkihPoTieru = rijetkiOblici.map((skup) => skup.size);
    ciljevi = {
      rijetke: { niska: rijetkeGrupe[0]!.size, srednja: rijetkeGrupe[1]!.size, jaka: rijetkeGrupe[2]!.size, ukupno: 81037 },
      duge: { duga: dugeRijeci[0]!.size, srednja: dugeRijeci[1]!.size, jaka: dugeRijeci[2]!.size, ukupno: 379193 },
    };
  }

  function grupeZa(rijec: string): readonly string[] {
    const grupe = rijecGrupe.get(rijec);
    if (grupe === undefined) return [];
    return typeof grupe === 'string' ? [grupe] : grupe;
  }

  function frekvencijaZa(rijec: string): number | null {
    return rijecFrekvencija.get(rijec) ?? null;
  }

  function jeVlastitoIme(rijec: string): boolean {
    return skupVlastitihImena.has(rijec);
  }

  function vrsteZa(rijec: string): readonly VrstaRijeci[] {
    const v = rijecVrste.get(rijec);
    if (v === undefined) return [];
    return typeof v === 'string' ? [v] : v;
  }

  function jeOsnovniOblik(rijec: string): boolean {
    const grupe = grupeZa(rijec);
    if (grupe.length === 0) return false;
    // Riječ je lema/osnovni oblik ako barem jedna njena grupa navodi istu riječ kao lemu
    return grupe.some((grupa) => {
      const dijelovi = grupa.split(':');
      if (dijelovi.length < 2) return false;
      const lema = dijelovi[1];
      const stupanj = dijelovi[2];
      // Za pridjeve/priloge tražimo pozitiv
      if (stupanj && stupanj !== 'poz') return false;
      return lema === rijec;
    });
  }

  /** Igriva = postoji u bazi, pripada dopuštenoj vrsti i nijedna njena grupa nije potrošena (RS-28/RS-29). */
  function jeIgriva(
    rijec: string,
    iskoristeneGrupe: ReadonlySet<string>,
    dopusteneVrste?: ReadonlySet<VrstaRijeci>,
    samoOsnovniOblici?: boolean,
    minDuljinaRijeci?: number,
  ): boolean {
    const grupe = rijecGrupe.get(rijec);
    if (grupe === undefined) return false;

    if (minDuljinaRijeci && minDuljinaRijeci > 0 && rijec.length < minDuljinaRijeci) {
      return false;
    }

    if (dopusteneVrste) {
      const v = vrsteZa(rijec);
      if (v.length > 0 && !v.some((vrsta) => dopusteneVrste.has(vrsta))) return false;
    }

    if (samoOsnovniOblici && !jeOsnovniOblik(rijec)) {
      return false;
    }

    if (typeof grupe === 'string') return !iskoristeneGrupe.has(grupe);
    return grupe.every((grupa) => !iskoristeneGrupe.has(grupa));
  }

  function imaSlobodnuRijecNa(
    dvaGrafema: string,
    iskoristeneGrupe: ReadonlySet<string>,
    dopusteneVrste?: ReadonlySet<VrstaRijeci>,
    samoOsnovniOblici?: boolean,
    minDuljinaRijeci?: number,
  ): boolean {
    const lista = poPrefiksu.get(dvaGrafema);
    if (!lista) return false;
    for (const rijec of lista) {
      if (jeIgriva(rijec, iskoristeneGrupe, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) return true;
    }
    return false;
  }

  await ucitaj();

  return {
    brojRijeci: () => rijecGrupe.size,
    brojKolekcijskihGrupa: () => brojKolekcijskih,
    brojKolekcijskihGrupaPoVrsti: () => new Map(kolekcijskihPoVrsti),
    brojKolekcijskihGrupaZaVrste: (vrste) => new Set(vrste.flatMap((vrsta) => [...(kolekcijskihKljuceviPoVrsti.get(vrsta) ?? [])])).size,
    brojDugihOblika: () => brojDugih,
    brojRijetkihOblika: () => brojRijetkih,
    brojDugihOblikaPoTieru: () => [...brojDugihPoTieru],
    brojRijetkihOblikaPoTieru: () => [...brojRijetkihPoTieru],
    brojPoKategoriji: () => kategorije,
    ciljeviRijeci: () => ciljevi,
    jePostojecaRijec: (rijec) => rijecGrupe.has(rijec),
    jeVlastitoIme,
    grupeZa,
    frekvencijaZa,
    vrsteZa,
    jeOsnovniOblik,
    postojeRijeciNa: (dvaGrafema) => (poPrefiksu.get(dvaGrafema)?.length ?? 0) > 0,
    imaSlobodnuRijecNa,
    nasumicnaPocetnaRijec: (iskoristeneGrupe, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci) => {
      const sigurnaRijec = odaberiSigurnuPocetnuRijec({
        iskoristeneGrupe,
        dopusteneVrste,
        grupeZa,
        vrsteZa,
        rijeciNa: (prefiks) => poPrefiksu.get(prefiks) ?? [],
        jeIgriva: (rijec, potroseneGrupe, vrste) =>
          jeIgriva(rijec, potroseneGrupe, vrste, samoOsnovniOblici, minDuljinaRijeci),
      });
      if (sigurnaRijec) return sigurnaRijec;

      if (!dopusteneVrste || dopusteneVrste.has('imenica')) {
        const ukupno = pocetneImenickeRijeci.length;
        if (ukupno > 0) {
          const pomak = Math.floor(Math.random() * ukupno);
          for (let i = 0; i < ukupno; i += 1) {
            const rijec = pocetneImenickeRijeci[(pomak + i) % ukupno]!;
            if (!jeIgriva(rijec, iskoristeneGrupe, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) continue;
            const nakonOdabira = new Set(iskoristeneGrupe);
            for (const grupa of grupeZa(rijec)) nakonOdabira.add(grupa);
            if (imaSlobodnuRijecNa(zadnjaDva(rijec), nakonOdabira, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) return rijec;
          }
        }
      }

      // Ako nema odgovarajuće imenice, tražimo bilo koju kratku riječ iz dopuštenih vrsta.
      for (const [rijec] of rijecGrupe) {
        if (rijec.length >= 6) continue;
        if (!jeIgriva(rijec, iskoristeneGrupe, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) continue;
        const nakonOdabira = new Set(iskoristeneGrupe);
        for (const grupa of grupeZa(rijec)) nakonOdabira.add(grupa);
        if (imaSlobodnuRijecNa(zadnjaDva(rijec), nakonOdabira, dopusteneVrste, samoOsnovniOblici, minDuljinaRijeci)) return rijec;
      }
      return null;
    },
    ponovoUcitaj: ucitaj,
  };
}
