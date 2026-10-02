import { describe, expect, it } from 'vitest';
import { grafemi } from '../src/grafemi.js';
import { sastaviKaladontCv, type CvDnkStatistika, type CvPodaciIgraca, type CvPodaciModa } from '../src/cv.js';

const prazanMod = (): CvPodaciModa => ({
  odigrane: 0,
  pobjede: 0,
  bodoviUkupno: 0,
  eliminacijeUkupno: 0,
  dnk: null,
  statistikaRijeci: null,
});

const ulaz = (): CvPodaciIgraca => ({
  igracId: '00000000-0000-4000-8000-000000000100',
  nadimak: 'Joka',
  iskustvoUkupno: 0,
  kolekcijaRijeci: 0,
  stvoren: '2026-09-20T12:00:00.000Z',
  registriranAt: '2026-09-20T12:00:00.000Z',
  referentniDatum: '2026-09-26',
  dvaIgraca: prazanMod(),
  cetiriIgraca: prazanMod(),
  dostignuca: [],
});

function dnkPrimjer(izmjene: Partial<CvDnkStatistika> = {}): CvDnkStatistika {
  return {
    prihvaceniPotezi: 100,
    ukupnoTrajanjePrihvaceniPoteziMs: 730_000,
    najduziStreak: 4,
    dugeRijeci: 54,
    srednjeDugeRijeci: 0,
    jakoDugeRijeci: 0,
    rijetkeRijeci: 0,
    srednjeRijetkeRijeci: 0,
    jakoRijetkeRijeci: 0,
    osi: [
      { kljuc: 'vjestina', vrijednost: 70 },
      { kljuc: 'taktika', vrijednost: 0 },
      { kljuc: 'fokus', vrijednost: 50 },
      { kljuc: 'brzina', vrijednost: 70 },
      { kljuc: 'duge_rijeci', vrijednost: 85 },
      { kljuc: 'rijetke_rijeci', vrijednost: 0 },
    ],
    ...izmjene,
  };
}

describe('Kaladont CV', () => {
  it('uvijek daje dvije uvodne rečenice i skriva praznu listu istaknutosti', () => {
    const cv = sastaviKaladontCv(ulaz());
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice).toHaveLength(2);
      expect(cv.biografija.recenice[0]).toBe('Joka još nije završio nijednu javnu partiju.');
      expect(cv.biografija.recenice[1]).toContain('10 javnih partija');
    }
    expect(cv.istaknuto).toEqual([]);
    expect(cv.kvalifikacija.rang).toBe('Piskaralo');
    expect(cv.staz?.tekst).toBe('6 dana');
  });

  it('skriva popis kada postoji samo jedno dostignuće i nema drugih istaknutih činjenica', () => {
    const podaci = ulaz();
    podaci.dostignuca = [{ id: 'dugometras', razina: 2 }];
    const cv = sastaviKaladontCv(podaci);
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice).toHaveLength(2);
    }
    expect(cv.istaknuto).toEqual([]);
  });

  it('ne kalibrira rang zbrojem načina kada svaki ima manje od deset igara', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 9 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 9 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.kvalifikacija).toMatchObject({ rang: 'Piskaralo', kalibriran: false, nacini: [] });
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') expect(cv.biografija.recenice[1]).toContain('Rang se dodjeljuje nakon 10 javnih partija');
  });

  it('odabire viši rang neovisno o tome koji način ima više igara', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 10, bodoviUkupno: 4 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 20, bodoviUkupno: 76 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.kvalifikacija).toMatchObject({ rang: 'Doktor riječi', nacini: ['cetiri_igraca'] });
  });

  it('opisuje raspodjelu javnih partija i imenuje način s većim brojem', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 6 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 4 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[0]).toContain('Joka je više javnih partija odigrao u Dvoboju');
      expect(cv.biografija.recenice[0]).toContain('6 Dvoboja i 4 Četveroboja');
      expect(cv.biografija.recenice[0]).not.toContain('bira');
    }

    podaci.dvaIgraca.odigrane = 59;
    podaci.cetiriIgraca.odigrane = 41;
    const blizuPraga = sastaviKaladontCv(podaci);
    if (blizuPraga.biografija.tip === 'opis') expect(blizuPraga.biografija.recenice[0]).toContain('više javnih partija odigrao u Dvoboju');
  });

  it('odabire brzinu i duge riječi kao zasebne zanimljivosti', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 10,
      dnk: dnkPrimjer({ prihvaceniPotezi: 9 }),
    };
    let cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toEqual([]);

    podaci.dvaIgraca.dnk = dnkPrimjer();
    cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toHaveLength(2);
    expect(cv.istaknuto[0]).toContain('prihvaćenim potezima od prosječno 7,3 s u Dvoboju');
    expect(cv.istaknuto[1]).toContain('zabilježenim dugim riječima (54) u Dvoboju');
  });

  it('zanemaruje nevaljane DNK brojače pri sastavljanju zanimljivosti', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 10,
      dnk: dnkPrimjer({
        osi: [
          { kljuc: 'vjestina', vrijednost: 70 },
          { kljuc: 'taktika', vrijednost: 0 },
          { kljuc: 'fokus', vrijednost: 0 },
          { kljuc: 'brzina', vrijednost: Number.NaN },
          { kljuc: 'duge_rijeci', vrijednost: 85 },
          { kljuc: 'rijetke_rijeci', vrijednost: 0 },
        ],
      }),
    };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toEqual([]);
  });

  it('odabire najdužu pouzdanu riječ po grafemima, uključujući digrafe', () => {
    const podaci = ulaz();
    const rijec = 'nadživljavanje';
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 1,
      pobjede: 1,
      statistikaRijeci: { najduzaRijec: rijec, najduzaRijecGrafemi: grafemi(rijec).length, najrjedaRijec: null },
    };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toHaveLength(2);
    expect(cv.istaknuto[0]).toContain(`„${rijec}”`);
    expect(cv.istaknuto[0]).toContain(`${grafemi(rijec).length} slova`);
  });

  it('koristi zabilježenu rijetku riječ ako nema valjanog rekorda najduže riječi', () => {
    const podaci = ulaz();
    podaci.cetiriIgraca = {
      ...prazanMod(),
      odigrane: 1,
      pobjede: 1,
      statistikaRijeci: { najduzaRijec: null, najduzaRijecGrafemi: 0, najrjedaRijec: 'žubor' },
    };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toHaveLength(2);
    expect(cv.istaknuto[0]).toContain('riječju „žubor” iz rijetkog frekvencijskog razreda');
  });

  it('uzima kolekciju kao činjeničnu istaknutost kad postoji dovoljan broj riječi', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 1, pobjede: 1 };
    podaci.kolekcijaRijeci = 24;
    const cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toHaveLength(2);
    expect(cv.istaknuto[0]).toBe('kolekcijom od 24 riječi');
  });

  it('vraća najviše tri istaknutosti u dogovorenom redoslijedu', () => {
    const podaci = ulaz();
    const rijec = 'nadživljavanje';
    podaci.dostignuca = [{ id: 'dugometras', razina: 4 }];
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 10,
      pobjede: 2,
      dnk: dnkPrimjer({ najduziStreak: 8 }),
      statistikaRijeci: { najduzaRijec: rijec, najduzaRijecGrafemi: grafemi(rijec).length, najrjedaRijec: null },
    };
    podaci.kolekcijaRijeci = 50;

    const cv = sastaviKaladontCv(podaci);
    expect(cv.istaknuto).toHaveLength(3);
    expect(cv.istaknuto[0]).toContain('dostignućem „Dugometraš”');
    expect(cv.istaknuto[1]).toContain('dugim nizom prihvaćenih riječi (8)');
    expect(cv.istaknuto[2]).toContain(`„${rijec}”`);
  });

  it('ne ističe kolekciju manju od deset riječi sama za sebe', () => {
    const podaci = ulaz();
    podaci.kolekcijaRijeci = 9;
    expect(sastaviKaladontCv(podaci).istaknuto).toEqual([]);
  });

  it('ostaje deterministički za isti ulaz', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 6 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 4 };
    expect(sastaviKaladontCv(podaci)).toEqual(sastaviKaladontCv(podaci));
  });

  it('odbija oštećene javne agregate umjesto da ih tumači kao nule', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: -1 };
    expect(() => sastaviKaladontCv(podaci)).toThrow('Profilni podaci nisu valjani');
  });

  it('ne koristi nastanak računa kao zamjenu za nedostajući registracijski datum', () => {
    const podaci = ulaz();
    podaci.registriranAt = null;
    const cv = sastaviKaladontCv(podaci);
    expect(cv.staz).toBeNull();
    expect(cv.datum.osnova).toBe('nepoznato');
    expect(cv.datum.pomoc).toBe('Datum registracije nije zabilježen.');
  });
});