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

/** Javni red je samo Brza igra (Troboj · Klasični). */
export async function udjiUJavniRed(igraci: readonly E2EIgrac[]) {
  if (igraci.length < 1 || igraci.length > 3) {
    throw new Error(`Brza igra (Troboj) prima 1–3 igrača u javni red, dobiveno ${igraci.length}.`);
  }
  const query = '/red?mod=tri_igraca&pravila=klasicni';
  // Ulaz jedan-po-jedan: paralelni goto ostavlja stol na 1–2. Treći igrač može odmah
  // otići u /partija — zato prihvaćamo lobby ILI partiju, ne samo sjedalo.
  for (const igrac of igraci) {
    await igrac.stranica.goto(query);
    await expect
      .poll(
        async () => {
          if (/\/partija\/[0-9a-f-]+$/.test(igrac.stranica.url())) return 'partija';
          if (await igrac.stranica.locator('ul.mjesta > li.moje-sjedalo').isVisible().catch(() => false)) {
            return 'lobby';
          }
          return 'ceka';
        },
        { timeout: 10_000 },
      )
      .not.toBe('ceka');
  }
}

export async function cekajIstuPartiju(igraci: readonly E2EIgrac[]): Promise<string> {
  const partijaIdovi = await Promise.all(
    igraci.map(async ({ stranica }) => {
      // Troboj s 3 čovjeka mora odmah krenuti; 15s je dovoljno bez bot-fill čekanja.
      await expect(stranica).toHaveURL(/\/partija\/[0-9a-f-]+$/, { timeout: 15_000 });
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
  // Prefiks-only riječ (RS-05/RS-06): prazan nastavak je valjan submit.
  if (nastavak) {
    await unos.fill(nastavak);
    await expect(unos).toHaveValue(nastavak);
  } else {
    await unos.fill('');
    await expect(unos).toHaveValue('');
  }
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

export async function mojIgracId(stranica: Page): Promise<string> {
  const id = await stranica.locator('.igraci-red > li:has(.oznaka-ti)').getAttribute('data-igrac-id');
  if (!id) throw new Error('Nema data-igrac-id za lokalno sjedalo.');
  return id;
}

/** Serverski redoslijed sjedala (ne lokalno rotiran prikaz). */
export async function redoslijedSjedala(stranica: Page): Promise<string[]> {
  return stranica.evaluate(async () => {
    const putanja = '/src/lib/stanje-igre.svelte.ts';
    const { dohvatiStanjeIgre } = await import(putanja);
    return dohvatiStanjeIgre().sjedala.map((sjedalo: { igracId: string }) => sjedalo.igracId);
  });
}

export async function procitajPrefiksIPocetnu(stranica: Page): Promise<{
  prefiks: string;
  pocetnaRijec: string;
}> {
  const unos = stranica.getByRole('textbox', { name: UNOS_POTEZA });
  await expect(unos).toBeVisible({ timeout: 15_000 });
  const oznaka = (await unos.getAttribute('aria-label')) ?? '';
  const prefiks = (oznaka.match(/(?:Dovrši riječ na|Dokaži nastavak na)\s+(.+)$/i)?.[1] ?? '')
    .trim()
    .toLocaleLowerCase('hr');
  expect(prefiks.length).toBeGreaterThan(0);
  const pocetnaLokator = stranica.locator('.kontekst-rijeci .trenutna-rijec, .rijec-oblak').first();
  await expect(pocetnaLokator).toBeVisible({ timeout: 10_000 });
  const pocetnaRijec = (await pocetnaLokator.innerText()).replace(/\s+/g, '').toLocaleLowerCase('hr');
  expect(pocetnaRijec.length).toBeGreaterThan(0);
  return { prefiks, pocetnaRijec };
}

/** Privatna soba → partija; svi klijenti na isti partijaId. */
export async function pokreniPrivatnuPartiju(
  igraci: readonly E2EIgrac[],
  pravila: 'klasicni' | 'ka_zna' | 'dokazi_nastavak',
): Promise<string> {
  if (igraci.length < 2) throw new Error('Privatna partija treba barem 2 igrača.');
  const vlasnik = igraci[0]!.stranica;
  await vlasnik.goto(`/soba/kreiraj?pravila=${pravila}`);
  await expect(vlasnik.getByRole('radio', { name: new RegExp(pravila === 'ka_zna' ? 'KA-zna' : pravila === 'klasicni' ? 'Klasični' : 'Dokaži nastavak') })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await vlasnik.getByRole('radio', { name: 'Bez tajmera' }).click();
  await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
  await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
  const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();

  for (const gost of igraci.slice(1)) {
    await gost.stranica.goto(`/soba/${kodSobe}`);
  }
  await expect(vlasnik.getByText(new RegExp(`Prijavljeni igrači \\(${igraci.length} \\/ 8\\)`))).toBeVisible({
    timeout: 15_000,
  });
  await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
  return cekajIstuPartiju(igraci);
}

/**
 * Valjana stanja lobby oznake ili ulaska u partiju — ne proći samo zato što oznake nestane.
 * Vrati 'oznaka' tek kad je tekst usklađen; 'partija' kad je URL gotov.
 */
export async function cekajOznakuIliPartiju(
  stranica: Page,
  ocekivaniTekst: RegExp,
  timeoutMs = 30_000,
): Promise<'oznaka' | 'partija'> {
  let ishod: 'oznaka' | 'partija' | null = null;
  await expect
    .poll(
      async () => {
        if (/\/partija\/[0-9a-f-]+$/.test(stranica.url())) {
          ishod = 'partija';
          return 'partija';
        }
        const oznaka = stranica.getByTestId('red-oznaka-izbora');
        if (await oznaka.isVisible().catch(() => false)) {
          const tekst = (await oznaka.innerText().catch(() => '')) ?? '';
          if (ocekivaniTekst.test(tekst)) {
            ishod = 'oznaka';
            return 'oznaka';
          }
        }
        return 'ceka';
      },
      { timeout: timeoutMs },
    )
    .not.toBe('ceka');
  return ishod!;
}