import { expect, test } from '@playwright/test';

async function poslovniZahtjeviImajuApiPrefiks(page: import('@playwright/test').Page): Promise<void> {
  const propusti: string[] = [];
  page.on('request', (zahtjev) => {
    const url = new URL(zahtjev.url());
    if (url.origin !== new URL(page.url()).origin) return;
    if (url.pathname.startsWith('/socket.io/') || url.pathname === '/zdravlje') return;
    if (zahtjev.resourceType() === 'document' || url.pathname.startsWith('/_app/')) return;
    if (['xhr', 'fetch'].includes(zahtjev.resourceType()) && !url.pathname.startsWith('/api/')) {
      propusti.push(`${zahtjev.method()} ${url.pathname}`);
    }
  });
  await page.goto('/profil');
  await expect(page.locator('body')).toContainText('Gost');
  expect(propusti).toEqual([]);
}

test('direktan ulazak i refresh privatnog profila rade iz buildanog servera', async ({ page }) => {
  await poslovniZahtjeviImajuApiPrefiks(page);
  await page.reload();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(page.locator('body')).toContainText('Gost');
});

test('stranice s queryjem, hashom, ljestvicom i javnim profilom rade nakon refresha', async ({ page, request }) => {
  await page.goto('/profil?tab=postavke#avatar');
  await expect(page).toHaveURL(/\/profil\?tab=postavke#avatar$/);
  await page.reload();
  await expect(page).toHaveURL(/\/profil\?tab=postavke#avatar$/);

  await page.goto('/ljestvica');
  await expect(page.getByRole('heading', { name: 'Ljestvica' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ljestvica' })).toBeVisible();

  const email = `http-e2e-${Date.now()}@example.com`;
  const registracija = await request.post('/api/racuni/registracija', {
    data: { email, lozinka: 'lozinka123', nadimak: 'HttpE2E' },
  });
  expect(registracija.ok()).toBe(true);
  const podaci = (await registracija.json()) as { igracId: string };

  await page.goto(`/profil/javni/${podaci.igracId}`);
  await expect(page).toHaveURL(new RegExp(`/profil/javni/${podaci.igracId}$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/profil/javni/${podaci.igracId}$`));
});

test('nepoznata API ruta vraća JSON 404, a reset stranica ostaje HTML', async ({ page }) => {
  const apiOdgovor = await page.request.get('/api/ne-postoji', { headers: { accept: 'text/html' } });
  expect(apiOdgovor.status()).toBe(404);
  expect(apiOdgovor.headers()['content-type']).toContain('application/json');
  await expect(apiOdgovor.json()).resolves.toEqual({ ok: false, greska: 'API ruta ne postoji.' });

  await page.goto('/racuni/resetiraj-lozinku?token=test');
  await expect(page.locator('form')).toBeVisible();
});
