import { expect, test } from '@playwright/test';

test('naslovnica prikazuje navigaciju i informativne poveznice bez headera', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.header')).toHaveCount(0);
  await expect(page.locator('.avatar')).toHaveCount(0);
  await expect(page.getByText('v0.3.0-closed-alpha.1')).toHaveCount(0);
  await expect(page.getByText('Hrvatska multiplayer igra riječi')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'KALADONT online' })).toBeVisible();
  await expect(page.locator('.ilustracija')).toHaveCount(0);

  const footer = page.locator('.landing-footer');
  const novosti = footer.getByRole('link', { name: 'Što je novo?' });
  await expect(novosti).toHaveAttribute('href', '/novosti');
  await expect(footer.getByRole('link', { name: 'Pomozi poboljšati igru' })).toHaveAttribute('href', '/povratne-informacije');
  await expect(footer.getByRole('button', { name: 'Uvjeti i privatnost' })).toBeVisible();

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('button', { name: 'Igraj' })).toBeVisible();
  await expect(navigacija.getByRole('link', { name: 'Pravila' })).toHaveAttribute('href', '/pravila');
  await expect(navigacija.getByRole('link', { name: 'Ljestvice' })).toHaveAttribute('href', '/ljestvice');
  await expect(navigacija.getByRole('link', { name: 'Moj profil' })).toHaveAttribute('href', '/profil');
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/prijava');
  await expect(navigacija.getByRole('link', { name: 'Registriraj se' })).toHaveAttribute('href', '/registracija');
  await expect(navigacija.getByRole('link', { name: 'Postavke' })).toHaveAttribute('href', '/postavke');
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCount(0);

  await navigacija.getByRole('button', { name: 'Igraj' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Kako želiš igrati?' });
  const opcije = dijalog.getByRole('link');
  await expect(opcije).toHaveCount(3);
  await expect(opcije.nth(0)).toHaveAttribute('href', '/red?mod=dva_igraca');
  await expect(opcije.nth(1)).toHaveAttribute('href', '/red?mod=cetiri_igraca');
  await expect(opcije.nth(2)).toHaveAttribute('href', '/soba/kreiraj');

  await page.keyboard.press('Escape');
  await expect(dijalog).toBeHidden();

  await novosti.click();
  await expect(page).toHaveURL('/novosti');
  await expect(page.getByRole('heading', { name: 'Što je novo' })).toBeVisible();
});

test('mobilna naslovnica skriva header i prikazuje poveznice u footeru', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.ilustracija')).toHaveCount(0);
  await expect(page.locator('.header')).toHaveCount(0);
  await expect(page.locator('.avatar')).toHaveCount(0);
  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'Što je novo?' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Pomozi poboljšati igru' })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Uvjeti i privatnost' })).toBeVisible();

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija).toBeVisible();
  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);
});

const viewportiBezScrolla = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 1280, height: 720 },
  { width: 1366, height: 657 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

for (const fontZaDisleksiju of [false, true]) {
  for (const viewport of viewportiBezScrolla) {
    test(`naslovnica stane u ekran bez scrolla ${viewport.width}x${viewport.height}${fontZaDisleksiju ? ' (font za disleksiju)' : ''}`, async ({ page }) => {
      if (fontZaDisleksiju) {
        await page.addInitScript(() => window.localStorage.setItem('kaladont_font_postavke_v1', 'true'));
      }
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.locator('.landing-footer')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const { scrollHeight, clientHeight } = await page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));
      expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
    });
  }
}

test('na niskom desktop ekranu ilustracija se skriva', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 500 });
  await page.goto('/');
  await expect(page.locator('.scena-2d5d')).toBeHidden();
});

test('na drugim stranicama header prikazuje povratnu strelicu', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Pravila' }).click();
  await expect(page).toHaveURL(/\/pravila-kaladonta\?tema=pravila$/);

  const povratak = page.getByRole('button', { name: 'Nazad' });
  await expect(povratak).toBeVisible();
  await expect(povratak).toHaveCSS('height', '80px');
  await expect(page.getByRole('link', { name: 'Početna' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Što je novo?' })).toHaveCount(0);
  await expect(povratak.locator('img')).toHaveAttribute('src', '/ikone/03-nazad.png');

  await povratak.click();
  await expect(page).toHaveURL('/');

  await page.getByRole('link', { name: 'Pravila' }).click();
  await page.getByRole('link', { name: 'Moj profil' }).click();
  await expect(page).toHaveURL('/profil');
  const pocetna = page.getByRole('link', { name: 'Početna' });
  await expect(pocetna).toBeVisible();
  await expect(pocetna).toHaveCSS('height', '80px');
  await expect(pocetna.locator('img')).toHaveAttribute('src', '/ikone/04-naslovna.png');
  await pocetna.click();
  await expect(page).toHaveURL('/');
});

test('ruta partije nema header ni na završnom prikazu', async ({ page }) => {
  await page.goto('/partija/nepostojeca-partija');
  await expect(page.getByRole('banner')).toHaveCount(0);
});