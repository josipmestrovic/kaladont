/**
 * Postgres unique_violation (23505), uključujući DrizzleQueryError wrapping od 0.44+.
 */
export function jeJedinstvenostPrekrsena(greska: unknown): boolean {
  let trenutna: unknown = greska;
  for (let dubina = 0; dubina < 4 && trenutna && typeof trenutna === 'object'; dubina += 1) {
    if ('code' in trenutna && trenutna.code === '23505') return true;
    trenutna = 'cause' in trenutna ? trenutna.cause : undefined;
  }
  return false;
}
