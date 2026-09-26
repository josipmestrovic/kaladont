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

  await page.goto('/profil');
  const privatniSažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(privatniSažetak.getByRole('heading', { name: 'Kaladont CV' })).toHaveCount(0);
  await expect(privatniSažetak.getByRole('heading', { name: 'O kandidatu' })).toHaveCount(0);
  const privatniOdlomak = privatniSažetak.locator('.cv-biografija');
  await expect(privatniOdlomak).toContainText('Još nemamo dovoljno informacija za opis ovog igrača.');
  await expect(privatniOdlomak).toHaveText(/U čarima Kaladonta uživa tek prvi dan\.$/);
  await expect(privatniSažetak.locator('p')).toHaveCount(1);
  await expect(privatniSažetak.locator('header, section, h2, h3, h4')).toHaveCount(0);

  const zaglavlje = page.locator('.zaglavlje-profila');
  const zaglavljeOkvir = await zaglavlje.boundingBox();
  const cvOkvir = await privatniSažetak.boundingBox();
  expect(zaglavljeOkvir).not.toBeNull();
  expect(cvOkvir).not.toBeNull();
  expect(cvOkvir!.x).toBeGreaterThanOrEqual(zaglavljeOkvir!.x + zaglavljeOkvir!.width - 2);

  const privatniBio = await privatniOdlomak.textContent();
  await page.goto(`/profil/javni/${igrac.igracId}`);
  const javniSažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(javniSažetak.getByRole('heading', { name: 'Kaladont CV' })).toHaveCount(0);
  await expect(javniSažetak.getByRole('heading', { name: 'O kandidatu' })).toHaveCount(0);
  await expect(javniSažetak.locator('.cv-biografija')).toHaveText(privatniBio ?? '');
  await expect(javniSažetak.locator('p')).toHaveCount(1);
  await expect(javniSažetak.locator('header, section, h2, h3, h4')).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  const mobilniHeader = await page.locator('.zaglavlje-profila').boundingBox();
  const mobilniCv = await javniSažetak.boundingBox();
  expect(mobilniHeader).not.toBeNull();
  expect(mobilniCv).not.toBeNull();
  expect(mobilniCv!.y).toBeGreaterThanOrEqual(mobilniHeader!.y + mobilniHeader!.height - 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.goto('/profil?tab=postavke');
  await expect(page.locator('.cv-sazetak')).toHaveCount(0);
});

test('gost vidi samo poruku za registraciju, uključujući na mobitelu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/profil');
  const sažetak = page.getByRole('region', { name: 'Biografija Kaladont igrača' });
  await expect(sažetak.getByRole('status')).toHaveText('Ovaj igrač igra kao gost. Opis će biti dostupan nakon registracije.');
  await expect(sažetak.locator('p')).toHaveCount(1);
  await expect(sažetak.locator('header, section, h2, h3, h4')).toHaveCount(0);
  const zaglavlje = await page.locator('.zaglavlje-profila').boundingBox();
  const cvOkvir = await sažetak.boundingBox();
  expect(zaglavlje).not.toBeNull();
  expect(cvOkvir).not.toBeNull();
  expect(cvOkvir!.x).toBeGreaterThanOrEqual(zaglavlje!.x + zaglavlje!.width - 2);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Biografija Kaladont igrača' }).getByRole('status')).toHaveText('Ovaj igrač igra kao gost. Opis će biti dostupan nakon registracije.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});