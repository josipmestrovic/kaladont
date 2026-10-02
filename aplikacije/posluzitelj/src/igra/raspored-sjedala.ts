import { randomInt } from 'node:crypto';

export function promijesajNiz<T>(
  vrijednosti: readonly T[],
  slucajniIndeks: (gornjaGranica: number) => number = randomInt,
): T[] {
  const rezultat = [...vrijednosti];
  for (let indeks = rezultat.length - 1; indeks > 0; indeks -= 1) {
    const drugiIndeks = slucajniIndeks(indeks + 1);
    [rezultat[indeks], rezultat[drugiIndeks]] = [rezultat[drugiIndeks]!, rezultat[indeks]!];
  }
  return rezultat;
}
