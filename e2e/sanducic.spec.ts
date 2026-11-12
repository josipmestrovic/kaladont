import { expect, test, type Page } from '@playwright/test';

async function cekajGostSesiju(page: Page): Promise<string> {
  await page.goto('/');
  await expect(page.getByRole('banner').locator('.avatar')).toBeVisible({ timeout: 20_000 });
  const token = await page.evaluate(() => localStorage.getItem('kaladont_gost_token') ?? '');
  expect(token.length).toBeGreaterThan(10);
  return token;
}

async function seedPoruku(page: Page, token: string, tekst: string): Promise<string> {
  const odgovor = await page.request.post('http://127.0.0.1:3001/api/sanducic/test', {
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    data: { tekst },
  });
  expect(odgovor.ok()).toBe(true);
  const tijelo = (await odgovor.json()) as { ok: true; id: string };
  return tijelo.id;
}

test('feed prikazuje tekst, auto-čita i briše sve', async ({ page }) => {
  const token = await cekajGostSesiju(page);
  const tekst = `Bravo! Otključano dostignuće test ${Date.now()}.`;
  await seedPoruku(page, token, tekst);

  await expect(page.locator('.sanducic-toast')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toBeVisible();

  await page.getByRole('link', { name: /Obavijesti/ }).first().click();
  await expect(page).toHaveURL('/obavijesti');
  await expect(page.getByRole('heading', { name: 'Obavijesti' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nove' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(tekst)).toBeVisible();
  await expect(page.getByText('Novo', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Označi sve pročitanim' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Obriši sve obavijesti' })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('banner').locator('.avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Obavijesti', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toHaveCount(0);

  await page.getByRole('link', { name: 'Obavijesti', exact: true }).click();
  await expect(page.getByText('Nema novih obavijesti.')).toBeVisible();
  // exact: inače hvata i „Prikaži sve” / „Obriši sve obavijesti”
  await page.getByRole('button', { name: 'Sve', exact: true }).click();
  await expect(page.getByText(tekst)).toBeVisible();
  page.once('dialog', (dijalog) => dijalog.accept());
  await page.getByRole('button', { name: 'Obriši sve obavijesti' }).click();
  await expect(page.getByText('Zasad nema obavijesti.')).toBeVisible();
});

test('toast se potisne u redu bez gubitka badgea', async ({ page }) => {
  const token = await cekajGostSesiju(page);
  await seedPoruku(page, token, `Potiskivanje ${Date.now()}`);

  await expect(page.locator('.sanducic-toast')).toBeVisible({ timeout: 15_000 });
  await page.goto('/red?mod=dva_igraca');
  await expect(page.locator('.sanducic-toast')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('banner').locator('.avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toBeVisible({ timeout: 15_000 });
});
