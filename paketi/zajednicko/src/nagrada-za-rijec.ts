import { grafemi } from './grafemi.js';
import type { NagradaZaRijec } from './protokol.js';

export const PRAGOVI_DULJINE = {
  duga: 10,
  srednjeDuga: 12,
  jakoDuga: 15,
} as const;

type Rijetkost = NonNullable<NagradaZaRijec['rijetkost']>;
type Duljina = NonNullable<NagradaZaRijec['duljina']>;

const TEKST_RIJETKOSTI: Record<Rijetkost, string> = {
  rijetka: 'rijetka',
  srednje_rijetka: 'srednje rijetka',
  jako_rijetka: 'jako rijetka',
};

const TEKST_DULJINE: Record<Duljina, string> = {
  duga: 'duga',
  srednje_duga: 'srednje duga',
  jako_duga: 'jako duga',
};

const INTENZITETI: Record<Rijetkost | Duljina, NagradaZaRijec['intenzitet']> = {
  rijetka: 'mali',
  duga: 'mali',
  srednje_rijetka: 'srednji',
  srednje_duga: 'srednji',
  jako_rijetka: 'veliki',
  jako_duga: 'veliki',
};

const REDOSLIJED_INTENZITETA: NagradaZaRijec['intenzitet'][] = ['mali', 'srednji', 'veliki'];

function jaciIntenzitet(
  prvi: NagradaZaRijec['intenzitet'],
  drugi: NagradaZaRijec['intenzitet'],
): NagradaZaRijec['intenzitet'] {
  return REDOSLIJED_INTENZITETA[Math.max(REDOSLIJED_INTENZITETA.indexOf(prvi), REDOSLIJED_INTENZITETA.indexOf(drugi))]!;
}

function odrediRijetkost(frekvencija: number, brojGrafema: number): Rijetkost | null {
  if (frekvencija === 0 && brojGrafema >= 4) return 'jako_rijetka';
  if (frekvencija >= 1 && frekvencija <= 9) return 'srednje_rijetka';
  if (frekvencija >= 10 && frekvencija <= 99) return 'rijetka';
  return null;
}

function odrediDuljinu(brojGrafema: number): Duljina | null {
  if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) return 'jako_duga';
  if (brojGrafema >= PRAGOVI_DULJINE.srednjeDuga) return 'srednje_duga';
  if (brojGrafema >= PRAGOVI_DULJINE.duga) return 'duga';
  return null;
}

export function izracunajNagraduZaRijec(
  rijec: string,
  frekvencija: number,
  grupe: readonly string[],
  vecNagradenih: ReadonlySet<string>,
): NagradaZaRijec | null {
  const brojGrafema = grafemi(rijec).length;
  const imaNovuGrupu = grupe.some((grupa) => !vecNagradenih.has(grupa));
  if (!imaNovuGrupu) return null;
  const rijetkost = odrediRijetkost(frekvencija, brojGrafema);
  const duljina = odrediDuljinu(brojGrafema);
  if (!rijetkost && !duljina) return null;

  const intenzitet = rijetkost && duljina
    ? jaciIntenzitet(INTENZITETI[rijetkost], INTENZITETI[duljina])
    : INTENZITETI[rijetkost ?? duljina!];
  const razlozi = [rijetkost, duljina]
    .filter((razlog): razlog is Rijetkost | Duljina => razlog !== null)
    .map((razlog) => TEKST_RIJETKOSTI[razlog as Rijetkost] ?? TEKST_DULJINE[razlog as Duljina]);

  const kategorija = rijetkost ? 'rijetke' : duljina ? 'duge' : null;
  return { intenzitet, rijetkost, duljina, tekst: `Pogođena je ${razlozi.join(' i ')} riječ!`, kategorija, otkljucano: null, ukupno: null };
}