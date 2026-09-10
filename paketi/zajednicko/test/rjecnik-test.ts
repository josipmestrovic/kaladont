/**
 * Mali kontrolirani rječnik za testove - digrafi, iznimke, mrtvi parovi, lanci,
 * leksemske grupe (ADR-013). Testovi ne ovise o pravom hrLexu (testiranje.md).
 */
import { prvaDva } from '../src/grafemi.js';
import type { RjecnikSucelje } from '../src/pravila.js';

export const RIJECNIK_TEST: readonly string[] = [
  'kaladont',
  'konj',
  'kralj',
  'aljkavost',
  'ulje',
  'ljepota',
  'bedž',
  'džamija',
  'ljubav',
  'njegovatelj',
  'injekcija',
  'konjunkcija',
  'uš',
  'šarena',
  'narukvica',
  'cadenica',
  'antena',
  'novak',
  'kutija',
  'jabuka',
  'akacija',
  'jastuk',
  'kula',
  'lava',
  'vatra',
  'raketa',
  'tava',
  'vaza',
  'zavjesa',
  'sat',
];

/** Obitelji oblika za testove leksemskih grupa (RS-28/RS-29). */
const OBITELJI: Record<string, readonly string[]> = {
  dobar: ['pridjev:dobar:poz'],
  dobra: ['pridjev:dobar:poz'],
  // Višekategorijski oblik: pridjev + prilog + imenica (RS-29)
  dobro: ['pridjev:dobar:poz', 'prilog:dobro:poz', 'imenica:dobro'],
  bolji: ['pridjev:dobar:komp'],
  najbolji: ['pridjev:dobar:sup'],
  pisati: ['glagol:pisati'],
  napisati: ['glagol:napisati'],
};

/** Riječ -> grupe: obitelji gore, sve ostalo vlastita jednočlana grupa. */
export const GRUPE_TEST: ReadonlyMap<string, readonly string[]> = new Map([
  ...RIJECNIK_TEST.map((rijec): [string, readonly string[]] => [rijec, [`test:${rijec}`]]),
  ...Object.entries(OBITELJI),
]);

export function stvoriTestniRjecnik(): RjecnikSucelje {
  const jeIgriva = (rijec: string, iskoristene: ReadonlySet<string>): boolean =>
    (GRUPE_TEST.get(rijec) ?? []).every((grupa) => !iskoristene.has(grupa));

  return {
    jePostojecaRijec: (rijec) => GRUPE_TEST.has(rijec),
    grupeZa: (rijec) => GRUPE_TEST.get(rijec) ?? [],
    postojeRijeciNa: (dvaGrafema) => [...GRUPE_TEST.keys()].some((rijec) => prvaDva(rijec) === dvaGrafema),
    imaSlobodnuRijecNa: (dvaGrafema, iskoristene) =>
      [...GRUPE_TEST.keys()].some((rijec) => prvaDva(rijec) === dvaGrafema && jeIgriva(rijec, iskoristene)),
    nasumicnaPocetnaImenickaRijec: (iskoristene) =>
      [...GRUPE_TEST.keys()].find((rijec) => jeIgriva(rijec, iskoristene)) ?? null,
  };
}
