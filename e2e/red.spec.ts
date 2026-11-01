import { expect, test, type Page } from '@playwright/test';
import type { RazlogEliminacije, StanjePartije } from 'zajednicko';
import {
  cekajIstuPartiju,
  stvoriIgrace,
  udjiUJavniRed,
  zatvoriIgrace,
} from './pomocnici/igraci.js';

for (const sirina of [320, 390, 1440]) {
  test(`zanimljivosti se listaju bez pomicanja čekaonice ${sirina}px`, async ({ page }, podaciTesta) => {
    await page.setViewportSize({ width: sirina, height: 900 });
    await page.goto('/red?mod=dva_igraca');
    const zanimljivosti = page.getByRole('region', { name: 'Zanimljivosti o hrvatskom jeziku' });
    await expect(zanimljivosti.getByRole('heading', { name: 'Zanimljivosti', exact: true })).toBeVisible();
    await expect(zanimljivosti.locator('article')).toHaveCount(23);
    await page.evaluate(() => document.fonts.ready);
    const visina = (await zanimljivosti.boundingBox())!.height;
    const prviNaslov = await zanimljivosti.locator('article[aria-hidden="false"] h3').textContent();
    await zanimljivosti.getByRole('button', { name: 'Sljedeća zanimljivost' }).click();
    await expect(zanimljivosti.locator('.brojac')).toHaveText('2 / 23');
    await expect(zanimljivosti.locator('article[aria-hidden="false"] h3')).not.toHaveText(prviNaslov!);
    await zanimljivosti.getByRole('button', { name: 'Prethodna zanimljivost' }).click();
    await expect(zanimljivosti.locator('.brojac')).toHaveText('1 / 23');
    await zanimljivosti.getByRole('button', { name: 'Sljedeća zanimljivost' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(zanimljivosti.locator('.brojac')).toHaveText('2 / 23');
    await zanimljivosti.locator('.klizac').evaluate((element) => element.scrollTo({ left: element.clientWidth * 22, behavior: 'instant' }));
    await expect(zanimljivosti.locator('.brojac')).toHaveText('23 / 23');
    expect((await zanimljivosti.boundingBox())!.height).toBe(visina);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const clanak of await zanimljivosti.locator('article').all()) {
      expect(await clanak.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await page.screenshot({ path: podaciTesta.outputPath('zanimljivosti.png'), fullPage: true });
  });
}

for (const svijetla of [false, true]) {
  test(`završni rezultati imaju čitljiv kontrast ${svijetla ? 'svijetla' : 'tamna'}`, async ({ browser }, podaciTesta) => {
    const igraci = await stvoriIgrace(browser, 2);
    try {
      await udjiUJavniRed(igraci, 'dva_igraca');
      const partijaId = await cekajIstuPartiju(igraci);
      const stranica = igraci[0]!.stranica;
      await expect(stranica.locator('.igraci-red > li')).toHaveCount(2);
      await expect.poll(() => stranica.evaluate(async () => {
        const putanja = '/src/lib/stanje-igre.svelte.ts';
        const { dohvatiStanjeIgre } = await import(putanja);
        return dohvatiStanjeIgre().runda;
      })).toBeGreaterThanOrEqual(1);
      await stranica.evaluate(async ({ id, tema }) => {
        document.documentElement.dataset.tema = tema;
        const putanja = '/src/lib/stanje-igre.svelte.ts';
        const { dohvatiStanjeIgre } = await import(putanja);
        const stanje = dohvatiStanjeIgre();
        const osi = ['Brzina', 'Rječnik', 'Duljina', 'Rijetkost', 'Eliminacije', 'Pobjede'].map((naziv, indeks) => ({ kljuc: `os-${indeks}`, naziv, vrijednost: 60 }));
        stanje.kraj = {
          partijaId: id, prikazRezultataOdIso: new Date(Date.now() - 1_000).toISOString(),
          plasmani: stanje.sjedala.map((sjedalo: { igracId: string; nadimak: string }, indeks: number) => ({ igracId: sjedalo.igracId, nadimak: sjedalo.nadimak, plasman: indeks + 1, bodovi: indeks === 0 ? 1 : 0, eliminacije: 0 })),
          mojNoviProsjek: 1, mojRang: null, mojaOcjenaIgre: 3, bonusOcjenaIgre: 0, novaDostignuca: [], mod: 'dva_igraca',
          mojeIskustvo: { prije: { razina: 1, ukupno: 90, uRazini: 90, doIduce: 100 }, poslije: { razina: 2, ukupno: 150, uRazini: 50, doIduce: 150 }, stavke: [{ vrsta: 'potezi', naziv: 'Prihvaćene riječi', kolicina: 12, poStavci: 5, iskustvo: 60 }], osvojenoIskustvo: 60, brutoIskustvo: 60, najboljiStreak: 12, mnoziteljStreaka: 1, bonusOcjenaIgre: 0 },
          mojDnk: { odigrano: 11, otkljucan: true, upravoOtkljucan: false, preostaloDoOtkljucavanja: 0, prije: osi.map((os) => ({ ...os, vrijednost: 70 })), poslije: osi },
        };
      }, { id: partijaId, tema: svijetla ? 'svijetla' : 'tamna' });
      await expect(stranica.getByRole('heading', { name: 'Završni poredak' })).toBeVisible();
      const provjeriKontrast = async () => {
        const omjeri = await stranica.locator('.iskustvo-partije header strong, .iskustvo-partije p, .iskustvo-partije li, .dnk-promjena-redak strong, .dnk-promjena-redak b, .plasman-ime, .plasman-bodovi, .kraj-akcije a').evaluateAll((elementi) => {
          const platno = document.createElement('canvas');
          platno.width = platno.height = 1;
          const kontekst = platno.getContext('2d')!;
          const rgba = (boja: string) => {
            kontekst.clearRect(0, 0, 1, 1);
            kontekst.fillStyle = boja;
            kontekst.fillRect(0, 0, 1, 1);
            return [...kontekst.getImageData(0, 0, 1, 1).data];
          };
          const spoji = (prednji: number[], straznji: number[]) => prednji.slice(0, 3).map((kanal, indeks) => kanal * prednji[3]! / 255 + straznji[indeks]! * (1 - prednji[3]! / 255));
          const svjetlina = (boja: number[]) => boja.map((kanal) => {
            const vrijednost = kanal / 255;
            return vrijednost <= 0.04045 ? vrijednost / 12.92 : ((vrijednost + 0.055) / 1.055) ** 2.4;
          }).reduce((zbroj, kanal, indeks) => zbroj + kanal * [0.2126, 0.7152, 0.0722][indeks]!, 0);
          return elementi.map((element) => {
            const roditelji: Element[] = [];
            for (let roditelj: Element | null = element; roditelj; roditelj = roditelj.parentElement) roditelji.unshift(roditelj);
            let podloga = [255, 255, 255];
            for (const roditelj of roditelji) podloga = spoji(rgba(getComputedStyle(roditelj).backgroundColor), podloga);
            const stil = getComputedStyle(element);
            const tekst = svjetlina(spoji(rgba(stil.color), podloga));
            const pozadina = svjetlina(podloga);
            return { tekst: element.textContent, omjer: (Math.max(tekst, pozadina) + 0.05) / (Math.min(tekst, pozadina) + 0.05) };
          });
        });
        for (const omjer of omjeri) expect(omjer.omjer, omjer.tekst ?? '').toBeGreaterThanOrEqual(4.5);
      };
      await provjeriKontrast();
      expect(await stranica.locator('.dnk-podrucje').evaluate((element) => getComputedStyle(element).stroke)).toBe(await stranica.evaluate(() => {
        const element = document.createElement('span');
        element.style.color = 'var(--boja-akcent-tekst)';
        document.body.append(element);
        const boja = getComputedStyle(element).color;
        element.remove();
        return boja;
      }));
      await stranica.screenshot({ path: podaciTesta.outputPath('rezultati.png'), fullPage: true });
      await stranica.evaluate(async () => {
        const putanja = '/src/lib/stanje-igre.svelte.ts';
        const { dohvatiStanjeIgre } = await import(putanja);
        dohvatiStanjeIgre().kraj.mojeIskustvo.poslije = { razina: 100, ukupno: 999999, uRazini: 0, doIduce: null };
      });
      await expect(stranica.locator('.iskustvo-partije .max')).toHaveText('MAX');
      await provjeriKontrast();
    } finally {
      await zatvoriIgrace(igraci);
    }
  });
}

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
            expect(statusi.every((status) => !status.prelijeva && status.visina >= (zaslon.width >= 1000 ? 45 : 40))).toBe(true);
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

test('dijalog Ne znam nestaje nakon eliminacije i prikazuje promatranje', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    const partijaId = await cekajIstuPartiju(igraci);

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

    const stranica = igraci[indeksNaPotezu]!.stranica;
    await stranica.locator('.ne-znam-gumb').click();
    const dijalog = stranica.getByRole('dialog', { name: 'Predati potez?' });
    await expect(dijalog).toBeVisible();

    const mojIgracId = await stranica.evaluate(async () => {
      const putanja = '/src/lib/stanje-igre.svelte.ts';
      const { dohvatiStanjeIgre } = await import(putanja);
      return dohvatiStanjeIgre().mojIgracId;
    });

    await stranica.evaluate(
      async ({ id, igracId }) => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        const socket = dohvatiSocket();
        socket.emitEvent([
          'partija:eliminacija',
          {
            igracId,
            plasman: 4,
            razlog: 'istek',
            bodZa: null,
            slova: null,
            rijecUzrok: null,
          },
        ]);
        socket.emitEvent([
          'partija:sustav-bira-rijec',
          { istekIzboraIso: new Date(Date.now() + 8_000).toISOString() },
        ]);
        void id;
      },
      { id: partijaId, igracId: mojIgracId },
    );

    await expect(dijalog).toBeHidden();
    await expect(stranica.locator('.zona-poteza')).toHaveCount(0);
    await expect(stranica.locator('.ne-znam-gumb')).toHaveCount(0);
    await expect(stranica.locator('.promatranje-traka')).toBeVisible();
    await expect(stranica.getByText(/Nova runda za:/)).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('eliminator nakon kaladonta ostaje interaktivan i dobiva formu u novoj rundi', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    await cekajIstuPartiju(igraci);

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

    const stranica = igraci[indeksNaPotezu]!.stranica;
    const { mojIgracId, zrtvaId } = await stranica.evaluate(async () => {
      const putanja = '/src/lib/stanje-igre.svelte.ts';
      const { dohvatiStanjeIgre } = await import(putanja);
      const stanje = dohvatiStanjeIgre();
      const zrtva = stanje.sjedala.find((sjedalo: { igracId: string }) => sjedalo.igracId !== stanje.mojIgracId);
      return { mojIgracId: stanje.mojIgracId as string, zrtvaId: zrtva!.igracId as string };
    });

    await stranica.evaluate(
      async ({ autorId, zrtvaId }) => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        const socket = dohvatiSocket();
        socket.emitEvent([
          'potez:prihvacen',
          {
            igracId: autorId,
            rijec: 'kaladont',
            trazenaSlova: 'ka',
            sljedeciId: zrtvaId,
            turnToken: 'test-token',
            istekPotezaIso: '',
            serverVrijemeIso: new Date().toISOString(),
            brojIskoristenih: 3,
            streak: 2,
            nagrada: null,
            iskustvo: [{ vrsta: 'kaladont', naziv: 'Kaladont', kolicina: 1, poStavci: 100, iskustvo: 100 }],
          },
        ]);
        socket.emitEvent([
          'partija:eliminacija',
          {
            igracId: zrtvaId,
            plasman: 4,
            razlog: 'kaladont',
            bodZa: autorId,
            slova: null,
            rijecUzrok: 'kaladont',
            iskustvo: { vrsta: 'eliminacije', naziv: 'Eliminacija', kolicina: 1, poStavci: 25, iskustvo: 25 },
          },
        ]);
        socket.emitEvent([
          'partija:sustav-bira-rijec',
          { istekIzboraIso: new Date(Date.now() + 8_000).toISOString() },
        ]);
      },
      { autorId: mojIgracId, zrtvaId },
    );

    await expect(stranica.getByText(/Nova runda za:/)).toBeVisible();
    await expect(stranica.locator('.zona-poteza')).toHaveCount(0);
    await expect(stranica.locator('.dijalog-overlay')).toHaveCount(0);

    await stranica.getByRole('button', { name: 'Otvori brze poruke' }).click();
    await expect(stranica.locator('#izbornik-brzih-poruka')).toBeVisible();
    await stranica.keyboard.press('Escape');

    await stranica.evaluate(
      async ({ autorId }) => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        dohvatiSocket().emitEvent([
          'partija:runda-otvorena',
          {
            rijec: 'sustavska',
            trazenaSlova: 'ka',
            naPotezuId: autorId,
            turnToken: 'nova-runda-token',
            istekPotezaIso: new Date(Date.now() + 30_000).toISOString(),
            serverVrijemeIso: new Date().toISOString(),
            runda: 2,
          },
        ]);
      },
      { autorId: mojIgracId },
    );

    await expect(stranica.locator('.zona-poteza')).toBeVisible();
    await expect(stranica.getByRole('textbox', { name: /Dovrši riječ na/ })).toBeEnabled();
    await expect(stranica.locator('.igraci-red li.naPotezu .avatar-omot')).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('eliminator nakon zadnje eliminacije vidi spremanje a ne zamrznuti stol', async ({ browser }) => {
  const igraci = await stvoriIgrace(browser, 4);
  try {
    await udjiUJavniRed(igraci, 'cetiri_igraca');
    await cekajIstuPartiju(igraci);

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

    const stranica = igraci[indeksNaPotezu]!.stranica;
    const ids = await stranica.evaluate(async () => {
      const putanja = '/src/lib/stanje-igre.svelte.ts';
      const { dohvatiStanjeIgre } = await import(putanja);
      const stanje = dohvatiStanjeIgre();
      const ostali = stanje.sjedala
        .map((sjedalo: { igracId: string }) => sjedalo.igracId)
        .filter((id: string) => id !== stanje.mojIgracId);
      return { mojIgracId: stanje.mojIgracId as string, ostali: ostali as string[] };
    });

    await stranica.evaluate(
      async ({ autorId, ostali }) => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        const socket = dohvatiSocket();
        for (const [indeks, zrtvaId] of ostali.slice(0, 2).entries()) {
          socket.emitEvent([
            'partija:eliminacija',
            {
              igracId: zrtvaId,
              plasman: 4 - indeks,
              razlog: 'istek',
              bodZa: autorId,
              slova: null,
              rijecUzrok: null,
            },
          ]);
        }
        const zadnjaZrtva = ostali[2]!;
        socket.emitEvent([
          'potez:prihvacen',
          {
            igracId: autorId,
            rijec: 'kaladont',
            trazenaSlova: 'ka',
            sljedeciId: zadnjaZrtva,
            turnToken: 'test-token',
            istekPotezaIso: '',
            serverVrijemeIso: new Date().toISOString(),
            brojIskoristenih: 8,
            streak: 5,
            nagrada: null,
            iskustvo: [{ vrsta: 'kaladont', naziv: 'Kaladont', kolicina: 1, poStavci: 100, iskustvo: 100 }],
          },
        ]);
        socket.emitEvent([
          'partija:eliminacija',
          {
            igracId: zadnjaZrtva,
            plasman: 2,
            razlog: 'kaladont',
            bodZa: autorId,
            slova: null,
            rijecUzrok: 'kaladont',
          },
        ]);
      },
      { autorId: ids.mojIgracId, ostali: ids.ostali },
    );

    await expect(stranica.getByText(/Spremanje rezultata/)).toBeVisible();
    await expect(stranica.getByText(/Traži se riječ na:/)).toHaveCount(0);
    await expect(stranica.locator('.zona-poteza')).toHaveCount(0);
    await expect(stranica.locator('.dijalog-overlay')).toHaveCount(0);
    await expect(stranica.getByRole('button', { name: 'Otvori brze poruke' })).toBeEnabled();
    await stranica.getByRole('button', { name: 'Otvori brze poruke' }).click();
    await expect(stranica.locator('#izbornik-brzih-poruka')).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});
