import { defineConfig } from 'vitest/config';

process.env.ONEMOGUCI_TIMER_POTEZA = 'true';
process.env.ODGODA_POCETKA_PARTIJE_MS = '0';
process.env.TOLERANCIJA_PREKIDA_MS = '300';
process.env.BOT_IZOSTANAK_PO_SUDJELOVANJU = '0';
process.env.BOT_NEZNANJE_PO_SUDJELOVANJU = '0';

export default defineConfig({
  test: {
    include: ['test/**/*.manual.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 60_000,
    env: {
      EMAIL_API_KLJUC: '',
      VERZIJA: 'lokalno',
      DIGEST: 'lokalno',
      BOT_IZOSTANAK_PO_SUDJELOVANJU: '0',
      BOT_NEZNANJE_PO_SUDJELOVANJU: '0',
      ONEMOGUCI_TIMER_POTEZA: 'true',
      ODGODA_POCETKA_PARTIJE_MS: '0',
      TOLERANCIJA_PREKIDA_MS: '300',
      LJESTVICE_POCETAK: new Date().toISOString(),
    },
  },
});
