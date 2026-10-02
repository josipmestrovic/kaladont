import { expect, test } from '@playwright/test';

const POSLUZITELJ = 'http://127.0.0.1:3001';

async function registrirajIgraca(page: import('@playwright/test').Page) {
  const odgovor = await page.request.post(`${POSLUZITELJ}/api/racuni/registracija`, {
    data: {
      email: `cv-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123',
      nadimak: 'CvE2EIgrac',
    },
  });
  expect(odgovor.status()).toBe(200);
  return (await odgovor.json()) as { igracId: string; sesijskiToken: string };
}

test('registrirani CV je isti na vlastitom i javnom profilu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const igrac = await registrirajIgraca(page);
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, igrac.sesijskiToken);
  await page.route('**/api/profil**', async (ruta) => {
    const odgovor = await ruta.fetch();
    const tijelo = await odgovor.json() as {
      kaladontCv: { istaknuto: string[] } | null;
      prosjecnaOcjenaIgre: number | null;
      dostignuca: { dostignuca: { id: string; razina: number; vrijednost: number; sljedeciPrag: number | null }[] };
    };
    if (tijelo.kaladontCv) {
      tijelo.kaladontCv.istaknuto = [
        'dostignućem „Jezični plan” (4 od 5 razina)',
        'dugim nizom prihvaćenih riječi (12)',
        'kolekcijom od 24 riječi',
        'prosječnim vremenom prihvaćenog poteza od 6,2 s u Dvoboju',
      ];
    }
    const napredak = {
      iskusnjara: { razina: 2, vrijednost: 20, sljedeciPrag: 40 },
      glas_zajednice: { razina: 3, vrijednost: 3, sljedeciPrag: 4 },
      kaladont: { razina: 3, vrijednost: 10, sljedeciPrag: 25 },
    };
    for (const dostignuce of tijelo.dostignuca.dostignuca) {
      const zapis = napredak[dostignuce.id as keyof typeof napredak];
      if (zapis) Object.assign(dostignuce, zapis);
    }
    tijelo.prosjecnaOcjenaIgre = 4.2;
    await ruta.fulfill({ response: odgovor, json: tijelo });
  });

  await page.goto('/profil');
  const privatniSažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(privatniSažetak.getByRole('heading', { name: 'Kaladont CV' })).toHaveCount(0);
  await expect(privatniSažetak.getByRole('heading', { name: 'O igraču' })).toHaveCount(1);
  const privatniOdlomak = privatniSažetak.locator('.cv-biografija');
  await expect(privatniOdlomak.locator('p')).toHaveCount(2);
  await expect(privatniOdlomak.locator('p').nth(0)).toHaveText('CvE2EIgrac još nije završio nijednu javnu partiju.');
  await expect(privatniOdlomak.locator('p').nth(1)).toHaveText('Rang se dodjeljuje nakon 10 javnih partija u Dvoboju ili Četveroboju.');
  const istaknutaDostignuca = page.getByRole('region', { name: 'Istaknuta dostignuća' });
  const gumbiDostignuca = istaknutaDostignuca.getByRole('button');
  await expect(gumbiDostignuca).toHaveCount(3);
  await expect(gumbiDostignuca.nth(0)).toHaveAttribute('aria-label', 'Iskusnjara, 2 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(1)).toHaveAttribute('aria-label', 'Glas zajednice, 3 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(2)).toHaveAttribute('aria-label', 'Kaladont!, 3 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(0).locator('.ikona')).toHaveAttribute('src', '/ikone/39-iskusnjara.png');
  await gumbiDostignuca.nth(0).click();
  const opisDostignuca = page.getByRole('tooltip');
  await expect(opisDostignuca).toContainText('Dosegni razine iskustva.');
  await expect(opisDostignuca).toContainText('Napredak do sljedeće zvjezdice: 20 / 40');
  await page.locator('h1').click();
  await expect(opisDostignuca).toHaveCount(0);

  const istaknutoCv = page.locator('.ostalo-kartica').getByRole('region', { name: 'Ističe se po' });
  await expect(istaknutoCv.locator('li')).toHaveCount(3);
  const nacini = page.getByRole('navigation', { name: 'Način igre' });
  await nacini.getByRole('button', { name: 'Dvoboj' }).click();
  await expect(page.locator('.ostalo-kartica').getByRole('region', { name: 'Ističe se po' }).locator('li')).toHaveCount(3);
  await nacini.getByRole('button', { name: 'Četveroboj' }).click();

  await page.getByRole('navigation', { name: 'Sadržaj profila' }).getByRole('button', { name: 'Dostignuća' }).click();
  await expect(page.locator('.dostignuce-kartica .medaljon img')).toHaveCount(10);
  const ikoneDostignuca = await page.locator('.dostignuce-kartica .medaljon img').evaluateAll((slike) => slike.map((slika) => slika.getAttribute('src')));
  expect(ikoneDostignuca).toEqual([
    '/ikone/39-iskusnjara.png',
    '/ikone/40-rijetkolovac.png',
    '/ikone/41-dugometras.png',
    '/ikone/42-jezik-u-plamenu.png',
    '/ikone/43-kaladont.png',
    '/ikone/44-ka-zna.png',
    '/ikone/45-lovac-na-glave.png',
    '/ikone/46-slijepa-ulica.png',
    '/ikone/47-zavrsna-rijec.png',
    '/ikone/48-glas-zajednice.png',
  ]);
  const slikeUcitane = await page.locator('.dostignuce-kartica .medaljon img').evaluateAll((slike) => slike.map((slika) => (slika as HTMLImageElement).complete && (slika as HTMLImageElement).naturalWidth > 0));
  expect(slikeUcitane).toEqual(Array.from({ length: 10 }, () => true));
  await page.getByRole('navigation', { name: 'Sadržaj profila' }).getByRole('button', { name: 'Statistika' }).click();

  const ocjenaIgre = page.locator('.ostalo-kartica .stat-kartica').filter({ hasText: 'Prosječna ocjena igre' });
  await expect(ocjenaIgre).toBeVisible();
  const ocjenaOkvir = await ocjenaIgre.boundingBox();
  const istaknutostiOkvir = await istaknutoCv.boundingBox();
  expect(ocjenaOkvir).not.toBeNull();
  expect(istaknutostiOkvir).not.toBeNull();
  expect(istaknutostiOkvir!.y).toBeGreaterThanOrEqual(ocjenaOkvir!.y + ocjenaOkvir!.height);

  const zaglavlje = page.locator('.zaglavlje-profila');
  const zaglavljeOkvir = await zaglavlje.boundingBox();
  const cvOkvir = await privatniSažetak.boundingBox();
  const avatarOkvir = await zaglavlje.locator('.avatar-uredivanje').boundingBox();
  expect(zaglavljeOkvir).not.toBeNull();
  expect(cvOkvir).not.toBeNull();
  expect(avatarOkvir).not.toBeNull();
  expect(cvOkvir!.x).toBeGreaterThanOrEqual(avatarOkvir!.x + avatarOkvir!.width);

  const privatniBio = await privatniOdlomak.textContent();
  await page.goto(`/profil/javni/${igrac.igracId}`);
  const javniSažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(javniSažetak.getByRole('heading', { name: 'Kaladont CV' })).toHaveCount(0);
  await expect(javniSažetak.getByRole('heading', { name: 'O igraču' })).toHaveCount(1);
  await expect(javniSažetak.locator('.cv-biografija')).toHaveText(privatniBio ?? '');
  await expect(javniSažetak.locator('.cv-biografija p')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Istaknuta dostignuća' }).getByRole('button')).toHaveCount(3);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const mobilniHeader = await page.locator('.zaglavlje-profila').boundingBox();
  const mobilniCv = await javniSažetak.boundingBox();
  const mobilniAvatar = await page.locator('.zaglavlje-profila > :first-child').boundingBox();
  const mobilniSazetak = await page.locator('.profil-sazetak').boundingBox();
  expect(mobilniHeader).not.toBeNull();
  expect(mobilniCv).not.toBeNull();
  expect(mobilniAvatar).not.toBeNull();
  expect(mobilniSazetak).not.toBeNull();
  expect(mobilniSazetak!.x).toBeGreaterThanOrEqual(mobilniAvatar!.x + mobilniAvatar!.width);
  await expect(page.getByRole('region', { name: 'Istaknuta dostignuća' }).getByRole('button')).toHaveCount(3);
  await page.getByRole('region', { name: 'Istaknuta dostignuća' }).getByRole('button').first().click();
  const mobilniTooltip = await page.getByRole('tooltip').boundingBox();
  expect(mobilniTooltip).not.toBeNull();
  expect(mobilniTooltip!.x).toBeGreaterThanOrEqual(0);
  expect(mobilniTooltip!.x + mobilniTooltip!.width).toBeLessThanOrEqual(375);
  expect(mobilniTooltip!.y + mobilniTooltip!.height).toBeLessThanOrEqual(812);
  await page.locator('h1').click();
  expect(mobilniCv!.x).toBeGreaterThanOrEqual(mobilniHeader!.x);
  expect(mobilniCv!.x + mobilniCv!.width).toBeLessThanOrEqual(mobilniHeader!.x + mobilniHeader!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.goto('/profil?tab=postavke');
  await expect(page.locator('.cv-sazetak')).toHaveCount(0);
});

test('gost vidi dvorečenični uvod i poziv na registraciju, uključujući na mobitelu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/profil');
  const sažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(sažetak.locator('.cv-biografija p')).toHaveCount(2);
  await expect(sažetak.locator('.cv-biografija')).toContainText('Rang se dodjeljuje nakon 10 javnih partija');
  await expect(sažetak.getByRole('heading', { name: 'O igraču' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Istaknuta dostignuća' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sačuvaj statistiku — Registriraj se' })).toBeVisible();
  const zaglavlje = await page.locator('.zaglavlje-profila').boundingBox();
  const cvOkvir = await sažetak.boundingBox();
  const avatarOkvir = await page.locator('.avatar-uredivanje').boundingBox();
  expect(zaglavlje).not.toBeNull();
  expect(cvOkvir).not.toBeNull();
  expect(avatarOkvir).not.toBeNull();
  expect(cvOkvir!.x).toBeGreaterThanOrEqual(avatarOkvir!.x + avatarOkvir!.width);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Biografija Kaladont igrača' }).locator('.cv-biografija p')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('objašnjenje stila radi na vlastitom i javnom profilu te se zatvara prema očekivanju', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const igrac = await registrirajIgraca(page);
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, igrac.sesijskiToken);

  await page.goto('/profil');
  const naziv = page.locator('.stil-naziv');
  await expect(naziv).toHaveText('neodređen');
  await naziv.click();
  const objasnjenje = page.getByRole('dialog', { name: 'Objašnjenje stila: neodređen' });
  await expect(objasnjenje).toContainText('Stil igre prikazat ćemo kad bude dovoljno podataka iz partija.');
  await objasnjenje.getByRole('button', { name: 'Zatvori objašnjenje stila' }).click();
  await expect(objasnjenje).toHaveCount(0);

  await page.locator('.stil-pomoc').click();
  await expect(objasnjenje).toBeVisible();
  await page.locator('h1').click();
  await expect(objasnjenje).toHaveCount(0);

  await naziv.click();
  await page.keyboard.press('Escape');
  await expect(objasnjenje).toHaveCount(0);

  await naziv.click();
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect(objasnjenje).toHaveCount(0);

  await page.goto(`/profil/javni/${igrac.igracId}`);
  const javniNaziv = page.locator('.stil-naziv');
  await javniNaziv.click();
  await expect(page.getByRole('dialog', { name: 'Objašnjenje stila: neodređen' })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const mobilniNaziv = page.locator('.stil-naziv');
  await mobilniNaziv.click();
  const mobilniPopup = page.getByRole('dialog', { name: 'Objašnjenje stila: neodređen' });
  const nazivOkvir = await mobilniNaziv.boundingBox();
  const popupOkvir = await mobilniPopup.boundingBox();
  expect(nazivOkvir).not.toBeNull();
  expect(popupOkvir).not.toBeNull();
  expect(popupOkvir!.y + popupOkvir!.height).toBeLessThanOrEqual(nazivOkvir!.y + 1);
  expect(popupOkvir!.width).toBeLessThanOrEqual(300);
  await mobilniPopup.getByRole('button', { name: 'Zatvori objašnjenje stila' }).click();
  await expect(mobilniPopup).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});