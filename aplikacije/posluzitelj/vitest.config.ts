import { defineConfig } from 'vitest/config';

// Forsiraj ispod CI job enva (npr. ONEMOGUCI_TIMER_POTEZA=false za e2e) prije loada worker procesa.
process.env.ONEMOGUCI_TIMER_POTEZA = 'true';
process.env.ODGODA_POCETKA_PARTIJE_MS = '0';
process.env.TOLERANCIJA_PREKIDA_MS = '300';
process.env.BOT_IZOSTANAK_PO_SUDJELOVANJU = '0';
process.env.BOT_NEZNANJE_PO_SUDJELOVANJU = '0';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/**/*.manual.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    // integracijski testovi dijele lokalnu Postgres bazu - sekvencijalno je pouzdanije od paralelnog
    fileParallelism: false,
    // isključi 30s timer poteza i 5s odabir riječi sustava - testovi ne trebaju čekati stvarno vrijeme
    env: {
      EMAIL_API_KLJUC: '',
      VERZIJA: 'lokalno',
      DIGEST: 'lokalno',
      BOT_IZOSTANAK_PO_SUDJELOVANJU: '0',
      BOT_NEZNANJE_PO_SUDJELOVANJU: '0',
      ONEMOGUCI_TIMER_POTEZA: 'true',
      ODGODA_POCETKA_PARTIJE_MS: '0',
      TOLERANCIJA_PREKIDA_MS: '300',
      // Praćenje počinje pri pokretanju testova, pa je svih vremena uvijek još zaključano.
      LJESTVICE_POCETAK: new Date().toISOString(),
    },
  },
});
