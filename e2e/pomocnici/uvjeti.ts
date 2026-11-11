import type { Page } from '@playwright/test';

/** Na koraku 2 registracije označi obje obavezne kućice. */
export async function oznaciPrihvatNaRegistraciji(page: Page): Promise<void> {
  const kucice = page.getByRole('checkbox');
  await kucice.nth(0).check();
  await kucice.nth(1).check();
}

export const PRIHVAT_REGISTRACIJE = {
  potvrdaDob16: true,
  prihvacamUvjete: true,
} as const;
