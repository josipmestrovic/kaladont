import { describe, expect, it } from 'vitest';
import {
  REPERTOAR_GLAVNI_PO_PREFIKSU,
  REPERTOAR_REZERVA_PO_PREFIKSU,
  izgradiRepertoarBotova,
  jeOpasanZavrsetak,
  prefiksImaPrijemljivuRijec,
} from '../src/bot/repertoar.js';

function fixture(rijeci: Record<string, { freq: number; grupe: string[]; osnovni?: boolean }>) {
  const poPrefiksu = new Map<string, string[]>();
  for (const rijec of Object.keys(rijeci)) {
    const prefiks = rijec.slice(0, 2);
    const lista = poPrefiksu.get(prefiks) ?? [];
    lista.push(rijec);
    poPrefiksu.set(prefiks, lista);
  }
  return {
    prefiksi: () => poPrefiksu.keys(),
    rijeciNaPrefiksu: (p: string) => poPrefiksu.get(p) ?? [],
    frekvencijaZa: (r: string) => rijeci[r]?.freq ?? null,
    grupeZa: (r: string) => rijeci[r]?.grupe ?? [],
    jeOsnovniOblik: (r: string) => rijeci[r]?.osnovni ?? (rijeci[r]?.grupe.some((g) => g.endsWith(`:${r}`)) ?? false),
    jePostojecaRijec: (r: string) => r in rijeci,
  };
}

describe('repertoar bota', () => {
  it('ograničava glavni i rezervni na 256 + deduplikacija grupe (kuća)', () => {
    const izvor = fixture({
      kuća: { freq: 500, grupe: ['imenica:kuća'], osnovni: true },
      kuće: { freq: 400, grupe: ['imenica:kuća'] },
      kućom: { freq: 100, grupe: ['imenica:kuća'] },
      kuca: { freq: 50, grupe: ['imenica:kuca'], osnovni: true },
    });
    const snimka = izgradiRepertoarBotova(izvor, 1);
    const ku = snimka.poPrefiksu.get('ku')!;
    expect(ku.glavni.length).toBeLessThanOrEqual(REPERTOAR_GLAVNI_PO_PREFIKSU);
    expect(ku.rezerva.length).toBeLessThanOrEqual(REPERTOAR_REZERVA_PO_PREFIKSU);
    expect(ku.glavni).toContain('kuća');
    expect(ku.glavni).not.toContain('kuće');
    expect(ku.glavni).not.toContain('kućom');
  });

  it('determinističan build za isti ulaz', () => {
    const rijeci: Record<string, { freq: number; grupe: string[]; osnovni?: boolean }> = {};
    for (let i = 0; i < 40; i += 1) {
      const rijec = `ma${String(i).padStart(2, '0')}`;
      rijeci[rijec] = { freq: 100 + i, grupe: [`imenica:${rijec}`], osnovni: true };
    }
    const a = izgradiRepertoarBotova(fixture(rijeci), 1);
    const b = izgradiRepertoarBotova(fixture(rijeci), 1);
    expect(a.poPrefiksu.get('ma')?.glavni).toEqual(b.poPrefiksu.get('ma')?.glavni);
  });

  it('svaki prefiks s prihvatljivom riječi ima barem jedan zapis u repertoaru', () => {
    const izvor = fixture({
      ab: { freq: 200, grupe: ['imenica:ab'], osnovni: true },
      xy: { freq: 0, grupe: ['imenica:xy'], osnovni: true },
    });
    const snimka = izgradiRepertoarBotova(izvor, 1);
    for (const prefiks of ['ab', 'xy'] as const) {
      expect(prefiksImaPrijemljivuRijec(snimka, prefiks, izvor.rijeciNaPrefiksu(prefiks), izvor.frekvencijaZa)).toBe(true);
      expect(snimka.poPrefiksu.get(prefiks)?.glavni.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('opasni završeci za taktiku', () => {
    expect(jeOpasanZavrsetak('ća')).toBe(true);
    expect(jeOpasanZavrsetak('ma')).toBe(false);
  });
});