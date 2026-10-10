import { expect, test } from '@playwright/test';
import type { PregledNadzora, UzorakNadzora } from '../paketi/zajednicko/src/nadzor.js';

test('admin nadzor prikazuje metrike i probnu obavijest na desktopu i mobitelu', async ({ page }, testInfo) => {
  let zastarjelo = false;
  let brojSlanja = 0;
  await page.route('**/api/admin/**', async (ruta) => {
    const putanja = new URL(ruta.request().url()).pathname;
    if (putanja.endsWith('/probna-obavijest')) {
      brojSlanja += 1;
      await ruta.fulfill({ json: { ok: true, poruka: 'Mail servis je prihvatio obavijest. Provjeri inbox.' } });
      return;
    }
    if (putanja.endsWith('/statistike/posluzitelj')) {
      const uzorak: UzorakNadzora = {
        vrijeme: new Date(Date.now() - (zastarjelo ? 60_000 : 0)).toISOString(),
        cpuPostotak: 24, rssBajtovi: 500 * 1_048_576, heapBajtovi: 250 * 1_048_576, vanjskaMemorijaBajtovi: 10 * 1_048_576, eventLoopP95Ms: 21,
        http: { zahtjevi: 100, greske4xx: 2, greske5xx: 0, p95Ms: 80 },
        socket: { pokusaji: 50, odbijeni: 1, autorizirani: 49, greskeAutorizacije: 0, prekidi: 3, p95AutorizacijeMs: 15, odbijeniOrigin: 0, odbijeniIp: 1, odbijeniLimit: 0 },
        igra: { veze: 49, partije: 10, treninzi: 2, slobodniBotovi: 40, botoviUPartiji: 0, isteciBotova: 0, namjerniIsteciBotova: 0, greskeBotova: 0 },
        baza: { dostupna: true, trajanjeMs: 2, provjerenoU: new Date().toISOString() },
      };
      const pregled: PregledNadzora = {
        ok: true, verzija: 'test-izdanje', digest: `sha256:${'a'.repeat(64)}`, uptimeSekunde: 3600,
        trenutno: uzorak, povijest: Array.from({ length: 180 }, (_, indeks) => ({ ...uzorak, cpuPostotak: indeks % 40 })),
        emailOmogucen: true,
        alarmi: [{ kljuc: 'cpu', naziv: 'CPU aplikacije', aktivan: false, zadnjaObavijest: null, greskaSlanja: false }],
      };
      await ruta.fulfill({ json: pregled });
      return;
    }
    await ruta.fulfill({ json: { ok: true, prijave: [], izmjene: [], dani: 7, poDanu: [], pobjedePoSastavu: [], eliminacijeBotova: [], zivo: null } });
  });
  await page.goto('/admin');
  const nadzor = page.getByRole('region', { name: 'Nadzor poslužitelja' });
  await expect(nadzor).toBeVisible();
  await expect(nadzor.getByText('500 MiB', { exact: true })).toBeVisible();
  await expect(nadzor.getByText(/Podaci aktualni/)).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`nadzor-${viewport.width}.png`), fullPage: true });
  }
  await nadzor.getByRole('button', { name: 'Poslati probnu obavijest' }).click();
  await expect(nadzor.getByRole('status')).toContainText('Provjeri inbox');
  expect(brojSlanja).toBe(1);
  zastarjelo = true;
  await nadzor.getByRole('button', { name: 'Osvježi nadzor' }).click();
  await expect(nadzor.getByText(/Podaci zastarjeli/)).toBeVisible();
});