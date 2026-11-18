import { expect, type Page, type Locator } from '@playwright/test';

/** Otvori profilni izbornik na headeru (avatar). */
export async function otvoriProfilIzbornik(page: Page): Promise<Locator> {
  const gumb = page.getByRole('banner').getByRole('button', { name: /Izbornik profila/ });
  await expect(gumb).toBeVisible({ timeout: 20_000 });
  await gumb.click();
  const izbornik = page.getByRole('menu', { name: 'Profil i račun' });
  await expect(izbornik).toBeVisible();
  return izbornik;
}

/** Ranked modal: pravilnik → format. */
export async function otvoriRankedKorak1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranked', exact: true }).click();
  const dijalog = page.getByRole('dialog', { name: 'Ranked' });
  await expect(
    dijalog.getByRole('heading', { name: 'Odaberi pravila po kojima želiš igrati' }),
  ).toBeVisible();
  return dijalog;
}

/** Zagrijavanje modal: pravilnik → broj Računala. */
export async function otvoriZagrijavanjeKorak1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zagrijavanje', exact: true }).click();
  const dijalog = page.getByRole('dialog', { name: 'Zagrijavanje' });
  await expect(
    dijalog.getByRole('heading', { name: 'Odaberi pravila po kojima želiš igrati' }),
  ).toBeVisible();
  return dijalog;
}
