import { describe, expect, it } from 'vitest';
import { jeValjanNadimak } from '../src/nadimak.js';

describe('pravila nadimka', () => {
  it('dopušta slova, hrvatske znakove, brojeve, crticu i donju crtu', () => {
    expect(jeValjanNadimak('Ana')).toBe(true);
    expect(jeValjanNadimak('Čedo_42')).toBe(true);
    expect(jeValjanNadimak('Marko-7')).toBe(true);
  });

  it('odbija praznine, interpunkciju i pogrešnu duljinu', () => {
    expect(jeValjanNadimak('An')).toBe(false);
    expect(jeValjanNadimak('Ana Marko')).toBe(false);
    expect(jeValjanNadimak('Ana!')).toBe(false);
    expect(jeValjanNadimak('A'.repeat(13))).toBe(false);
  });
});