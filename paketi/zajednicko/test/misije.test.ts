import { describe, expect, it } from 'vitest';
import {
  DEFINICIJE_MISIJA,
  XP_DNEVNA_MISIJA,
  XP_TJEDNA_MISIJA,
  definicijaMisije,
  definicijeMisijaPoVrsti,
  jePristupacnaTjedna,
  jeTopDvaCetverobojMisija,
} from '../src/misije.js';

describe('katalog misija', () => {
  it('katalog ima 50 predložaka; aktivni pool je manji nakon Brze igre', () => {
    expect(DEFINICIJE_MISIJA).toHaveLength(50);
    // 8 dnevnih + 8 tjednih deaktivirano (D07/08/09/11/12/19/22/24, W08/09/11/12/19/20/22/24).
    expect(definicijeMisijaPoVrsti('dnevna')).toHaveLength(17);
    expect(definicijeMisijaPoVrsti('tjedna')).toHaveLength(17);
    expect(definicijaMisije('D07')?.aktivna).toBe(false);
    expect(definicijaMisije('W22')?.aktivna).toBe(false);
    expect(definicijaMisije('D21')?.aktivna).toBe(true);
    expect(definicijaMisije('D25')?.aktivna).toBe(true);
  });

  it('ima jedinstvene ID-ove i pozitivne ciljeve', () => {
    const idovi = DEFINICIJE_MISIJA.map((d) => d.predlozakId);
    expect(new Set(idovi).size).toBe(50);
    for (const d of DEFINICIJE_MISIJA) {
      expect(d.cilj).toBeGreaterThan(0);
      expect(d.verzijaDefinicije).toBe(1);
    }
  });

  it('daje 200 XP dnevnim i 2000 XP tjednim', () => {
    for (const d of definicijeMisijaPoVrsti('dnevna')) expect(d.xp).toBe(XP_DNEVNA_MISIJA);
    for (const d of definicijeMisijaPoVrsti('tjedna')) expect(d.xp).toBe(XP_TJEDNA_MISIJA);
  });

  it('čuva korisničke pobjedničke i trening ciljeve', () => {
    expect(definicijaMisije('D08')?.cilj).toBe(1);
    expect(definicijaMisije('D09')?.cilj).toBe(3);
    expect(definicijaMisije('D10')?.cilj).toBe(1);
    expect(definicijaMisije('D10')?.kontekst).toBe('trening');
    expect(definicijaMisije('W08')?.cilj).toBe(5);
    expect(definicijaMisije('W09')?.cilj).toBe(20);
    expect(definicijaMisije('W10')?.cilj).toBe(3);
    expect(definicijaMisije('W10')?.kontekst).toBe('trening');
    expect(definicijaMisije('D25')?.kontekst).toBe('izazov');
    expect(definicijaMisije('D25')?.metrika).toBe('izazov_pokusaji');
    expect(definicijaMisije('D25')?.cilj).toBe(3);
    expect(definicijaMisije('W25')?.kontekst).toBe('izazov');
    expect(definicijaMisije('W25')?.cilj).toBe(10);
  });

  it('označava top-2 i pristupačne tjedne', () => {
    expect(jeTopDvaCetverobojMisija('D19')).toBe(true);
    expect(jeTopDvaCetverobojMisija('W19')).toBe(true);
    expect(jeTopDvaCetverobojMisija('D08')).toBe(false);
    expect(jePristupacnaTjedna('W01')).toBe(true);
    expect(jePristupacnaTjedna('W09')).toBe(false);
    // HINT PR12: W21–W24 nisu pristupačne.
    expect(jePristupacnaTjedna('W22')).toBe(false);
    expect(jePristupacnaTjedna('W23')).toBe(false);
  });

  it('ima pragove za W03/D20/W07 i podciljeve za D12/W20', () => {
    expect(definicijaMisije('W03')?.pragMetrike).toBe(5);
    expect(definicijaMisije('D20')?.pragMetrike).toBe(3);
    expect(definicijaMisije('W07')?.pragMetrike).toBe(5);
    expect(definicijaMisije('D12')?.podciljevi).toHaveLength(2);
    expect(definicijaMisije('W20')?.podciljevi).toHaveLength(2);
    expect(definicijaMisije('W20')?.cilj).toBe(10);
  });
});
