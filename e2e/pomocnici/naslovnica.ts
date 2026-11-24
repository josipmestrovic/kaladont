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

/** Brza igra: jedan klik → kanonski red. */
export async function idiUBrzuIgru(page: Page) {
  await page.goto('/');
  await page.getByTestId('naslovnica-brza-igra').click();
  await expect(page).toHaveURL(/\/red\?mod=tri_igraca&pravila=klasicni/);
}

/** @deprecated Koristi idiUBrzuIgru — Ranked modal više ne postoji. */
export async function otvoriRankedKorak1(page: Page) {
  await idiUBrzuIgru(page);
  return page.getByRole('main');
}

/** Trening setup stranica (full-width, bez modala). */
export async function otvoriZagrijavanjeKorak1(page: Page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Trening', exact: true }).click();
  await expect(page).toHaveURL(/\/trening$/);
  const setup = page.getByTestId('trening-setup');
  await expect(setup.getByRole('heading', { name: 'Trening', exact: true })).toBeVisible();
  return setup;
}
