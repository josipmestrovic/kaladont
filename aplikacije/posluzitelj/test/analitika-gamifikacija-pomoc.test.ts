import { describe, expect, it } from 'vitest';
import {
  DEFINICIJE_DOSTIGNUCA,
  stanjeIskustva,
  type BrojaciDostignucaZaIzracun,
} from 'zajednicko';
import {
  agregirajDostignucaPresjek,
  agregirajKolekcijuPresjek,
  kantaRazinaXp,
  nazivPredloskaIzSnimke,
  postotak,
  PRAG_MALI_UZORAK_GAMIFIKACIJE,
  raspodjelaRazinaXp,
  razinaDostignucaZaIgraca,
  stopeMisija,
} from '../src/analitika/gamifikacija-pomoc.js';

describe('gamifikacija pomoćnici', () => {
  it('računa udio i terminalnu stopu s ispravnim nazivnicima', () => {
    const s = stopeMisija(10, 4, 3, 1);
    expect(s.udioTrenutnoDovrsenih).toBe(40);
    expect(s.terminalnaStopaDovrsavanja).toBe(50);
    expect(s.terminalniNazivnik).toBe(8);
    expect(s.stopaZamjenjivanja).toBe(30);
    expect(stopeMisija(5, 0, 0, 0).terminalnaStopaDovrsavanja).toBeNull();
    expect(postotak(1, 0)).toBeNull();
  });

  it('aktivne nisu u terminalnom nazivniku; dnevna bez isteka ima 0 isteklih', () => {
    const s = stopeMisija(7, 2, 1, 0);
    expect(s.terminalniNazivnik).toBe(3);
    expect(s.terminalnaStopaDovrsavanja).toBeCloseTo((2 / 3) * 100);
  });

  it('uzima naziv iz snimke ili pada na ID', () => {
    expect(nazivPredloskaIzSnimke('D01', { naziv: 'Odigraj 3 partije' })).toBe('Odigraj 3 partije');
    expect(nazivPredloskaIzSnimke('D99', null)).toBe('D99');
    expect(nazivPredloskaIzSnimke('D99', {})).toBe('D99');
  });

  it('razlikuje verzije predloška po zasebnim ključevima kroz stope', () => {
    // v1: teža, više zamjena; v2: lakša
    const v1 = stopeMisija(30, 5, 20, 0);
    const v2 = stopeMisija(30, 25, 2, 0);
    expect(v1.stopaZamjenjivanja).toBeGreaterThan(v2.stopaZamjenjivanja!);
    expect(v2.terminalnaStopaDovrsavanja).toBeGreaterThan(v1.terminalnaStopaDovrsavanja!);
    expect(PRAG_MALI_UZORAK_GAMIFIKACIJE).toBe(30);
  });

  it('koristi stanjeIskustva i raspone razina do 100', () => {
    expect(kantaRazinaXp(1)).toBe('1-5');
    expect(kantaRazinaXp(50)).toBe('41-70');
    expect(kantaRazinaXp(100)).toBe('71-100');
    const xp = [0, 500, 5000, 50_000];
    const r = raspodjelaRazinaXp(xp);
    expect(r.uzorak).toBe(4);
    expect(r.napredovaliIznadPrve).toBeGreaterThanOrEqual(1);
    expect(r.prosjekXp).not.toBeNull();
    expect(stanjeIskustva(0).razina).toBe(1);
  });

  it('dostignuća koriste max(spremljena, dinamička) i stvarni max razina', () => {
    const def = DEFINICIJE_DOSTIGNUCA.find((d) => d.id === 'glas_zajednice')!;
    expect(def.pragovi.length).toBe(5);
    const brojac: BrojaciDostignucaZaIzracun = { povratneInformacije: 5 };
    const dinamicna = razinaDostignucaZaIgraca({
      definicija: def,
      iskustvoUkupno: 0,
      najboljiNizAktivnosti: 0,
      spremljenaRazina: 1,
      brojac,
    });
    expect(dinamicna).toBe(5);

    const samoSpremljena = razinaDostignucaZaIgraca({
      definicija: def,
      iskustvoUkupno: 0,
      najboljiNizAktivnosti: 0,
      spremljenaRazina: 3,
      brojac: { povratneInformacije: 0 },
    });
    expect(samoSpremljena).toBe(3);

    const agregat = agregirajDostignucaPresjek([
      {
        iskustvoUkupno: 0,
        najboljiNizAktivnosti: 0,
        spremljeneRazine: new Map([['glas_zajednice', 1]]),
        brojac: { povratneInformacije: 5 },
      },
      {
        iskustvoUkupno: 0,
        najboljiNizAktivnosti: 0,
        spremljeneRazine: new Map(),
        brojac: null,
      },
    ]);
    expect(agregat.bazaIgraca).toBe(2);
    const glas = agregat.poDostignucu.find((d) => d.id === 'glas_zajednice')!;
    expect(glas.otkljucani).toBe(1);
    expect(glas.naMaksimalnojRazini).toBe(1);
    expect(glas.maksimalnaRazina).toBe(5);
  });

  it('kolekcija broji riječ jednom i kad je duga i rijetka', () => {
    // Dva igrača: veličine 2 i 0; duge/rijetke broje se zasebno na razini redova
    const k = agregirajKolekcijuPresjek([2, 0], 1, 1, 2);
    expect(k.igraciSBaremJednomRijeci).toBe(1);
    expect(k.distinctRijeciGlobalno).toBe(2);
    expect(k.brojDugihOtkljucavanja).toBe(1);
    expect(k.brojRijetkihOtkljucavanja).toBe(1);
    expect(k.prosjekVelicine).toBe(1);
  });

  it('prazni uzorci vraćaju null postotke i nulte raspodjele', () => {
    expect(raspodjelaRazinaXp([]).uzorak).toBe(0);
    expect(raspodjelaRazinaXp([]).prosjekXp).toBeNull();
    const d = agregirajDostignucaPresjek([]);
    expect(d.bazaIgraca).toBe(0);
    expect(d.prosjekZvjezdica).toBeNull();
    const k = agregirajKolekcijuPresjek([], 0, 0, 0);
    expect(k.prosjekVelicine).toBeNull();
  });
});
