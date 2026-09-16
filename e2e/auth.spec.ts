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
  await page.getByRole('button', { name: /odaberi/i }).first().click();
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