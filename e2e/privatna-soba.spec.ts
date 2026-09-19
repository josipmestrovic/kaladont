import { expect, test } from '@playwright/test';
import { stvoriIgrace, zatvoriIgrace } from './pomocnici/igraci.js';

test('dva igrača stvaraju privatnu sobu i pokreću partiju', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await expect(vlasnik.getByRole('heading', { name: 'Nova privatna soba' })).toBeVisible();
    await expect(vlasnik.getByRole('heading', { name: 'Dopuštene vrste riječi' })).toBeVisible();

    const imenice = vlasnik.getByRole('checkbox', { name: 'Imenice' });
    await expect(imenice).toBeChecked();
    await expect(imenice).toBeDisabled();

    await vlasnik.getByRole('button', { name: 'skupa sigurnih riječi' }).click();
    await expect(vlasnik.getByRole('tooltip')).toContainText(
      'Zbirka riječi koja uvijek ima nastavak te njihov nastavak isto ima nastavak.',
    );
    await vlasnik.keyboard.press('Escape');

    await vlasnik.getByRole('checkbox', { name: 'Glagoli' }).uncheck();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);

    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);

    await expect(vlasnik.getByRole('heading', { name: /Privatna čekaonica/ })).toBeVisible();
    await expect(gost.getByText(/Prijavljeni igrači \(2 \/ 8\)/)).toBeVisible();
    await expect(gost.locator('.vrsta-tag', { hasText: 'Imenice' })).toBeVisible();
    await expect(gost.locator('.vrsta-tag', { hasText: 'Glagoli' })).toHaveCount(0);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();

    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('pojašnjenje mrtvih slova radi na mobilnom prikazu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pravila');

  await page.getByRole('button', { name: 'mrtva slova' }).click();
  const pojasnjenje = page.getByRole('tooltip');
  await expect(pojasnjenje).toBeVisible();
  await expect(pojasnjenje).toContainText(
    'Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi.',
  );

  await page.keyboard.press('Escape');
  await expect(pojasnjenje).toBeHidden();
});