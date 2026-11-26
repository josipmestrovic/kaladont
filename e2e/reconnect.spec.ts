import { expect, test } from '@playwright/test';
import { cekajIstuPartiju, stvoriIgrace, udjiUJavniRed, zatvoriIgrace } from './pomocnici/igraci.js';

test('reload u aktivnoj partiji vraća isti stol i stanje igre', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 3);
  try {
    await udjiUJavniRed(igraci);
    const partijaId = await cekajIstuPartiju(igraci);
    const igrac = igraci[0]!.stranica;

    const stolTekst = igrac
      .getByText(/Nastavi riječ na|Traži se riječ na:|Igra počinje/)
      .filter({ visible: true })
      .first();
    await expect(stolTekst).toBeVisible();
    await igrac.reload();

    await expect(igrac).toHaveURL(new RegExp(`/partija/${partijaId}$`));
    await expect(
      igrac.getByText(/Nastavi riječ na|Traži se riječ na:|Igra počinje/).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(igrac.getByRole('list').first()).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});