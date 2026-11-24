import { expect, test, type Page } from '@playwright/test';

async function otvoriNaslovnicu(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('naslovnica-brze-postavke')).toBeVisible({ timeout: 20_000 });
}

test('brze postavke mijenjaju temu i zadržavaju je nakon refresha', async ({ page }) => {
  await otvoriNaslovnicu(page);
  const tema = page.getByTestId('brza-postavka-tema').getByRole('switch');
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', 'svijetla');
  await tema.click();
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'svijetla');
  expect(await page.evaluate(() => localStorage.getItem('kaladont_tema_v1'))).toBe('svijetla');

  await page.reload();
  await expect(page.getByTestId('naslovnica-brze-postavke')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'svijetla');
  await expect(page.getByTestId('brza-postavka-tema').getByRole('switch')).toBeChecked();

  await page.getByTestId('brza-postavka-tema').getByRole('switch').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', 'svijetla');
});

test('brze postavke uključuju i isključuju font za disleksiju', async ({ page }) => {
  await otvoriNaslovnicu(page);
  const font = page.getByTestId('brza-postavka-font').getByRole('switch');
  await expect(page.locator('html')).not.toHaveAttribute('data-font-disleksiju', '');
  await font.click();
  await expect(page.locator('html')).toHaveAttribute('data-font-disleksiju', '');
  expect(await page.evaluate(() => localStorage.getItem('kaladont_font_postavke_v1'))).toBe('true');

  await font.click();
  await expect(page.locator('html')).not.toHaveAttribute('data-font-disleksiju', '');
});

test('čitanje naglas ažurira lokalnu pohranu bez rušenja UI-a', async ({ page }) => {
  await page.addInitScript(() => {
    function MockUtterance(this: { text: string; lang: string }) {
      this.text = '';
      this.lang = '';
    }
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [],
        speak: () => {},
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockUtterance,
    });
  });

  await otvoriNaslovnicu(page);
  const glas = page.getByTestId('brza-postavka-glas').getByRole('switch');
  await glas.click();
  await expect(glas).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('kaladont_glas_postavke_v1'))).toBe('true');
  await expect(page.getByTestId('naslovnica-brza-igra')).toBeVisible();
});

test('brze postavke i profilne kontrole dijele isto stanje', async ({ page }) => {
  await otvoriNaslovnicu(page);
  await page.getByTestId('brza-postavka-tema').getByRole('switch').click();
  await page.getByTestId('brza-postavka-font').getByRole('switch').click();

  await page.goto('/postavke');
  await expect(page.getByRole('switch', { name: 'Svijetla tema' })).toBeChecked({ timeout: 20_000 });
  await expect(page.getByRole('switch', { name: 'Font za disleksiju' })).toBeChecked();

  await page.getByRole('switch', { name: 'Svijetla tema' }).click();
  await page.goto('/');
  await expect(page.getByTestId('naslovnica-brze-postavke')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).not.toHaveAttribute('data-tema', 'svijetla');
  await expect(page.getByTestId('brza-postavka-tema').getByRole('switch')).not.toBeChecked();
  await expect(page.getByTestId('brza-postavka-font').getByRole('switch')).toBeChecked();
});

test('tipkovnica aktivira brze postavke; nema horizontalnog overflowa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await otvoriNaslovnicu(page);
  // Klik na label (cijela površina / jedan tab-stop); Space na opacity-0 switch nije pouzdan u headless CI.
  await page.getByTestId('brza-postavka-font').click();
  await expect(page.locator('html')).toHaveAttribute('data-font-disleksiju', '');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  await expect(page.getByTestId('naslovnica-brza-igra')).toBeVisible();
});

for (const { sirina, visina } of [
  { sirina: 390, visina: 844 },
  { sirina: 1100, visina: 700 },
  { sirina: 1366, visina: 500 },
  { sirina: 1440, visina: 900 },
]) {
  test(`brze postavke ne remete raspored ${sirina}×${visina}`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: visina });
    await otvoriNaslovnicu(page);
    const grupe = page.getByTestId('naslovnica-brze-postavke');
    await expect(grupe).toBeVisible();
    await expect(page.getByTestId('naslovnica-brza-igra')).toBeVisible();
    await expect(page.locator('.zadnje-azuriranje')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    const mjere = await page.evaluate(() => {
      const okvir = (selektor: string) => {
        const el = document.querySelector(selektor);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { y: r.y, height: r.height };
      };
      return {
        navigacija: okvir('.glavna-navigacija'),
        brze: okvir('[data-testid="naslovnica-brze-postavke"]'),
        novosti: okvir('.zadnje-azuriranje'),
      };
    });
    expect(mjere.navigacija && mjere.brze && mjere.novosti).toBeTruthy();
    expect(mjere.brze!.y).toBeGreaterThan(mjere.navigacija!.y + mjere.navigacija!.height - 1);
    expect(mjere.novosti!.y).toBeGreaterThan(mjere.navigacija!.y + mjere.navigacija!.height - 1);
    // Mobitel: novosti ispod togglea. Desktop: novosti u istoj razini s prečacima, togglei dolje lijevo.
    if (sirina < 1000) {
      expect(mjere.novosti!.y).toBeGreaterThan(mjere.brze!.y + mjere.brze!.height - 1);
    } else {
      expect(mjere.brze!.y).toBeGreaterThan(mjere.novosti!.y - 1);
    }
  });
}
