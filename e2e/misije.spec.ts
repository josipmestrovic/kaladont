import { expect, test, type Page } from '@playwright/test';

async function registrirajSe(page: Page, nadimak: string): Promise<void> {
  const email = `e2e-misije-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto('/registracija');
  await page.getByPlaceholder('Tvoj nadimak').fill(nadimak);
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Lozinka').fill('lozinka123');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await expect(page).toHaveURL('/profil/avatar?registracija=1');
  await page.getByRole('button', { name: 'Završi registraciju' }).click();
  await expect(page).toHaveURL('/potvrdi-email?dobrodosao=1');
}

test('navigacija vodi na Misije; gost vidi objašnjenje', async ({ page }) => {
  await page.goto('/');
  const navigacija = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(navigacija.getByRole('link', { name: 'Misije' })).toHaveAttribute('href', '/misije');
  await navigacija.getByRole('link', { name: 'Misije' }).click();
  await expect(page).toHaveURL('/misije');
  await expect(page.getByRole('heading', { name: 'Misije', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Misije za registrirane igrače' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Prijavi se' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registriraj se' })).toBeVisible();
});

test('registrirani igrač vidi 1 dnevnu i 3 tjedne; zamjena s potvrdom', async ({ page }) => {
  await registrirajSe(page, 'MisE2E');
  await page.goto('/misije');

  await expect(page.getByRole('heading', { name: 'Dnevne misije' })).toBeVisible();
  await expect(page.getByText(/1 \/ 3 sačuvane/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tjedne misije' })).toBeVisible();
  await expect(page.getByText(/0 \/ 3 završene/)).toBeVisible();

  const dnevneKartice = page.locator('.sekcija').filter({ has: page.getByRole('heading', { name: 'Dnevne misije' }) }).locator('.kartica-misije');
  await expect(dnevneKartice).toHaveCount(1);
  const tjedneKartice = page.locator('.sekcija').filter({ has: page.getByRole('heading', { name: 'Tjedne misije' }) }).locator('.kartica-misije');
  await expect(tjedneKartice).toHaveCount(3);

  const nazivPrije = await dnevneKartice.first().locator('h3').innerText();
  await dnevneKartice.first().getByRole('button', { name: /Zamijeni misiju/ }).click();
  const dijalog = page.getByRole('dialog', { name: 'Zamijeniti ovu misiju?' });
  await expect(dijalog).toBeVisible();
  await dijalog.getByRole('button', { name: 'Odustani' }).click();
  await expect(dijalog).toBeHidden();
  await expect(dnevneKartice.first().locator('h3')).toHaveText(nazivPrije);

  await dnevneKartice.first().getByRole('button', { name: /Zamijeni misiju/ }).click();
  await page.getByRole('dialog', { name: 'Zamijeniti ovu misiju?' }).getByRole('button', { name: 'Zamijeni' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Misija zamijenjena.' })).toBeVisible();
  await expect(dnevneKartice.first().getByRole('button', { name: /Zamijeni misiju/ })).toBeDisabled();
});

test('druga zamjena iste vrste pokazuje grešku kvote', async ({ page }) => {
  await registrirajSe(page, 'MisKvota');
  await page.goto('/misije');
  const dnevna = page.locator('.sekcija').filter({ has: page.getByRole('heading', { name: 'Dnevne misije' }) }).locator('.kartica-misije').first();
  await dnevna.getByRole('button', { name: /Zamijeni misiju/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Zamijeni' }).click();
  await expect(page.getByText('Misija zamijenjena.')).toBeVisible();
  await expect(dnevna.getByRole('button', { name: /Zamijeni misiju/ })).toBeDisabled();
  await expect(page.getByText(/Današnja zamjena je iskorištena/)).toBeVisible();
});
