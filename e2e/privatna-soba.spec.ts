import { expect, test } from '@playwright/test';
import { stvoriIgrace, zatvoriIgrace } from './pomocnici/igraci.js';

test('dva igrača stvaraju privatnu sobu i pokreću partiju', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await expect(vlasnik.getByRole('heading', { name: 'Nova privatna soba' })).toBeVisible();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);

    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);

    await expect(vlasnik.getByRole('heading', { name: /Privatna čekaonica/ })).toBeVisible();
    await expect(gost.getByText(/Prijavljeni igrači \(2 \/ 8\)/)).toBeVisible();
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();

    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());
  } finally {
    await zatvoriIgrace(igraci);
  }
});