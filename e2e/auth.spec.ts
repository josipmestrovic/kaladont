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
  const registriraj = page.getByRole('button', { name: 'Registriraj se', exact: true });
  await expect(registriraj).toBeEnabled();
  await registriraj.click();

  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');
  await expect(page.getByRole('heading', { name: 'Dobrodošao/la u Kaladont!' })).toBeVisible();
  await expect(page.getByText('Tvoj račun je spreman. Ostao je još samo jedan korak.')).toBeVisible();
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
  const registriraj = page.getByRole('button', { name: 'Registriraj se', exact: true });
  await expect(registriraj).toBeEnabled();
  await registriraj.click();
  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');

  // waitForResponse mora biti registriran prije navigacije, inače GET /api/misije može proći neuhvaćen.
  const misijeOdgovor = page.waitForResponse(
    (odgovor) => odgovor.url().includes('/api/misije') && odgovor.request().method() === 'GET',
    { timeout: 10_000 },
  );
  await page.goto('/');
  await misijeOdgovor.catch(() => {});
  // Nove misije: toast umjesto popupa — zatvori da ne blokira profil izbornik.
  const toastMisija = page.getByRole('status').filter({ hasText: /Imaš nove (dnevne|tjedne)/ });
  await toastMisija.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await toastMisija.count() > 0) {
    const zatvori = toastMisija.getByRole('button', { name: 'Zatvori obavijest' });
    const pregled = page.waitForResponse(
      (odgovor) => odgovor.url().includes('/misije/pregled') && odgovor.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await zatvori.click();
    await pregled.catch(() => {});
    await expect(toastMisija).toHaveCount(0, { timeout: 15_000 });
  }
  await expect(page.getByRole('dialog', { name: /Nove (dnevne|tjedne) misije/ })).toHaveCount(0);
  const profilGumb = page.getByRole('banner').getByRole('button', { name: /Izbornik profila/ });
  await expect(profilGumb).toBeVisible({ timeout: 20_000 });
  await profilGumb.click();
  const izbornik = page.getByRole('menu', { name: 'Profil i račun' });
  const odjava = izbornik.getByRole('menuitem', { name: 'Odjavi se' });
  await expect(odjava).toBeVisible();

  // Registriraj čekanje odjave prije klika; potvrdi stvarni API + opoziv tokena.
  const odjavaOdgovor = page.waitForResponse(
    (odgovor) => odgovor.url().includes('/racuni/odjava') && odgovor.request().method() === 'POST',
    { timeout: 15_000 },
  );
  page.once('dialog', (dijalog) => dijalog.accept());
  await odjava.click();
  await odjavaOdgovor;
  // Odjava može navigirati i uništiti execution context — tretiraj to kao opozvan token.
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => localStorage.getItem('kaladont_sesijski_token'));
      } catch {
        return null;
      }
    }, {
      timeout: 15_000,
    })
    .toBeNull();

  await expect(profilGumb).toBeVisible({ timeout: 15_000 });
  await profilGumb.click();
  await expect(page.getByRole('menu', { name: 'Profil i račun' }).getByRole('menuitem', { name: 'Prijavi se' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('menu', { name: 'Profil i račun' }).getByRole('menuitem', { name: 'Odjavi se' })).toHaveCount(0);

  await page.reload();
  await expect(profilGumb).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('kaladont_sesijski_token')), {
      timeout: 10_000,
    })
    .toBeNull();
  await profilGumb.click();
  await expect(page.getByRole('menu', { name: 'Profil i račun' }).getByRole('menuitem', { name: 'Prijavi se' })).toBeVisible();
  await expect(page.getByRole('menu', { name: 'Profil i račun' }).getByRole('menuitem', { name: 'Odjavi se' })).toHaveCount(0);
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
  const registriraj = page.getByRole('button', { name: 'Registriraj se', exact: true });
  await expect(registriraj).toBeDisabled();
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
