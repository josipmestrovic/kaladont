import { zadnjaDva, type VrstaRijeci } from 'zajednicko';

export const SKUP_SIGURNIH_RIJECI = [
  'šećer',
  'biser',
  'bager',
  'bunker',
  'laser',
  'trener',
  'frizer',
  'jezik',
  'učenik',
  'radnik',
  'dnevnik',
  'putnik',
  'med',
  'led',
  'sladoled',
  'ured',
  'razred',
  'pogled',
  'raspored',
  'rep',
  'džep',
  'čep',
  'zid',
  'papir',
  'sir',
  'krumpir',
  'leptir',
  'šešir',
  'orah',
  'okvir',
  'svemir',
  'klavir',
  'mir',
  'automobil',
  'krokodil',
  'miš',
  'slatkiš',
  'nož',
  'velik',
  'lijep',
  'loš',
  'suh',
  'gluh',
  'duhovit',
  'jučer',
  'navečer',
  'prekjučer',
  'naprijed',
  'unaprijed',
  'još',
  'blizu',
  'noću',
] as const;

interface OpcijeSigurnogOdabira {
  iskoristeneGrupe: ReadonlySet<string>;
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  grupeZa(rijec: string): readonly string[];
  vrsteZa(rijec: string): readonly VrstaRijeci[];
  rijeciNa(prefiks: string): readonly string[];
  jeIgriva(rijec: string, iskoristeneGrupe: ReadonlySet<string>, dopusteneVrste?: ReadonlySet<VrstaRijeci>): boolean;
  nasumicniPomak?: number;
}

function dodajGrupe(iskoristeneGrupe: ReadonlySet<string>, grupe: readonly string[]): Set<string> {
  const rezultat = new Set(iskoristeneGrupe);
  for (const grupa of grupe) rezultat.add(grupa);
  return rezultat;
}

export function odaberiSigurnuPocetnuRijec(opcije: OpcijeSigurnogOdabira): string | null {
  const brojKandidata = SKUP_SIGURNIH_RIJECI.length;
  const pomak = opcije.nasumicniPomak ?? Math.floor(Math.random() * brojKandidata);

  for (let indeks = 0; indeks < brojKandidata; indeks += 1) {
    const kandidat = SKUP_SIGURNIH_RIJECI[(pomak + indeks) % brojKandidata]!;
    if (!opcije.jeIgriva(kandidat, opcije.iskoristeneGrupe, opcije.dopusteneVrste)) continue;

    const nakonKandidata = dodajGrupe(opcije.iskoristeneGrupe, opcije.grupeZa(kandidat));
    const odgovori = opcije
      .rijeciNa(zadnjaDva(kandidat))
      .filter((rijec) => opcije.jeIgriva(rijec, nakonKandidata, opcije.dopusteneVrste));
    if (odgovori.length === 0) continue;

    const svakiOdgovorImaNastavak = odgovori.every((odgovor) => {
      const nakonOdgovora = dodajGrupe(nakonKandidata, opcije.grupeZa(odgovor));
      return opcije
        .rijeciNa(zadnjaDva(odgovor))
        .some((rijec) => opcije.jeIgriva(rijec, nakonOdgovora, opcije.dopusteneVrste));
    });

    if (svakiOdgovorImaNastavak) return kandidat;
  }

  return null;
}