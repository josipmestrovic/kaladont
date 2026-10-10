import { expect, test } from '@playwright/test';
import {
  cekajIstuPartiju,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';

for (const mod of ['dva_igraca', 'cetiri_igraca'] as const) {
  test(`odbrojavanje prikazuje konačna bot sjedala u modu ${mod}`, async ({ page }) => {
    await page.goto(`/red?mod=${mod}`);
    await expect(page.locator('.mjesta li.moje-sjedalo')).toHaveCount(1);
    await page.evaluate(async (nacin) => {
      const putanjaModula = '/src/lib/socket.ts';
      const modul = await import(putanjaModula);
      const socket = modul.dohvatiSocket();
      const stanje = await new Promise<{ mojIgracId: string }>((resolve) => {
        socket.once('red:stanje', resolve);
        socket.emit('red:stanje', { mod: nacin });
      });
      const mjesta = nacin === 'dva_igraca' ? 2 : 4;
      socket.emitEvent(['partija:pocetak', {
        partijaId: 'test-odbrojavanje', mojIgracId: stanje.mojIgracId, mod: nacin, kontekst: 'javna',
        pocetakIso: new Date(Date.now() + 60_000).toISOString(),
        sjedala: Array.from({ length: mjesta }, (_, indeks) => ({
          igracId: indeks === 0 ? stanje.mojIgracId : `bot-${indeks}`,
          nadimak: indeks === 0 ? 'Igrac' : `TestniBot${indeks}`,
          jeGost: indeks === 0, avatarId: 0, avatarConfig: null, avatarRevision: 0,
          rang: null, razina: 1, trenutniNiz: 0, razinaVatre: 0,
        })),
      }]);
    }, mod);
    await expect(page.getByRole('heading', { name: /Svi igrači su tu/ })).toBeVisible();
    await expect(page.locator('.mjesta li.zauzeto')).toHaveCount(mod === 'dva_igraca' ? 2 : 4);
    await expect(page.getByText('Prazno mjesto', { exact: true })).toHaveCount(0);
    await expect(page.getByText('TestniBot1', { exact: true })).toBeVisible();
  });
}

test('četiri igrača ulaze u javni red i dobivaju isti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    await cekajIstuPartiju(igraci);
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('dva igrača ulaze u javni red i dobivaju isti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 2);
  try {
    await udjiUJavniRed(igraci, 'dva_igraca');
    await cekajIstuPartiju(igraci);
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('svaki igrač vidi sebe prvog, a sjedala se ne mijenjaju nakon eliminacije', async ({
  browser,
}) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    await cekajIstuPartiju(igraci);

    for (const { stranica } of igraci) {
      const sjedala = stranica.locator('.igraci-red > li');
      await expect(sjedala).toHaveCount(4);
      const mojRed = stranica.locator('.igraci-red > li:has(.oznaka-ti)');
      await expect(mojRed).toHaveAttribute(
        'data-igrac-id',
        (await sjedala.first().getAttribute('data-igrac-id')) ?? '',
      );
    }

    const redoslijediPrije = await Promise.all(
      igraci.map(({ stranica }) =>
        stranica
          .locator('.igraci-red > li')
          .evaluateAll((sjedala) =>
            sjedala.map((sjedalo) => sjedalo.getAttribute('data-igrac-id')),
          ),
      ),
    );

    let indeksNaPotezu = -1;
    await expect
      .poll(async () => {
        const vidljiviGumbi = await Promise.all(
          igraci.map(({ stranica }) => stranica.locator('.ne-znam-gumb').isVisible()),
        );
        indeksNaPotezu = vidljiviGumbi.findIndex(Boolean);
        return indeksNaPotezu;
      })
      .toBeGreaterThanOrEqual(0);

    const stranicaNaPotezu = igraci[indeksNaPotezu]!.stranica;
    await stranicaNaPotezu.locator('.ne-znam-gumb').click();
    await stranicaNaPotezu.getByRole('dialog').getByRole('button', { name: 'Da' }).click();

    for (const { stranica } of igraci) {
      await expect(stranica.locator('.igraci-red li.eliminiran')).toHaveCount(1);
    }
    const redoslijediPoslije = await Promise.all(
      igraci.map(({ stranica }) =>
        stranica
          .locator('.igraci-red > li')
          .evaluateAll((sjedala) =>
            sjedala.map((sjedalo) => sjedalo.getAttribute('data-igrac-id')),
          ),
      ),
    );

    expect(redoslijediPoslije).toEqual(redoslijediPrije);
  } finally {
    await zatvoriIgrace(igraci);
  }
});
