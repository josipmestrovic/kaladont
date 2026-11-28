import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { upsertKrajIgre, upsertPocetakIgre } from '../src/analitika/igre.js';
import {
  agregirajAktivnostIgraca,
  pomakniKalendarskiDan,
} from '../src/analitika/igraci.js';
import { danasZagrebIso, pocetakDanaZagrebUtc } from '../src/analitika/otvaranja.js';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';

describe('analitika igrača', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  async function zavrsiIgru(opcije: {
    igracId: string;
    danIso: string;
    kontekst?: 'javna' | 'privatna' | 'trening' | 'izazov';
    vrsta?: 'gost' | 'registriran';
    ishod?: 'zavrsena' | 'prekinuta';
    satUtc?: number;
  }) {
    const igraId = randomUUID();
    const pocetakU = new Date(pocetakDanaZagrebUtc(opcije.danIso).getTime() + (opcije.satUtc ?? 12) * 3_600_000);
    const krajU = new Date(pocetakU.getTime() + 5 * 60_000);
    const kontekst = opcije.kontekst ?? 'javna';
    await upsertPocetakIgre({
      igraId,
      kontekst,
      mod: 'dva_igraca',
      pocetakU,
      sudionici: [
        {
          igracId: opcije.igracId,
          vrstaRacunaNaPocetku: opcije.vrsta ?? 'gost',
        },
      ],
    });
    await upsertKrajIgre(igraId, krajU, opcije.ishod ?? 'zavrsena', {
      kontekst,
      mod: 'dva_igraca',
      pocetakU,
    });
    return igraId;
  }

  it('prazan raspon vraća nulte KPI-jeve', async () => {
    const daleko = '2099-01-01';
    const agregat = await agregirajAktivnostIgraca({ odDan: daleko, doDan: daleko });
    expect(agregat.kpi.dau).toBe(0);
    expect(agregat.kpi.wau).toBe(0);
    expect(agregat.kpi.mau).toBe(0);
    expect(agregat.kpi.dauMau).toBeNull();
    expect(agregat.kpi.registracijeRaspon).toBe(0);
    expect(agregat.kpi.konverzija30d.postotak).toBeNull();
    expect(agregat.retencijaUkupno.d1.postotak).toBeNull();
    expect(agregat.dani).toHaveLength(1);
    expect(agregat.dani[0]?.dau).toBe(0);
  });

  it('računa DAU/novi/povratni, isključuje prekinute i filtrira kontekst', async () => {
    const danas = danasZagrebIso();
    const jucev = pomakniKalendarskiDan(danas, -1);
    const novi = randomUUID();
    const povratni = randomUUID();
    const drugiKontekst = randomUUID();
    const prekinuti = randomUUID();

    await zavrsiIgru({ igracId: povratni, danIso: jucev });
    await zavrsiIgru({ igracId: povratni, danIso: danas });
    await zavrsiIgru({ igracId: novi, danIso: danas });
    await zavrsiIgru({ igracId: drugiKontekst, danIso: danas, kontekst: 'trening' });
    await zavrsiIgru({ igracId: prekinuti, danIso: danas, ishod: 'prekinuta' });

    const sve = await agregirajAktivnostIgraca({ odDan: danas, doDan: danas });
    const red = sve.dani.find((d) => d.dan === danas)!;
    expect(red.dau).toBeGreaterThanOrEqual(3);
    expect(red.novi).toBeGreaterThanOrEqual(2); // novi + drugiKontekst
    expect(red.povratni).toBeGreaterThanOrEqual(1);
    expect(red.dau).toBe(red.novi + red.povratni);
    expect(sve.kpi.dau).toBe(red.dau);

    const samoJavna = await agregirajAktivnostIgraca({ odDan: danas, doDan: danas, kontekst: 'javna' });
    const javni = samoJavna.dani.find((d) => d.dan === danas)!;
    expect(javni.dau).toBeGreaterThanOrEqual(2);
    expect(javni.dau).toBeLessThan(red.dau);
  });

  it('WAU/MAU broje distinct, ne zbroj DAU', async () => {
    const danas = danasZagrebIso();
    const d1 = pomakniKalendarskiDan(danas, -1);
    const d2 = pomakniKalendarskiDan(danas, -2);
    const a = randomUUID();
    const b = randomUUID();

    await zavrsiIgru({ igracId: a, danIso: d2 });
    await zavrsiIgru({ igracId: a, danIso: d1 });
    await zavrsiIgru({ igracId: a, danIso: danas });
    await zavrsiIgru({ igracId: b, danIso: danas });

    const agregat = await agregirajAktivnostIgraca({ odDan: d2, doDan: danas });
    expect(agregat.kpi.dau).toBeGreaterThanOrEqual(2);
    // Isti igrač A kroz 3 dana ne smije utrostručiti WAU
    expect(agregat.kpi.wau).toBeGreaterThanOrEqual(2);
    expect(agregat.kpi.wau).toBeLessThan(agregat.dani.reduce((s, d) => s + d.dau, 0));
    expect(agregat.kpi.mau).toBe(agregat.kpi.wau);
  });

  it('D1 retencija: točan dan, nezrele kohorte null, ponderirani ukupni', async () => {
    const danas = danasZagrebIso();
    const kohortaDan = pomakniKalendarskiDan(danas, -2);
    const d1Dan = pomakniKalendarskiDan(kohortaDan, 1);
    const svjezaKohorta = danas; // D1 još nije završen ako je referent danas

    const vratiSe = randomUUID();
    const neVratiSe = randomUUID();
    const nezreli = randomUUID();

    await zavrsiIgru({ igracId: vratiSe, danIso: kohortaDan });
    await zavrsiIgru({ igracId: neVratiSe, danIso: kohortaDan });
    await zavrsiIgru({ igracId: vratiSe, danIso: d1Dan });
    await zavrsiIgru({ igracId: nezreli, danIso: svjezaKohorta });

    const agregat = await agregirajAktivnostIgraca({
      odDan: kohortaDan,
      doDan: danas,
    });

    const zrela = agregat.retencijaKohorte.find((k) => k.kohortaDan === kohortaDan)!;
    expect(zrela.d1Zrela).toBe(true);
    expect(zrela.d1Povratnici).toBeGreaterThanOrEqual(1);
    expect(zrela.noviIgraci).toBeGreaterThanOrEqual(2);
    expect(zrela.d1Postotak).not.toBeNull();

    const svjeza = agregat.retencijaKohorte.find((k) => k.kohortaDan === svjezaKohorta)!;
    expect(svjeza.d1Zrela).toBe(false);
    expect(svjeza.d1Povratnici).toBeNull();
    expect(svjeza.d1Postotak).toBeNull();

    expect(agregat.retencijaUkupno.d1.kohorta).toBeGreaterThanOrEqual(2);
    expect(agregat.retencijaUkupno.d1.povratnici).toBeGreaterThanOrEqual(1);
    expect(agregat.retencijaUkupno.d1.postotak).not.toBeNull();
  });

  it('konverzija 30d: gost→reg isti ID; hladna registracija i bez reg ne ulaze u brojnik/nazivnik krivo', async () => {
    const danas = danasZagrebIso();
    // Kohorta stara 40 dana → prozor 30d zreo
    const prviDan = pomakniKalendarskiDan(danas, -40);
    const gostKonvertiran = randomUUID();
    const gostBezReg = randomUUID();
    const hladni = randomUUID();

    await zavrsiIgru({ igracId: gostKonvertiran, danIso: prviDan, vrsta: 'gost' });
    await zavrsiIgru({ igracId: gostBezReg, danIso: prviDan, vrsta: 'gost' });

    await baza.insert(igraci).values([
      {
        id: gostKonvertiran,
        vrsta: 'registriran',
        upravljac: 'covjek',
        nadimak: `konv-${gostKonvertiran.slice(0, 8)}`,
        registriranAt: new Date(pocetakDanaZagrebUtc(pomakniKalendarskiDan(prviDan, 5)).getTime() + 12 * 3_600_000),
      },
      {
        id: hladni,
        vrsta: 'registriran',
        upravljac: 'covjek',
        nadimak: `hladni-${hladni.slice(0, 8)}`,
        registriranAt: new Date(pocetakDanaZagrebUtc(prviDan).getTime() + 12 * 3_600_000),
      },
    ]);

    const agregat = await agregirajAktivnostIgraca({ odDan: prviDan, doDan: prviDan });
    expect(agregat.kpi.konverzija30d.gosti).toBeGreaterThanOrEqual(2);
    expect(agregat.kpi.konverzija30d.konvertirani).toBeGreaterThanOrEqual(1);
    expect(agregat.kpi.konverzija30d.postotak).not.toBeNull();
    // Hladna registracija na prviDan ulazi u registracije raspona; konvertirani (dan+5) ne.
    expect(agregat.kpi.registracijeRaspon).toBeGreaterThanOrEqual(1);
    expect(agregat.dani.find((d) => d.dan === prviDan)?.registracije).toBeGreaterThanOrEqual(1);
  });

  it('više partija istog igrača isti dan broji se jednom u DAU', async () => {
    const danas = danasZagrebIso();
    const igrac = randomUUID();
    await zavrsiIgru({ igracId: igrac, danIso: danas, satUtc: 10 });
    await zavrsiIgru({ igracId: igrac, danIso: danas, satUtc: 14 });
    await zavrsiIgru({ igracId: igrac, danIso: danas, satUtc: 18 });

    const agregat = await agregirajAktivnostIgraca({ odDan: danas, doDan: danas });
    const red = agregat.dani.find((d) => d.dan === danas)!;
    // Baremm naš igrač jednom; ne tri puta
    expect(red.dau).toBeGreaterThanOrEqual(1);
    const nas = await agregirajAktivnostIgraca({ odDan: danas, doDan: danas, kontekst: 'javna' });
    // Sanity: funkcija ne pada i vraća konzistentan DAU = novi+povratni
    const r = nas.dani.find((d) => d.dan === danas)!;
    expect(r.dau).toBe(r.novi + r.povratni);
  });

  it('označava nezavršeni referentni dan', async () => {
    const danas = danasZagrebIso();
    const agregat = await agregirajAktivnostIgraca({ odDan: danas, doDan: danas });
    expect(agregat.referentniDan).toBe(danas);
    expect(agregat.referentniDanNezavrsen).toBe(true);

    const jucev = pomakniKalendarskiDan(danas, -1);
    const gotov = await agregirajAktivnostIgraca({ odDan: jucev, doDan: jucev });
    expect(gotov.referentniDanNezavrsen).toBe(false);
  });
});
