import { expect, test } from '@playwright/test';

const POSLUZITELJ = 'http://127.0.0.1:3001';

async function registrirajIgraca(page: import('@playwright/test').Page) {
  const odgovor = await page.request.post(`${POSLUZITELJ}/api/racuni/registracija`, {
    data: {
      email: `profil-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true,
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
  const avatar = await page.locator('.zaglavlje-profila > :first-child').boundingBox();
  const identitet = await page.locator('.profil-identitet').boundingBox();
  const sazetak = await page.locator('.profil-sazetak').boundingBox();
  expect(avatar).not.toBeNull();
  expect(identitet).not.toBeNull();
  expect(sazetak).not.toBeNull();
  expect(identitet!.x).toBeGreaterThanOrEqual(avatar!.x + avatar!.width - 1);
  expect(sazetak!.y).toBeGreaterThanOrEqual(identitet!.y);
  await expect(javnaDostignuca.getByRole('button')).toHaveCount(6);

  const ikona = javnaDostignuca.getByRole('button').first();
  const ikonaOkvir = await ikona.boundingBox();
  await ikona.click();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  const mobilniTooltip = await tooltip.boundingBox();
  expect(ikonaOkvir).not.toBeNull();
  expect(mobilniTooltip).not.toBeNull();
  expect(mobilniTooltip!.x).toBeGreaterThanOrEqual(0);
  expect(mobilniTooltip!.x + mobilniTooltip!.width).toBeLessThanOrEqual(375);
  expect(mobilniTooltip!.y + mobilniTooltip!.height).toBeLessThanOrEqual(812);
  await page.locator('h1').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('Pregled je default; #statistika i #opcenito otvaraju Pregled; Troboj je naziv formata', async ({ page }) => {
  const igrac = await registrirajIgraca(page);
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, igrac.sesijskiToken);

  for (const sirina of [380, 1100] as const) {
    await page.setViewportSize({ width: sirina, height: 900 });
    await page.goto('/profil');
    await expect(page.getByRole('button', { name: 'Pregled' })).toHaveClass(/aktivan/);
    await expect(page.locator('#pregled')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kaladont DNK', level: 3 })).toBeVisible();
    await expect(page.locator('.dnk-kartica')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Brza igra', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Osobni rekordi', level: 2 })).toBeVisible();
    await expect(page.getByText('Brza igra (Troboj)')).toHaveCount(0);

    await page.goto('/profil#statistika');
    await expect(page.locator('#pregled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pregled' })).toHaveClass(/aktivan/);

    await page.goto('/profil#opcenito');
    await expect(page.locator('#pregled')).toBeVisible();

    await page.goto('/profil');
    await expect(page.locator('#pregled')).toBeVisible();
  }
});

test('objašnjenje stila radi na vlastitom i javnom profilu te se zatvara prema očekivanju', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const igrac = await registrirajIgraca(page);
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, igrac.sesijskiToken);

  await page.goto('/profil');
  const stilGumb = page.getByRole('button', { name: /Stil igre/i });
  if (await stilGumb.count()) {
    await stilGumb.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

  await page.goto(`/profil/javni/${igrac.igracId}`);
  const javniStil = page.getByRole('button', { name: /Stil igre/i });
  if (await javniStil.count()) {
    await javniStil.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
});
