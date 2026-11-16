/**
 * Privremeni runner za staging/prod image koji još ima .ts-only entry check
 * (isti obrazac kao pokreni-backfill.mjs za PR09).
 * Usage: node /tmp/pokreni-prijelaz-ljestvice-pr11.mjs --usporedi
 *        node /tmp/pokreni-prijelaz-ljestvice-pr11.mjs --primijeni=DA
 *        node /tmp/pokreni-prijelaz-ljestvice-pr11.mjs --primijeni=DA --odrzavanje-produkcije=DA
 */
process.argv[1] = '/app/dist/cli/prijelaz-ljestvice-pr11.ts';
await import('/app/dist/cli/prijelaz-ljestvice-pr11.js');
