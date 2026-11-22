import { describe, expect, it } from 'vitest';
import {
  brojBotovaZaIzazov,
  definicijaIzazova,
  dostupnostIzazova,
  ID_OVI_IZAZOVA,
  idEviFormata,
  idEviLevela,
  izgradiAgregateLevela,
  izgradiStavkuKataloga,
  izracunajZvjezdiceIzazivaca,
  jeIdIzazova,
  jePoznatiProfilBota,
  KATALOG_IZAZOVA,
  levelDostupan,
  nadimakProfilaBota,
  PRAG_DUGE_RIJECI_IZAZOVA,
  UKUPNI_NOMINALNI_XP_IZAZOVA,
  validirajKatalogIzazova,
  VERZIJA_DEFINICIJE_IZAZOVA,
  ZADANI_PROFIL_TRENINGA,
} from '../src/izazovi.js';

describe('katalog izazova v2', () => {
  it('validira 60 definicija, fond XP i verziju', () => {
    expect(() => validirajKatalogIzazova()).not.toThrow();
    expect(KATALOG_IZAZOVA).toHaveLength(60);
    expect(ID_OVI_IZAZOVA).toHaveLength(60);
    expect(VERZIJA_DEFINICIJE_IZAZOVA).toBe(2);
    expect(KATALOG_IZAZOVA.reduce((s, d) => s + d.xp, 0)).toBe(UKUPNI_NOMINALNI_XP_IZAZOVA);
    expect(UKUPNI_NOMINALNI_XP_IZAZOVA).toBe(106_540);
  });

  it('koristi shared prag duge riječi (≥10)', () => {
    expect(PRAG_DUGE_RIJECI_IZAZOVA).toBe(10);
  });

  it('matrica: profili, formati, varijante, timeri', () => {
    const l1dv01 = definicijaIzazova('IZ-L1-DV-01');
    expect(l1dv01.varijanta).toBe('obicni');
    expect(l1dv01.turnDurationMs).toBe(30_000);
    expect(l1dv01.botTurnDurationMs).toBe(30_000);
    expect(l1dv01.pravila).toBe('klasicni');
    expect(l1dv01.profileId).toBe('pocetnik');
    expect(brojBotovaZaIzazov(l1dv01)).toBe(1);

    const brzi = definicijaIzazova('IZ-L1-TR-02');
    expect(brzi.varijanta).toBe('brzi');
    expect(brzi.turnDurationMs).toBe(15_000);
    expect(brzi.botTurnDurationMs).toBe(30_000);

    const finale = definicijaIzazova('IZ-L2-CE-05');
    expect(finale.varijanta).toBe('zavrsni');
    expect(finale.pravila).toBe('dokazi_nastavak');
    expect(finale.ciljevi.bezPogreske).toBe(true);
    expect(finale.ciljevi.uspjesanDokaz).toBeUndefined();
    expect(finale.profileId).toBe('iskusni');
  });

  it('početnih 12 dostupnih; finala zaključana; stari IZ* ne otključava', () => {
    const prazno = new Set<string>();
    const dostupni = KATALOG_IZAZOVA.filter(
      (d) => dostupnostIzazova(d, prazno).status === 'dostupan',
    );
    expect(dostupni).toHaveLength(12);
    expect(dostupni.every((d) => d.level === 1 && d.redoslijedUFormatu <= 4)).toBe(true);

    const finale = dostupnostIzazova(definicijaIzazova('IZ-L1-DV-05'), prazno);
    expect(finale.status).toBe('zakljucan');
    expect(finale.razlog?.vrsta).toBe('prethodni_izazovi_formata');

    const sStarim = new Set(Array.from({ length: 24 }, (_, i) => `IZ${String(i + 1).padStart(2, '0')}`));
    expect(dostupnostIzazova(definicijaIzazova('IZ-L1-DV-01'), sStarim).status).toBe('dostupan');
    expect(levelDostupan(2, sStarim)).toBe(false);
  });

  it('finale traži 4/4 istog formata; drugi format ne pomaže', () => {
    const cetiriDv = new Set(idEviFormata(1, 'DV').filter((id) => id !== 'IZ-L1-DV-05'));
    expect(cetiriDv.size).toBe(4);
    expect(dostupnostIzazova(definicijaIzazova('IZ-L1-DV-05'), cetiriDv).status).toBe('dostupan');
    expect(dostupnostIzazova(definicijaIzazova('IZ-L1-TR-05'), cetiriDv).status).toBe('zakljucan');

    const tri = new Set([...cetiriDv].slice(0, 3));
    expect(dostupnostIzazova(definicijaIzazova('IZ-L1-DV-05'), tri).status).toBe('zakljucan');
  });

  it('level 2 tek nakon 15/15; 14/15 ne otključava', () => {
    const l1 = [...idEviLevela(1)];
    const cetiriNaest = new Set(l1.slice(0, 14));
    expect(levelDostupan(2, cetiriNaest)).toBe(false);
    expect(dostupnostIzazova(definicijaIzazova('IZ-L2-DV-01'), cetiriNaest).status).toBe('zakljucan');

    const petnaest = new Set(l1);
    expect(levelDostupan(2, petnaest)).toBe(true);
    const osnovniL2 = KATALOG_IZAZOVA.filter(
      (d) => d.level === 2 && d.redoslijedUFormatu <= 4
        && dostupnostIzazova(d, petnaest).status === 'dostupan',
    );
    expect(osnovniL2).toHaveLength(12);
  });

  it('agregati i DTO status', () => {
    const l1 = new Set(idEviLevela(1));
    const agregati = izgradiAgregateLevela(l1);
    expect(agregati[0]!.status).toBe('zavrsen');
    expect(agregati[0]!.zavrseno).toBe(15);
    expect(agregati[1]!.status).toBe('dostupan');
    expect(agregati[2]!.status).toBe('zakljucan');

    const stavka = izgradiStavkuKataloga(definicijaIzazova('IZ-L2-DV-01'), { zavrseni: l1 });
    expect(stavka.status).toBe('dostupan');
    expect(stavka.level).toBe(2);
    expect(stavka.razlogZakljucavanja).toBeNull();
  });

  it('Izazivač: 1★ bilo koji; 2★ L1; 5★ svih 60', () => {
    expect(izracunajZvjezdiceIzazivaca(new Set())).toBe(0);
    expect(izracunajZvjezdiceIzazivaca(new Set(['IZ-L1-TR-02']))).toBe(1);
    expect(izracunajZvjezdiceIzazivaca(new Set(idEviLevela(1)))).toBe(2);
    expect(izracunajZvjezdiceIzazivaca(new Set(ID_OVI_IZAZOVA))).toBe(5);
    expect(izracunajZvjezdiceIzazivaca(new Set(['IZ01']))).toBe(0);
  });

  it('jeIdIzazova ne prihvaća stari regex-only ID', () => {
    expect(jeIdIzazova('IZ-L1-DV-01')).toBe(true);
    expect(jeIdIzazova('IZ01')).toBe(false);
    expect(jeIdIzazova('XYZ')).toBe(false);
  });

  it('PR02: zadani trening profil i nadimci', () => {
    expect(ZADANI_PROFIL_TRENINGA).toBe('iskusni');
    expect(jePoznatiProfilBota('majstor')).toBe(true);
    expect(jePoznatiProfilBota('xyz')).toBe(false);
    expect(nadimakProfilaBota('velemajstor', 1, 1)).toBe('Velemajstor');
    expect(nadimakProfilaBota('velemajstor', 2, 3)).toBe('Velemajstor 2');
  });
});
