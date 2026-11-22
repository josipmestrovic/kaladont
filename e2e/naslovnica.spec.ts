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
    await expect(footer.getByRole('link', { name: 'Povratne informacije' })).toHaveAttribute(
      'href',
      '/povratne-informacije',
    );
    await expect(footer.getByRole('link', { name: 'Uvjeti' })).toHaveAttribute('href', '/uvjeti');
    await expect(footer.getByRole('link', { name: 'Privatnost' })).toHaveAttribute('href', '/privatnost');
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
  const footerLinkovi = footer.locator('nav a');
  await expect(footerLinkovi).toHaveCount(4);
  await expect(footerLinkovi.nth(0)).toHaveAttribute('href', '/pravila-kaladonta');
  await expect(footerLinkovi.nth(0)).toHaveText('Pravila');
  await expect(footerLinkovi.nth(1)).toHaveAttribute('href', '/povratne-informacije');
  await expect(footerLinkovi.nth(1)).toHaveText('Povratne informacije');
  await expect(footerLinkovi.nth(2)).toHaveAttribute('href', '/uvjeti');
  await expect(footerLinkovi.nth(3)).toHaveAttribute('href', '/privatnost');

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('button', { name: 'Igraj', exact: true })).toBeVisible();
  await expect(navigacija.getByRole('link', { name: 'Izazovi', exact: true })).toHaveAttribute(
    'href',
    '/izazovi',
  );
  await expect(navigacija.getByRole('button', { name: 'Trening', exact: true })).toBeVisible();
  await expect(navigacija.getByRole('link', { name: 'Privatna soba', exact: true })).toHaveAttribute(
    'href',
    '/soba/kreiraj',
  );
  await expect(navigacija.getByTestId('naslovnica-turniri')).toBeVisible();
  await expect(navigacija.getByTestId('naslovnica-turniri')).toContainText('Turniri');
  await expect(navigacija.getByTestId('naslovnica-turniri')).toContainText('Izlazi uskoro');

  const izbornik = await otvoriProfilIzbornik(page);
  await expect(izbornik.getByRole('menuitem', { name: 'Moj profil' })).toHaveAttribute('href', '/profil');
  await expect(izbornik.getByRole('menuitem', { name: 'Misije' })).toHaveAttribute('href', '/misije');
  await expect(izbornik.getByRole('menuitem', { name: 'Ljestvice' })).toHaveAttribute('href', '/ljestvice');
  await expect(izbornik.getByRole('menuitem', { name: 'Pravila' })).toHaveAttribute(
    'href',
    '/pravila-kaladonta',
  );
  await expect(izbornik.getByRole('menuitem', { name: 'Postavke' })).toHaveAttribute('href', '/postavke');
  await expect(izbornik.getByRole('menuitem', { name: 'Prijavi se' })).toHaveAttribute('href', '/prijava');
  await expect(izbornik.getByRole('menuitem', { name: 'Registriraj se' })).toHaveAttribute(
    'href',
    '/registracija',
  );
  await expect(izbornik.getByRole('menuitem', { name: 'Odjavi se' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await navigacija.getByRole('button', { name: 'Igraj', exact: true }).click();
  await expect(page).toHaveURL(/\/red\?mod=tri_igraca&pravila=klasicni/);
  await expect(page.getByTestId('red-oznaka-izbora')).toHaveText('Brza igra · Troboj · Klasična pravila');
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
  expect(ssr).toContain('Vidi što je novo');
  expect(ssr).toContain('href="/novosti"');
  expect(ssr).not.toContain(`href="/novosti#${najnovije.sidro}"`);

  await page.goto('/');
  const blok = page.locator('.zadnje-azuriranje');
  await expect(blok).toHaveText(`Zadnje ažuriranje: ${najnovije.datumHr} · Vidi što je novo`);
  await expect(blok.locator('.razdjelnik')).toHaveAttribute('aria-hidden', 'true');
  await expect(blok.locator('time')).toHaveAttribute('datetime', najnovije.objavljeno);
  await expect(blok.locator('time')).toHaveText(najnovije.datumHr);

  const poveznice = blok.getByRole('link');
  await expect(poveznice).toHaveCount(1);
  await expect(poveznice).toHaveText('Vidi što je novo');
  await expect(poveznice).toHaveAttribute('href', '/novosti');

  await poveznice.click();
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

      const blok = page.locator('.zadnje-azuriranje');
      const footer = page.locator('.landing-footer');
      await expect(blok).toBeVisible();
      await expect(footer.locator('.copyright')).toBeVisible({ timeout: 20_000 });
      if (svijetla) await expect(page.locator('html')).toHaveAttribute('data-tema', 'svijetla');
      if (disleksija) await expect(page.locator('html')).toHaveAttribute('data-font-disleksiju', '');
      for (const poveznica of await blok.getByRole('link').all()) {
        await expect(poveznica).toBeVisible();
      }
      // Blok je brat footera, a ne njegov dio: postojeći testovi mjere raspored unutar footera.
      await expect(footer.locator('.zadnje-azuriranje')).toHaveCount(0);
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
          blok: okvir('.zadnje-azuriranje'),
          footer: okvir('.landing-footer'),
          susjedi: {
            navigacija: okvir('.glavna-navigacija'),
            kontrolePristupacnosti: okvir('.kontrole-pristupacnosti-naslovnica'),
            ilustracija: okvir('.scena-2d5d'),
          },
          sirinaSadrzaja: document.documentElement.scrollWidth,
          sirinaProzora: document.documentElement.clientWidth,
        };
      });

      expect(mjere.sirinaSadrzaja).toBeLessThanOrEqual(mjere.sirinaProzora);
      expect(mjere.blok).not.toBeNull();
      expect(mjere.footer).not.toBeNull();
      expect(mjere.susjedi.navigacija).not.toBeNull();
      const okvirBloka = mjere.blok!;
      expect(okvirBloka.x).toBeGreaterThanOrEqual(0);
      expect(okvirBloka.x + okvirBloka.width).toBeLessThanOrEqual(mjere.sirinaProzora + 1);
      expect(okvirBloka.y + okvirBloka.height).toBeLessThanOrEqual(mjere.footer!.y + 1);
      for (const [naziv, okvir] of Object.entries(mjere.susjedi)) {
        if (okvir) expect(preklapajuSe(okvirBloka, okvir), `${naziv} se preklapa s blokom`).toBe(false);
      }

      if (sirina >= 1000) {
        // Desktop je visinski ugođen bez viška prostora: blok ne smije povećati visinu
        // samo kad naslovnica već staje u viewport (Brza igra CTA može ga prelaziti).
        const visine = await page.evaluate((visinaViewporta) => {
          const element = document.querySelector<HTMLElement>('.zadnje-azuriranje')!;
          const sBlokom = document.documentElement.scrollHeight;
          element.style.display = 'none';
          const bezBloka = document.documentElement.scrollHeight;
          element.style.display = '';
          return { sBlokom, bezBloka, stajeUViewport: bezBloka < visinaViewporta };
        }, visina);
        if (visine.stajeUViewport) expect(visine.sBlokom).toBe(visine.bezBloka);
      }
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
  await expect(footer.getByRole('link', { name: 'Povratne informacije' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Uvjeti' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Privatnost' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Novosti' })).toHaveCount(0);
  await expect(footer.getByRole('link', { name: 'O igri' })).toHaveCount(0);

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
  const izbornik = await otvoriProfilIzbornik(page);
  await izbornik.getByRole('menuitem', { name: 'Pravila' }).click();
  await expect(page).toHaveURL('/pravila-kaladonta');

  const povratak = page.getByRole('button', { name: 'Nazad' });
  await expect(povratak).toBeVisible();
  await expect(povratak).toHaveCSS('height', '44px');
  const header = page.getByRole('banner');
  await expect(header.getByRole('link', { name: 'Početna' })).toHaveCount(0);
  // „O igri” nije u headeru (ni više u footeru naslovnice).
  await expect(header.getByRole('link', { name: 'O igri' })).toHaveCount(0);
  await expect(povratak.locator('img')).toHaveAttribute('src', '/ikone/03-nazad.png');

  await povratak.click();
  await expect(page).toHaveURL('/');

  const izbornik2 = await otvoriProfilIzbornik(page);
  await izbornik2.getByRole('menuitem', { name: 'Pravila' }).click();
  const izbornik3 = await otvoriProfilIzbornik(page);
  await izbornik3.getByRole('menuitem', { name: 'Moj profil' }).click();
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

    const izbornik = await otvoriProfilIzbornik(page);
    await izbornik.getByRole('menuitem', { name: 'Moj profil' }).click();
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

test('mobilna navigacija ima pet stavki s razmakom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.landing-footer')).toBeVisible({ timeout: 20_000 });

  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  const igraj = navigacija.getByRole('button', { name: 'Igraj', exact: true });
  const izazovi = navigacija.getByRole('link', { name: 'Izazovi', exact: true });
  const trening = navigacija.getByRole('button', { name: 'Trening', exact: true });
  const privatna = navigacija.getByRole('link', { name: 'Privatna soba', exact: true });
  const turniri = navigacija.getByTestId('naslovnica-turniri');

  const igrajBox = await igraj.boundingBox();
  const izazoviBox = await izazovi.boundingBox();
  const treningBox = await trening.boundingBox();
  const privatnaBox = await privatna.boundingBox();
  const turniriBox = await turniri.boundingBox();
  expect(igrajBox && izazoviBox && treningBox && privatnaBox && turniriBox).toBeTruthy();

  const razmak1 = izazoviBox!.y - (igrajBox!.y + igrajBox!.height);
  const razmak2 = treningBox!.y - (izazoviBox!.y + izazoviBox!.height);
  const razmak3 = privatnaBox!.y - (treningBox!.y + treningBox!.height);
  const razmak4 = turniriBox!.y - (privatnaBox!.y + privatnaBox!.height);
  expect(razmak1).toBeGreaterThanOrEqual(5);
  expect(razmak2).toBeGreaterThanOrEqual(5);
  expect(razmak3).toBeGreaterThanOrEqual(5);
  expect(razmak4).toBeGreaterThanOrEqual(5);
});
