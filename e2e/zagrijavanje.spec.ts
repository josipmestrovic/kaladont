import { expect, test } from '@playwright/test';

test('gost pokreće Zagrijavanje, odustaje i vidi kraj treninga bez napretka', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Igraj' }).click();
  await page.getByRole('link', { name: /Zagrijavanje/ }).click();
  await expect(page).toHaveURL(/\/zagrijavanje$/);

  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
  const sjedala = page.locator('.igraci-red > li');
  await expect(sjedala).toHaveCount(2);
  await expect(page.getByText('Računalo')).toBeVisible();

  // Čovjek odustaje čim dođe na potez; Računalo igra samo.
  await expect(page.getByRole('button', { name: 'Ne znam' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ne znam' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Predati potez?' });
  await expect(dijalog).toBeVisible();
  await dijalog.getByRole('button', { name: 'Da' }).click();

  await expect(page.getByRole('heading', { name: 'Kraj treninga' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('trening-obavijest')).toContainText('Rezultat se ne bilježi');
  await expect(page.getByText(/XP/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forma' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kolekcija riječi' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Registriraj se' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Igraj novi trening' }).click();
  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
});
