import { expect, test } from '@playwright/test';
import { otvoriZagrijavanjeKorak1 } from './pomocnici/naslovnica.js';

test('gost pokreće Zagrijavanje, odustaje i vidi kraj treninga bez napretka', async ({ page }) => {
  const dijalog = await otvoriZagrijavanjeKorak1(page);
  await dijalog.getByRole('button', { name: /KA-zna/ }).click();
  await expect(dijalog.getByRole('heading', { name: 'Koliko Računala želiš?' })).toBeVisible();
  await dijalog.getByRole('link', { name: 'Igraj 1 računalom' }).click();
  await expect(page).toHaveURL(/\/zagrijavanje\?pravila=ka_zna&botovi=1$/);

  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
  const sjedala = page.locator('.igraci-red > li');
  await expect(sjedala).toHaveCount(2);
  await expect(page.getByText('Računalo')).toBeVisible();
  await expect(page.locator('.timer-prsten')).toHaveCount(0);

  // Čovjek odustaje čim dođe na potez; Računalo igra samo.
  await expect(page.getByRole('button', { name: 'Ne znam' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ne znam' }).click();
  const potvrda = page.getByRole('dialog', { name: 'Predati potez?' });
  await expect(potvrda).toBeVisible();
  await potvrda.getByRole('button', { name: 'Da' }).click();

  await expect(page.getByRole('heading', { name: 'Kraj treninga' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('trening-obavijest')).toContainText('Trening se ne bilježi');
  await expect(page.getByRole('region', { name: 'Osvojeno iskustvo' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forma' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kolekcija riječi' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Registriraj se' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Igraj novi trening' }).click();
  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
});
