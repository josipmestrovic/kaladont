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

test('logout poništava sesiju nakon ponovnog učitavanja', async ({ page }) => {
  const email = `e2e-logout-${Date.now()}@example.com`;

  await page.goto('/registracija');
  await page.getByPlaceholder('Tvoj nadimak').fill('Logout Igrac');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await page.getByRole('button', { name: /odaberi/i }).first().click();
  await page.getByRole('button', { name: /registriraj/i }).click();

  await page.goto('/profil');
  await expect(page.getByRole('button', { name: 'Odjavi se' })).toBeVisible();
  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Moj profil' })).not.toBeVisible();
});

test('stranica privatnosti prikazuje GDPR kontakt i postupak brisanja', async ({ page }) => {
  await page.goto('/privatnost');
  await expect(page.getByRole('heading', { name: 'Pravila privatnosti' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'info@kaladont.hr' }).first()).toBeVisible();
  await expect(page.getByText(/roku do 7 dana/)).toBeVisible();
  await expect(page.getByText(/piši farmaceut/)).toBeVisible();
});

test('footer uvjeti i privatnost otvaraju popup na naslovnici', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Uvjeti' }).click();
  await expect(page.getByRole('dialog')).toContainText('Kaladont je igra riječi');
  await page.getByRole('button', { name: 'Zatvori' }).click();

  await page.getByRole('button', { name: 'Privatnost' }).click();
  await expect(page.getByRole('dialog')).toContainText('info@kaladont.hr');
  await expect(page.getByRole('dialog')).toContainText('roku do 7 dana');
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
