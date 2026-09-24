import { expect, test } from '@playwright/test';
import { dodajIgrace, zatvoriIgrace, type E2EIgrac } from './pomocnici/igraci.js';

test('buildani image podržava kratku partiju i ponovnu igru', async ({
  browser,
  context,
  page,
}) => {
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 1)),
  ];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);

    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await expect(gost.getByText(/Prijavljeni igrači \(2 \/ 8\)/)).toBeVisible();

    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());

    await vlasnik.getByRole('button', { name: 'Ne znam' }).click();
    const dijalog = vlasnik.getByRole('dialog', { name: 'Predati potez?' });
    await expect(dijalog).toBeVisible();
    await dijalog.getByRole('button', { name: 'Da' }).click();

    await expect(vlasnik.getByRole('heading', { name: 'Završni poredak' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(gost.getByRole('heading', { name: 'Završni poredak' })).toBeVisible({
      timeout: 20_000,
    });

    await vlasnik.getByRole('link', { name: 'Igraj ponovno' }).click();
    await expect(vlasnik).toHaveURL(new RegExp(`/soba/${kodSobe}$`));
  } finally {
    await zatvoriIgrace(igraci);
  }
});
