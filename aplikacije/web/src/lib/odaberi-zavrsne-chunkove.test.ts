import { describe, expect, it } from 'vitest';
import { kriticniZavrsniChunkovi, odaberiZavrsneChunkove } from './odaberi-zavrsne-chunkove.js';

describe('odaberiZavrsneChunkove', () => {
  it('za izazov učitava samo rezultat i panel riječi', () => {
    const chunkovi = odaberiZavrsneChunkove({
      kontekst: 'izazov',
      imaXp: true,
      imaMisije: true,
      imaDnk: true,
      imaIgraceZaPrijavu: true,
    });
    expect([...chunkovi].sort()).toEqual(['panelRijeci', 'rezultatIzazova']);
  });

  it('tijekom predviđanja ne učitava DNK ni panel igrača', () => {
    const chunkovi = odaberiZavrsneChunkove({
      kontekst: 'javna',
      imaXp: false,
      imaMisije: false,
      imaDnk: false,
      imaIgraceZaPrijavu: true,
      predvidanje: true,
    });
    expect(chunkovi.has('dnk')).toBe(false);
    expect(chunkovi.has('panelIgraca')).toBe(false);
    expect(chunkovi.has('iskustvo')).toBe(true);
    expect(chunkovi.has('panelRijeci')).toBe(true);
    expect(chunkovi.has('rezultatIzazova')).toBe(false);
  });

  it('DNK samo kad postoji i nije trening', () => {
    expect(
      odaberiZavrsneChunkove({
        kontekst: 'javna',
        imaXp: false,
        imaMisije: false,
        imaDnk: true,
        imaIgraceZaPrijavu: false,
      }).has('dnk'),
    ).toBe(true);
    expect(
      odaberiZavrsneChunkove({
        kontekst: 'trening',
        imaXp: true,
        imaMisije: false,
        imaDnk: true,
        imaIgraceZaPrijavu: false,
      }).has('dnk'),
    ).toBe(false);
  });

  it('kritični set za izazov uključuje rezultat', () => {
    const kriticni = kriticniZavrsniChunkovi({
      kontekst: 'izazov',
      imaXp: false,
      imaMisije: false,
      imaDnk: false,
      imaIgraceZaPrijavu: false,
    });
    expect([...kriticni].sort()).toEqual(['panelRijeci', 'rezultatIzazova']);
  });

  it('kritični set za javnu s XP uključuje iskustvo', () => {
    const kriticni = kriticniZavrsniChunkovi({
      kontekst: 'javna',
      imaXp: true,
      imaMisije: false,
      imaDnk: false,
      imaIgraceZaPrijavu: false,
    });
    expect(kriticni.has('iskustvo')).toBe(true);
    expect(kriticni.has('rezultatIzazova')).toBe(false);
  });
});
