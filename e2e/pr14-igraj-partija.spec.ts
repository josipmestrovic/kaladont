/**
 * PR14 — prihvat: dvokoračni Igraj, spojeni Dvoboj, Troboj, dokaz UI, trening 2 bota, privatna.
 * HINT: dokaz UI se injektira preko window.__KALADONT_E2E_EMIT__ (vidi stanje-igre).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  cekajIstuPartiju,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';

async function otvoriIgrajKorak1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Igraj' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Igraj' });
  await expect(dijalog.getByRole('heading', { name: 'Kako želiš igrati?' })).toBeVisible();
  return dijalog;
}

for (const sirina of [380, 1100] as const) {
  test(`Igraj koraci 1–2 čitljivi na ${sirina}px`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: sirina < 1000 ? 720 : 900 });
    const dijalog = await otvoriIgrajKorak1(page);
    await expect(dijalog.getByText('Kad kažeš „kaladont”')).toBeVisible();
    await dijalog.getByRole('button', { name: /Dokaži nastavak/ }).click();
    await expect(dijalog.getByRole('heading', { name: 'Odaberi stol' })).toBeVisible();
    await expect(dijalog.getByRole('link', { name: /Dvoboj/ })).toBeVisible();
    await expect(dijalog.getByRole('link', { name: /Troboj/ })).toBeVisible();
    await expect(dijalog.getByRole('button', { name: 'Natrag' })).toBeVisible();
    const potvrdaNeZnamNijeTu = dijalog.getByRole('button', { name: 'Da' });
    await expect(potvrdaNeZnamNijeTu).toHaveCount(0);
    await dijalog.getByRole('button', { name: 'Natrag' }).click();
    await expect(dijalog.getByRole('heading', { name: 'Kako želiš igrati?' })).toBeVisible();
  });
}

test('spojeni Dvoboj: Klasični i KA-ZNA dijele isti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    await igraci[0]!.stranica.goto('/red?mod=dva_igraca&pravila=klasicni');
    await igraci[1]!.stranica.goto('/red?mod=dva_igraca&pravila=ka_zna');

    // Oznaka je samo na lobbyju; match često odmah ide u partiju.
    await Promise.race([
      igraci[0]!.stranica.getByTestId('red-oznaka-izbora').waitFor({ state: 'visible', timeout: 15_000 }),
      igraci[0]!.stranica.waitForURL(/\/partija\/[0-9a-f-]+$/, { timeout: 30_000 }),
    ]).catch(() => undefined);
    const oznaka0 = igraci[0]!.stranica.getByTestId('red-oznaka-izbora');
    const oznaka1 = igraci[1]!.stranica.getByTestId('red-oznaka-izbora');
    if (await oznaka0.isVisible().catch(() => false)) {
      await expect(oznaka0).toContainText('Klasični');
    }
    if (await oznaka1.isVisible().catch(() => false)) {
      await expect(oznaka1).toContainText('KA-ZNA');
    }

    await cekajIstuPartiju(igraci);
    for (const { stranica } of igraci) {
      await expect(stranica.locator('.igraci-red > li')).toHaveCount(2);
    }
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('Troboj: tri sjedala (lobby oznaka ili stol)', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 3);
  try {
    await udjiUJavniRed(igraci, 'tri_igraca', 'dokazi_nastavak');
    // Match može odmah u partiju — oznaka je na lobbyju; stol mora imati 3 sjedala.
    await Promise.race([
      igraci[0]!.stranica.getByTestId('red-oznaka-izbora').waitFor({ state: 'visible', timeout: 20_000 }),
      igraci[0]!.stranica.waitForURL(/\/partija\/[0-9a-f-]+$/, { timeout: 30_000 }),
    ]).catch(() => undefined);
    const oznaka = igraci[0]!.stranica.getByTestId('red-oznaka-izbora');
    if (await oznaka.isVisible().catch(() => false)) {
      await expect(oznaka).toContainText('Troboj');
      await expect(oznaka).toContainText('Dokaži');
    }
    await cekajIstuPartiju(igraci);
    for (const { stranica } of igraci) {
      await expect(stranica.locator('.igraci-red > li')).toHaveCount(3);
      await expect(stranica.locator('.igraci-red.troboj')).toHaveCount(1);
    }
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('dokaz UI: autor vidi uputu, čekač vidi čekanje bez „Ispao”', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    await udjiUJavniRed(igraci, 'dva_igraca', 'dokazi_nastavak');
    await cekajIstuPartiju(igraci);

    const autor = igraci[0]!;
    const cekatelj = igraci[1]!;
    const autorId = await autor.stranica.locator('.igraci-red > li:has(.oznaka-ti)').getAttribute('data-igrac-id');
    const cekateljId = await cekatelj.stranica
      .locator('.igraci-red > li:has(.oznaka-ti)')
      .getAttribute('data-igrac-id');
    const partijaId = new URL(autor.stranica.url()).pathname.split('/').at(-1)!;

    const payload = {
      partijaId,
      izazovId: `e2e-dokaz-${Date.now()}`,
      autorId: autorId!,
      cekateljId: cekateljId!,
      izvornaRijec: 'kuća',
      trazenaSlova: 'ća',
      razlogOtvaranja: 'ne_znam' as const,
      cekateljVecIspao: false,
      turnToken: 'e2e-token',
      istekPotezaIso: new Date(Date.now() + 60_000).toISOString(),
      serverVrijemeIso: new Date().toISOString(),
      naPotezuId: autorId!,
    };

    await autor.stranica.evaluate((p) => {
      (window as unknown as { __KALADONT_E2E_EMIT__: (e: string, d: unknown) => void }).__KALADONT_E2E_EMIT__(
        'dokaz:zatrazen',
        p,
      );
    }, payload);
    await cekatelj.stranica.evaluate((p) => {
      (window as unknown as { __KALADONT_E2E_EMIT__: (e: string, d: unknown) => void }).__KALADONT_E2E_EMIT__(
        'dokaz:zatrazen',
        p,
      );
    }, payload);

    await expect(autor.stranica.getByTestId('dokaz-zona')).toContainText('Dokaži nastavak na svoju riječ', {
      timeout: 10_000,
    });
    await expect(autor.stranica.getByTestId('dokaz-zona')).toContainText('ća');
    await expect(cekatelj.stranica.getByTestId('dokaz-zona')).toContainText('dokazuje nastavak');
    await expect(cekatelj.stranica.getByTestId('dokaz-cekam')).toBeVisible();
    await expect(cekatelj.stranica.getByText('Ispao si')).toHaveCount(0);
    await expect(cekatelj.stranica.getByText('Promatraš igru.')).toHaveCount(0);
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('klasični trening ima dva Računala (3 sjedala)', async ({ page }) => {
  await page.goto('/zagrijavanje?pravila=klasicni');
  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.locator('.igraci-red > li')).toHaveCount(3);
  await expect(page.getByText(/Računalo/)).toHaveCount(2);
});

test('privatna soba: gost vidi domaćinov pravilnik', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj?pravila=dokazi_nastavak');
    await expect(vlasnik.getByRole('radio', { name: 'Dokaži nastavak' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();

    await gost.goto(`/soba/${kodSobe}`);
    await expect(gost.getByText(/Pravilnik:/)).toBeVisible({ timeout: 15_000 });
    await expect(gost.getByText('Dokaži nastavak')).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});
