import { expect, test } from '@playwright/test';

const NASLOVNICA_TITLE = 'Kaladont Online - Multiplayer igra riječi';
const NASLOVNICA_DESCRIPTION =
  'Zaigraj kaladont i pokušaj ostati zadnji za stolom! Testiraj svoje znanje jezika, osvajaj nagrade, rangiraj se na ljestvicama i još mnogo toga.';

test('naslovnica SSR šalje title i description crawleru', async ({ page, request }) => {
  const odgovor = await request.get('/');
  expect(odgovor.ok()).toBe(true);
  const html = await odgovor.text();
  expect(html).toContain(`<title>${NASLOVNICA_TITLE}</title>`);
  expect(html).toContain(`content="${NASLOVNICA_DESCRIPTION}"`);
  expect(html).toContain('KALADONT');
  expect(html).toContain('/pravila-kaladonta');

  await page.goto('/');
  await expect(page).toHaveTitle(NASLOVNICA_TITLE);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', NASLOVNICA_DESCRIPTION);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
});

for (const sirina of [320, 390, 1440]) {
  test(`copyright i licence ostaju dostupni ${sirina}px`, async ({ page }, podaciTesta) => {
    await page.setViewportSize({ width: sirina, height: sirina < 1000 ? 568 : 900 });
    await page.goto('/');
    const footer = page.locator('.landing-footer');
    // Duži timeout zbog gost-sesije / CI latency.
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
    await page.screenshot({ path: podaciTesta.outputPath('footer.png') });
    await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
    await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');
    await footer.getByRole('link', { name: 'O igri' }).click();
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

test('naslovnica prikazuje navigaciju i header samo s profilom', async ({ page }) => {
  await page.goto('/');

  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  await expect(header.getByRole('button', { name: 'Nazad' })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'Početna' })).toHaveCount(0);
  await expect(header.getByRole('link', { name: 'O igri' })).toHaveCount(0);
  // Avatar ovisi o gost-sesiji + /profil — duži timeout zbog CI opterećenja.
  await expect(header.locator('.avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Obavijesti' })).toBeVisible();
  await expect(page.getByText('v0.3.0-closed-alpha.1')).toHaveCount(0);
  await expect(page.getByText('Hrvatska multiplayer igra riječi')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'KALADONT online' })).toBeVisible();
  await expect(page.locator('.ilustracija')).toHaveCount(0);

  const footer = page.locator('.landing-footer');
  const oIgri = footer.getByRole('link', { name: 'O igri' });
  await expect(oIgri).toHaveAttribute('href', '/o-igri');
  await expect(footer.getByRole('link', { name: 'Pomozi poboljšati igru' })).toHaveAttribute('href', '/povratne-informacije');
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');

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

test('mobilna naslovnica ima header samo-desno i poveznice u footeru', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.ilustracija')).toHaveCount(0);
  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  await expect(header.getByRole('button', { name: 'Nazad' })).toHaveCount(0);
  await expect(header.locator('.avatar')).toBeVisible({ timeout: 20_000 });
  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'O igri' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Pomozi poboljšati igru' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toBeVisible();

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija).toBeVisible();
  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);
});

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
  // „O igri” je u footeru naslovnice, ne u headeru.
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

for (const { sirina, visina } of [
  { sirina: 390, visina: 844 },
  { sirina: 1440, visina: 900 },
]) {
  test(`avatar ne skače s naslovnice na profil (${sirina}px)`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: visina });
    await page.goto('/');
    const avatarNaslovnica = page.getByRole('banner').locator('.avatar');
    await expect(avatarNaslovnica).toBeVisible({ timeout: 20_000 });
    const boxNaslovnica = await avatarNaslovnica.boundingBox();
    expect(boxNaslovnica).not.toBeNull();

    await page.getByRole('banner').locator('a.profil-link').click();
    await expect(page).toHaveURL('/profil');
    const avatarProfil = page.getByRole('banner').locator('.avatar');
    await expect(avatarProfil).toBeVisible({ timeout: 20_000 });
    const boxProfil = await avatarProfil.boundingBox();
    expect(boxProfil).not.toBeNull();

    expect(Math.abs(boxProfil!.x - boxNaslovnica!.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(boxProfil!.y - boxNaslovnica!.y)).toBeLessThanOrEqual(2);
  });
}

test('ruta partije nema header ni na završnom prikazu', async ({ page }) => {
  await page.goto('/partija/nepostojeca-partija');
  await expect(page.getByRole('banner')).toHaveCount(0);
});

for (const sirina of [320, 390]) {
  test(`DEMO i H1 dijele lijevi rub na ${sirina}px`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'KALADONT online' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const demo = page.locator('.demo-oznaka');
    await expect(demo).toBeVisible();
    await expect(page.locator('#naslov-kaladont')).toBeVisible();

    const poravnanje = await page.evaluate(() => {
      const oznaka = document.querySelector('.demo-oznaka') as HTMLElement;
      const naslov = document.querySelector('#naslov-kaladont') as HTMLElement;
      const navigacija = document.querySelector('.glavna-navigacija') as HTMLElement;
      const spremljeniTransform = oznaka.style.transform;
      oznaka.style.transform = 'none';
      const demoRect = oznaka.getBoundingClientRect();
      const h1Rect = naslov.getBoundingClientRect();
      const navRect = navigacija.getBoundingClientRect();
      oznaka.style.transform = spremljeniTransform;
      return {
        razlikaDemoH1: Math.abs(demoRect.left - h1Rect.left),
        razlikaH1Nav: Math.abs(h1Rect.left - navRect.left),
        demoSirina: demoRect.width,
        h1Sirina: h1Rect.width,
      };
    });
    expect(poravnanje.razlikaDemoH1).toBeLessThanOrEqual(2);
    expect(poravnanje.razlikaH1Nav).toBeLessThanOrEqual(2);
    expect(poravnanje.demoSirina).toBeLessThan(poravnanje.h1Sirina);
  });
}

test('padajuće riječi nisu montirane na 1000px i manje', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(0);
});

test('padajuće riječi montirane iznad 1000px i demontiraju se pri suženju', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(0);
});

test('mobilna navigacija ima veći razmak stavki i odvojene prekidače', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  const igraj = navigacija.getByRole('button', { name: 'Igraj' });
  const profil = navigacija.getByRole('link', { name: 'Moj profil' });
  const zadnjaStavka = navigacija.getByRole('link', { name: 'Registriraj se' });
  const kontrole = page.locator('.kontrole-pristupacnosti-naslovnica');

  const igrajBox = await igraj.boundingBox();
  const profilBox = await profil.boundingBox();
  const zadnjaBox = await zadnjaStavka.boundingBox();
  const kontroleBox = await kontrole.boundingBox();
  expect(igrajBox && profilBox && zadnjaBox && kontroleBox).toBeTruthy();

  const razmakStavki = profilBox!.y - (igrajBox!.y + igrajBox!.height);
  const razmakPrekidaca = kontroleBox!.y - (zadnjaBox!.y + zadnjaBox!.height);
  expect(razmakStavki).toBeGreaterThanOrEqual(5);
  expect(razmakPrekidaca).toBeGreaterThan(razmakStavki);

  const fontPrekidaca = await page
    .locator('.kontrole-pristupacnosti-naslovnica .naziv-kontrole')
    .first()
    .evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontPrekidaca).toBe('16px');
});
