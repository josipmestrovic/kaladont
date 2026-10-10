import { expect, test } from '@playwright/test';
import { cekajIgracaNaPotezu, cekajIstuPartiju, dodajIgrace, udjiUJavniRed, zatvoriIgrace, type E2EIgrac } from './pomocnici/igraci.js';

for (const brojSjedala of [2, 4, 8]) {
  test(`mobilni unos prati tipkovnicu za ${brojSjedala} sjedala`, async ({ browser }, podaciTesta) => {
    test.setTimeout(60_000);
    const igraci = await dodajIgrace(browser, 2);
    const stranica = igraci[0]!.stranica;
    try {
      await stranica.setViewportSize({ width: 390, height: 844 });
      await stranica.addInitScript(() => {
        const viewport = Object.assign(new EventTarget(), {
          width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1,
        });
        Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
      });
      await udjiUJavniRed(igraci, 'dva_igraca');
      await cekajIstuPartiju(igraci);
      await stranica.evaluate(async (broj) => {
        const putanjaStanja = '/src/lib/stanje-igre.svelte.ts';
        const putanjaSocketa = '/src/lib/socket.ts';
        const { dohvatiStanjeIgre } = await import(putanjaStanja);
        const { dohvatiSocket } = await import(putanjaSocketa);
        const stanje = dohvatiStanjeIgre();
        const sjedalo = stanje.sjedala.find((igrac: { igracId: string }) => igrac.igracId === stanje.mojIgracId);
        dohvatiSocket().emitEvent(['partija:stanje', {
          ...JSON.parse(JSON.stringify(stanje)),
          sjedala: Array.from({ length: broj }, (_, indeks) => ({ ...sjedalo, igracId: indeks === 0 ? stanje.mojIgracId : `protivnik-${indeks}`, nadimak: `Igrac${indeks}` })),
          naPotezuId: stanje.mojIgracId, jePrivatna: broj === 8, sustavBiraRijec: false,
          zadnjaRijec: 'prepoznavanje', zadnjaRijecIgracId: 'protivnik-1', zadnjaRijecVrsta: 'rijec',
          trazenaSlova: 'ča', istekPotezaIso: '', eliminacije: [], statusSpremanja: 'nije_zavrsena',
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
      expect(Math.abs(sirine.oblak - sirine.roditelj)).toBeLessThanOrEqual(1);
      await expect(oblak).toHaveText('prepoznavanje');
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

test('mobilne tablice pravila zadržavaju sve vrijednosti bez vodoravnog pomicanja', async ({
  page,
}) => {
  for (const sirina of [320, 360, 390, 768, 999]) {
    await page.setViewportSize({ width: sirina, height: 760 });
    for (const tema of ['nacini', 'bodovi', 'napredak']) {
      await page.goto(`/pravila-kaladonta?tema=${tema}`);
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
    }
  }

  await page.goto('/pravila-kaladonta?tema=bodovi');
  const rangovi = page.locator('.tablica-rangova tbody tr');
  await expect(rangovi).toHaveCount(10);
  await expect(rangovi.first().locator('td').last()).toContainText('manje od 30 %');
  await expect(rangovi.last().locator('td').last()).toContainText('89 % ili više');
  await expect(rangovi.first().locator('.rang-uzorak')).toHaveCSS('border-top-width', '4px');

  await page.setViewportSize({ width: 1000, height: 760 });
  await expect(page.locator('.tablica-rangova thead')).toBeVisible();
  await expect(page.locator('.tablica-rangova')).toHaveCSS('display', 'table');
});

test('tablice ostaju čitljive u obje teme i s disleksijskim fontom', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  for (const svijetla of [false, true]) {
    for (const disleksijskiFont of [false, true]) {
      await page.goto('/pravila-kaladonta?tema=napredak');
      await page.evaluate(
        ({ svijetlaTema, font }) => {
          localStorage.setItem('kaladont_tema_v1', svijetlaTema ? 'svijetla' : 'tamna');
          localStorage.setItem('kaladont_font_postavke_v1', String(font));
        },
        { svijetlaTema: svijetla, font: disleksijskiFont },
      );
      await page.reload();
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
    }
  }
});

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
  await page.goto('/pravila-kaladonta?tema=kako-igrati');
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
          },
        ],
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
  await page.route(/\/rijeci\/top\?/, (ruta) =>
    ruta.fulfill({
      json: {
        rijeci: [
          { mjesto: 1, rijec: 'najduzarijecbezrazmaka', brojUpotreba: 12, postotakPartija: 15 },
        ],
      },
    }),
  );

  for (const sirina of [320, 390, 999]) {
    await page.setViewportSize({ width: sirina, height: 760 });
    await page.goto('/ljestvice');
    await expect(page.getByText('Ovo si ti')).toBeVisible();
    for (const tab of ['Igrači', 'Riječi']) {
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

test('mobilni korisnik ne vidi aktivnost profila ni neovlaštene API podatke', async ({ page }) => {
  const odgovor = await page.request.post('http://127.0.0.1:3001/api/racuni/registracija', {
    data: {
      email: `aktivnost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`,
      lozinka: 'lozinka123',
      nadimak: 'AktivIgrac',
    },
  });
  expect(odgovor.ok()).toBe(true);
  const { igracId, sesijskiToken } = (await odgovor.json()) as { igracId: string; sesijskiToken: string };
  await page.addInitScript((token) => {
    localStorage.setItem('kaladont_sesijski_token', token);
  }, sesijskiToken);
  await page.setViewportSize({ width: 320, height: 760 });

  await page.goto('/profil');
  await expect(page.getByRole('navigation', { name: 'Sadržaj profila' }).getByRole('button', { name: 'Aktivnost' })).toHaveCount(0);

  await page.goto(`/profil/javni/${igracId}`);
  await expect(page.getByRole('navigation', { name: 'Sadržaj profila' }).getByRole('button', { name: 'Aktivnost' })).toHaveCount(0);

  const zaglavlja = { authorization: `Bearer ${sesijskiToken}` };
  const aktivnost = await page.request.get(`http://127.0.0.1:3001/api/aktivnost/${igracId}`, { headers: zaglavlja });
  const povijest = await page.request.get(`http://127.0.0.1:3001/api/povijest/${igracId}`, { headers: zaglavlja });
  expect(aktivnost.status()).toBe(403);
  expect(povijest.status()).toBe(403);
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
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
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

test('mobilna privatna partija završava i Igraj ponovno vraća u sobu', async ({
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
    await vlasnik.getByRole('button', { name: 'Bez tajmera' }).click();
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
    await vlasnik.locator('button.povijest-naslov').click();
    const prijavaRijeci = vlasnik.locator('button.prijavi-btn').first();
    await expect(prijavaRijeci).toBeVisible();
    await prijavaRijeci.click();
    await expect(
      vlasnik.getByRole('button', { name: 'Riječ je prijavljena' }).first(),
    ).toBeVisible();
    await expect(vlasnik.locator('textarea')).toHaveCount(0);
    await vlasnik.getByRole('link', { name: 'Igraj ponovno' }).click();
    await expect(vlasnik).toHaveURL(new RegExp(`/soba/${kodSobe}$`));
  } finally {
    await zatvoriIgrace(igraci);
  }
});
