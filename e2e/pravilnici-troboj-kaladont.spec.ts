/**
 * PR3 C1 — stvarni browser tok: isti lanac do „ka” + kaladont na troje
 * daje različitu žrtvu u Klasičnom vs KA-ZNA.
 */
import { expect, test } from '@playwright/test';
import {
  cekajIgracaNaPotezu,
  mojIgracId,
  odigrajRijec,
  pokreniPrivatnuPartiju,
  procitajPrefiksIPocetnu,
  redoslijedSjedala,
  stvoriIgrace,
  zatvoriIgrace,
  type E2EIgrac,
} from './pomocnici/igraci.js';
import { pronadjiLanacDoKa } from './pomocnici/rjecnik.js';

function sljedeciUKrugu(sjedala: readonly string[], odId: string, aktivni: ReadonlySet<string>): string {
  const pocetni = sjedala.indexOf(odId);
  if (pocetni < 0) throw new Error(`Igrač ${odId} nije u sjedalima`);
  for (let pomak = 1; pomak <= sjedala.length; pomak += 1) {
    const kandidat = sjedala[(pocetni + pomak) % sjedala.length]!;
    if (aktivni.has(kandidat)) return kandidat;
  }
  throw new Error(`Nema sljedećeg aktivnog nakon ${odId}`);
}

async function nadjiIgracaPoId(igraci: readonly E2EIgrac[], igracId: string): Promise<E2EIgrac> {
  for (const igrac of igraci) {
    if ((await mojIgracId(igrac.stranica)) === igracId) return igrac;
  }
  throw new Error(`Nema klijenta za igracId ${igracId}`);
}

for (const pravila of ['klasicni', 'ka_zna'] as const) {
  test(`Troboj ${pravila}: kaladont eliminira očekivanu žrtvu`, async ({ browser }) => {
    test.setTimeout(120_000);
    const igraci = await stvoriIgrace(browser, 3);
    try {
      await pokreniPrivatnuPartiju(igraci, pravila);
      const naPotezu = await cekajIgracaNaPotezu(igraci);
      const { prefiks, pocetnaRijec } = await procitajPrefiksIPocetnu(naPotezu.stranica);
      const lanac = await pronadjiLanacDoKa(prefiks, pocetnaRijec);
      expect(lanac.length).toBeGreaterThan(0);

      let autorKaId = await mojIgracId(naPotezu.stranica);
      for (const rijec of lanac) {
        const igrac = await cekajIgracaNaPotezu(igraci);
        autorKaId = await mojIgracId(igrac.stranica);
        await odigrajRijec(igrac.stranica, rijec);
      }

      const sayer = await cekajIgracaNaPotezu(igraci);
      const sayerId = await mojIgracId(sayer.stranica);
      const sjedala = await redoslijedSjedala(sayer.stranica);
      const aktivni = new Set(sjedala);
      const ocekivanaZrtva =
        pravila === 'klasicni' ? sljedeciUKrugu(sjedala, sayerId, aktivni) : autorKaId;

      expect(ocekivanaZrtva).not.toBe(sayerId);
      if (pravila === 'ka_zna') {
        expect(ocekivanaZrtva).toBe(autorKaId);
      } else {
        expect(ocekivanaZrtva).not.toBe(autorKaId);
      }

      await odigrajRijec(sayer.stranica, 'kaladont');

      for (const { stranica } of igraci) {
        await expect(stranica.locator(`.igraci-red > li[data-igrac-id="${ocekivanaZrtva}"]`)).toHaveClass(
          /eliminiran/,
          { timeout: 20_000 },
        );
        await expect(stranica.locator('.igraci-red > li.eliminiran')).toHaveCount(1);
        await expect(stranica.getByText(/Trenutna riječ:\s*kaladont/i)).toBeVisible({ timeout: 10_000 });
      }

      const zrtva = await nadjiIgracaPoId(igraci, ocekivanaZrtva);
      await expect(zrtva.stranica.getByText('Promatraš igru.')).toBeVisible({ timeout: 10_000 });

      const prezivjeli = igraci.filter((ig) => ig !== zrtva && ig !== sayer);
      // Sayer ili drugi preživjeli — igra nije zamrznuta.
      await expect
        .poll(
          async () => {
            for (const igrac of igraci) {
              if (igrac === zrtva) continue;
              if (
                await igrac.stranica
                  .getByRole('textbox', { name: /Dovrši riječ na|Dokaži nastavak/ })
                  .isVisible()
                  .catch(() => false)
              ) {
                return true;
              }
            }
            return false;
          },
          { timeout: 25_000 },
        )
        .toBe(true);
      expect(prezivjeli.length).toBeGreaterThanOrEqual(1);
    } finally {
      await zatvoriIgrace(igraci);
    }
  });
}
