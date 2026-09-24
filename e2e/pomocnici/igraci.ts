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

export async function udjiUJavniRed(igraci: readonly E2EIgrac[], mod: 'dva_igraca' | 'cetiri_igraca') {
  await Promise.all(igraci.map((igrac) => igrac.stranica.goto(`/red?mod=${mod}`)));
}

export async function cekajIstuPartiju(igraci: readonly E2EIgrac[]): Promise<string> {
  const partijaIdovi = await Promise.all(
    igraci.map(async ({ stranica }) => {
      await expect(stranica).toHaveURL(/\/partija\/[0-9a-f-]+$/);
      return new URL(stranica.url()).pathname.split('/').at(-1)!;
    }),
  );
  expect(new Set(partijaIdovi).size).toBe(1);
  return partijaIdovi[0]!;
}

export async function zatvoriIgrace(igraci: readonly E2EIgrac[]): Promise<void> {
  await Promise.all(igraci.map(({ kontekst }) => kontekst.close()));
}