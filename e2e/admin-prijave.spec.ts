import { expect, test } from '@playwright/test';

test('admin prijave: busy gumb, toast i uklanjanje retka bez refresha', async ({ page }) => {
  let rijeci: Array<{
    id: number;
    tip: 'za_brisanje' | 'za_dodavanje';
    rijec: string;
    status: string;
    vrijeme: string;
    partijaId: string;
  }> = [
    {
      id: 101,
      tip: 'za_brisanje',
      rijec: 'testrijec',
      status: 'nova',
      vrijeme: new Date().toISOString(),
      partijaId: 'partija-1',
    },
  ];

  let igraci: Array<{
    id: number;
    partijaId: string;
    prijavljeniIgracId: string;
    nadimak: string;
    razlog: string;
    status: string;
    vrijeme: string;
  }> = [
    {
      id: 202,
      partijaId: 'partija-1',
      prijavljeniIgracId: 'igrac-2',
      nadimak: 'Pogrdan',
      razlog: 'pogrdan_nadimak',
      status: 'nova',
      vrijeme: new Date().toISOString(),
    },
  ];

  await page.route('**/api/admin/**', async (ruta) => {
    const url = new URL(ruta.request().url());
    const putanja = url.pathname;
    const metoda = ruta.request().method();

    if (metoda === 'GET' && putanja.endsWith('/admin/prijave')) {
      await ruta.fulfill({ json: { prijave: rijeci } });
      return;
    }
    if (metoda === 'GET' && putanja.endsWith('/admin/prijave-igraca')) {
      await ruta.fulfill({ json: { prijave: igraci } });
      return;
    }
    if (metoda === 'POST' && putanja.endsWith('/admin/prijave/101/dismiss')) {
      await new Promise((r) => setTimeout(r, 400));
      rijeci = rijeci.filter((p) => p.id !== 101);
      await ruta.fulfill({ json: { ok: true } });
      return;
    }
    if (metoda === 'POST' && putanja.endsWith('/admin/prijave-igraca/202/obrisi-racun')) {
      await new Promise((r) => setTimeout(r, 200));
      igraci = igraci.filter((p) => p.id !== 202);
      await ruta.fulfill({ json: { ok: true, ishod: 'obrisan' } });
      return;
    }

    await ruta.fulfill({ json: { ok: true, prijave: [], izmjene: [] } });
  });

  await page.goto('/admin/prijave');

  const rijecRed = page.locator('.rijec-prijava', { hasText: 'testrijec' });
  const nadimakRed = page.locator('.rijec-prijava', { hasText: 'Pogrdan' });
  await expect(rijecRed).toBeVisible();
  await expect(nadimakRed).toBeVisible();

  const dismiss = page.getByRole('button', { name: 'Dismiss' }).first();
  await dismiss.click();
  // Optimistički UI: red i toast odmah, bez čekanja na POST.
  await expect(page.locator('.uspjeh-obavijest', { hasText: 'Prijava odbačena.' })).toBeVisible();
  await expect(rijecRed).toHaveCount(0);

  const obrisiRacun = page.getByRole('button', { name: 'Obriši račun' });
  // Pričekaj kraj prve akcije (akcijaUTijeku) pa tek onda klikni drugu.
  await expect(obrisiRacun).toBeEnabled({ timeout: 10_000 });
  await obrisiRacun.click();
  await expect(page.locator('.uspjeh-obavijest')).toContainText('obrisan');
  await expect(nadimakRed).toHaveCount(0);
});
