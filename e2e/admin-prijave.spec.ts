import { expect, test } from '@playwright/test';

test('admin prijave: potvrda-popup, toast i uklanjanje retka bez refresha', async ({ page }) => {
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

  let dismissTijelo: unknown = null;
  let obrisiRacunTijelo: unknown = null;

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
      dismissTijelo = ruta.request().postDataJSON();
      await new Promise((r) => setTimeout(r, 400));
      rijeci = rijeci.filter((p) => p.id !== 101);
      await ruta.fulfill({ json: { ok: true } });
      return;
    }
    if (metoda === 'POST' && putanja.endsWith('/admin/prijave-igraca/202/obrisi-racun')) {
      obrisiRacunTijelo = ruta.request().postDataJSON();
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
  const dismissDijalog = page.getByRole('dialog', { name: 'Odbaciti prijavu?' });
  await expect(dismissDijalog).toBeVisible();
  await dismissDijalog.getByLabel('Napomena (neobavezno)').fill('Nije greška.');
  await dismissDijalog.getByRole('button', { name: 'Dismiss' }).click();
  // Optimistički UI: red i toast odmah nakon potvrde, bez čekanja na POST.
  await expect(page.locator('.uspjeh-obavijest', { hasText: 'Prijava odbačena.' })).toBeVisible();
  await expect(rijecRed).toHaveCount(0);
  await expect.poll(() => dismissTijelo).toEqual({ napomena: 'Nije greška.' });

  const obrisiRacun = page.getByRole('button', { name: 'Obriši račun' });
  // Pričekaj kraj prve akcije (akcijaUTijeku) pa tek onda klikni drugu.
  await expect(obrisiRacun).toBeEnabled({ timeout: 10_000 });
  await obrisiRacun.click();
  const obrisiDijalog = page.getByRole('dialog', { name: 'Obrisati račun?' });
  await expect(obrisiDijalog).toBeVisible();
  await obrisiDijalog.getByRole('button', { name: 'Obriši račun' }).click();
  await expect(page.locator('.uspjeh-obavijest')).toContainText('obrisan');
  await expect(nadimakRed).toHaveCount(0);
  await expect.poll(() => obrisiRacunTijelo).toEqual({});
});

test('admin prijave: Dodaj otvara popup rijetkosti i šalje tierRijetkosti + napomenu', async ({ page }) => {
  let rijeci: Array<{
    id: number;
    tip: 'za_brisanje' | 'za_dodavanje';
    rijec: string;
    status: string;
    vrijeme: string;
    partijaId: string;
  }> = [
    {
      id: 303,
      tip: 'za_dodavanje',
      rijec: 'novaforma',
      status: 'nova',
      vrijeme: new Date().toISOString(),
      partijaId: 'partija-2',
    },
  ];

  let poslanoTijelo: unknown = null;

  await page.route('**/api/admin/**', async (ruta) => {
    const url = new URL(ruta.request().url());
    const putanja = url.pathname;
    const metoda = ruta.request().method();

    if (metoda === 'GET' && putanja.endsWith('/admin/prijave')) {
      await ruta.fulfill({ json: { prijave: rijeci } });
      return;
    }
    if (metoda === 'GET' && putanja.endsWith('/admin/prijave-igraca')) {
      await ruta.fulfill({ json: { prijave: [] } });
      return;
    }
    if (metoda === 'POST' && putanja.endsWith('/admin/prijave/303/dodaj-rijec')) {
      poslanoTijelo = ruta.request().postDataJSON();
      await new Promise((r) => setTimeout(r, 150));
      rijeci = rijeci.filter((p) => p.id !== 303);
      await ruta.fulfill({ json: { ok: true, brojRijeci: 1 } });
      return;
    }

    await ruta.fulfill({ json: { ok: true, prijave: [], izmjene: [] } });
  });

  await page.goto('/admin/prijave');

  const rijecRed = page.locator('.rijec-prijava', { hasText: 'novaforma' });
  await expect(rijecRed).toBeVisible();

  await page.getByRole('button', { name: 'Dodaj' }).click();
  const dijalog = page.getByRole('dialog', { name: 'Dodati riječ?' });
  await expect(dijalog).toBeVisible();
  await expect(dijalog.getByText('novaforma')).toBeVisible();

  await dijalog.getByLabel('Rijetkost').selectOption('jako_rijetka');
  await dijalog.getByLabel('Napomena (neobavezno)').fill('Super prijava!');
  await dijalog.getByRole('button', { name: 'Dodaj u rječnik' }).click();

  await expect(page.locator('.uspjeh-obavijest', { hasText: 'novaforma' })).toBeVisible();
  await expect(rijecRed).toHaveCount(0);
  await expect(dijalog).toHaveCount(0);
  await expect.poll(() => poslanoTijelo).toEqual({
    tierRijetkosti: 'jako_rijetka',
    napomena: 'Super prijava!',
  });
});
