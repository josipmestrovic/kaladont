import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { upsertKrajIgre, upsertPocetakIgre } from '../src/analitika/igre.js';
import {
  agregirajPartije,
  medijanTrajanja,
  p90Trajanja,
  prosjekTrajanja,
} from '../src/analitika/partije.js';
import { danasZagrebIso, pocetakDanaZagrebUtc } from '../src/analitika/otvaranja.js';
import { baza } from '../src/baza/klijent.js';
import { analitikaIgre } from '../src/baza/shema.js';

describe('analitika partija', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  async function zapisiIgru(opcije: {
    igracId?: string;
    igraci?: string[];
    danIso: string;
    kontekst?: 'javna' | 'privatna' | 'trening' | 'izazov';
    mod?: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca';
    pravila?: 'klasicni' | 'ka_zna' | 'dokazi_nastavak' | null;
    ishod?: 'zavrsena' | 'prekinuta' | 'nepotpuno' | null;
    trajanjeMinuta?: number;
    satUtc?: number;
    prelazakPonoci?: boolean;
  }) {
    const igraId = randomUUID();
    const kontekst = opcije.kontekst ?? 'javna';
    const mod = opcije.mod ?? 'dva_igraca';
    const pocetakU = new Date(
      pocetakDanaZagrebUtc(opcije.danIso).getTime() + (opcije.satUtc ?? 12) * 3_600_000,
    );
    const minuta = opcije.trajanjeMinuta ?? 10;
    const krajU = opcije.prelazakPonoci
      ? new Date(pocetakDanaZagrebUtc(opcije.danIso).getTime() + 26 * 3_600_000)
      : new Date(pocetakU.getTime() + minuta * 60_000);
    const sudionici = (opcije.igraci ?? [opcije.igracId ?? randomUUID()]).map((igracId) => ({
      igracId,
      vrstaRacunaNaPocetku: 'gost' as const,
    }));

    await upsertPocetakIgre({
      igraId,
      kontekst,
      mod,
      pravila: opcije.pravila === undefined ? 'ka_zna' : opcije.pravila,
      pocetakU,
      sudionici,
    });

    if (opcije.ishod !== null) {
      await upsertKrajIgre(igraId, krajU, opcije.ishod ?? 'zavrsena', {
        kontekst,
        mod,
        pravila: opcije.pravila === undefined ? 'ka_zna' : opcije.pravila,
        pocetakU,
      });
    }

    return igraId;
  }

  it('prazan raspon vraća nulte metrike i null trajanje', async () => {
    const daleko = '2099-06-01';
    const agregat = await agregirajPartije({ odDan: daleko, doDan: daleko });
    expect(agregat.sazetak.zapocete).toBe(0);
    expect(agregat.sazetak.stopaZavrsavanja).toBeNull();
    expect(agregat.sazetak.trajanje.prosjekSekundi).toBeNull();
    expect(agregat.sazetak.trajanje.medijanSekundi).toBeNull();
    expect(agregat.sazetak.trajanje.p90Sekundi).toBeNull();
    expect(agregat.sazetak.pokrivenostPravila).toBeNull();
  });

  it('računa prosjek, medijan i P90 trajanja', () => {
    expect(prosjekTrajanja([])).toBeNull();
    expect(medijanTrajanja([])).toBeNull();
    expect(p90Trajanja([])).toBeNull();
    expect(prosjekTrajanja([10, 20, 30])).toBe(20);
    expect(medijanTrajanja([10, 20, 30])).toBe(20);
    expect(medijanTrajanja([10, 20, 30, 40])).toBe(25);
    expect(p90Trajanja([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])).toBe(90);
  });

  it('agregira kontekste, formate, pravila, stope i unique igrače', async () => {
    const dan = danasZagrebIso();
    const igracA = randomUUID();
    const igracB = randomUUID();

    await zapisiIgru({
      igraci: [igracA, igracB],
      danIso: dan,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      trajanjeMinuta: 10,
    });
    await zapisiIgru({
      igracId: igracA,
      danIso: dan,
      kontekst: 'trening',
      mod: 'dva_igraca',
      pravila: 'ka_zna',
      trajanjeMinuta: 20,
    });
    await zapisiIgru({
      igracId: igracB,
      danIso: dan,
      kontekst: 'privatna',
      mod: 'cetiri_igraca',
      pravila: 'dokazi_nastavak',
      ishod: 'prekinuta',
      trajanjeMinuta: 5,
    });
    await zapisiIgru({
      igracId: randomUUID(),
      danIso: dan,
      kontekst: 'izazov',
      mod: 'tri_igraca',
      pravila: 'ka_zna',
      ishod: 'nepotpuno',
    });
    await zapisiIgru({
      igracId: randomUUID(),
      danIso: dan,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: null,
      ishod: null,
    });

    const agregat = await agregirajPartije({ odDan: dan, doDan: dan });
    expect(agregat.sazetak.zapocete).toBeGreaterThanOrEqual(5);
    expect(agregat.sazetak.zavrsene).toBeGreaterThanOrEqual(2);
    expect(agregat.sazetak.prekinute).toBeGreaterThanOrEqual(1);
    expect(agregat.sazetak.nepotpuno).toBeGreaterThanOrEqual(1);
    expect(agregat.sazetak.bezIshoda).toBeGreaterThanOrEqual(1);
    expect(agregat.sazetak.stopaZavrsavanja).not.toBeNull();
    expect(agregat.sazetak.trajanje.prosjekSekundi).not.toBeNull();
    // Prekinute ne ulaze u trajanje
    expect(agregat.sazetak.trajanje.uzorak).toBe(agregat.sazetak.zavrsene);

    const javna = agregat.nacini.find((n) => n.kontekst === 'javna')!;
    const trening = agregat.nacini.find((n) => n.kontekst === 'trening')!;
    expect(javna.zapocete).toBeGreaterThanOrEqual(2);
    expect(trening.jedinstveniIgraci).toBeGreaterThanOrEqual(1);

    // Isti igrač u javnoj i treningu: ukupno ≠ zbroj po kontekstima
    const zbrojKonteksta = agregat.nacini.reduce((s, n) => s + n.jedinstveniIgraci, 0);
    expect(agregat.sazetak.jedinstveniIgraci).toBeLessThan(zbrojKonteksta);

    expect(agregat.formati.some((f) => f.mod === 'dva_igraca' && f.zapocete > 0)).toBe(true);
    expect(agregat.formati.some((f) => f.mod === 'cetiri_igraca' && f.kontekst === 'privatna')).toBe(
      true,
    );

    const klasicni = agregat.pravila.find((p) => p.pravila === 'klasicni')!;
    const nepoznato = agregat.pravila.find((p) => p.pravila === 'nepoznato')!;
    expect(klasicni.zapocete).toBeGreaterThanOrEqual(1);
    expect(nepoznato.zapocete).toBeGreaterThanOrEqual(1);
    expect(agregat.sazetak.pokrivenostPravila).not.toBeNull();
    expect(agregat.sazetak.pokrivenostPravila!).toBeLessThan(100);
  });

  it('uključuje igru koja prelazi ponoć u kohortu početnog dana', async () => {
    const dan = danasZagrebIso();
    await zapisiIgru({
      danIso: dan,
      satUtc: 23,
      prelazakPonoci: true,
      kontekst: 'javna',
      pravila: 'klasicni',
      trajanjeMinuta: 120,
    });
    const agregat = await agregirajPartije({ odDan: dan, doDan: dan });
    expect(agregat.sazetak.zavrsene).toBeGreaterThanOrEqual(1);
    expect(agregat.sazetak.trajanje.uzorak).toBeGreaterThanOrEqual(1);
  });

  it('čuva pravila pri ponovljenom početku i kraj-prije-početka', async () => {
    const igraId = randomUUID();
    const sada = new Date();
    const igrac = randomUUID();

    await upsertKrajIgre(igraId, sada, 'zavrsena', {
      kontekst: 'javna',
      mod: 'tri_igraca',
      pravila: 'dokazi_nastavak',
      pocetakU: sada,
    });
    await upsertPocetakIgre({
      igraId,
      kontekst: 'javna',
      mod: 'tri_igraca',
      pravila: null,
      pocetakU: sada,
      sudionici: [{ igracId: igrac, vrstaRacunaNaPocetku: 'gost' }],
    });

    const [red] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red?.pravila).toBe('dokazi_nastavak');
    expect(red?.ishod).toBe('zavrsena');

    await upsertKrajIgre(igraId, new Date(sada.getTime() + 1000), 'prekinuta', {
      kontekst: 'javna',
      mod: 'tri_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
    });
    const [red2] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red2?.ishod).toBe('zavrsena');
    expect(red2?.pravila).toBe('dokazi_nastavak');
  });

  it('filter konteksta sužava načine', async () => {
    const dan = danasZagrebIso();
    await zapisiIgru({ danIso: dan, kontekst: 'trening', pravila: 'ka_zna' });
    await zapisiIgru({ danIso: dan, kontekst: 'javna', pravila: 'klasicni' });
    const samoTrening = await agregirajPartije({ odDan: dan, doDan: dan, kontekst: 'trening' });
    expect(samoTrening.nacini.every((n) => n.kontekst === 'trening')).toBe(true);
    expect(samoTrening.formati.every((f) => f.kontekst === 'trening')).toBe(true);
  });
});
