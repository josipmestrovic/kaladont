/** Autofokus unosa na potezu: uvijek uključen (mobitel i desktop). */
export function trebaAutofokusPoteza(): boolean {
  return typeof window !== 'undefined';
}
