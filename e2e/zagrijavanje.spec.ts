import { expect, test } from '@playwright/test';
import { otvoriZagrijavanjeKorak1 } from './pomocnici/naslovnica.js';

test('gost pokreće Zagrijavanje, odustaje i vidi kraj treninga bez napretka', async ({ page }) => {
  const setup = await otvoriZagrijavanjeKorak1(page);

  // Defaulti = prvi u redu (lijevo): Klasični, Početnik, 1 bot.
  await expect(setup.getByRole('radio', { name: 'Klasični Kaladont' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(setup.getByRole('radio', { name: 'Početnik' })).toHaveAttribute('aria-checked', 'true');
  await expect(setup.getByRole('radio', { name: '1 bot' })).toHaveAttribute('aria-checked', 'true');

  await setup.getByRole('radio', { name: 'KA-zna' }).click();
  await setup.getByRole('radio', { name: 'Iskusni' }).click();
  await setup.getByRole('radio', { name: '1 bot' }).click();
  await setup.getByTestId('trening-zapocni').click();

  await expect(page).toHaveURL(/\/zagrijavanje\?pravila=ka_zna&botovi=1&profil=iskusni$/);

  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
  const sjedala = page.locator('.igraci-red > li');
  await expect(sjedala).toHaveCount(2);
  await expect(page.locator('.igraci-red').getByText('BOTaničar')).toBeVisible();
  await expect(page.getByTestId('trening-meta')).toContainText('Iskusni');
  await expect(page.locator('.timer-prsten')).toHaveCount(0);

  // Čovjek odustaje čim dođe na potez; bot igra samo.
  await expect(page.getByRole('button', { name: 'Ne znam' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ne znam' }).click();
  const potvrda = page.getByRole('dialog', { name: 'Predati potez?' });
  await expect(potvrda).toBeVisible();
  await potvrda.getByRole('button', { name: 'Da' }).click();

  await expect(page.getByRole('heading', { name: 'Kraj treninga' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('trening-obavijest')).toContainText('nije natjecateljska igra');
  await expect(page.getByRole('heading', { name: 'Forma' })).toHaveCount(0);
  // Gost je odmah odustao — bez novih riječi nema sekcije kolekcije ni XP obračuna.
  await expect(page.getByRole('heading', { name: 'Kolekcija riječi' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Registriraj se' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Igraj novi trening' }).click();
  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
});
