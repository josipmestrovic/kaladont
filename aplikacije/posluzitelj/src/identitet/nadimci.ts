/**
 * Generiranje nadimaka za nove goste (npr. "VeseliJež42").
 */
const PRIDJEVI = [
  'Veseli',
  'Brzi',
  'Lukavi',
  'Sretni',
  'Hrabri',
  'Tihi',
  'Vragoljasti',
  'Nestasni',
  'Mudri',
  'Radoznali',
];

const IMENICE = [
  'Jež',
  'Vuk',
  'Sokol',
  'Medvjed',
  'Lisac',
  'Orao',
  'Ris',
  'Vidra',
  'Jazavac',
  'Galeb',
];

/** Nasumičan nadimak oblika Pridjev+Imenica+broj (jedinstvenost se ne garantira ovdje). */
export function generirajNadimak(): string {
  const pridjev = PRIDJEVI[Math.floor(Math.random() * PRIDJEVI.length)];
  const imenica = IMENICE[Math.floor(Math.random() * IMENICE.length)];
  const broj = Math.floor(Math.random() * 100);
  return `${pridjev}${imenica}${broj}`;
}
