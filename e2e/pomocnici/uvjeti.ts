import type { Page } from '@playwright/test';

/** Na koraku 2 registracije označi obje obavezne kućice (ne i vidljivost lozinke). */
export async function oznaciPrihvatNaRegistraciji(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: /najmanje 16 godina/i }).check();
  await page.getByRole('checkbox', { name: /Uvjete korištenja/i }).check();
}

export const PRIHVAT_REGISTRACIJE = {
  potvrdaDob16: true,
  prihvacamUvjete: true,
} as const;
