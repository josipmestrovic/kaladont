import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem('kursori-test-inicijaliziran')) return;
    window.localStorage.removeItem('kaladont_kursor_v1');
    window.sessionStorage.setItem('kursori-test-inicijaliziran', 'true');
  });
});

test('postavke prikazuju sve setove, pregled stanja i pamte odabir', async ({ page }) => {
  await page.goto('/postavke');
  await expect(page.getByRole('heading', { name: 'Kursor' })).toBeVisible();
  await expect(page.getByText(/Prilagođeni kursor prikazuje se na računalima/)).toBeVisible();

  const odabir = page.locator('.odabir-kursora');
  const setovi = odabir.locator('input[name="set-kursora"]');
  await expect(setovi).toHaveCount(5);
  await expect(odabir.locator('.pregled-stanja img')).toHaveCount(15);
  await expect(odabir.locator('input[name="set-kursora"]:checked')).toHaveValue('05-kaladont');

  const ucitaneSlike = await odabir.locator('.pregled-stanja img').evaluateAll((slike) =>
    slike.every((slika) => (slika as HTMLImageElement).naturalWidth === 80),
  );
  expect(ucitaneSlike).toBe(true);

  await odabir.locator('input[name="set-kursora"][value="01-klasik"]').check({ force: true });
  await odabir.getByRole('radio', { name: 'Strelica', exact: true }).check();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('kaladont_kursor_v1')))
    .toBe('{"set":"01-klasik","rezim":"strelica"}');
  await page.mouse.move(200, 200);
  const finoPokazivalo = await page.evaluate(
    () => matchMedia('(pointer: fine) and (hover: hover)').matches,
  );
  const kursor = () => page.evaluate(() => getComputedStyle(document.body).cursor);
  if (finoPokazivalo) await expect.poll(kursor).toContain('/kursori/01-klasik/normal.png');
  else await expect.poll(kursor).not.toContain('/kursori/');

  await page.reload();
  await expect(page.locator('.odabir-kursora input[name="set-kursora"]:checked')).toHaveValue('01-klasik');
  await expect(page.locator('.odabir-kursora input[name="rezim-kursora"]:checked')).toHaveValue('strelica');
  await page.mouse.move(200, 200);
  if (finoPokazivalo) await expect.poll(kursor).toContain('/kursori/01-klasik/normal.png');
  else await expect.poll(kursor).not.toContain('/kursori/');
});

test('desktop kursor mijenja stanje samo dok je primarna tipka pritisnuta', async ({ page }) => {
  await page.goto('/postavke');
  const podrzavaPokazivac = await page.evaluate(
    () => matchMedia('(pointer: fine) and (hover: hover)').matches,
  );
  test.skip(!podrzavaPokazivac, 'Test traži uređaj s finim pokazivačem.');

  const kursor = () => page.evaluate(() => getComputedStyle(document.body).cursor);
  await page.mouse.move(200, 200);
  await expect.poll(kursor).toContain('/kursori/05-kaladont/hover.png');

  await page.mouse.down();
  await expect.poll(kursor).toContain('/kursori/05-kaladont/klik.png');
  await page.mouse.up();
  await expect.poll(kursor).toContain('/kursori/05-kaladont/hover.png');

  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { button: 0, pointerType: 'mouse' })));
  await expect.poll(kursor).toContain('/kursori/05-kaladont/hover.png');

  await page.mouse.down();
  await expect.poll(kursor).toContain('/kursori/05-kaladont/klik.png');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect.poll(kursor).toContain('/kursori/05-kaladont/hover.png');
  await page.mouse.up();
});

test('touch-only uređaj zadržava standardni kursor i prikazuje napomenu', async ({ page }) => {
  await page.goto('/postavke');
  const touchOnly = await page.evaluate(
    () => !matchMedia('(pointer: fine) and (hover: hover)').matches,
  );
  test.skip(!touchOnly, 'Test traži touch-only uređaj.');

  await expect(page.getByText(/Na uređajima koji se koriste dodirom ostaje standardni pokazivač/)).toBeVisible();
  const kursor = await page.evaluate(() => getComputedStyle(document.body).cursor);
  expect(kursor).not.toContain('/kursori/');
});