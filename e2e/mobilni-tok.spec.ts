import { expect, test } from '@playwright/test';
import { dodajIgrace, zatvoriIgrace, type E2EIgrac } from './pomocnici/igraci.js';

test('mobilne tablice pravila zadržavaju sve vrijednosti bez vodoravnog pomicanja', async ({
  page,
}) => {
  for (const sirina of [320, 360, 390, 768, 999]) {
    await page.setViewportSize({ width: sirina, height: 760 });
    for (const tema of ['nacini', 'bodovi', 'napredak']) {
      await page.goto(`/pravila-kaladonta?tema=${tema}`);
      const tablice = page.locator('table');
      await expect(tablice.first()).toBeVisible();
      const neoznacene = await page
        .locator('table.tablica-mobilni-retci tbody td:not(:first-child):not([data-label])')
        .count();
      expect(neoznacene).toBe(0);
      const prelijevanje = await tablice.evaluateAll((elementi) =>
        elementi.some((tablica) => {
          const okvir = tablica.getBoundingClientRect();
          return (
            tablica.scrollWidth > tablica.clientWidth + 1 ||
            okvir.right > window.innerWidth + 1 ||
            okvir.left < -1
          );
        }),
      );
      expect(prelijevanje).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }

  await page.goto('/pravila-kaladonta?tema=bodovi');
  const rangovi = page.locator('.tablica-rangova tbody tr');
  await expect(rangovi).toHaveCount(10);
  await expect(rangovi.first().locator('td').last()).toContainText('manje od 30 %');
  await expect(rangovi.last().locator('td').last()).toContainText('89 % ili više');
  await expect(rangovi.first().locator('.rang-uzorak')).toHaveCSS('border-top-width', '4px');

  await page.setViewportSize({ width: 1000, height: 760 });
  await expect(page.locator('.tablica-rangova thead')).toBeVisible();
  await expect(page.locator('.tablica-rangova')).toHaveCSS('display', 'table');
});

test('tablice ostaju čitljive u obje teme i s disleksijskim fontom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  for (const svijetla of [false, true]) {
    for (const disleksijskiFont of [false, true]) {
      await page.goto('/pravila-kaladonta?tema=napredak');
      await page.evaluate(
        ({ svijetlaTema, font }) => {
          localStorage.setItem('kaladont_tema_v1', svijetlaTema ? 'svijetla' : 'tamna');
          localStorage.setItem('kaladont_font_postavke_v1', String(font));
        },
        { svijetlaTema: svijetla, font: disleksijskiFont },
      );
      await page.reload();
      await page.evaluate(() => document.fonts.ready);
      const prelijevanje = await page.locator('table').evaluateAll((elementi) =>
        elementi.some((tablica) => {
          const okvir = tablica.getBoundingClientRect();
          return (
            tablica.scrollWidth > tablica.clientWidth + 1 || okvir.right > window.innerWidth + 1
          );
        }),
      );
      expect(prelijevanje).toBe(false);
    }
  }
});

test('dvostupčana statistika rječnika stane na uski mobitel', async ({ page }) => {
  await page.route(/\/rjecnik\/statistika$/, (ruta) =>
    ruta.fulfill({
      json: {
        ukupno: 123456,
        kategorije: [{ vrsta: 'vlastito_ime', brojOblika: 123456 }],
      },
    }),
  );
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/pravila-kaladonta?tema=kako-igrati');
  const tablica = page.getByRole('region', { name: 'Broj riječi po vrsti' }).getByRole('table');
  await expect(
    tablica.getByRole('rowheader', { name: 'Ukupno jedinstvenih oblika' }),
  ).toBeVisible();
  expect(await tablica.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
});

test('mobilne ljestvice prikazuju oznake i dugačke nazive bez pomicanja', async ({ page }) => {
  await page.route(/\/ljestvica\?/, (ruta) =>
    ruta.fulfill({
      json: {
        ljestvica: [
          {
            mjesto: 1,
            igracId: 'test',
            jeJavan: true,
            nadimak: 'JakoDugackoImeIgraca',
            rang: 'Gospodar rječnika',
            prosjekBodova: 5.12,
            odigrane: 45,
            postotakPobjeda: 70,
          },
        ],
        mojeMjesto: null,
      },
    }),
  );
  await page.route(/\/rijeci\/top\?/, (ruta) =>
    ruta.fulfill({
      json: {
        rijeci: [
          { mjesto: 1, rijec: 'najduzarijecbezrazmaka', brojUpotreba: 12, postotakPartija: 15 },
        ],
      },
    }),
  );

  for (const sirina of [320, 390, 999]) {
    await page.setViewportSize({ width: sirina, height: 760 });
    await page.goto('/ljestvica');
    for (const tab of ['Igrači', 'Riječi']) {
      await page.getByRole('tab', { name: tab }).click();
      const tablica = page.locator('table.tablica-mobilni-retci');
      await expect(tablica.locator('tbody tr')).toHaveCount(1);
      await expect(tablica.locator('tbody td[data-label]').first()).toBeVisible();
      const prelijevanje = await tablica.evaluate((element) => {
        const okvir = element.getBoundingClientRect();
        return element.scrollWidth > element.clientWidth + 1 || okvir.right > window.innerWidth + 1;
      });
      expect(prelijevanje).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
});

test('mobilna ljestvica privatne sobe prikazuje označene rezultate', async ({ page }) => {
  await page.goto('/soba/kreiraj');
  await page.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
  const ljestvicaSobe = page.locator('.ljestvica-tablica');
  await expect(ljestvicaSobe.locator('tbody tr')).toHaveCount(1);
  await expect(ljestvicaSobe.locator('td[data-label="Pobjede"]')).toBeVisible();
  expect(
    await ljestvicaSobe.evaluate((tablica) => tablica.scrollWidth <= tablica.clientWidth),
  ).toBe(true);
});

test('mobilna aktivnost javnog profila prikazuje sve podatke partije', async ({ page }) => {
  const odgovor = await page.request.post('http://127.0.0.1:3001/api/racuni/registracija', {
    data: {
      email: `tablica-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123',
      nadimak: 'TablicaIgrac',
    },
  });
  expect(odgovor.ok()).toBe(true);
  const { igracId } = (await odgovor.json()) as { igracId: string };
  await page.route(/\/api\/aktivnost\//, (ruta) =>
    ruta.fulfill({
      json: {
        aktivnost: [
          {
            partijaId: 'test-partija',
            pocetak: '2026-09-30T10:00:00Z',
            kraj: '2026-09-30T10:10:00Z',
            mod: 'dva_igraca',
            plasman: 1,
            bodovi: 1,
            eliminacije: 0,
          },
        ],
        imaJos: false,
        sljedeciCursor: null,
      },
    }),
  );
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`/profil/javni/${igracId}`);
  await page
    .getByRole('navigation', { name: 'Sadržaj profila' })
    .getByRole('button', { name: 'Aktivnost' })
    .click();
  const tablica = page.locator('.aktivnost-tablica');
  await expect(tablica.locator('tbody tr')).toHaveCount(1);
  await expect(tablica.locator('td[data-label="Bodovi"]')).toHaveText('1');
  await expect(tablica.getByRole('link', { name: 'Vidi igru' })).toBeVisible();
  expect(await tablica.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
});

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

test('mobilni igrač ulazi u privatnu partiju i vidi aktivni input', async ({
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

test('mobilni prekid mreže zaključava potez i reconnect vraća stanje partije', async ({
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

test('mobilna privatna partija završava i Igraj ponovno vraća u sobu', async ({
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
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);

    await vlasnik.getByRole('button', { name: 'Ne znam' }).click();
    const dijalog = vlasnik.getByRole('dialog', { name: 'Predati potez?' });
    await expect(dijalog).toBeVisible();
    await dijalog.getByRole('button', { name: 'Da' }).click();

    await expect(vlasnik.getByRole('heading', { name: 'Završni poredak' })).toBeVisible({
      timeout: 20_000,
    });
    await vlasnik.locator('button.povijest-naslov').click();
    const prijavaRijeci = vlasnik.locator('button.prijavi-btn').first();
    await expect(prijavaRijeci).toBeVisible();
    await prijavaRijeci.click();
    await expect(
      vlasnik.getByRole('button', { name: 'Riječ je prijavljena' }).first(),
    ).toBeVisible();
    await expect(vlasnik.locator('textarea')).toHaveCount(0);
    await vlasnik.getByRole('link', { name: 'Igraj ponovno' }).click();
    await expect(vlasnik).toHaveURL(new RegExp(`/soba/${kodSobe}$`));
  } finally {
    await zatvoriIgrace(igraci);
  }
});
