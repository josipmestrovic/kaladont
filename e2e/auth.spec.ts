import { expect, test } from '@playwright/test';
import { oznaciPrihvatNaRegistraciji } from './pomocnici/uvjeti.js';

test('registracija i prijava zadržavaju sesiju nakon reloadanja', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/registracija');
  const nadimak = page.getByPlaceholder('Tvoj nadimak');
  await nadimak.fill('E2EIgrac');
  await expect(nadimak).toHaveValue('E2EIgrac');
  await page.getByRole('button', { name: 'Dalje', exact: true }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await oznaciPrihvatNaRegistraciji(page);
  const daljeAvatar = page.getByRole('button', { name: /Dalje: stvori avatar/ });
  await expect(daljeAvatar).toBeEnabled();
  await daljeAvatar.click();

  await expect(page).toHaveURL('/profil/avatar?registracija=1');
  await page.getByRole('button', { name: 'Završi registraciju' }).click();

  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');
  await expect(page.getByRole('heading', { name: 'Dobrodošao/la u Kaladont!' })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(/Neželjena pošta/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ponovno pošalji potvrdu' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Igraj kao gost' })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');
});

test('logout poništava sesiju nakon ponovnog učitavanja', async ({ page }) => {
  const email = `e2e-logout-${Date.now()}@example.com`;

  await page.goto('/registracija');
  await page.getByPlaceholder('Tvoj nadimak').fill('LogoutIgrac');
  await page.getByRole('button', { name: 'Dalje', exact: true }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await oznaciPrihvatNaRegistraciji(page);
  const daljeAvatar = page.getByRole('button', { name: /Dalje: stvori avatar/ });
  await expect(daljeAvatar).toBeEnabled();
  await daljeAvatar.click();
  await expect(page).toHaveURL('/profil/avatar?registracija=1');
  await page.getByRole('button', { name: 'Završi registraciju' }).click();
  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');

  // waitForResponse mora biti registriran prije navigacije, inače GET /api/misije može proći neuhvaćen.
  const misijeOdgovor = page.waitForResponse(
    (odgovor) => odgovor.url().includes('/api/misije') && odgovor.request().method() === 'GET',
    { timeout: 10_000 },
  );
  await page.goto('/');
  await misijeOdgovor.catch(() => {});
  const popupMisija = page.getByRole('dialog', { name: /Nove (dnevne|tjedne) misije/ });
  await popupMisija.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  for (let i = 0; i < 5; i += 1) {
    if (await popupMisija.count() === 0) break;
    const naslovPrije = await popupMisija.locator('h2').textContent().catch(() => null);
    const zatvori = popupMisija.getByRole('button', { name: 'Zatvori' });
    // API oznake pregleda drži gumb disabled — pričekaj pa klikni.
    await expect(zatvori).toBeEnabled({ timeout: 15_000 });
    await zatvori.click();
    // Daily→weekly zamjenjuje dijalog in place; čekaj nestanak ili promjenu naslova.
    await expect.poll(async () => {
      if (await popupMisija.count() === 0) return 'gone';
      return (await popupMisija.locator('h2').textContent()) ?? '';
    }, { timeout: 15_000 }).not.toBe(naslovPrije);
  }
  await expect(popupMisija).toHaveCount(0);
  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  const odjava = navigacija.getByRole('button', { name: 'Odjavi se' });
  await expect(odjava).toBeVisible();
  page.once('dialog', (dijalog) => dijalog.accept());
  await odjava.click();
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toBeVisible({ timeout: 15_000 });
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCount(0);
  await page.reload();
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toBeVisible();
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCount(0);
});

test('stranica privatnosti prikazuje GDPR kontakt i postupak brisanja', async ({ page }) => {
  await page.goto('/privatnost');
  await expect(page.getByRole('heading', { name: 'Pravila privatnosti' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'info@kaladont.hr' }).first()).toBeVisible();
  await expect(page.getByText(/roku do 7 dana/)).toBeVisible();
  await expect(page.getByText(/STACK/)).toBeVisible();
});

test('stranica uvjeta prikazuje 16+ i datum objave', async ({ page }) => {
  await page.goto('/uvjeti');
  await expect(page.getByRole('heading', { name: 'Uvjeti korištenja' })).toBeVisible();
  await expect(page.getByText(/najmanje 16 godina/i).first()).toBeVisible();
  await expect(page.getByText(/11\. studenoga 2026/)).toBeVisible();
  await expect(page.getByText(/nemaju javne korisničke profile/i)).toBeVisible();
});

test('registracija bez kućica ne prolazi', async ({ page }) => {
  await page.goto('/registracija');
  await page.getByPlaceholder('Tvoj nadimak').fill('BezKucica');
  await page.getByRole('button', { name: 'Dalje', exact: true }).click();
  await page.getByLabel('Email').fill(`bez-kucica-${Date.now()}@example.com`);
  await page.getByLabel('Lozinka').fill('lozinka123');
  const daljeAvatar = page.getByRole('button', { name: /Dalje: stvori avatar/ });
  await expect(daljeAvatar).toBeDisabled();
  await expect(page).toHaveURL('/registracija');
  await expect(page.getByRole('checkbox').first()).toBeVisible();
});

test('gost ulazi u red bez dijaloga Uvjeta', async ({ page }) => {
  await page.goto('/red');
  await expect(page.getByRole('dialog', { name: /16 godina/i })).toHaveCount(0);
  await expect(page).toHaveURL(/\/red/);
});

test('izbornik uvjeta i privatnosti vodi na pravne stranice', async ({ page }) => {
  await page.goto('/');

  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');
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
