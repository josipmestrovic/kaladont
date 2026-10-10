import { expect, test, type Page } from '@playwright/test';
import type { RazlogEliminacije, StanjePartije } from 'zajednicko';
import {
  cekajIstuPartiju,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';

for (const mod of ['dva_igraca', 'cetiri_igraca'] as const) {
  test(`odbrojavanje prikazuje konačna bot sjedala u modu ${mod}`, async ({ page }) => {
    await page.goto(`/red?mod=${mod}`);
    await expect(page.locator('.mjesta li.moje-sjedalo')).toHaveCount(1);
    await page.evaluate(async (nacin) => {
      const putanjaModula = '/src/lib/socket.ts';
      const modul = await import(putanjaModula);
      const socket = modul.dohvatiSocket();
      const stanje = await new Promise<{ mojIgracId: string }>((resolve) => {
        socket.once('red:stanje', resolve);
        socket.emit('red:stanje', { mod: nacin });
      });
      const mjesta = nacin === 'dva_igraca' ? 2 : 4;
      socket.emitEvent(['partija:pocetak', {
        partijaId: 'test-odbrojavanje', mojIgracId: stanje.mojIgracId, mod: nacin, kontekst: 'javna',
        pocetakIso: new Date(Date.now() + 60_000).toISOString(),
        sjedala: Array.from({ length: mjesta }, (_, indeks) => ({
          igracId: indeks === 0 ? stanje.mojIgracId : `bot-${indeks}`,
          nadimak: indeks === 0 ? 'Igrac' : `TestniBot${indeks}`,
          jeGost: indeks === 0, avatarId: 0, avatarConfig: null, avatarRevision: 0,
          rang: null, razina: 1, trenutniNiz: 0, razinaVatre: 0,
        })),
      }]);
    }, mod);
    await expect(page.getByRole('heading', { name: /Svi igrači su tu/ })).toBeVisible();
    await expect(page.locator('.mjesta li.zauzeto')).toHaveCount(mod === 'dva_igraca' ? 2 : 4);
    await expect(page.getByText('Prazno mjesto', { exact: true })).toHaveCount(0);
    await expect(page.getByText('TestniBot1', { exact: true })).toBeVisible();
  });
}

async function polozajiAvatara(stranica: Page) {
  return stranica.locator('.igraci-red .avatar-omot').evaluateAll((avatari) => avatari.map((avatar) => {
    const { x, y, width, height } = avatar.getBoundingClientRect();
    return { x, y, width, height };
  }));
}

async function emitiranjeStanja(stranica: Page, stanje: StanjePartije) {
  await stranica.evaluate(async (poruka) => {
    const putanja = '/src/lib/socket.ts';
    const { dohvatiSocket } = await import(putanja);
    dohvatiSocket().emitEvent(['partija:stanje', poruka]);
  }, stanje);
}

for (const zaslon of [
  { width: 1440, height: 900 }, { width: 390, height: 844 },
  { width: 320, height: 568 }, { width: 844, height: 390 },
]) {
  for (const mod of ['dva_igraca', 'cetiri_igraca'] as const) {
    test(`stabilni avatari kroz prijelaze ${mod} ${zaslon.width}x${zaslon.height}`, async ({ browser }, podaciTesta) => {
      test.setTimeout(90_000);
      const igraci = await stvoriIgrace(browser, mod === 'dva_igraca' ? 2 : 4);
      try {
        for (const { stranica } of igraci) await stranica.setViewportSize(zaslon);
        await udjiUJavniRed(igraci, mod);
        const partijaId = await cekajIstuPartiju(igraci);
        const stanja: StanjePartije[] = [];
        for (const { stranica } of igraci) {
          await expect(stranica.locator('.igraci-red > li')).toHaveCount(igraci.length);
          await stranica.evaluate(() => document.fonts.ready);
          stanja.push(await stranica.evaluate(async () => {
            const putanja = '/src/lib/stanje-igre.svelte.ts';
            const { dohvatiStanjeIgre } = await import(putanja);
            return JSON.parse(JSON.stringify(dohvatiStanjeIgre()));
          }));
        }
        const sjedala = stanja[0]!.sjedala.map((sjedalo, indeks) => ({ ...sjedalo, nadimak: `DugiNadimakIgraca${indeks}` }));
        const autor = sjedala[0]!.igracId;
        const ispali = sjedala[1]!.igracId;
        const rijec = 'najneprepoznatljivijima';
        for (let indeks = 0; indeks < igraci.length; indeks += 1) {
          await emitiranjeStanja(igraci[indeks]!.stranica, {
            ...stanja[indeks]!, sjedala, naPotezuId: autor, sustavBiraRijec: false,
            zadnjaRijec: rijec, zadnjaRijecIgracId: autor, zadnjaRijecVrsta: 'rijec',
            istekPotezaIso: '', eliminacije: [], statusSpremanja: 'nije_zavrsena',
          });
        }
        const prije = await Promise.all(igraci.map(({ stranica }) => polozajiAvatara(stranica)));
        for (const { stranica } of igraci) {
          const unos = stranica.getByRole('textbox', { name: /Dovrši riječ na/ });
          if (await unos.count()) await expect(unos).toHaveCSS('font-size', zaslon.width >= 1000 ? '20px' : '18px');
        }
        const provjeri = async () => {
          for (let indeks = 0; indeks < igraci.length; indeks += 1) {
            const stranica = igraci[indeks]!.stranica;
            await expect.poll(() => polozajiAvatara(stranica)).toEqual(prije[indeks]);
            for (const avatar of await polozajiAvatara(stranica)) {
              expect(avatar.x).toBeGreaterThanOrEqual(0);
              expect(avatar.y).toBeGreaterThanOrEqual(0);
              expect(avatar.x + avatar.width).toBeLessThanOrEqual(zaslon.width);
              expect(avatar.y + avatar.height).toBeLessThanOrEqual(zaslon.height);
            }
            const statusi = await stranica.locator('.red-label').evaluateAll((elementi) => elementi.map((element) => ({
              prelijeva: element.scrollWidth > element.clientWidth,
              visina: element.getBoundingClientRect().height,
            })));
            expect(statusi.every((status) => !status.prelijeva && status.visina === 18)).toBe(true);
            expect(await stranica.locator('.avatar-omot').evaluateAll((avatari) => avatari.every((avatar) => {
              const pravokutnik = avatar.getBoundingClientRect();
              const element = document.elementFromPoint(pravokutnik.x + pravokutnik.width / 2, pravokutnik.y + pravokutnik.height / 2);
              return element !== null && avatar.contains(element);
            }))).toBe(true);
            expect(await stranica.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          }
        };
        const razlozi: RazlogEliminacije[] = ['mrtva_slova_baza', 'mrtva_slova_iskoristeno', 'kaladont', 'istek', 'prekid', 'ne_znam'];
        for (const razlog of razlozi) {
          for (let indeks = 0; indeks < igraci.length; indeks += 1) {
            await emitiranjeStanja(igraci[indeks]!.stranica, {
              ...stanja[indeks]!, sjedala, naPotezuId: autor, sustavBiraRijec: false, istekPotezaIso: '',
              zadnjaRijec: rijec, zadnjaRijecIgracId: razlog === 'istek' ? ispali : autor, zadnjaRijecVrsta: 'rijec',
              eliminacije: [], statusSpremanja: 'nije_zavrsena',
            });
            await emitiranjeStanja(igraci[indeks]!.stranica, {
              ...stanja[indeks]!, sjedala, naPotezuId: autor, sustavBiraRijec: true,
              istekIzboraIso: new Date(Date.now() + 8_000).toISOString(), istekPotezaIso: '',
              zadnjaRijec: rijec, zadnjaRijecIgracId: razlog === 'istek' ? ispali : autor, zadnjaRijecVrsta: 'rijec',
              eliminacije: [{ igracId: ispali, razlog, plasman: igraci.length, bodZa: autor, slova: 'ma', rijecUzrok: rijec }],
              statusSpremanja: 'nije_zavrsena',
            });
          }
          await expect(igraci[0]!.stranica.getByText(/Nova runda za:/)).toBeVisible();
          await provjeri();
          for (const { stranica } of igraci) {
            await expect(stranica.locator('.rijec-oblak')).toHaveText(rijec);
            const oblak = await stranica.locator('.rijec-oblak').boundingBox();
            expect(oblak!.y).toBeGreaterThanOrEqual(0);
            expect(oblak!.x).toBeGreaterThanOrEqual(0);
            expect(oblak!.x + oblak!.width).toBeLessThanOrEqual(zaslon.width);
          }
        }
        for (let indeks = 0; indeks < igraci.length; indeks += 1) {
          const stranica = igraci[indeks]!.stranica;
          await emitiranjeStanja(stranica, {
            ...stanja[indeks]!, sjedala, naPotezuId: autor, sustavBiraRijec: false,
            zadnjaRijec: 'maslac', zadnjaRijecIgracId: null, zadnjaRijecVrsta: 'sustav_rijec',
            istekPotezaIso: '', eliminacije: [], statusSpremanja: 'nije_zavrsena',
          });
          await stranica.evaluate(async (id) => {
            const putanja = '/src/lib/stanje-igre.svelte.ts';
            const { dohvatiStanjeIgre } = await import(putanja);
            const stanje = dohvatiStanjeIgre();
            stanje.obracunIskustva = { partijaId: id, mojeIskustvo: { osvojenoIskustvo: 25 } };
            stanje.stavkeIskustva = [{ vrsta: 'duge_rijeci', naziv: 'Duga riječ', iskustvo: 10 }];
          }, partijaId);
        }
        await provjeri();
        for (let indeks = 0; indeks < igraci.length; indeks += 1) {
          const stranica = igraci[indeks]!.stranica;
          const zavrsno: StanjePartije = {
            ...stanja[indeks]!, sjedala, naPotezuId: autor, sustavBiraRijec: false, zavrsena: true,
            istekPotezaIso: '', zadnjaRijec: 'kaladont', zadnjaRijecIgracId: autor, zadnjaRijecVrsta: 'rijec',
            eliminacije: sjedala.slice(1).map((sjedalo, red) => ({ igracId: sjedalo.igracId, razlog: 'kaladont', plasman: red + 2, bodZa: autor, slova: null, rijecUzrok: null })),
            statusSpremanja: 'spremanje_rezultata',
          };
          await emitiranjeStanja(stranica, zavrsno);
        }
        await provjeri();
        const vrijemeRezultata = Date.now();
        for (const { stranica } of igraci) {
          await stranica.clock.install({ time: new Date(vrijemeRezultata) });
          await stranica.evaluate(async ({ id, vrijeme }) => {
            const putanja = '/src/lib/socket.ts';
            const { dohvatiSocket } = await import(putanja);
            dohvatiSocket().emitEvent(['partija:kraj', {
              partijaId: id, prikazRezultataOdIso: new Date(vrijeme + 8_000).toISOString(),
              plasmani: [], mojNoviProsjek: 0, mojRang: null, mojeIskustvo: null,
              mojaOcjenaIgre: null, bonusOcjenaIgre: 0, novaDostignuca: [],
            }]);
          }, { id: partijaId, vrijeme: vrijemeRezultata });
          await expect(stranica.getByText(/Rezultati za:/)).toBeVisible();
        }
        await provjeri();
        await igraci[0]!.stranica.screenshot({ path: podaciTesta.outputPath('stabilni-avatari.png'), fullPage: true });
        for (const { stranica } of igraci) {
          await stranica.clock.fastForward(3_000);
          await expect(stranica.getByText(/Rezultati za:/)).toContainText('5');
          await stranica.clock.fastForward(5_000);
          await expect(stranica.getByRole('heading', { name: 'Završni poredak' })).toBeVisible();
        }
      } finally {
        await zatvoriIgrace(igraci);
      }
    });
  }
}

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
