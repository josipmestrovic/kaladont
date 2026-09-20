import { expect, test } from '@playwright/test';

test('naslovnica prikazuje novi header, navigaciju i modal igre', async ({ page }) => {
  await page.goto('/');

  const novosti = page.getByRole('link', { name: 'Što je novo?' });
  await expect(novosti).toBeVisible();
  await expect(novosti).toHaveAttribute('href', '/novosti');
  await expect(page.getByRole('link', { name: 'Moj profil' })).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Igraj' })).toHaveCount(0);
  await expect(page.getByText('v0.3.0-closed-alpha.1')).toHaveCount(0);
  await expect(page.getByText('Hrvatska online igra riječi')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'KALADONT multiplayer' })).toBeVisible();
  await expect(page.locator('.ilustracija')).toHaveCount(0);

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('button', { name: 'Igraj' })).toBeVisible();
  await expect(navigacija.getByRole('link', { name: 'Pravila' })).toHaveAttribute('href', '/pravila');
  await expect(navigacija.getByRole('link', { name: 'Ljestvica' })).toHaveAttribute('href', '/ljestvica');
  await expect(navigacija.getByRole('link', { name: 'Moja statistika' })).toHaveAttribute('href', '/profil#statistika');
  await expect(navigacija.getByRole('link', { name: 'Prijavi se' })).toHaveAttribute('href', '/prijava');
  await expect(navigacija.getByRole('link', { name: 'Registriraj se' })).toHaveAttribute('href', '/registracija');
  await expect(navigacija.getByRole('link', { name: 'Postavke' })).toHaveCount(0);
  await expect(navigacija.getByRole('button', { name: 'Odjavi se' })).toHaveCount(0);
  await expect(navigacija.getByRole('button', { name: 'Uvjeti i privatnost' })).toHaveCount(0);
  await expect(page.locator('.landing-footer').getByRole('button', { name: 'Uvjeti i privatnost' })).toBeVisible();
  const pravila = navigacija.getByRole('link', { name: 'Pravila' });
  await expect(pravila).toHaveCSS('color', 'rgb(26, 24, 21)');
  await expect(pravila.locator('.ikona-sucelja')).toHaveCSS('background-color', 'rgb(26, 24, 21)');
  const dimenzijeStavki = await navigacija.locator('.navigacijska-stavka').evaluateAll((stavke) =>
    stavke.map((stavka) => ({ sirina: stavka.getBoundingClientRect().width, visina: stavka.getBoundingClientRect().height })),
  );
  expect(dimenzijeStavki).toHaveLength(6);
  expect(new Set(dimenzijeStavki.map(({ sirina }) => sirina)).size).toBe(1);
  expect(new Set(dimenzijeStavki.map(({ visina }) => visina)).size).toBe(1);

  await navigacija.getByRole('button', { name: 'Igraj' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Kako želiš igrati?' });
  const opcije = dijalog.getByRole('link');
  await expect(opcije).toHaveCount(3);
  await expect(opcije.nth(0)).toHaveAttribute('href', '/red?mod=dva_igraca');
  await expect(opcije.nth(1)).toHaveAttribute('href', '/red?mod=cetiri_igraca');
  await expect(opcije.nth(2)).toHaveAttribute('href', '/soba/kreiraj');

  await page.keyboard.press('Escape');
  await expect(dijalog).toBeHidden();

  const rasporedNovosti = await novosti.evaluate((poveznica) => {
    const ikona = poveznica.querySelector('.novosti-ikona')!.getBoundingClientRect();
    const tekst = poveznica.querySelector('span:last-child')!.getBoundingClientRect();
    return { ikonaIznadTeksta: ikona.bottom <= tekst.top };
  });
  expect(rasporedNovosti.ikonaIznadTeksta).toBe(true);
  await expect(page.locator('.novosti-ikona')).toHaveCSS('background-color', 'rgb(26, 24, 21)');
  await novosti.hover();
  await expect(page.locator('.novosti-ikona')).toHaveCSS('background-color', 'rgb(228, 87, 46)');
  await expect(novosti).toHaveCSS('color', 'rgb(228, 87, 46)');

  await novosti.click();
  await expect(page).toHaveURL('/novosti');
  await expect(page.getByRole('heading', { name: 'Što je novo' })).toBeVisible();
});

test('mobilna naslovnica skriva ilustraciju i ostavlja profil desno', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.ilustracija')).toHaveCount(0);
  const novosti = page.getByRole('link', { name: 'Što je novo?' });
  const profil = page.getByRole('link', { name: 'Moj profil' });
  await expect(novosti).toBeVisible();
  await expect(profil).toBeVisible();
  const headerRaspored = await page.locator('.header-sadrzaj').evaluate((header) => {
    const novostiOkvir = header.querySelector('.novosti-link')!.getBoundingClientRect();
    const avatar = header.querySelector('.header-avatar')!.getBoundingClientRect();
    const nadimakElement = header.querySelector('.profil-ime')!;
    const nadimak = nadimakElement.getBoundingClientRect();
    return {
      visineUskladene: Math.abs(novostiOkvir.height - avatar.height) <= 1,
      nadimakSkriven: getComputedStyle(nadimakElement).display === 'none',
    };
  });
  expect(headerRaspored.visineUskladene).toBe(true);
  expect(headerRaspored.nadimakSkriven).toBe(true);

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija).toBeVisible();
  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);
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
  await expect(page.locator('.povratak-ikona')).toHaveCSS('background-color', 'rgb(228, 87, 46)');

  await povratak.click();
  await expect(page).toHaveURL('/');

  await page.getByRole('link', { name: 'Pravila' }).click();
  await page.getByRole('link', { name: 'Moj profil' }).click();
  await expect(page).toHaveURL('/profil');
  const pocetna = page.getByRole('link', { name: 'Početna' });
  await expect(pocetna).toBeVisible();
  await expect(pocetna).toHaveCSS('height', '80px');
  await expect(page.locator('.pocetna-ikona')).toHaveCSS('background-color', 'rgb(228, 87, 46)');
  await pocetna.click();
  await expect(page).toHaveURL('/');
});

test('ruta partije nema header ni na završnom prikazu', async ({ page }) => {
  await page.goto('/partija/nepostojeca-partija');
  await expect(page.getByRole('banner')).toHaveCount(0);
});