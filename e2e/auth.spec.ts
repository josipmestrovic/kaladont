import { expect, test } from '@playwright/test';

test('registracija i prijava zadržavaju sesiju nakon reloadanja', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/registracija');
  const nadimak = page.getByPlaceholder('Tvoj nadimak');
  await nadimak.fill('E2E Igrac');
  await expect(nadimak).toHaveValue('E2E Igrac');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await page
    .getByRole('button', { name: /odaberi/i })
    .first()
    .click();
  await page.getByRole('button', { name: /registriraj/i }).click();

  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page).not.toHaveURL(/\/prijava|\/registracija/);
});

test('prijava s krivom lozinkom prikazuje grešku', async ({ page }) => {
  await page.goto('/prijava');
  await page.getByLabel('Email').fill(`ne-postoji-${Date.now()}@example.com`);
  await page.getByLabel('Lozinka').fill('kriva-lozinka');
  await page.getByRole('button', { name: /prijavi se/i }).click();

  await expect(page.getByRole('alert')).toBeVisible();
});

test('zaboravljena lozinka skriva postojanje računa i nudi registraciju', async ({ page }) => {
  await page.goto('/zaboravljena-lozinka');
  await page.getByLabel('Email').fill(`ne-postoji-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Pošalji upute' }).click();

  await expect(
    page.getByText('Ako račun postoji, poslali smo upute na unesenu email adresu.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registriraj se' })).toBeVisible();
});

test('lozinka se može prikazati, a nevaljani reset link se odbija', async ({ page }) => {
  await page.goto('/prijava');
  const lozinka = page.locator('input[type="password"]');
  await lozinka.fill('vidljiva-lozinka');
  await page.locator('.vidljivost').click();
  await expect(page.locator('input[type="text"]')).toHaveValue('vidljiva-lozinka');

  await page.goto('/racuni/resetiraj-lozinku');
  await expect(page.getByRole('alert')).toHaveText('Poveznica za reset nije ispravna.');
});
