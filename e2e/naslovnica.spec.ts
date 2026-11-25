import { expect, test } from '@playwright/test';
import { nasloviNacrta, ocekivanaIzdanja } from './pomocnici/izdanja.js';
import { otvoriProfilIzbornik } from './pomocnici/naslovnica.js';

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
    const godina = String(new Date().getFullYear());
    // Duži timeout zbog gost-sesije / CI latency.
    await expect(footer.locator('.copyright')).toContainText(`© ${godina} Kaladont`, {
      timeout: 20_000,
    });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: podaciTesta.outputPath('footer.png') });
    await expect(footer.getByRole('link', { name: 'Pravila igre' })).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
    await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');
    await expect(footer.getByRole('link', { name: 'Povratne informacije' })).toHaveCount(0);
    await page.goto('/o-igri');
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
  // Naslovnica ne prikazuje nikakvu oznaku verzije (SemVer, CalVer ni alpha).
  await expect(page.locator('main.landing')).not.toContainText(/\d+\.\d+\.\d+|alpha/i);
  await expect(page.getByText('Hrvatska multiplayer igra riječi')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'KALADONT online' })).toBeVisible();
  await expect(page.locator('.ilustracija')).toHaveCount(0);

  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'Što je novo?' })).toHaveAttribute('href', '/novosti');
  await expect(footer.getByRole('link', { name: 'Pravila igre' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');
  await expect(footer.getByRole('link', { name: 'Povratne informacije' })).toHaveCount(0);
  await expect(footer.locator('.copyright')).toContainText('Kaladont');

  await expect(page.getByTestId('naslovnica-napredak')).toBeVisible({ timeout: 20_000 });

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByTestId('naslovnica-brza-igra')).toBeVisible();
  await expect(navigacija.getByTestId('naslovnica-brza-igra')).toContainText('Troboj');
  await expect(navigacija.getByTestId('naslovnica-brza-igra')).toContainText(
    'Igraj online u troje.',
  );
  await expect(navigacija.getByTestId('naslovnica-brza-igra')).toContainText(
    'Ako nema igrača, pridružit će se botovi.',
  );
  await expect(navigacija.getByRole('link', { name: 'Izazovi', exact: true })).toHaveAttribute(
    'href',
    '/izazovi',
  );
  await expect(navigacija.getByRole('link', { name: 'Trening', exact: true })).toHaveAttribute(
    'href',
    '/trening',
  );
  await expect(navigacija.getByTestId('naslovnica-privatna-soba')).toHaveAttribute(
    'href',
    '/soba/kreiraj',
  );
  await expect(navigacija.getByTestId('naslovnica-ljestvice')).toHaveAttribute('href', '/ljestvice');
  await expect(navigacija.getByTestId('naslovnica-ljestvice')).toContainText('Ljestvice');
  await expect(navigacija.getByTestId('naslovnica-turniri')).toHaveCount(0);

  const sporedna = page.getByRole('navigation', { name: 'Napredak i pomoć' });
  await expect(sporedna.getByTestId('naslovnica-misije')).toHaveAttribute('href', '/misije');
  await expect(sporedna.getByTestId('naslovnica-kolekcija')).toHaveAttribute('href', '/profil#rijeci');
  await expect(sporedna.getByTestId('naslovnica-kolekcija-labela')).toContainText(/riječ/, {
    timeout: 20_000,
  });
  await expect(sporedna.getByTestId('naslovnica-misije-labela')).toContainText(/aktivn/, {
    timeout: 20_000,
  });
  await expect(sporedna.getByTestId('naslovnica-dostignuca')).toHaveAttribute(
    'href',
    '/profil#dostignuca',
  );
  await expect(sporedna.getByTestId('naslovnica-dostignuca-labela')).toContainText(/zvjezdica/);
  await expect(sporedna.getByTestId('naslovnica-pravila')).toHaveCount(0);
  await expect(sporedna.getByTestId('naslovnica-kolekcija-badge')).toHaveCount(0);

  const izbornik = await otvoriProfilIzbornik(page);
  await expect(izbornik.getByRole('menuitem', { name: 'Moj profil' })).toHaveAttribute('href', '/profil');
  await expect(izbornik.getByRole('menuitem', { name: 'Uredi avatar' })).toHaveCount(0);
  await expect(izbornik.getByRole('menuitem', { name: 'Postavke' })).toHaveAttribute('href', '/postavke');
  await expect(izbornik.getByTestId('naslovnica-pravila')).toHaveAttribute('href', '/pravila-kaladonta');
  await expect(izbornik.getByRole('menuitem', { name: 'Pravila igre' })).toBeVisible();
  await expect(izbornik.getByRole('menuitem', { name: 'Povratne informacije' })).toHaveCount(0);
  await expect(izbornik.getByRole('menuitem', { name: 'Misije' })).toHaveCount(0);
  await expect(izbornik.getByRole('menuitem', { name: 'Ljestvice' })).toHaveCount(0);
  await expect(izbornik.getByRole('menuitem', { name: 'Prijavi se' })).toHaveAttribute('href', '/prijava');
  await expect(izbornik.getByRole('menuitem', { name: 'Registriraj se' })).toHaveAttribute(
    'href',
    '/registracija',
  );
  await expect(izbornik.getByRole('menuitem', { name: 'Odjavi se' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await navigacija.getByTestId('naslovnica-brza-igra').click();
  await expect(page).toHaveURL(/\/red\?mod=tri_igraca&pravila=klasicni/);
  await expect(page.getByTestId('red-oznaka-izbora')).toHaveText('Brza igra · Troboj · Klasična pravila');
});

test('naslovnica prikazuje XP sažetak i gostujući CTA bez linka na profil', async ({ page }) => {
  await page.goto('/');
  const napredak = page.getByTestId('naslovnica-napredak');
  await expect(napredak).toBeVisible({ timeout: 20_000 });
  await expect(napredak).toContainText(/LVL|Moj napredak/);
  await expect(napredak).not.toHaveAttribute('href');

  const gostCta = page.getByTestId('naslovnica-gost-registracija');
  await expect(gostCta).toBeVisible({ timeout: 20_000 });
  await expect(gostCta).toHaveAttribute('href', '/registracija');
  await expect(gostCta).toContainText('Sačuvaj svoj napredak.');
  await expect(gostCta).toContainText('Registriraj se');
  const gostBlok = page.getByTestId('naslovnica-gost-cta');
  await expect(gostBlok).toContainText('Već imaš račun?');
  await expect(page.getByTestId('naslovnica-gost-prijava')).toHaveAttribute('href', '/prijava');

  const brzaIgra = page.getByTestId('naslovnica-brza-igra');
  await expect(brzaIgra.getByTestId('naslovnica-brza-igra-gost-napomena')).toBeVisible({
    timeout: 20_000,
  });
  await expect(brzaIgra.getByTestId('naslovnica-brza-igra-gost-napomena')).toHaveText(
    'Besplatno · Bez registracije',
  );

  const izazovi = page.getByTestId('naslovnica-izazovi');
  await expect(izazovi).toContainText(/Svladavaj \d+ sve težih izazova/);
  // Katalog s 0 završenih prikazuje 0% traku; bez kataloga ostaje samo opis.
  const traka = izazovi.locator('.izazovi-napredak');
  if ((await traka.count()) > 0) {
    await expect(traka.locator('.izazovi-napredak__broj')).toContainText(
      /0 \/ \d+ završenih izazova/,
    );
  }
});

test('naslovnica prikazuje brze postavke gostu', async ({ page }) => {
  await page.goto('/');
  const grupe = page.getByTestId('naslovnica-brze-postavke');
  await expect(grupe).toBeVisible({ timeout: 20_000 });
  await expect(grupe.getByRole('switch', { name: 'Svijetli način' })).toBeVisible();
  await expect(grupe.getByRole('switch', { name: 'Čitanje naglas' })).toBeVisible();
  await expect(grupe.getByRole('switch', { name: 'Font za disleksiju' })).toBeVisible();
});

test('/novosti prikazuje objavljena izdanja po datumima, najnovije prvo', async ({ page, request }) => {
  const izdanja = ocekivanaIzdanja();
  expect(izdanja.length).toBeGreaterThan(0);

  const odgovor = await request.get('/novosti', { maxRedirects: 0 });
  expect(odgovor.status()).toBe(200);
  const html = await odgovor.text();
  for (const izdanje of izdanja) {
    expect(html).toContain(`id="${izdanje.sidro}"`);
    expect(html).toContain(`datetime="${izdanje.objavljeno}"`);
  }
  // Stara sidra i oznake 0.x više ne postoje; nacrti se ne prikazuju ni u SSR HTML-u.
  expect(html).not.toContain('id="v0-');
  expect(html).not.toContain('Kaladont 0.');
  for (const naslovNacrta of nasloviNacrta()) {
    expect(html).not.toContain(naslovNacrta);
  }

  const mapa = await request.get('/sitemap.xml');
  expect(mapa.ok()).toBe(true);
  expect(await mapa.text()).toContain('/novosti');

  await page.goto('/novosti');
  await expect(page).toHaveTitle(/Novosti/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.getByRole('heading', { name: 'Novosti', exact: true })).toBeVisible();
  // U javnom sučelju nema SemVer ni CalVer oznaka; hrvatski datum ima razmake pa ne odgovara uzorku.
  await expect(page.locator('main.novosti')).not.toContainText(/\d+\.\d+\.\d+|alpha/i);

  const zapisi = page.locator('article.objava');
  const redoslijed = await zapisi.evaluateAll((elementi) => elementi.map((element) => element.id));
  expect(redoslijed).toEqual(izdanja.map((izdanje) => izdanje.sidro));
  for (const [indeks, izdanje] of izdanja.entries()) {
    const zapis = zapisi.nth(indeks);
    const vrijeme = zapis.locator('h2 time');
    await expect(vrijeme).toHaveAttribute('datetime', izdanje.objavljeno);
    await expect(vrijeme).toHaveText(izdanje.datumHr);
    await expect(zapis.locator('.objava-naslov')).toHaveText(izdanje.naslov);
    await expect(zapis.locator('ul.stavke li').first()).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'O igri' }).first()).toHaveAttribute('href', '/o-igri');
});

test('naslovnica prikazuje zadnje ažuriranje iz istog izvora kao Novosti', async ({ page, request }) => {
  const [najnovije] = ocekivanaIzdanja();
  expect(najnovije).toBeDefined();

  // Blok mora biti u SSR HTML-u: CI i produkcijski workflow provjeravaju ga bez preglednika.
  const ssr = await (await request.get('/')).text();
  expect(ssr).toContain(`datetime="${najnovije.objavljeno}"`);
  expect(ssr).toContain('Što je novo?');
  expect(ssr).toContain('href="/novosti"');
  expect(ssr).not.toContain(`href="/novosti#${najnovije.sidro}"`);

  await page.goto('/');
  const footer = page.locator('.landing-footer');
  const blok = footer.locator('.zadnje-azuriranje');
  await expect(blok).toContainText(`Ažurirano ${najnovije.datumHr}`);
  await expect(blok).toContainText('Što je novo?');
  await expect(blok.locator('time')).toHaveAttribute('datetime', najnovije.objavljeno);
  await expect(blok.locator('time')).toHaveText(najnovije.datumHr);
  await expect(footer.locator('.copyright')).toContainText('Kaladont');
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toBeVisible();

  const poveznica = blok.getByRole('link', { name: 'Što je novo?' });
  await expect(poveznica).toHaveAttribute('href', '/novosti');

  await poveznica.click();
  await expect(page).toHaveURL('/novosti');
  await expect(page.getByRole('heading', { name: 'Novosti', exact: true })).toBeVisible();
});

type Okvir = { x: number; y: number; width: number; height: number };

function preklapajuSe(a: Okvir, b: Okvir): boolean {
  return a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
}

// Tema ne mijenja raspored, pa se svijetla tema provjerava zajedno s fontom za disleksiju.
for (const { sirina, visina } of [
  { sirina: 320, visina: 568 },
  { sirina: 380, visina: 760 },
  { sirina: 390, visina: 844 },
  { sirina: 1100, visina: 700 },
  { sirina: 1440, visina: 900 },
  { sirina: 1366, visina: 500 },
]) {
  for (const { svijetla, disleksija } of [
    { svijetla: false, disleksija: false },
    { svijetla: true, disleksija: true },
  ]) {
    const oznaka = `${svijetla ? 'svijetla' : 'tamna'}${disleksija ? ' + disleksija' : ''}`;
    test(`zadnje ažuriranje ne remeti raspored ${sirina}×${visina} (${oznaka})`, async ({ page }) => {
      await page.addInitScript(
        ({ svijetlaTema, font }) => {
          localStorage.setItem('kaladont_tema_v1', svijetlaTema ? 'svijetla' : 'tamna');
          localStorage.setItem('kaladont_font_postavke_v1', String(font));
        },
        { svijetlaTema: svijetla, font: disleksija },
      );
      await page.setViewportSize({ width: sirina, height: visina });
      await page.goto('/');

      const footer = page.locator('.landing-footer');
      const blok = footer.locator('.zadnje-azuriranje');
      await expect(blok).toBeVisible();
      await expect(footer.locator('.copyright')).toBeVisible({ timeout: 20_000 });
      if (svijetla) await expect(page.locator('html')).toHaveAttribute('data-tema', 'svijetla');
      if (disleksija) await expect(page.locator('html')).toHaveAttribute('data-font-disleksiju', '');
      await expect(blok.getByRole('link', { name: 'Što je novo?' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      // Svi okviri mjere se u jednom pozivu, da pomak rasporeda između mjerenja ne da lažan rezultat.
      const mjere = await page.evaluate(() => {
        const okvir = (selektor: string) => {
          const element = document.querySelector(selektor);
          if (!element) return null;
          const pravokutnik = element.getBoundingClientRect();
          if (pravokutnik.width === 0 || pravokutnik.height === 0) return null;
          return { x: pravokutnik.x, y: pravokutnik.y, width: pravokutnik.width, height: pravokutnik.height };
        };
        return {
          footer: okvir('.landing-footer'),
          susjedi: {
            navigacija: okvir('.glavna-navigacija'),
            kontrolePristupacnosti: okvir('[data-testid="naslovnica-brze-postavke"]'),
            ilustracija: okvir('.scena-2d5d'),
          },
          sirinaSadrzaja: document.documentElement.scrollWidth,
          sirinaProzora: document.documentElement.clientWidth,
        };
      });

      expect(mjere.sirinaSadrzaja).toBeLessThanOrEqual(mjere.sirinaProzora);
      expect(mjere.footer).not.toBeNull();
      expect(mjere.susjedi.navigacija).not.toBeNull();
      const okvirFootera = mjere.footer!;
      expect(okvirFootera.x).toBeGreaterThanOrEqual(0);
      expect(okvirFootera.x + okvirFootera.width).toBeLessThanOrEqual(mjere.sirinaProzora + 1);
      expect(okvirFootera.y).toBeGreaterThanOrEqual(mjere.susjedi.navigacija!.y + mjere.susjedi.navigacija!.height - 1);
      for (const [naziv, okvir] of Object.entries(mjere.susjedi)) {
        if (okvir) expect(preklapajuSe(okvirFootera, okvir), `${naziv} se preklapa s footerom`).toBe(false);
      }

      // Prirodni scroll je dopušten; CTA mora ostati u DOM-u i biti dostupan.
      const cta = page.getByTestId('naslovnica-brza-igra').locator('.cta');
      await expect(cta).toBeVisible();
      const ctaStil = await cta.evaluate((el) => getComputedStyle(el).display);
      expect(ctaStil).not.toBe('none');
    });
  }
}

test('mobilna naslovnica ima header samo-desno i poveznice u footeru', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.locator('.ilustracija')).toHaveCount(0);
  const header = page.getByRole('banner');
  await expect(header).toBeVisible();
  await expect(header.getByRole('button', { name: 'Nazad' })).toHaveCount(0);
  await expect(header.locator('.avatar')).toBeVisible({ timeout: 20_000 });
  const footer = page.locator('.landing-footer');
  await expect(footer.getByRole('link', { name: 'Pravila igre' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Povratne informacije' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'Novosti' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'O igri' })).toHaveCount(0);

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija).toBeVisible();
  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);
});

test('na niskom desktop ekranu CTA ostaje vidljiv i scroll je dopušten', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 500 });
  await page.goto('/');
  await expect(page.locator('.scena-2d5d')).toHaveCount(0);
  const cta = page.getByTestId('naslovnica-brza-igra').locator('.cta');
  await expect(cta).toBeVisible();
  expect(await cta.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
  await expect(page.locator('.landing-footer')).toBeVisible();
});

test('na drugim stranicama header prikazuje povratnu strelicu', async ({ page }) => {
  await page.goto('/');
  const izbornikPravila = await otvoriProfilIzbornik(page);
  await izbornikPravila.getByTestId('naslovnica-pravila').click();
  await expect(page).toHaveURL('/pravila-kaladonta');

  const povratak = page.getByRole('button', { name: 'Nazad' });
  await expect(povratak).toBeVisible();
  await expect(povratak).toHaveCSS('height', '44px');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Početna' })).toHaveCount(0);
  // „O igri” nije u headeru (ni više u footeru naslovnice).
  await expect(header.getByRole('link', { name: 'O igri' })).toHaveCount(0);
  await expect(povratak.locator('img.header-ikona')).toBeVisible();

  await povratak.click();
  await expect(page).toHaveURL('/');

  const izbornikPonovo = await otvoriProfilIzbornik(page);
  await izbornikPonovo.getByTestId('naslovnica-pravila').click();
  await expect(page).toHaveURL('/pravila-kaladonta');
  const izbornik = await otvoriProfilIzbornik(page);
  await izbornik.getByRole('menuitem', { name: 'Moj profil' }).click();
  await expect(page).toHaveURL(/\/profil(#pregled)?$/);
  const pocetna = page.getByRole('link', { name: 'Početna' });
  await expect(pocetna).toBeVisible();
  await expect(pocetna).toHaveCSS('height', '44px');
  await expect(pocetna.locator('img.header-ikona')).toBeVisible();
  await pocetna.click();
  await expect(page).toHaveURL('/');
});

test('naslovnica otvara dostignuća deep link na profilu', async ({ page }) => {
  await page.goto('/');
  const dostignuca = page.getByTestId('naslovnica-dostignuca');
  await expect(dostignuca).toBeVisible({ timeout: 20_000 });
  await expect(dostignuca).toHaveAttribute('href', '/profil#dostignuca');
  await expect(page.getByTestId('naslovnica-dostignuca-labela')).toContainText(/\/\d+ zvjezdica/);
  await dostignuca.click();
  await expect(page).toHaveURL(/\/profil#dostignuca/);
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

    const izbornik = await otvoriProfilIzbornik(page);
    await izbornik.getByRole('menuitem', { name: 'Moj profil' }).click();
    await expect(page).toHaveURL(/\/profil(#pregled)?$/);
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
  test(`H1 je u headeru i vidljiv na ${sirina}px`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: 844 });
    await page.goto('/');
    // Ispod 500px „online” je skriven — ostaje samo KALADONT.
    const naslov = page.getByRole('banner').getByRole('heading', { name: 'KALADONT', exact: true });
    await expect(naslov).toBeVisible();
    await expect(page.locator('#naslov-kaladont')).toBeVisible();
    await expect(page.locator('.logo-naslovnica .vrsta-igre')).toBeHidden();
    await expect(page.locator('.demo-oznaka')).toHaveCount(0);
  });
}

test('padajuće riječi nisu montirane ispod 1280px', async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 800 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(0);
});

test('padajuće riječi montirane od 1280px i demontiraju se pri suženju', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(1);
  await expect(page.getByTestId('padajuca-partija-lijevo')).toHaveCount(1);
  await expect(page.getByTestId('padajuca-partija-desno')).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.pozadina-rijeci')).toHaveCount(0);
});

test('mobilna navigacija ima pet stavki s razmakom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  const brzaIgra = navigacija.getByTestId('naslovnica-brza-igra');
  const izazovi = navigacija.getByTestId('naslovnica-izazovi');
  const trening = navigacija.getByTestId('naslovnica-trening');
  const privatna = navigacija.getByTestId('naslovnica-privatna-soba');
  const ljestvice = navigacija.getByTestId('naslovnica-ljestvice');

  const brzaIgraBox = await brzaIgra.boundingBox();
  const izazoviBox = await izazovi.boundingBox();
  const treningBox = await trening.boundingBox();
  const privatnaBox = await privatna.boundingBox();
  const ljestviceBox = await ljestvice.boundingBox();
  expect(brzaIgraBox && izazoviBox && treningBox && privatnaBox && ljestviceBox).toBeTruthy();

  const razmak1 = izazoviBox!.y - (brzaIgraBox!.y + brzaIgraBox!.height);
  const razmak2 = treningBox!.y - (izazoviBox!.y + izazoviBox!.height);
  const razmak3 = privatnaBox!.y - (treningBox!.y + treningBox!.height);
  const razmak4 = ljestviceBox!.y - (privatnaBox!.y + privatnaBox!.height);
  expect(razmak1).toBeGreaterThanOrEqual(5);
  expect(razmak2).toBeGreaterThanOrEqual(5);
  expect(razmak3).toBeGreaterThanOrEqual(5);
  expect(razmak4).toBeGreaterThanOrEqual(5);
});
