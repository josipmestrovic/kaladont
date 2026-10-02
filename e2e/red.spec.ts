import { expect, test } from '@playwright/test';
import {
  cekajIstuPartiju,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';

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
