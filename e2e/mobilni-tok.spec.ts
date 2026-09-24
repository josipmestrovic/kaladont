import { expect, test } from '@playwright/test';
import { dodajIgrace, zatvoriIgrace, type E2EIgrac } from './pomocnici/igraci.js';

test('mobilni tok registracije čuva fokus, tipkovničku navigaciju i raspored', async ({ page }) => {
  await page.goto('/registracija');

  const nadimak = page.getByPlaceholder('Tvoj nadimak');
  await nadimak.fill('Mobilni_7');
  await expect(nadimak).toBeFocused();
  await expect(nadimak).toHaveAttribute('maxlength', '12');
  await expect(nadimak).toHaveAttribute('minlength', '3');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeFocused();
  await page.keyboard.press('Enter');
  const email = page.getByLabel('Email');
  await expect(email).toBeVisible();
  await email.focus();
  await expect(email).toBeFocused();

  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toContain('user-scalable=no');
});

test('mobilni igrač ulazi u privatnu partiju i vidi aktivni input', async ({ browser, context, page }) => {
  const igraci: E2EIgrac[] = [{ kontekst: context, stranica: page }, ...(await dodajIgrace(browser, 1))];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());

    const aktivniUnos = vlasnik.getByRole('textbox', { name: /Dovrši riječ na/ });
    await expect(aktivniUnos).toBeVisible();
    await aktivniUnos.scrollIntoViewIfNeeded();
    await aktivniUnos.focus();
    await expect(aktivniUnos).toBeFocused();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilni prekid mreže zaključava potez i reconnect vraća stanje partije', async ({ browser, context, page }) => {
  const igraci: E2EIgrac[] = [{ kontekst: context, stranica: page }, ...(await dodajIgrace(browser, 1))];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;
    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);

    const igrac = igraci[0]!;
    await expect(igrac.stranica.getByRole('button', { name: 'Pošalji' })).toBeVisible();
    await igrac.kontekst.setOffline(true);
    await expect(igrac.stranica.getByText('Veza je prekinuta.')).toBeVisible();
    await expect(igrac.stranica.getByRole('button', { name: 'Pošalji' })).toBeDisabled();

    await igrac.kontekst.setOffline(false);
    await expect(igrac.stranica.getByText('Veza je prekinuta.')).toBeHidden({ timeout: 15_000 });
    await expect(igrac.stranica.getByText(/Traži se riječ na:|Igra počinje/).first()).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilna privatna partija završava i Igraj ponovno vraća u sobu', async ({ browser, context, page }) => {
  const igraci: E2EIgrac[] = [{ kontekst: context, stranica: page }, ...(await dodajIgrace(browser, 1))];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;
    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);

    await vlasnik.getByRole('button', { name: 'Ne znam' }).click();
    const dijalog = vlasnik.getByRole('dialog', { name: 'Predati potez?' });
    await expect(dijalog).toBeVisible();
    await dijalog.getByRole('button', { name: 'Da' }).click();

    await expect(vlasnik.getByRole('heading', { name: 'Završni poredak' })).toBeVisible({ timeout: 20_000 });
    await vlasnik.locator('button.povijest-naslov').click();
    const prijavaRijeci = vlasnik.locator('button.prijavi-btn').first();
    await expect(prijavaRijeci).toBeVisible();
    await prijavaRijeci.click();
    await expect(vlasnik.getByRole('button', { name: 'Riječ je prijavljena' }).first()).toBeVisible();
    await expect(vlasnik.locator('textarea')).toHaveCount(0);
    await vlasnik.getByRole('link', { name: 'Igraj ponovno' }).click();
    await expect(vlasnik).toHaveURL(new RegExp(`/soba/${kodSobe}$`));
  } finally {
    await zatvoriIgrace(igraci);
  }
});
