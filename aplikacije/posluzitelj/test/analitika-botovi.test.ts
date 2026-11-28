import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { agregirajBotove, PRAG_MALI_UZORAK_BOTOVA } from '../src/analitika/botovi.js';
import {
  prazniBrojaciEliminacija,
  upsertKrajIgre,
  upsertPocetakIgre,
} from '../src/analitika/igre.js';
import { danasZagrebIso } from '../src/analitika/otvaranja.js';
import { baza } from '../src/baza/klijent.js';
import { analitikaIgre } from '../src/baza/shema.js';

describe('analitika botova — upis i agregat', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  it('prazan raspon vraća nulte metrike', async () => {
    const daleko = '2099-08-01';
    const agregat = await agregirajBotove({ odDan: daleko, doDan: daleko });
    expect(agregat.uspjesnost.ukupno.zavrseneProtivBotova).toBe(0);
    expect(agregat.uspjesnost.ukupno.udioPobjedaLjudi).toBeNull();
    expect(agregat.sastavJavnih).toEqual([]);
    expect(agregat.pokrivenost.zapocete).toBe(0);
    expect(PRAG_MALI_UZORAK_BOTOVA).toBe(30);
  });

  it('snima sastav bez botova i ne računa uspješnost vs botova', async () => {
    const sada = new Date();
    const igraId = randomUUID();
    await upsertPocetakIgre({
      igraId,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
      botovi: {
        brojLjudi: 2,
        brojBotova: 0,
        profilBotova: null,
        verzijaBotPolitike: null,
        verzijaProfilaBota: null,
      },
      sudionici: [
        { igracId: randomUUID(), vrstaRacunaNaPocetku: 'gost' },
        { igracId: randomUUID(), vrstaRacunaNaPocetku: 'gost' },
      ],
    });
    await upsertKrajIgre(igraId, new Date(sada.getTime() + 60_000), 'zavrsena', {
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
      botovi: {
        brojLjudi: 2,
        brojBotova: 0,
        profilBotova: null,
        verzijaBotPolitike: null,
        verzijaProfilaBota: null,
      },
      vrstaPobjednika: 'covjek',
      eliminacijeLjudi: { ...prazniBrojaciEliminacija(), ne_znam: 1 },
      eliminacijeBotova: prazniBrojaciEliminacija(),
    });

    const [red] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red?.brojBotova).toBe(0);
    expect(red?.profilBotova).toBeNull();
    expect(red?.vrstaPobjednika).toBe('covjek');
  });

  it('bilježi 1v1 čovjek–bot, troboj sastave, profile i prekid bez pobjednika', async () => {
    const dan = danasZagrebIso();
    const bazaMs = Date.now();

    async function igra(opcije: {
      mod: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca';
      brojLjudi: number;
      brojBotova: number;
      profil: 'pocetnik' | 'iskusni' | 'majstor' | 'velemajstor' | 'prilagodeno';
      ishod: 'zavrsena' | 'prekinuta';
      pobjednik?: 'covjek' | 'bot' | null;
      verzijaPolitike?: number;
      verzijaProfila?: number | null;
      kontekst?: 'javna' | 'trening' | 'izazov';
    }) {
      const igraId = randomUUID();
      const pocetakU = new Date(bazaMs);
      const botovi = {
        brojLjudi: opcije.brojLjudi,
        brojBotova: opcije.brojBotova,
        profilBotova: opcije.profil,
        verzijaBotPolitike: opcije.verzijaPolitike ?? 8,
        verzijaProfilaBota: opcije.verzijaProfila === undefined ? 3 : opcije.verzijaProfila,
      };
      await upsertPocetakIgre({
        igraId,
        kontekst: opcije.kontekst ?? 'javna',
        mod: opcije.mod,
        pravila: 'klasicni',
        pocetakU,
        botovi,
        sudionici: Array.from({ length: opcije.brojLjudi }, () => ({
          igracId: randomUUID(),
          vrstaRacunaNaPocetku: 'gost' as const,
        })),
      });
      const elimLjudi = prazniBrojaciEliminacija();
      const elimBotova = prazniBrojaciEliminacija();
      if (opcije.ishod === 'zavrsena') {
        if (opcije.pobjednik === 'covjek') elimBotova.istek = 1;
        else elimLjudi.ne_znam = 1;
      }
      await upsertKrajIgre(igraId, new Date(bazaMs + 30_000), opcije.ishod, {
        kontekst: opcije.kontekst ?? 'javna',
        mod: opcije.mod,
        pravila: 'klasicni',
        pocetakU,
        botovi,
        vrstaPobjednika: opcije.ishod === 'prekinuta' ? null : (opcije.pobjednik ?? null),
        eliminacijeLjudi: elimLjudi,
        eliminacijeBotova: elimBotova,
      });
      return igraId;
    }

    await igra({
      mod: 'dva_igraca',
      brojLjudi: 1,
      brojBotova: 1,
      profil: 'iskusni',
      ishod: 'zavrsena',
      pobjednik: 'covjek',
    });
    await igra({
      mod: 'dva_igraca',
      brojLjudi: 1,
      brojBotova: 1,
      profil: 'majstor',
      ishod: 'zavrsena',
      pobjednik: 'bot',
    });
    await igra({
      mod: 'tri_igraca',
      brojLjudi: 2,
      brojBotova: 1,
      profil: 'pocetnik',
      ishod: 'zavrsena',
      pobjednik: 'covjek',
    });
    await igra({
      mod: 'tri_igraca',
      brojLjudi: 1,
      brojBotova: 2,
      profil: 'velemajstor',
      ishod: 'zavrsena',
      pobjednik: 'bot',
    });
    await igra({
      mod: 'cetiri_igraca',
      brojLjudi: 1,
      brojBotova: 3,
      profil: 'prilagodeno',
      ishod: 'zavrsena',
      pobjednik: 'covjek',
      verzijaProfila: null,
    });
    await igra({
      mod: 'dva_igraca',
      brojLjudi: 1,
      brojBotova: 1,
      profil: 'iskusni',
      ishod: 'prekinuta',
      pobjednik: null,
      kontekst: 'trening',
    });

    const agregat = await agregirajBotove({ odDan: dan, doDan: dan, kontekst: 'javna' });
    expect(agregat.uspjesnost.ukupno.zavrseneProtivBotova).toBeGreaterThanOrEqual(5);
    expect(agregat.uspjesnost.ukupno.pobjedeLjudi).toBeGreaterThanOrEqual(3);
    expect(agregat.uspjesnost.ukupno.pobjedeBotova).toBeGreaterThanOrEqual(2);
    expect(agregat.uspjesnost.poProfilu.some((p) => p.profil === 'iskusni')).toBe(true);
    expect(agregat.uspjesnost.poProfilu.some((p) => p.profil === 'prilagodeno')).toBe(true);
    expect(agregat.sastavJavnih.some((s) => s.sastav === '1c-1b')).toBe(true);
    expect(agregat.sastavJavnih.some((s) => s.sastav === '2c-1b')).toBe(true);
    expect(agregat.eliminacije.botovi.find((r) => r.razlog === 'istek')!.broj).toBeGreaterThanOrEqual(1);
    expect(agregat.eliminacije.ljudi.find((r) => r.razlog === 'ne_znam')!.broj).toBeGreaterThanOrEqual(1);

    const prekinuta = await agregirajBotove({ odDan: dan, doDan: dan, kontekst: 'trening' });
    // Prekinuta ne ulazi u win-rate vs botova kao pobjeda.
    expect(prekinuta.uspjesnost.ukupno.pobjedeLjudi + prekinuta.uspjesnost.ukupno.pobjedeBotova).toBe(0);
  });

  it('ne pregazi poznatu bot snimku nullom i čuva kraj prije početka', async () => {
    const igraId = randomUUID();
    const sada = new Date();
    await upsertKrajIgre(igraId, sada, 'zavrsena', {
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
      botovi: {
        brojLjudi: 1,
        brojBotova: 1,
        profilBotova: 'iskusni',
        verzijaBotPolitike: 8,
        verzijaProfilaBota: 3,
      },
      vrstaPobjednika: 'bot',
      eliminacijeLjudi: { ...prazniBrojaciEliminacija(), istek: 1 },
      eliminacijeBotova: prazniBrojaciEliminacija(),
    });
    await upsertPocetakIgre({
      igraId,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
      sudionici: [{ igracId: randomUUID(), vrstaRacunaNaPocetku: 'gost' }],
      // bez botovi — ne smije obrisati snimku s kraja
    });
    const [red] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red?.brojBotova).toBe(1);
    expect(red?.profilBotova).toBe('iskusni');
    expect(red?.vrstaPobjednika).toBe('bot');
    expect(red?.ishod).toBe('zavrsena');

    // Retry kraja ne degradira završenu igru.
    await upsertKrajIgre(igraId, new Date(sada.getTime() + 1000), 'prekinuta', {
      kontekst: 'javna',
      mod: 'dva_igraca',
      pravila: 'klasicni',
      pocetakU: sada,
      vrstaPobjednika: null,
    });
    const [red2] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red2?.ishod).toBe('zavrsena');
    expect(red2?.vrstaPobjednika).toBe('bot');
  });

  it('povijesni zapis bez bot polja ostaje null', async () => {
    const igraId = randomUUID();
    const sada = new Date();
    await upsertPocetakIgre({
      igraId,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pocetakU: sada,
      sudionici: [{ igracId: randomUUID(), vrstaRacunaNaPocetku: 'gost' }],
    });
    const [red] = await baza.select().from(analitikaIgre).where(eq(analitikaIgre.igraId, igraId)).limit(1);
    expect(red?.brojBotova).toBeNull();
    expect(red?.profilBotova).toBeNull();
    expect(red?.vrstaPobjednika).toBeNull();
  });
});
