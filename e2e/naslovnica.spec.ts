import { expect, test } from '@playwright/test';

for (const sirina of [320, 390, 1440]) {
  test(`copyright i licence ostaju dostupni ${sirina}px`, async ({ page }, podaciTesta) => {
    await page.setViewportSize({ width: sirina, height: sirina < 1000 ? 568 : 900 });
    await page.goto('/');
    const footer = page.locator('.landing-footer');
    // Boot drži children dok sesija/ikone ne završe — duži timeout umjesto racy provjere „Učitavanje…”.
    await expect(footer.locator('.copyright')).toHaveText('© 2026 Kaladont. Sva prava pridržana.', {
      timeout: 20_000,
    });
    await page.evaluate(() => document.fonts.ready);
    const nav = await footer.locator('nav').boundingBox();
    const copyright = await footer.locator('.copyright').boundingBox();
    if (sirina >= 1000) {
      expect(copyright!.x).toBeGreaterThan(nav!.x + nav!.width);
      expect(Math.abs(copyright!.y + copyright!.height / 2 - nav!.y - nav!.height / 2)).toBeLessThanOrEqual(1);
    } else {
      expect(copyright!.y).toBeGreaterThanOrEqual(nav!.y + nav!.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: podaciTesta.outputPath('footer.png') });
    await footer.getByRole('button', { name: 'Uvjeti i privatnost' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'O igri i licence' }).click();
    await expect(page).toHaveURL('/o-igri');
    await expect(page.getByRole('heading', { name: 'O igri' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/deed.hr',
    );
    await expect(page.getByRole('link', { name: 'CC BY 4.0', exact: true })).toBeVisible();
    await expect(page.getByText(/Micaha Laniera/)).toBeVisible();
    await expect(page.getByText(/The Ultimate Games Icons Library/)).toHaveCount(0);
    const obavijest = await page.request.get('/licence/lucide.txt');
    expect(obavijest.ok()).toBe(true);
    expect(await obavijest.text()).toContain('Cole Bemis');
  });
}

test('naslovnica prikazuje navigaciju i informativne poveznice bez headera', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.header')).toHaveCount(0);
  // Avatar ovisi o gost-sesiji + /profil — duži timeout zbog boot/retry pod CI opterećenjem.
  await expect(page.locator('.sanducic-profil-zona .avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Obavijesti' })).toBeVisible();
  await expect(page.getByText('v0.3.0-closed-alpha.1')).toHaveCount(0);
  await expect(page.getByText('Hrvatska multiplayer igra riječi')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'KALADONT online' })).toBeVisible();
  await expect(page.locator('.ilustracija')).toHaveCount(0);

  const footer = page.locator('.landing-footer');
  const oIgri = footer.getByRole('link', { name: 'O igri' });
  await expect(oIgri).toHaveAttribute('href', '/o-igri');
  await expect(footer.getByRole('link', { name: 'Pomozi poboljšati igru' })).toHaveAttribute('href', '/povratne-informacije');
  await expect(footer.getByRole('button', { name: 'Uvjeti i privatnost' })).toBeVisible();

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('button', { name: 'Igraj' })).toBeVisible();
  await expect(navigacija.getByRole('link', { name: 'Pravila' })).toHaveAttribute('href', '/pravila-kaladonta');
  await expect(navigacija.getByRole('link', { name: 'Misije' })).toHaveAttribute('href', '/misije');
  await expect(navigacija.getByRole('link', { name: 'Ljestvice' })).toHaveAttribute('href', '/ljestvice');
  await expect(navigacija.getByRole('link', { name: 'Moj profil' })).toHaveAttribute('href', '/profil');
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/prijava');
  await expect(navigacija.getByRole('link', { name: 'Registriraj se' })).toHaveAttribute('href', '/registracija');
  await expect(navigacija.getByRole('link', { name: 'Postavke' })).toHaveAttribute('href', '/postavke');
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCount(0);

  await navigacija.getByRole('button', { name: 'Igraj' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Kako želiš igrati?' });
  const opcije = dijalog.getByRole('link');
  await expect(opcije).toHaveCount(4);
  await expect(opcije.nth(0)).toHaveAttribute('href', '/red?mod=dva_igraca');
  await expect(opcije.nth(1)).toHaveAttribute('href', '/red?mod=cetiri_igraca');
  await expect(opcije.nth(2)).toHaveAttribute('href', '/zagrijavanje');
  await expect(opcije.nth(3)).toHaveAttribute('href', '/soba/kreiraj');

  await page.keyboard.press('Escape');
  await expect(dijalog).toBeHidden();

  await oIgri.click();
  await expect(page).toHaveURL('/o-igri');
  await expect(page.getByRole('heading', { name: 'O igri' })).toBeVisible();
});

test('mobilna naslovnica skriva header i prikazuje poveznice u footeru', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.ilustracija')).toHaveCount(0);
  await expect(page.locator('.header')).toHaveCount(0);
  await expect(page.locator('.sanducic-profil-zona .avatar')).toBeVisible({ timeout: 20_000 });
  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'O igri' })).toBeVisible();
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
  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await navigacija.getByRole('link', { name: 'Pravila' }).click();
  await expect(page).toHaveURL('/pravila-kaladonta');

  const povratak = page.getByRole('button', { name: 'Nazad' });
  await expect(povratak).toBeVisible();
  await expect(povratak).toHaveCSS('height', '44px');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Početna' })).toHaveCount(0);
  // „O igri” je tema u navigaciji pomoći; u headeru ostaje samo na naslovnici.
  await expect(header.getByRole('link', { name: 'O igri' })).toHaveCount(0);
  await expect(povratak.locator('img')).toHaveAttribute('src', '/ikone/03-nazad.png');

  await povratak.click();
  await expect(page).toHaveURL('/');

  await navigacija.getByRole('link', { name: 'Pravila' }).click();
  await page.getByRole('banner').getByRole('link', { name: 'Moj profil' }).click();
  await expect(page).toHaveURL('/profil');
  const pocetna = page.getByRole('link', { name: 'Početna' });
  await expect(pocetna).toBeVisible();
  await expect(pocetna).toHaveCSS('height', '44px');
  await expect(pocetna.locator('img')).toHaveAttribute('src', '/ikone/04-naslovna.png');
  await pocetna.click();
  await expect(page).toHaveURL('/');
});

test('ruta partije nema header ni na završnom prikazu', async ({ page }) => {
  await page.goto('/partija/nepostojeca-partija');
  await expect(page.getByRole('banner')).toHaveCount(0);
});