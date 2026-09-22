import { expect, test } from '@playwright/test';

test('registracija i prijava zadržavaju sesiju nakon reloadanja', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/registracija');
  const nadimak = page.getByPlaceholder('Tvoj nadimak');
  await nadimak.fill('E2EIgrac');
  await expect(nadimak).toHaveValue('E2EIgrac');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: /registriraj/i }).click();

  await expect(page).toHaveURL('/zahvala');
  await expect(page.getByRole('heading', { name: /Legenda si/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Igrati u 2 igrača' })).toHaveAttribute('href', '/red?mod=dva_igraca');
  await page.getByRole('link', { name: 'Vidjeti što je novo u igri' }).click();
  await expect(page).toHaveURL('/novosti');
  await expect(page.getByRole('heading', { name: 'Što je novo' })).toBeVisible();
  await page.goto('/');
  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('link', { name: 'Moja statistika' })).toHaveAttribute('href', '/profil#statistika');
  await expect(navigacija.getByRole('link', { name: 'Postavke' })).toHaveAttribute('href', '/postavke');
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCSS('color', 'rgb(228, 87, 46)');
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toHaveCount(0);
  await expect(navigacija.getByRole('link', { name: 'Registriraj se' })).toHaveCount(0);
  await navigacija.getByRole('link', { name: 'Postavke' }).click();
  await expect(page).toHaveURL('/profil?tab=postavke#postavke');
  await expect(page.locator('#postavke')).toBeInViewport();
  await page.goto('/profil?tab=postavke');
  await expect(page.getByRole('button', { name: 'Spremi promjene' })).toHaveCount(0);
  await page.goto('/');
  await navigacija.getByRole('link', { name: 'Moja statistika' }).click();
  await expect(page).toHaveURL('/profil#statistika');
  await expect(page.locator('#statistika')).toBeInViewport();
  await page.reload();
  await expect(page).not.toHaveURL(/\/prijava|\/registracija/);
});

test('logout poništava sesiju nakon ponovnog učitavanja', async ({ page }) => {
  const email = `e2e-logout-${Date.now()}@example.com`;

  await page.goto('/registracija');
  await page.getByPlaceholder('Tvoj nadimak').fill('LogoutIgrac');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: /registriraj/i }).click();
  await expect(page).toHaveURL('/zahvala');

  await page.goto('/');
  const odjava = page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('button', { name: 'Odjavi se' });
  await expect(odjava).toBeVisible();
  await odjava.click();
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

test('izbornik uvjeta i privatnosti vodi na pravne stranice', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Uvjeti i privatnost' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Što te zanima?' });
  await expect(dijalog.getByRole('link', { name: /Uvjeti korištenja/ })).toHaveAttribute('href', '/uvjeti');
  await expect(dijalog.getByRole('link', { name: /Pravila privatnosti/ })).toHaveAttribute('href', '/privatnost');
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
