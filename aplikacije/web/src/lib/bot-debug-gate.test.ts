import { describe, expect, it } from 'vitest';

/** Logika vidljivosti panela — bez DOM-a (mobilni breakpoint + staging + kontekst). */
function botDebugSmijePrikazati(ulaz: {
  okruzenje: string;
  desktop: boolean;
  kontekst: string | null | undefined;
  kraj: boolean;
}): boolean {
  if (ulaz.okruzenje !== 'staging') return false;
  if (!ulaz.desktop) return false;
  if (ulaz.kraj) return false;
  return ulaz.kontekst === 'javna' || ulaz.kontekst === 'trening' || ulaz.kontekst === 'izazov';
}

describe('Bot debug UI gate', () => {
  it('ne prikazuje panel na mobilnom sučelju', () => {
    expect(botDebugSmijePrikazati({
      okruzenje: 'staging',
      desktop: false,
      kontekst: 'javna',
      kraj: false,
    })).toBe(false);
  });

  it('ne prikazuje na produkciji', () => {
    expect(botDebugSmijePrikazati({
      okruzenje: 'production',
      desktop: true,
      kontekst: 'javna',
      kraj: false,
    })).toBe(false);
  });

  it('prikazuje na staging desktop Brzoj', () => {
    expect(botDebugSmijePrikazati({
      okruzenje: 'staging',
      desktop: true,
      kontekst: 'javna',
      kraj: false,
    })).toBe(true);
  });

  it('ne prikazuje u privatnoj sobi', () => {
    expect(botDebugSmijePrikazati({
      okruzenje: 'staging',
      desktop: true,
      kontekst: 'privatna',
      kraj: false,
    })).toBe(false);
  });
});
