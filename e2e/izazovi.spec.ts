import { expect, test, type Page } from '@playwright/test';

async function otvoriMapu(page: Page) {
  await page.goto('/izazovi');
  await expect(page.getByRole('heading', { name: 'Izazovi' })).toBeVisible({ timeout: 20_000 });
}

test('naslovnica vodi na mapu; level tabovi i zaključani finale', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('naslovnica-izazovi').click();
  await expect(page).toHaveURL(/\/izazovi/);
  await expect(page.getByRole('heading', { name: 'Izazovi' })).toBeVisible();

  await expect(page.getByTestId('izazov-level-tabovi')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('izazov-level-1')).toHaveAttribute('aria-pressed', 'true');

  const dv01 = page.getByTestId('izazov-kartica-IZ-L1-DV-01');
  const dv05 = page.getByTestId('izazov-kartica-IZ-L1-DV-05');
  await expect(dv01).toBeVisible();
  await expect(dv01).toHaveAttribute('data-status', 'dostupan');
  await expect(dv05).toHaveAttribute('data-status', 'zakljucan');

  // Klik na broj kartice — izbjegava PojamPomoc gumbe koji stopPropagation.
  await dv05.locator('.kartica-broj').click();
  await expect(page.getByTestId('izazov-detalj')).toHaveCount(0);
  await expect(page.getByTestId('izazov-start-poruka')).toBeVisible();
  await expect(page.getByTestId('izazov-start-poruka')).toContainText(/Otključava|dovrši/i);
});

test('zaključani ?level= fallback + obavijest', async ({ page }) => {
  await page.goto('/izazovi?level=4');
  await expect(page.getByTestId('izazov-level-obavijest')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('izazov-level-1')).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/level=1/);
});

test('gost pokreće IZ-L1-DV-01, odustaje i vidi rezultat bez rang/DNK', async ({ page }) => {
  await otvoriMapu(page);
  await page.getByTestId('izazov-kartica-IZ-L1-DV-01').click();

  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 25_000 });
  await expect(page.getByTestId('izazov-ciljevi')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('izazov-uvjeti-naslov')).toContainText('Level 1');
  await expect(page.getByText('Tvoj potez: 30 s')).toBeVisible();
  await expect(page.getByTestId('izazov-ciljevi')).toContainText('Botovi: Početnik');

  await expect(page.getByRole('button', { name: 'Ne znam' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ne znam' }).click();
  const potvrda = page.getByRole('dialog', { name: 'Predati potez?' });
  await expect(potvrda).toBeVisible();
  await potvrda.getByRole('button', { name: 'Da' }).click();

  await expect(page.getByTestId('rezultat-izazova')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('heading', { name: /Izgubio si izazov|Izazov nije uspio|Tehnički prekid/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Završni poredak' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forma' })).toHaveCount(0);
  await expect(page.getByTestId('izazov-gost-cta')).toContainText('postojeći');
  await expect(page.getByTestId('izazov-odaberi')).toHaveAttribute('href', /\/izazovi\?level=1/);
  await expect(page.getByTestId('izazov-ponovo')).toHaveAttribute('href', /zapocni=IZ-L1-DV-01/);
});

test('injicirani uspjeh prikazuje nagrade i CTA bez rang tablice', async ({ page }) => {
  const partijaId = '00000000-0000-4000-8000-000000000501';
  const mojId = 'igrac-e2e-izazov';

  await page.goto('/');
  await expect(page.getByTestId('naslovnica-izazovi')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    sessionStorage.setItem('kaladont:izazov:zadnjiChallengeId', 'IZ-L1-DV-01');
  });
  await page.goto(`/partija/${partijaId}`);

  await page.evaluate(
    async ({ partijaId, mojId }) => {
      const { dohvatiStanjeIgre } = await import('/src/lib/stanje-igre.svelte.ts');
      const stanje = dohvatiStanjeIgre();
      stanje.partijaId = partijaId;
      stanje.mojIgracId = mojId;
      stanje.kontekst = 'izazov';
      stanje.izazovChallengeId = 'IZ-L1-DV-01';
      stanje.izazovMeta = {
        challengeId: 'IZ-L1-DV-01',
        level: 1,
        format: 'DV',
        varijanta: 'obicni',
        naziv: 'Obični',
        profileId: 'pocetnik',
        humanTurnDurationMs: 30_000,
        botTurnDurationMs: 30_000,
      };
      stanje.sjedala = [
        {
          igracId: mojId,
          nadimak: 'Ti',
          jeGost: true,
          jeBot: false,
          avatarId: 1,
          avatarConfig: null,
          avatarRevision: 0,
          rang: null,
          razina: 1,
          trenutniNiz: 0,
          razinaVatre: 0,
        },
        {
          igracId: 'racunalo-1',
          nadimak: 'Početnik',
          jeGost: false,
          jeBot: true,
          avatarId: 1,
          avatarConfig: null,
          avatarRevision: 0,
          rang: null,
          razina: 1,
          trenutniNiz: 0,
          razinaVatre: 0,
        },
      ];
      stanje.goalProgress = {
        bezPogreske: { required: false, met: true },
        bezZavrsavanjaNaKa: { required: false, met: true },
        dugeRijeci: { required: 0, current: 0, met: true },
        rijetkeRijeci: { required: 0, current: 0, met: true },
        uspjesanDokaz: { required: 0, current: 0, met: true },
        sviCiljeviIspunjeni: true,
      };
      stanje.izazovTerminal = {
        status: 'uspjeh',
        reason: null,
        resultsVisibleAtIso: new Date(Date.now() - 1_000).toISOString(),
        gameWon: true,
      };
      stanje.statusSpremanja = 'rezultati_spremljeni';
      stanje.kraj = {
        partijaId,
        prikazRezultataOdIso: new Date(Date.now() - 1_000).toISOString(),
        plasmani: [
          {
            igracId: mojId,
            nadimak: 'Ti',
            plasman: 1,
            bodovi: 0,
            eliminacije: 0,
            jeBot: false,
            javniProfil: false,
          },
          {
            igracId: 'racunalo-1',
            nadimak: 'Početnik',
            plasman: 2,
            bodovi: 0,
            eliminacije: 0,
            jeBot: true,
            javniProfil: false,
          },
        ],
        mojNoviProsjek: 0,
        mojRang: null,
        mojeIskustvo: null,
        mojaOcjenaIgre: null,
        bonusOcjenaIgre: 0,
        novaDostignuca: [],
        kontekst: 'izazov',
        izazovSettlement: {
          firstCompletion: true,
          challengeXp: { nominal: 100, awarded: 100 },
          missionXp: { nominal: 0, awarded: 0 },
          izazivac: { zvjezdice: 1, novaRazina: 1 },
          settlementState: 'spremljeno',
          novaDostignuca: [],
        },
      };
      stanje.rezultatiPrikazaniPartijaId = partijaId;
    },
    { partijaId, mojId },
  );

  await expect(page.getByTestId('rezultat-izazova')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Izazov uspješan!' })).toBeVisible();
  await expect(page.getByTestId('izazov-challenge-xp')).toContainText('100');
  await expect(page.getByTestId('izazov-sljedeci')).toBeVisible();
  await expect(page.getByTestId('izazov-sljedeci')).toHaveAttribute(
    'href',
    /\/izazovi\?zapocni=IZ-L1-DV-02&level=1/,
  );
  await expect(page.getByTestId('izazov-odaberi')).toHaveAttribute('href', '/izazovi?level=1');
  await expect(page.getByTestId('izazov-gost-cta')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Završni poredak' })).toHaveCount(0);
});

test('mapa na 380px bez horizontalnog scrolla; tabovi wrap', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 700 });
  await otvoriMapu(page);
  await expect(page.getByTestId('izazov-kartica-IZ-L1-DV-01')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('izazov-level-4')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('desktop 1100px prikazuje tri formata L1', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await otvoriMapu(page);
  await expect(page.getByTestId('izazov-format-DV')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('izazov-format-TR')).toBeVisible();
  await expect(page.getByTestId('izazov-format-CE')).toBeVisible();
  await expect(page.getByTestId('izazov-kartica-IZ-L1-CE-04')).toBeVisible();
});
