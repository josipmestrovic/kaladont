import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 20000,
    // integracijski testovi dijele lokalnu Postgres bazu - sekvencijalno je pouzdanije od paralelnog
    fileParallelism: false,
    // isklju\u010di 30s timer poteza i 5s odabir rije\u010di sustava - testovi ne trebaju \u010dekati stvarno vrijeme
    env: {
      EMAIL_API_KLJUC: '',
      VERZIJA: 'lokalno',
      DIGEST: 'lokalno',
      ONEMOGUCI_TIMER_POTEZA: 'true',
      ODGODA_POCETKA_PARTIJE_MS: '0',
      TOLERANCIJA_PREKIDA_MS: '300',
    },
  },
});
