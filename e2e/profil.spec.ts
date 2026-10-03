import { expect, test } from '@playwright/test';

const POSLUZITELJ = 'http://127.0.0.1:3001';

async function registrirajIgraca(page: import('@playwright/test').Page) {
  const odgovor = await page.request.post(`${POSLUZITELJ}/api/racuni/registracija`, {
    data: {
      email: `profil-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123',
      nadimak: 'ProfilIgrac',
    },
  });
  const tijelo = await odgovor.json();
  expect(odgovor.status(), JSON.stringify(tijelo)).toBe(200);
  return tijelo as { igracId: string; sesijskiToken: string };
}

test('profili prikazuju istaknuta dostignuća i tooltip na osobnom i javnom profilu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const igrac = await registrirajIgraca(page);
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, igrac.sesijskiToken);
  await page.route('**/api/profil**', async (ruta) => {
    const odgovor = await ruta.fetch();
    const tijelo = await odgovor.json() as {
      dostignuca: { dostignuca: { id: string; razina: number; vrijednost: number; sljedeciPrag: number | null }[] };
    };
    const napredak = {
      iskusnjara: { razina: 2, vrijednost: 20, sljedeciPrag: 40 },
      glas_zajednice: { razina: 3, vrijednost: 3, sljedeciPrag: 4 },
      kaladont: { razina: 3, vrijednost: 10, sljedeciPrag: 25 },
      rijetkolovac: { razina: 2, vrijednost: 5, sljedeciPrag: 15 },
      dugometras: { razina: 2, vrijednost: 10, sljedeciPrag: 30 },
      slijepa_ulica: { razina: 2, vrijednost: 5, sljedeciPrag: 15 },
    };
    for (const dostignuce of tijelo.dostignuca.dostignuca) {
      const zapis = napredak[dostignuce.id as keyof typeof napredak];
      if (zapis) Object.assign(dostignuce, zapis);
    }
    await ruta.fulfill({ response: odgovor, json: tijelo });
  });

  await page.goto('/profil');
  const istaknutaDostignuca = page.getByRole('region', { name: 'Istaknuta dostignuća' });
  const gumbiDostignuca = istaknutaDostignuca.getByRole('button');
  await expect(gumbiDostignuca).toHaveCount(6);
  await expect(gumbiDostignuca.nth(0)).toHaveAttribute('aria-label', 'Iskusnjara, 2 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(1)).toHaveAttribute('aria-label', 'Glas zajednice, 3 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(2)).toHaveAttribute('aria-label', 'Kaladont!, 3 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(3)).toHaveAttribute('aria-label', 'Rijetkolovac, 2 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(4)).toHaveAttribute('aria-label', 'Dugometraš, 2 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(5)).toHaveAttribute('aria-label', 'Slijepa ulica, 2 od 5 zvjezdica');
  await expect(gumbiDostignuca.nth(0).locator('.ikona')).toHaveAttribute('src', '/ikone/39-iskusnjara.png');
  await gumbiDostignuca.nth(0).click();
  const opisDostignuca = page.getByRole('tooltip');
  await expect(opisDostignuca).toContainText('Dosegni razine iskustva.');
  await expect(opisDostignuca).toContainText('Napredak do sljedeće zvjezdice: 20 / 40');
  await page.locator('h1').click();
  await expect(opisDostignuca).toHaveCount(0);

  await page.goto(`/profil/javni/${igrac.igracId}`);
  const javnaDostignuca = page.getByRole('region', { name: 'Istaknuta dostignuća' });
  await expect(javnaDostignuca.getByRole('button')).toHaveCount(6);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const header = page.locator('.zaglavlje-profila');
  const avatar = await page.locator('.zaglavlje-profila > :first-child').boundingBox();
  const sazetak = await page.locator('.profil-sazetak').boundingBox();
  expect(avatar).not.toBeNull();
  expect(sazetak).not.toBeNull();
  expect(sazetak!.x).toBeGreaterThanOrEqual(avatar!.x + avatar!.width);
  await expect(javnaDostignuca.getByRole('button')).toHaveCount(6);

  const ikona = javnaDostignuca.getByRole('button').first();
  const ikonaOkvir = await ikona.boundingBox();
  await ikona.click();
  const mobilniTooltip = await page.getByRole('tooltip').boundingBox();
  expect(ikonaOkvir).not.toBeNull();
  expect(mobilniTooltip).not.toBeNull();
  expect(mobilniTooltip!.x).toBeGreaterThanOrEqual(0);
  expect(mobilniTooltip!.x + mobilniTooltip!.width).toBeLessThanOrEqual(375);
  expect(mobilniTooltip!.y + mobilniTooltip!.height).toBeLessThanOrEqual(812);
  await page.locator('h1').click();
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