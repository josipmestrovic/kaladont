import { expect, test } from '@playwright/test';
import { cekajIstuPartiju, stvoriIgrace, udjiUJavniRed, zatvoriIgrace } from './pomocnici/igraci.js';

test('reload u aktivnoj partiji vraća isti stol i stanje igre', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    const partijaId = await cekajIstuPartiju(igraci);
    const igrac = igraci[0]!.stranica;

    await expect(igrac.getByText(/Traži se riječ na:|Igra počinje/).first()).toBeVisible();
    await igrac.reload();

    await expect(igrac).toHaveURL(new RegExp(`/partija/${partijaId}$`));
    await expect(igrac.getByText(/Traži se riječ na:|Igra počinje/).first()).toBeVisible();
    await expect(igrac.getByRole('list').first()).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});