import { expect, test, type Page } from '@playwright/test';

async function otvoriMapu(page: Page) {
  await page.goto('/izazovi');
  await expect(page.getByRole('heading', { name: 'Izazovi' })).toBeVisible({ timeout: 20_000 });
}

test('naslovnica vodi na mapu; kartice i zaključani detalj', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('naslovnica-izazovi').click();
  await expect(page).toHaveURL(/\/izazovi$/);
  await expect(page.getByRole('heading', { name: 'Izazovi' })).toBeVisible();

  const iz01 = page.getByTestId('izazov-kartica-IZ01');
  const iz02 = page.getByTestId('izazov-kartica-IZ02');
  await expect(iz01).toBeVisible({ timeout: 20_000 });
  await expect(iz01).toHaveAttribute('data-status', 'dostupan');
  await expect(iz02).toHaveAttribute('data-status', 'zakljucan');

  await iz02.click();
  const detalj = page.getByTestId('izazov-detalj');
  await expect(detalj).toBeVisible();
  await expect(detalj.getByRole('heading', { name: 'Treće mjesto nije cilj' })).toBeVisible();
  await expect(page.getByTestId('izazov-start')).toBeDisabled();
  await detalj.getByRole('button', { name: 'Zatvori' }).click();
  await expect(detalj).toHaveCount(0);

  await iz01.click();
  await expect(page.getByTestId('izazov-detalj')).toBeVisible();
  await expect(page.getByTestId('izazov-start')).toBeEnabled();
});

test('gost pokreće IZ01, odustaje i vidi rezultat bez rang/DNK', async ({ page }) => {
  await otvoriMapu(page);
  await page.getByTestId('izazov-kartica-IZ01').click();
  await page.getByTestId('izazov-start').click();

  await expect(page).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 25_000 });
  await expect(page.getByTestId('izazov-ciljevi')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Pobijedi')).toBeVisible();
  await expect(page.getByText('Početnik')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Ne znam' })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Ne znam' }).click();
  const potvrda = page.getByRole('dialog', { name: 'Predati potez?' });
  await expect(potvrda).toBeVisible();
  await potvrda.getByRole('button', { name: 'Da' }).click();

  await expect(page.getByTestId('rezultat-izazova')).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole('heading', { name: /Izazov nije uspio|Tehnički prekid/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Završni poredak' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Forma' })).toHaveCount(0);
  await expect(page.getByTestId('izazov-gost-cta')).toContainText('postojeći');
  await expect(page.getByTestId('izazov-svi')).toHaveAttribute('href', '/izazovi');
  await expect(page.getByTestId('izazov-ponovo')).toHaveAttribute('href', /zapocni=IZ01/);
});

test('injicirani uspjeh prikazuje nagrade i CTA bez rang tablice', async ({ page }) => {
  const partijaId = '00000000-0000-4000-8000-000000000501';
  const mojId = 'igrac-e2e-izazov';

  await page.goto('/');
  await expect(page.getByTestId('naslovnica-izazovi')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    sessionStorage.setItem('kaladont:izazov:zadnjiChallengeId', 'IZ01');
  });
  await page.goto(`/partija/${partijaId}`);

  await page.evaluate(
    async ({ partijaId, mojId }) => {
      const { dohvatiStanjeIgre } = await import('/src/lib/stanje-igre.svelte.ts');
      const stanje = dohvatiStanjeIgre();
      stanje.partijaId = partijaId;
      stanje.mojIgracId = mojId;
      stanje.kontekst = 'izazov';
      stanje.izazovChallengeId = 'IZ01';
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
  await expect(page.getByTestId('izazov-sljedeci')).toHaveAttribute('href', /zapocni=IZ02/);
  await expect(page.getByTestId('izazov-gost-cta')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Završni poredak' })).toHaveCount(0);
});

test('mapa na 380px bez horizontalnog scrolla', async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 700 });
  await otvoriMapu(page);
  await expect(page.getByTestId('izazov-kartica-IZ01')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test('desktop 1100px mapa ostaje pregledna', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await otvoriMapu(page);
  await expect(page.getByTestId('izazov-kartica-IZ24')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Etapa 8' })).toBeVisible();
});
