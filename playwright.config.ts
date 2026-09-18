import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'http-rute.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'pnpm --filter posluzitelj exec tsx src/index.ts',
      url: 'http://127.0.0.1:3001/zdravlje',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: '3001',
        BAZA_URL: process.env.BAZA_URL ?? 'postgresql://kaladont:kaladont@localhost:5432/kaladont_dev',
        ODGODA_POCETKA_PARTIJE_MS: '0',
        ONEMOGUCI_TIMER_POTEZA: 'true',
        TOLERANCIJA_PREKIDA_MS: '10000',
        EMAIL_API_KLJUC: '',
        SESIJA_TAJNA: 'e2e-test-secret',
        VERZIJA: 'e2e',
        DIGEST: 'e2e',
      },
    },
    {
      command: 'pnpm --filter web exec vite dev --host 127.0.0.1 --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_ADRESA_POSLUZITELJA: 'http://127.0.0.1:3001',
      },
    },
  ],
});