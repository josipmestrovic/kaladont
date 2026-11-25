import { expect, test } from '@playwright/test';
import {
  cekajIgracaNaPotezu,
  cekajIstuPartiju,
  dodajIgrace,
  pokreniPrivatnuPartiju,
  udjiUJavniRed,
  zatvoriIgrace,
  type E2EIgrac,
} from './pomocnici/igraci.js';

// Sintetički prikaz geometrije (injektirano stanje); stvarni Troboj tok je zaseban test.
for (const brojSjedala of [2, 3, 4, 8]) {
  test(`mobilni unos prati tipkovnicu za ${brojSjedala} sjedala`, async ({ browser }, podaciTesta) => {
    test.setTimeout(60_000);
    const igraci = await dodajIgrace(browser, 3);
    const stranica = igraci[0]!.stranica;
    try {
      await stranica.setViewportSize({ width: 390, height: 844 });
      await stranica.addInitScript(() => {
        const viewport = Object.assign(new EventTarget(), {
          width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1,
        });
        Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
      });
      await udjiUJavniRed(igraci);
      await cekajIstuPartiju(igraci);
      await stranica.evaluate(async (broj) => {
        const putanjaStanja = '/src/lib/stanje-igre.svelte.ts';
        const putanjaSocketa = '/src/lib/socket.ts';
        const { dohvatiStanjeIgre } = await import(putanjaStanja);
        const { dohvatiSocket } = await import(putanjaSocketa);
        const stanje = dohvatiStanjeIgre();
        const sjedalo = stanje.sjedala.find((igrac: { igracId: string }) => igrac.igracId === stanje.mojIgracId);
        const lokalna = stanje.verzijaStanja ?? 0;
        dohvatiSocket().emitEvent(['partija:stanje', {
          ...JSON.parse(JSON.stringify(stanje)),
          sjedala: Array.from({ length: broj }, (_, indeks) => ({ ...sjedalo, igracId: indeks === 0 ? stanje.mojIgracId : `protivnik-${indeks}`, nadimak: `Igrac${indeks}` })),
          naPotezuId: stanje.mojIgracId, jePrivatna: broj === 8, sustavBiraRijec: false,
          zadnjaRijec: 'prepoznavanje', zadnjaRijecIgracId: 'protivnik-1', zadnjaRijecVrsta: 'rijec',
          trazenaSlova: 'ča', istekPotezaIso: '', eliminacije: [], statusSpremanja: 'nije_zavrsena',
          // #142: ista verzija snimke ne primjenjuje naPotezu/unos.
          verzijaStanja: lokalna + 1,
        }]);
      }, brojSjedala);
      const unos = stranica.getByRole('textbox', { name: 'Dovrši riječ na ČA' });
      await expect(unos).toBeVisible();
      await unos.focus();
      await expect(unos).toHaveCSS('font-size', '18px');
      await expect(unos).toHaveAttribute('autocapitalize', 'none');
      await expect(unos).toHaveAttribute('autocorrect', 'off');
      await unos.fill('ŠAČĆŽĐ');
      await expect(unos).toHaveValue('šačćžđ');
      await unos.evaluate((element) => {
        element.value = 'Ž';
        element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
      });
      await expect(unos).toHaveValue('Ž');
      await unos.evaluate((element) => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      await expect(unos).toHaveValue('ž');
      await unos.fill('ŠAČĆŽĐ');
      await unos.evaluate((element) => { element.dataset.provjera = 'isti-input'; element.setSelectionRange(2, 2); });
      for (const geometrija of [{ height: 320, offsetTop: 0 }, { height: 260, offsetTop: 75 }, { height: 420, offsetTop: 15 }]) {
        await stranica.evaluate((dimenzije) => {
          Object.assign(window.visualViewport!, { ...dimenzije, width: innerWidth });
          window.visualViewport!.dispatchEvent(new Event('resize'));
          window.visualViewport!.dispatchEvent(new Event('scroll'));
        }, geometrija);
        await expect.poll(async () => {
          const pravokutnik = await stranica.locator('.zona-poteza').boundingBox();
          return pravokutnik !== null && pravokutnik.y >= geometrija.offsetTop && pravokutnik.y + pravokutnik.height <= geometrija.offsetTop + geometrija.height - 7;
        }).toBe(true);
        await expect(unos).toHaveAttribute('data-provjera', 'isti-input');
        expect(await unos.evaluate((element) => element.selectionStart)).toBe(2);
      }
      await stranica.evaluate(async () => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        dohvatiSocket().emitEvent(['potez:odbijen', { kod: 'RIJEC_NE_POSTOJI', poruka: 'Ta riječ ne postoji u rječniku.' }]);
      });
      await expect(unos).toHaveAttribute('data-provjera', 'isti-input');
      await expect(unos).toHaveValue('šačćžđ');
      const oblak = stranica.locator('.rijec-oblak');
      const sirine = await oblak.evaluate((element) => ({ oblak: element.getBoundingClientRect().width, roditelj: element.parentElement!.getBoundingClientRect().width }));
      expect(sirine.oblak).toBeLessThanOrEqual(sirine.roditelj + 1);
      await expect(oblak).toHaveText('prepoznavanje');
      // Naslovni font može stisnuti srednje dugu riječ za 1px; ostaje unutar budžeta 12–18.
      expect(await oblak.evaluate((element) => {
        const px = parseFloat(getComputedStyle(element).fontSize);
        return px >= 12 && px <= 18;
      })).toBe(true);
       await stranica.evaluate(async () => {
         const putanja = '/src/lib/stanje-igre.svelte.ts';
         const { dohvatiStanjeIgre } = await import(putanja);
         dohvatiStanjeIgre().zadnjaRijec = 'mir';
       });
       await expect(oblak).toHaveText('mir');
      await expect(oblak).toHaveCSS('font-size', '18px');
       expect(await oblak.evaluate((element) => element.getBoundingClientRect().width < element.parentElement!.clientWidth / 2)).toBe(true);
       const dugaRijec = 'č'.repeat(31);
       await stranica.evaluate(async (rijec) => {
         const putanja = '/src/lib/stanje-igre.svelte.ts';
         const { dohvatiStanjeIgre } = await import(putanja);
         dohvatiStanjeIgre().zadnjaRijec = rijec;
       }, dugaRijec);
       await expect(oblak).toHaveText(dugaRijec);
       await expect(oblak).toHaveCSS('font-size', '12px');
       // Troboj (3 sjedala) sužava bijelu zonu — malo širi budžet širine/visine.
       expect(await oblak.evaluate((element, broj) => {
         const stil = getComputedStyle(element);
         const lineHeight = parseFloat(stil.lineHeight);
         const faktor = broj === 3 ? 2.8 : 2;
         const budzet = Number.isFinite(lineHeight)
           ? lineHeight * faktor + 8
           : parseFloat(stil.fontSize) * (faktor + 0.4) + 8;
         const dozvolaSirine = broj === 3 ? 8 : 0;
         return (
           element.scrollWidth <= element.clientWidth + dozvolaSirine &&
           element.getBoundingClientRect().height <= budzet
         );
       }, brojSjedala)).toBe(true);
      await stranica.screenshot({ path: podaciTesta.outputPath('mobilni-unos.png') });
      await stranica.locator('.ne-znam-gumb').click();
      await expect(stranica.getByRole('dialog').getByRole('button', { name: 'Ne', exact: true })).toBeVisible();
      await stranica.getByRole('dialog').getByRole('button', { name: 'Ne', exact: true }).click();
      await stranica.evaluate(() => {
        Object.assign(window.visualViewport!, { height: innerHeight, width: innerWidth, offsetTop: 0 });
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
      await unos.blur();
      await expect(stranica.locator('.zona-poteza')).not.toHaveClass(/mobilni-potez/);
      const poslano = await stranica.evaluate(async () => {
        const putanja = '/src/lib/socket.ts';
        const { dohvatiSocket } = await import(putanja);
        const socket = dohvatiSocket();
        const izvorno = socket.emit;
        let potez: { rijec: string } | null = null;
        socket.emit = (dogadaj: string, ...argumenti: unknown[]) => {
          if (dogadaj === 'potez:rijec') { potez = argumenti[0] as { rijec: string }; return socket; }
          return izvorno.call(socket, dogadaj, ...argumenti);
        };
        (document.querySelector('.zona-poteza') as HTMLFormElement).requestSubmit();
        socket.emit = izvorno;
        return potez;
      });
      expect(poslano).toMatchObject({ rijec: 'čašačćžđ' });
    } finally {
      await zatvoriIgrace(igraci);
    }
  });
}

test('prazan nastavak šalje prefiks kao cijelu riječ (#111)', async ({ browser }) => {
  test.setTimeout(60_000);
  const igraci = await dodajIgrace(browser, 3);
  const stranica = igraci[0]!.stranica;
  try {
    await udjiUJavniRed(igraci);
    await cekajIstuPartiju(igraci);
    await stranica.evaluate(async () => {
      const putanjaStanja = '/src/lib/stanje-igre.svelte.ts';
      const putanjaSocketa = '/src/lib/socket.ts';
      const { dohvatiStanjeIgre } = await import(putanjaStanja);
      const { dohvatiSocket } = await import(putanjaSocketa);
      const stanje = dohvatiStanjeIgre();
      const sjedalo = stanje.sjedala.find((igrac: { igracId: string }) => igrac.igracId === stanje.mojIgracId);
      const lokalna = stanje.verzijaStanja ?? 0;
      dohvatiSocket().emitEvent(['partija:stanje', {
        ...JSON.parse(JSON.stringify(stanje)),
        sjedala: [
          { ...sjedalo, igracId: stanje.mojIgracId, nadimak: 'Igrac0' },
          { ...sjedalo, igracId: 'protivnik-1', nadimak: 'Igrac1' },
        ],
        naPotezuId: stanje.mojIgracId,
        sustavBiraRijec: false,
        zadnjaRijec: 'kuća',
        zadnjaRijecIgracId: 'protivnik-1',
        zadnjaRijecVrsta: 'rijec',
        trazenaSlova: 'ča',
        istekPotezaIso: '',
        eliminacije: [],
        statusSpremanja: 'nije_zavrsena',
        // #142: ista verzija snimke ne primjenjuje naPotezu/unos.
        verzijaStanja: lokalna + 1,
      }]);
    });
    const unos = stranica.getByRole('textbox', { name: 'Dovrši riječ na ČA' });
    await expect(unos).toBeVisible();
    await unos.fill('');
    const poslano = await stranica.evaluate(async () => {
      const putanja = '/src/lib/socket.ts';
      const { dohvatiSocket } = await import(putanja);
      const socket = dohvatiSocket();
      const izvorno = socket.emit;
      let potez: { rijec: string } | null = null;
      socket.emit = (dogadaj: string, ...argumenti: unknown[]) => {
        if (dogadaj === 'potez:rijec') { potez = argumenti[0] as { rijec: string }; return socket; }
        return izvorno.call(socket, dogadaj, ...argumenti);
      };
      (document.querySelector('.zona-poteza') as HTMLFormElement).requestSubmit();
      socket.emit = izvorno;
      return potez;
    });
    expect(poslano).toMatchObject({ rijec: 'ča' });
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilne tablice pravila zadržavaju sve vrijednosti bez vodoravnog pomicanja', async ({
  browser,
}) => {
  for (const sirina of [320, 360, 390, 768, 999]) {
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: sirina, height: 760 });
      await page.goto('/pravila-kaladonta', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const tablice = page.locator('table');
      await expect(tablice.first()).toBeVisible();
      const neoznacene = await page
        .locator('table.tablica-mobilni-retci tbody td:not(:first-child):not([data-label])')
        .count();
      expect(neoznacene).toBe(0);
      const prelijevanje = await tablice.evaluateAll((elementi) =>
        elementi.some((tablica) => {
          const okvir = tablica.getBoundingClientRect();
          return (
            tablica.scrollWidth > tablica.clientWidth + 1 ||
            okvir.right > window.innerWidth + 1 ||
            okvir.left < -1
          );
        }),
      );
      expect(prelijevanje).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    } finally {
      await page.close();
    }
  }

  const desktop = await browser.newPage();
  try {
    await desktop.setViewportSize({ width: 1000, height: 760 });
    await desktop.goto('/pravila-kaladonta', { waitUntil: 'domcontentloaded' });
    await expect(desktop.getByRole('heading', { name: 'Pravila igre' })).toBeVisible();
    await expect(desktop.locator('table').first()).toHaveCSS('display', 'table');
  } finally {
    await desktop.close();
  }
});

// Jedan goto po kombinaciji (svježi page) — WebKit na CI pada na reload/dvostruki goto ("internal error").
for (const svijetla of [false, true]) {
  for (const disleksijskiFont of [false, true]) {
    const oznakaTeme = svijetla ? 'svijetla' : 'tamna';
    const oznakaFonta = disleksijskiFont ? ' + disleksija' : '';
    test(`tablice ostaju čitljive (${oznakaTeme}${oznakaFonta})`, async ({ page }) => {
      await page.addInitScript(
        ({ svijetlaTema, font }) => {
          localStorage.setItem('kaladont_tema_v1', svijetlaTema ? 'svijetla' : 'tamna');
          localStorage.setItem('kaladont_font_postavke_v1', String(font));
        },
        { svijetlaTema: svijetla, font: disleksijskiFont },
      );
      await page.setViewportSize({ width: 320, height: 760 });
      await page.goto('/pravila-kaladonta', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const prelijevanje = await page.locator('table').evaluateAll((elementi) =>
        elementi.some((tablica) => {
          const okvir = tablica.getBoundingClientRect();
          return (
            tablica.scrollWidth > tablica.clientWidth + 1 || okvir.right > window.innerWidth + 1
          );
        }),
      );
      expect(prelijevanje).toBe(false);
    });
  }
}

test('dvostupčana statistika rječnika stane na uski mobitel', async ({ page }) => {
  await page.route(/\/rjecnik\/statistika$/, (ruta) =>
    ruta.fulfill({
      json: {
        ukupno: 123456,
        kategorije: [{ vrsta: 'vlastito_ime', brojOblika: 123456 }],
      },
    }),
  );
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/o-igri');
  const tablica = page.getByRole('region', { name: 'Broj riječi po vrsti' }).getByRole('table');
  await expect(
    tablica.getByRole('rowheader', { name: 'Ukupno jedinstvenih oblika' }),
  ).toBeVisible();
  expect(await tablica.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
});

test('mobilne ljestvice prikazuju oznake i dugačke nazive bez pomicanja', async ({ page }) => {
  const pozicija = { status: 'rangiran', mjesto: 1, odigraneIgre: 45, minimumIgara: 10, nedostajeIgara: 0 };
  await page.route(/\/api\/ljestvice\?/, (ruta) =>
    ruta.fulfill({
      json: {
        ok: true,
        mod: 'cetiri_igraca',
        metrika: 'prosjek_bodova',
        prikaz: 'top',
        razdoblje: {
          vrsta: 'dnevno',
          od: '2026-10-01T22:00:00.000Z',
          do: '2026-10-02T22:00:00.000Z',
          podaciOd: '2026-01-01T00:00:00.000Z',
          stanje: 'aktivno',
          otkljucavaSe: null,
        },
        minimumIgara: 10,
        redci: [
          {
            mjesto: 1,
            igracId: 'test',
            nadimak: 'JakoDugackoImeIgracaBezRazmaka',
            jeJavanProfil: true,
            jeJa: true,
            odigraneIgre: 45,
            vrijednost: { vrsta: 'prosjek_bodova', prosjek: 5.12, bodoviUkupno: 230 },
            avatarId: 0,
            avatarConfig: null,
            avatarRevision: 0,
          },
        ],
        mojRedak: {
          mjesto: 1,
          igracId: 'test',
          nadimak: 'JakoDugackoImeIgracaBezRazmaka',
          jeJavanProfil: true,
          jeJa: true,
          odigraneIgre: 45,
          vrijednost: { vrsta: 'prosjek_bodova', prosjek: 5.12, bodoviUkupno: 230 },
          avatarId: 0,
          avatarConfig: null,
          avatarRevision: 0,
        },
        mojaPozicija: pozicija,
        pozicijePoRazdobljima: {
          dnevno: pozicija,
          tjedno: { ...pozicija, status: 'nedovoljan_broj_igara', mjesto: null, minimumIgara: 20, nedostajeIgara: 3 },
          mjesecno: { ...pozicija, status: 'nije_igrano', mjesto: null, odigraneIgre: 0 },
          godisnje: pozicija,
          svih_vremena: { ...pozicija, status: 'zakljucano', mjesto: null },
        },
        svihVremenaOtkljucavaSe: '2027-01-01T00:00:00.000Z',
        izracunatoU: '2026-10-02T10:00:00.000Z',
      },
    }),
  );
  await page.route(/\/rijeci\/najopasnije\?/, (ruta) =>
    ruta.fulfill({
      json: {
        ok: true,
        imaJos: false,
        rijeci: [
          { mjesto: 1, rijec: 'najduzarijecbezrazmaka', brojEliminacija: 12 },
        ],
      },
    }),
  );

  for (const sirina of [320, 390, 999]) {
    await page.setViewportSize({ width: sirina, height: 760 });
    await page.goto('/ljestvice');
    await expect(page.getByText('Ovo si ti')).toBeVisible();
    for (const tab of ['Igrači', 'Najopasnije riječi']) {
      await page.getByRole('tab', { name: tab }).click();
      const tablica = page.locator('table.tablica-mobilni-retci');
      await expect(tablica.locator('tbody tr')).toHaveCount(1);
      await expect(tablica.locator('tbody td[data-label]').first()).toBeVisible();
      const prelijevanje = await tablica.evaluate((element) => {
        const okvir = element.getBoundingClientRect();
        return element.scrollWidth > element.clientWidth + 1 || okvir.right > window.innerWidth + 1;
      });
      expect(prelijevanje).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  }
});

test('mobilna ljestvica privatne sobe prikazuje označene rezultate', async ({ page }) => {
  await page.goto('/soba/kreiraj');
  await page.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
  const ljestvicaSobe = page.locator('.ljestvica-tablica');
  await expect(ljestvicaSobe.locator('tbody tr')).toHaveCount(1);
  await expect(ljestvicaSobe.locator('td[data-label="Pobjede"]')).toBeVisible();
  expect(
    await ljestvicaSobe.evaluate((tablica) => tablica.scrollWidth <= tablica.clientWidth),
  ).toBe(true);
});

test('mobilna naslovnica prikazuje poveznicu Misije', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const misije = page.getByTestId('naslovnica-misije');
  await expect(misije).toBeVisible();
  await expect(misije).toHaveAttribute('href', '/misije');
  await misije.click();
  await expect(page).toHaveURL('/misije');
  await expect(page.getByRole('heading', { name: 'Misije', exact: true })).toBeVisible();
});

test('mobilni korisnik ne vidi aktivnost profila ni neovlaštene API podatke', async ({ page, playwright }) => {
  const sufiks = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // Odvojeni API kontekst — page.request dijeli kolačić sesije s preglednikom.
  const api = await playwright.request.newContext();
  try {
  const odgovor = await api.post('http://127.0.0.1:3001/api/racuni/registracija', {
    data: {
      email: `aktivnost-${sufiks}@example.com`,
      lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true,
      nadimak: `Ak${sufiks}`.slice(0, 12),
    },
  });
  expect(odgovor.ok()).toBe(true);
  const { igracId, sesijskiToken } = (await odgovor.json()) as { igracId: string; sesijskiToken: string };

  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, sesijskiToken);
  await page.setViewportSize({ width: 320, height: 760 });

  // Samo /profil UI — WebKit ima nestabilan race pri izmjeni /profil ↔ /profil/javni.
  await page.goto('/profil');
  await expect(page.getByRole('navigation', { name: 'Sadržaj profila' }).getByRole('button', { name: 'Aktivnost' })).toHaveCount(0);

  const zaglavlja = { authorization: `Bearer ${sesijskiToken}` };
  const aktivnost = await page.request.get(`http://127.0.0.1:3001/api/aktivnost/${igracId}`, { headers: zaglavlja });
  const povijest = await page.request.get(`http://127.0.0.1:3001/api/povijest/${igracId}`, { headers: zaglavlja });
  expect(aktivnost.status()).toBe(403);
  expect(povijest.status()).toBe(403);
  } finally {
    await api.dispose();
  }
});

test('mobilni tok registracije čuva fokus, tipkovničku navigaciju i raspored', async ({ page }) => {
  await page.goto('/registracija');

  const nadimak = page.getByPlaceholder('Tvoj nadimak');
  await nadimak.fill('Mobilni_7');
  await expect(nadimak).toBeFocused();
  await expect(nadimak).toHaveAttribute('maxlength', '12');
  await expect(nadimak).toHaveAttribute('minlength', '3');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeFocused();
  await page.keyboard.press('Enter');
  const email = page.getByLabel('Email');
  await expect(email).toBeVisible();
  await email.focus();
  await expect(email).toBeFocused();

  const nemaHorizontalnogPrelijevanja = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(nemaHorizontalnogPrelijevanja).toBe(true);

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toContain('user-scalable=no');
});

test('mobilni igrač ulazi u privatnu partiju i vidi aktivni input', async ({
  browser,
  context,
  page,
}) => {
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 1)),
  ];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());

    const igracNaPotezu = await cekajIgracaNaPotezu(igraci);
    const aktivniUnos = igracNaPotezu.stranica.getByRole('textbox', { name: /Dovrši riječ na/ });
    await expect(aktivniUnos).toBeVisible();
    await aktivniUnos.scrollIntoViewIfNeeded();
    await aktivniUnos.focus();
    await expect(aktivniUnos).toBeFocused();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilni scroll partije ne drži avatare sticky preko zone igre', async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 1)),
  ];
  try {
    for (const igrac of igraci) {
      await igrac.stranica.setViewportSize({ width: 390, height: 844 });
    }
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;

    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    await expect(vlasnik).toHaveURL(/\/soba\/[A-Z0-9]+$/);
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);
    await expect(gost).toHaveURL(vlasnik.url());

    const igracNaPotezu = await cekajIgracaNaPotezu(igraci);
    const stranica = igracNaPotezu.stranica;
    const zona = stranica.locator('.bijela-zona-igre');
    const igraciRed = stranica.locator('.igraci-red');
    await expect(zona).toBeVisible();
    await expect(igraciRed).toBeVisible();

    await zona.scrollIntoViewIfNeeded();
    await stranica.evaluate(() => window.scrollBy(0, 120));

    const rezultat = await stranica.evaluate(() => {
      const red = document.querySelector('.igraci-red');
      const zonaIgre = document.querySelector('.bijela-zona-igre');
      if (!red || !zonaIgre) return { sticky: true, preklapanje: true, horizontalno: true };
      const stil = getComputedStyle(red);
      const redBox = red.getBoundingClientRect();
      const zonaBox = zonaIgre.getBoundingClientRect();
      const preklapanje =
        redBox.bottom > zonaBox.top + 4 &&
        redBox.top < zonaBox.bottom - 4 &&
        redBox.left < zonaBox.right - 4 &&
        redBox.right > zonaBox.left + 4;
      return {
        sticky: stil.position === 'sticky',
        preklapanje,
        horizontalno: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });

    expect(rezultat.sticky).toBe(false);
    expect(rezultat.preklapanje).toBe(false);
    expect(rezultat.horizontalno).toBe(false);
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilni prekid mreže zaključava potez i reconnect vraća stanje partije', async ({
  browser,
  context,
  page,
}) => {
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 1)),
  ];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;
    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('radio', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);

    const igrac = await cekajIgracaNaPotezu(igraci);
    await expect(igrac.stranica.getByRole('button', { name: 'Pošalji' })).toBeVisible();
    await igrac.kontekst.setOffline(true);
    await expect(igrac.stranica.getByText('Veza je prekinuta.')).toBeVisible();
    await expect(igrac.stranica.getByRole('button', { name: 'Pošalji' })).toBeDisabled();

    await igrac.kontekst.setOffline(false);
    await expect(igrac.stranica.getByText('Veza je prekinuta.')).toBeHidden({ timeout: 15_000 });
    await expect(igrac.stranica.getByText(/Traži se riječ na:|Igra počinje/).first()).toBeVisible();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilni Troboj: lobby → stol bez refresha (isti partijaId, 3 sjedala)', async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(90_000);
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 2)),
  ];
  try {
    for (const igrac of igraci) {
      await igrac.stranica.setViewportSize({ width: 390, height: 844 });
    }
    const partijaId = await pokreniPrivatnuPartiju(igraci, 'dokazi_nastavak');
    for (const { stranica } of igraci) {
      await expect(stranica).toHaveURL(new RegExp(`/partija/${partijaId}$`));
      await expect(stranica.locator('.igraci-red > li')).toHaveCount(3);
      await expect(stranica.locator('.igraci-red.troboj')).toHaveCount(1);
    }
    const naPotezu = await cekajIgracaNaPotezu(igraci);
    const unos = naPotezu.stranica.getByRole('textbox', { name: /Dovrši riječ na|Dokaži nastavak/ });
    await expect(unos).toBeVisible();
    await unos.scrollIntoViewIfNeeded();
    await unos.focus();
    await expect(unos).toBeFocused();
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilni Troboj: propušteni partija:pocetak oporavlja stol bez reload()', async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(90_000);
  // Javni red sluša partija:stanje → goto; soba to nema. Hook samo suzbija početnu poruku.
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 2)),
  ];
  try {
    for (const igrac of igraci) {
      await igrac.stranica.setViewportSize({ width: 390, height: 844 });
    }
    const mobilni = igraci[0]!;
    await mobilni.stranica.goto('/red?mod=tri_igraca&pravila=klasicni');
    await expect(mobilni.stranica.getByTestId('red-oznaka-izbora')).toBeVisible({ timeout: 20_000 });

    await mobilni.stranica.evaluate(async () => {
      const { dohvatiSocket } = await import('/src/lib/socket.ts');
      dohvatiSocket().removeAllListeners('partija:pocetak');
    });

    await udjiUJavniRed(igraci.slice(1));
    await expect
      .poll(async () => {
        const urlovi = await Promise.all(igraci.slice(1).map((ig) => ig.stranica.url()));
        return urlovi.every((u) => /\/partija\/[0-9a-f-]+$/.test(u));
      }, { timeout: 45_000 })
      .toBe(true);

    const partijaId = new URL(igraci[1]!.stranica.url()).pathname.split('/').at(-1)!;
    expect(mobilni.stranica.url()).not.toMatch(/\/partija\//);

    // Stvarni server snapshot — test ne injektira prikaz ni ne zove reload().
    await mobilni.stranica.evaluate(async () => {
      const { dohvatiSocket } = await import('/src/lib/socket.ts');
      dohvatiSocket().emit('partija:stanje');
    });

    await expect(mobilni.stranica).toHaveURL(new RegExp(`/partija/${partijaId}$`), {
      timeout: 30_000,
    });
    await expect(mobilni.stranica.locator('.igraci-red > li')).toHaveCount(3, { timeout: 20_000 });
    await expect(
      mobilni.stranica.getByText(/Traži se riječ na:|Igra počinje|Dovrši riječ/).first(),
    ).toBeVisible({ timeout: 20_000 });
  } finally {
    await zatvoriIgrace(igraci);
  }
});

test('mobilna privatna partija završava i Igraj ponovno vraća u sobu', async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(60_000);
  const igraci: E2EIgrac[] = [
    { kontekst: context, stranica: page },
    ...(await dodajIgrace(browser, 1)),
  ];
  try {
    const vlasnik = igraci[0]!.stranica;
    const gost = igraci[1]!.stranica;
    await vlasnik.goto('/soba/kreiraj');
    await vlasnik.getByRole('radio', { name: 'Bez tajmera' }).click();
    await vlasnik.getByRole('button', { name: 'Stvori privatnu sobu' }).click();
    const kodSobe = await vlasnik.locator('.oznaka-koda strong').innerText();
    await gost.goto(`/soba/${kodSobe}`);
    await vlasnik.getByRole('button', { name: 'Započni igru' }).click();
    await expect(vlasnik).toHaveURL(/\/partija\/[0-9a-f-]+$/);

    const igracNaPotezu = await cekajIgracaNaPotezu(igraci);
    await igracNaPotezu.stranica.getByRole('button', { name: 'Ne znam' }).click();
    const dijalog = igracNaPotezu.stranica.getByRole('dialog', { name: 'Predati potez?' });
    await expect(dijalog).toBeVisible();
    await dijalog.getByRole('button', { name: 'Da' }).click();

    await expect(vlasnik.getByRole('heading', { name: 'Završni poredak' })).toBeVisible({
      timeout: 20_000,
    });
    // PanelPrijavaRijeci je već otvoren (otvorenoPocetno); klik na naslov bi ga zatvorio.
    const panelPrijava = vlasnik.getByRole('button', { name: 'Prijavi riječ' });
    await expect(panelPrijava).toHaveAttribute('aria-expanded', 'true');
    await panelPrijava.scrollIntoViewIfNeeded();
    const prijavaRijeci = vlasnik.getByRole('button', { name: 'Prijavi', exact: true }).first();
    await expect(prijavaRijeci).toBeVisible({ timeout: 15_000 });
    await prijavaRijeci.click();
    await expect(vlasnik.getByRole('button', { name: 'Prijavljeno' }).first()).toBeVisible();
    await expect(vlasnik.locator('.uspjeh-obavijest')).toContainText('Hvala');
    await expect(vlasnik.locator('textarea')).toHaveCount(0);
    await vlasnik.getByRole('link', { name: 'Igraj ponovno' }).click();
    await expect(vlasnik).toHaveURL(new RegExp(`/soba/${kodSobe}$`));
  } finally {
    await zatvoriIgrace(igraci);
  }
});
