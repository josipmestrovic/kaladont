import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface E2EIgrac {
  kontekst: BrowserContext;
  stranica: Page;
}

export async function dodajIgrace(browser: Browser, broj: number): Promise<E2EIgrac[]> {
  return Promise.all(
    Array.from({ length: broj }, async () => {
      const kontekst = await browser.newContext();
      const stranica = await kontekst.newPage();
      return { kontekst, stranica };
    }),
  );
}

export async function stvoriIgrace(browser: Browser, broj: number): Promise<E2EIgrac[]> {
  return dodajIgrace(browser, broj);
}

/** PR14: podržava Troboj i optional `pravila` (default KA-ZNA na serveru ako izostane). */
export async function udjiUJavniRed(
  igraci: readonly E2EIgrac[],
  mod: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca',
  pravila?: 'klasicni' | 'ka_zna' | 'dokazi_nastavak',
) {
  const query = pravila
    ? `/red?mod=${mod}&pravila=${pravila}`
    : `/red?mod=${mod}`;
  await Promise.all(igraci.map(async (igrac) => {
    await igrac.stranica.goto(query);
  }));
}

export async function cekajIstuPartiju(igraci: readonly E2EIgrac[]): Promise<string> {
  const partijaIdovi = await Promise.all(
    igraci.map(async ({ stranica }) => {
      // CI matchmaking + bot fill često treba više od zadanog Playwright 5s.
      await expect(stranica).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 30_000 });
      return new URL(stranica.url()).pathname.split('/').at(-1)!;
    }),
  );
  expect(new Set(partijaIdovi).size).toBe(1);
  return partijaIdovi[0]!;
}

const UNOS_POTEZA = /Dovrši riječ na|Dokaži nastavak/;

export async function cekajIgracaNaPotezu(igraci: readonly E2EIgrac[]): Promise<E2EIgrac> {
  let igracNaPotezu: E2EIgrac | null = null;
  await expect.poll(async () => {
    for (const igrac of igraci) {
      if (await igrac.stranica.getByRole('textbox', { name: UNOS_POTEZA }).isVisible()) {
        igracNaPotezu = igrac;
        return true;
      }
    }
    return false;
  }, { timeout: 15_000 }).toBe(true);
  return igracNaPotezu!;
}

/** Upiše nastavak (bez prefiksa) i pošalje potez. */
export async function odigrajRijec(stranica: Page, cijelaRijec: string): Promise<void> {
  const unos = stranica.getByRole('textbox', { name: UNOS_POTEZA });
  await expect(unos).toBeVisible({ timeout: 10_000 });
  const oznaka = (await unos.getAttribute('aria-label')) ?? '';
  const prefiksPoklapanje = oznaka.match(/(?:Dovrši riječ na|Dokaži nastavak na)\s+(.+)$/i);
  const prefiks = (prefiksPoklapanje?.[1] ?? '').trim().toLocaleLowerCase('hr');
  const normalizirana = cijelaRijec.trim().toLocaleLowerCase('hr');
  if (!prefiks || !normalizirana.startsWith(prefiks)) {
    throw new Error(`Riječ „${cijelaRijec}” ne odgovara prefiksu iz UI-ja („${prefiks}”).`);
  }
  const nastavak = normalizirana.slice(prefiks.length);
  if (!nastavak) {
    throw new Error(`Riječ „${cijelaRijec}” nema nastavak iza prefiksa „${prefiks}”.`);
  }
  await unos.fill(nastavak);
  await expect(unos).toHaveValue(nastavak);
  await stranica.getByRole('button', { name: 'Pošalji' }).click();
  // Potez prihvaćen → forma nestaje (red prelazi).
  await expect(unos).toBeHidden({ timeout: 15_000 });
}

export async function predajNeZnam(stranica: Page): Promise<void> {
  await stranica.getByRole('button', { name: 'Ne znam' }).click();
  const dijalog = stranica.getByRole('dialog', { name: 'Predati potez?' });
  await expect(dijalog).toBeVisible();
  await dijalog.getByRole('button', { name: 'Da' }).click();
}

export async function zatvoriIgrace(igraci: readonly E2EIgrac[]): Promise<void> {
  await Promise.all(igraci.map(({ kontekst }) => kontekst.close()));
}