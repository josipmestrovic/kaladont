/**
 * PR14 — prihvat: dvokoračni Igraj, spojeni Dvoboj, Troboj, dokaz UI, trening 2 bota, privatna.
 * HINT: dokaz UI se injektira preko window.__KALADONT_E2E_EMIT__ (vidi stanje-igre).
 * HINT: „dokaz smoke” ide stvarnim putem (riječ → Ne znam → zona), bez injekcije.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  cekajIgracaNaPotezu,
  cekajIstuPartiju,
  odigrajRijec,
  predajNeZnam,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';
import { pronadjiIgrivuRijec } from './pomocnici/rjecnik.js';

async function otvoriRankedKorak1(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ranked', exact: true }).click();
  const dijalog = page.getByRole('dialog', { name: 'Ranked' });
  await expect(
    dijalog.getByRole('heading', { name: 'Odaberi pravila po kojima želiš igrati' }),
  ).toBeVisible();
  return dijalog;
}

for (const sirina of [380, 1100] as const) {
  test(`Igraj koraci 1–2 čitljivi na ${sirina}px`, async ({ page }) => {
    await page.setViewportSize({ width: sirina, height: sirina < 1000 ? 720 : 900 });
    const dijalog = await otvoriRankedKorak1(page);
    await expect(dijalog.getByText(/Ako protivnik zapne/)).toBeVisible();
    await dijalog.getByRole('button', { name: /Dokaži nastavak/ }).click();
    await expect(dijalog.getByRole('heading', { name: 'Odaberi stol' })).toBeVisible();
    await expect(dijalog.getByRole('link', { name: /Dvoboj/ })).toBeVisible();
    await expect(dijalog.getByRole('link', { name: /Troboj/ })).toBeVisible();
    await expect(dijalog.getByRole('button', { name: 'Natrag' })).toBeVisible();
    const potvrdaNeZnamNijeTu = dijalog.getByRole('button', { name: 'Da' });
    await expect(potvrdaNeZnamNijeTu).toHaveCount(0);
    await dijalog.getByRole('button', { name: 'Natrag' }).click();
    await expect(
      dijalog.getByRole('heading', { name: 'Odaberi pravila po kojima želiš igrati' }),
    ).toBeVisible();
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

test('dokaz UI: uspjeh nakon odlaska čekača pokazuje ishod, ne samo prekid', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    await udjiUJavniRed(igraci, 'dva_igraca', 'dokazi_nastavak');
    await cekajIstuPartiju(igraci);

    const autor = igraci[0]!;
    const autorLi = autor.stranica.locator('.igraci-red > li:has(.oznaka-ti)');
    const cekateljLi = autor.stranica.locator('.igraci-red > li:not(:has(.oznaka-ti))').first();
    const autorId = await autorLi.getAttribute('data-igrac-id');
    const cekateljId = await cekateljLi.getAttribute('data-igrac-id');
    const autorNadimak = (await autorLi.locator('.nadimak').innerText()).trim();
    const cekateljNadimak = (await cekateljLi.locator('.nadimak').innerText()).trim();
    const partijaId = new URL(autor.stranica.url()).pathname.split('/').at(-1)!;
    expect(autorId).toBeTruthy();
    expect(cekateljId).toBeTruthy();

    const dokazPayload = {
      partijaId,
      izazovId: `e2e-dokaz-odlazak-${Date.now()}`,
      autorId: autorId!,
      cekateljId: cekateljId!,
      izvornaRijec: 'kuća',
      trazenaSlova: 'ća',
      razlogOtvaranja: 'prekid_na_potezu' as const,
      cekateljVecIspao: true,
      turnToken: 'e2e-token-odlazak',
      istekPotezaIso: new Date(Date.now() + 60_000).toISOString(),
      serverVrijemeIso: new Date().toISOString(),
      naPotezuId: autorId!,
    };

    await autor.stranica.evaluate((p) => {
      (window as unknown as { __KALADONT_E2E_EMIT__: (e: string, d: unknown) => void }).__KALADONT_E2E_EMIT__(
        'dokaz:zatrazen',
        p,
      );
    }, dokazPayload);
    await expect(autor.stranica.getByTestId('dokaz-zona')).toBeVisible({ timeout: 10_000 });

    const sjedala = [
      {
        igracId: autorId!,
        nadimak: autorNadimak,
        jeGost: true,
        jeBot: false,
        avatarId: 1,
        avatarConfig: null,
        avatarRevision: 0,
        rang: null,
        razina: 1,
        trenutniNiz: 0,
        razinaVatre: 0 as const,
      },
      {
        igracId: cekateljId!,
        nadimak: cekateljNadimak,
        jeGost: true,
        jeBot: false,
        avatarId: 2,
        avatarConfig: null,
        avatarRevision: 0,
        rang: null,
        razina: 1,
        trenutniNiz: 0,
        razinaVatre: 0 as const,
      },
    ];

    const stanjePayload = {
      partijaId,
      mojIgracId: autorId!,
      sjedala,
      turnToken: 'e2e-token-nakon',
      naPotezuId: '',
      trazenaSlova: null,
      istekPotezaIso: new Date().toISOString(),
      serverVrijemeIso: new Date().toISOString(),
      runda: 2,
      brojIskoristenih: 1,
      eliminacije: [
        {
          igracId: cekateljId!,
          plasman: 2,
          razlog: 'prekid' as const,
          bodZa: autorId!,
          slova: null,
          rijecUzrok: null,
        },
      ],
      sustavBiraRijec: true,
      istekIzboraIso: new Date(Date.now() + 5_000).toISOString(),
      zadnjaRijec: 'ćaskanje',
      zadnjaRijecIgracId: autorId!,
      zadnjaRijecVrsta: 'rijec' as const,
      zavrsena: false,
      statusSpremanja: 'nije_zavrsena' as const,
      faza: 'sustav_bira' as const,
      dokaz: null,
      pravila: 'dokazi_nastavak' as const,
      mod: 'dva_igraca' as const,
    };

    await autor.stranica.evaluate((p) => {
      (window as unknown as { __KALADONT_E2E_EMIT__: (e: string, d: unknown) => void }).__KALADONT_E2E_EMIT__(
        'partija:stanje',
        p,
      );
    }, stanjePayload);

    await expect(autor.stranica.locator('.sustav-bira-obrazlozenje')).toContainText(
      `${autorNadimak} je dokazao nastavak`,
      { timeout: 10_000 },
    );
    await expect(autor.stranica.locator('.sustav-bira-obrazlozenje')).not.toContainText('izgubljena veza');
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

test('dokaz smoke: Ne znam otvara zonu bez injekcije', async ({ browser }) => {
  test.setTimeout(60_000);
  const igraci = await stvoriIgrace(browser, 2);
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj?pravila=dokazi_nastavak');
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();

    await gost.goto(`/soba/${kodSobe}`);
    await expect(gost.getByText(/Prijavljeni igrači \(2 \/ 8\)/)).toBeVisible({ timeout: 15_000 });
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 20_000 });
    await expect(gost).toHaveURL(vlasnik.url());

    const ana = await cekajIgracaNaPotezu(igraci);
    const bruno = igraci.find((ig) => ig !== ana)!;
    const unos = ana.stranica.getByRole('textbox', { name: /Dovrši riječ na|Dokaži nastavak/ });
    const oznaka = (await unos.getAttribute('aria-label')) ?? '';
    const prefiks = (oznaka.match(/(?:Dovrši riječ na|Dokaži nastavak na)\s+(.+)$/i)?.[1] ?? '')
      .trim()
      .toLocaleLowerCase('hr');
    expect(prefiks.length).toBeGreaterThan(0);

    // Desktop: sustavska riječ je u .kontekst-rijeci; oblak nije uvijek vidljiv.
    const pocetnaLokator = ana.stranica.locator('.kontekst-rijeci .trenutna-rijec, .rijec-oblak').first();
    await expect(pocetnaLokator).toBeVisible({ timeout: 10_000 });
    const pocetnaRijec = (await pocetnaLokator.innerText()).replace(/\s+/g, '').toLocaleLowerCase('hr');
    expect(pocetnaRijec.length).toBeGreaterThan(0);

    const anaRijec = await pronadjiIgrivuRijec(prefiks, pocetnaRijec);
    await odigrajRijec(ana.stranica, anaRijec);

    await expect(bruno.stranica.getByRole('button', { name: 'Ne znam' })).toBeEnabled({
      timeout: 15_000,
    });
    await predajNeZnam(bruno.stranica);

    await expect(ana.stranica.getByTestId('dokaz-zona')).toContainText('Dokaži nastavak na svoju riječ', {
      timeout: 15_000,
    });
    await expect(bruno.stranica.getByTestId('dokaz-zona')).toContainText('dokazuje nastavak');
    await expect(bruno.stranica.getByTestId('dokaz-cekam')).toBeVisible();
    await expect(bruno.stranica.getByText('Ispao si')).toHaveCount(0);
  } finally {
    await zatvoriIgrace(igraci);
  }
});
