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
  it('zamjenjuje bio porukom kada nema javnih igara ni trajnih dostignuća', () => {
    const cv = sastaviKaladontCv(ulaz());
    expect(cv.biografija).toEqual({
      tip: 'nedovoljno_informacija',
      tekst: 'Još nemamo dovoljno informacija za opis ovog igrača.',
    });
    expect(cv.kvalifikacija.rang).toBe('Piskaralo');
    expect(cv.staz?.tekst).toBe('6 dana');
  });

  it('koristi trajno dostignuće registriranog igrača bez javnih igara kao jedini dokaz', () => {
    const podaci = ulaz();
    podaci.dostignuca = [{ id: 'dugometras', razina: 2 }];
    const cv = sastaviKaladontCv(podaci);
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice).toHaveLength(5);
      expect(cv.biografija.recenice[0]).toContain('nijednu javnu igru');
      expect(cv.biografija.recenice[3]).toContain('Dugometraš');
    }
  });

  it('ne kalibrira rang zbrojem načina kada svaki ima manje od deset igara', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 9 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 9 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.kvalifikacija).toMatchObject({ rang: 'Piskaralo', kalibriran: false, nacini: [] });
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') expect(cv.biografija.recenice[1]).toContain('nedostaje mu još 1 javna igra');
  });

  it('odabire viši rang neovisno o tome koji način ima više igara', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 10, bodoviUkupno: 4 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 20, bodoviUkupno: 76 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.kvalifikacija).toMatchObject({ rang: 'Doktor riječi', nacini: ['cetiri_igraca'] });
  });

  it('opisuje samo činjeničnu raspodjelu, uz prag od 60 posto', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = { ...prazanMod(), odigrane: 6 };
    podaci.cetiriIgraca = { ...prazanMod(), odigrane: 4 };
    const cv = sastaviKaladontCv(podaci);
    expect(cv.biografija.tip).toBe('opis');
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[0]).toContain('više javnih igara odigrao je u dvobojima');
      expect(cv.biografija.recenice[0]).not.toContain('bira');
    }

    podaci.dvaIgraca.odigrane = 59;
    podaci.cetiriIgraca.odigrane = 41;
    const blizuPraga = sastaviKaladontCv(podaci);
    if (blizuPraga.biografija.tip === 'opis') expect(blizuPraga.biografija.recenice[0]).not.toContain('više javnih igara odigrao');
  });

  it('ne tvrdi stil prije deset prihvaćenih poteza i koristi samo valjane osi', () => {
    const podaci = ulaz();
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 10,
      dnk: dnkPrimjer({ prihvaceniPotezi: 9 }),
    };
    let cv = sastaviKaladontCv(podaci);
    if (cv.biografija.tip === 'opis') expect(cv.biografija.recenice[2]).toContain('nedostaje zabilježenih podataka');

    podaci.dvaIgraca.dnk = dnkPrimjer();
    cv = sastaviKaladontCv(podaci);
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[2]).toContain('uporabom dugih riječi');
      expect(cv.biografija.recenice[2]).toContain('brzim prihvaćenim potezima');
      expect(cv.biografija.recenice[2]).not.toContain('Fokus');
    }
  });

  it('zanemaruje jednu nevaljanu opcionalnu DNK os, ali zadržava drugu valjanu osobinu', () => {
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
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[2]).toContain('uporabom dugih riječi');
      expect(cv.biografija.recenice[2]).not.toContain('brzim prihvaćenim potezima');
    }
  });

  it('odabire najdužu pouzdanu riječ po grafemima, uključujući digrafe', () => {
    const podaci = ulaz();
    const rijec = 'nadživljavanje';
    podaci.dvaIgraca = {
      ...prazanMod(),
      odigrane: 1,
      statistikaRijeci: { najduzaRijec: rijec, najduzaRijecGrafemi: grafemi(rijec).length, najrjedaRijec: null },
    };
    const cv = sastaviKaladontCv(podaci);
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[3]).toContain(`„${rijec}”`);
      expect(cv.biografija.recenice[3]).toContain(`${grafemi(rijec).length} slova`);
    }
  });

  it('koristi zabilježenu rijetku riječ ako nema valjanog rekorda najduže riječi', () => {
    const podaci = ulaz();
    podaci.cetiriIgraca = {
      ...prazanMod(),
      odigrane: 1,
      statistikaRijeci: { najduzaRijec: null, najduzaRijecGrafemi: 0, najrjedaRijec: 'žubor' },
    };
    const cv = sastaviKaladontCv(podaci);
    if (cv.biografija.tip === 'opis') {
      expect(cv.biografija.recenice[3]).toBe('Među njegovim zabilježenim rijetkim riječima nalazi se „žubor”.');
    }
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