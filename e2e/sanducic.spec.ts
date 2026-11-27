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

test('feed automatski čita, zadržava popis i briše', async ({ page }) => {
  const token = await cekajGostSesiju(page);
  const tekst = `Bravo! Otključano dostignuće test ${Date.now()}.`;
  await seedPoruku(page, token, tekst);

  await expect(page.locator('.sanducic-toast')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toBeVisible();

  await page.getByRole('link', { name: /Obavijesti/ }).first().click();
  await expect(page).toHaveURL('/obavijesti');
  await expect(page.getByRole('heading', { name: 'Obavijesti' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sve', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nepročitane' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Označi sve pročitanima' })).toHaveCount(0);
  await expect(page.getByText(tekst)).toBeVisible();
  // Ulazak na /obavijesti automatski označi sve pročitanima; poruka ostaje na popisu.
  await expect(page.getByText('Pročitano', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Obriši sve obavijesti' })).toBeEnabled();

  await page.goto('/');
  await expect(page.getByRole('banner').locator('.avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Obavijesti', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toHaveCount(0);

  await page.getByRole('link', { name: 'Obavijesti', exact: true }).click();
  await expect(page.getByText(tekst)).toBeVisible();
  page.once('dialog', (dijalog) => dijalog.accept());
  await page.getByRole('button', { name: 'Obriši sve obavijesti' }).click();
  await expect(page.getByText('Zasad nema obavijesti.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Obriši sve obavijesti' })).toBeDisabled();
});

test('toast se potisne u redu bez gubitka badgea', async ({ page }) => {
  const token = await cekajGostSesiju(page);
  await seedPoruku(page, token, `Potiskivanje ${Date.now()}`);

  await expect(page.locator('.sanducic-toast')).toBeVisible({ timeout: 15_000 });
  await page.goto('/red?mod=tri_igraca&pravila=klasicni');
  await expect(page.locator('.sanducic-toast')).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('banner').locator('.avatar')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: /Obavijesti,/ })).toBeVisible({ timeout: 15_000 });
});

test('gost na desktopu nema pregled obavijesti u profilnoj kartici', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await cekajGostSesiju(page);
  await expect(page.getByTestId('naslovnica-napredak')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('naslovnica-obavijesti')).toHaveCount(0);
});

test('registrirani desktop: pager, čitanje miče poruku, prazno stanje', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const odgovor = await page.request.post('http://127.0.0.1:3001/api/racuni/registracija', {
    data: {
      email: `obavijesti-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123',
      potvrdaDob16: true,
      prihvacamUvjete: true,
      nadimak: 'ObavE2E',
    },
  });
  const tijelo = await odgovor.json() as { sesijskiToken: string };
  expect(odgovor.status(), JSON.stringify(tijelo)).toBe(200);

  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, tijelo.sesijskiToken);

  const a = await seedPoruku(page, tijelo.sesijskiToken, `Pager A ${Date.now()}`);
  const b = await seedPoruku(page, tijelo.sesijskiToken, `Pager B ${Date.now()}`);
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();

  await page.goto('/');
  const pregled = page.getByTestId('naslovnica-obavijesti');
  await expect(pregled).toBeVisible({ timeout: 20_000 });
  await expect(pregled.locator('.naslov-poruke').first()).toBeVisible();
  await expect(pregled.getByRole('button', { name: 'Označi pročitanim' })).toBeVisible();

  // Dobrodošlica + seedane poruke: čitaj dok pager ne ostane prazan.
  for (let i = 0; i < 12; i += 1) {
    const prazno = page.getByTestId('naslovnica-obavijesti-prazno');
    if (await prazno.isVisible().catch(() => false)) break;
    const gumb = pregled.getByRole('button', { name: 'Označi pročitanim' });
    if (!(await gumb.isVisible().catch(() => false))) break;
    const prije = await pregled.locator('.naslov-poruke').textContent().catch(() => '');
    await gumb.click();
    await Promise.race([
      prazno.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => null),
      pregled.locator('.naslov-poruke').filter({ hasNotText: prije ?? '' }).waitFor({ timeout: 8_000 }).catch(() => null),
      expect(gumb).toBeEnabled({ timeout: 8_000 }).catch(() => null),
    ]);
  }
  await expect(page.getByTestId('naslovnica-obavijesti-prazno')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: 'Vidi starije obavijesti ›' })).toBeVisible();
});
