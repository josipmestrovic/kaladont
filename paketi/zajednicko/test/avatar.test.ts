import { describe, expect, it } from 'vitest';
import { ZADANI_AVATAR_CONFIG, validirajAvatarConfig } from '../src/avatar.js';

describe('AvatarConfigV1', () => {
  it('prihvaća zadanu konfiguraciju', () => {
    expect(validirajAvatarConfig(ZADANI_AVATAR_CONFIG)).toBe(true);
  });

  it('odbija nepoznati dio i nevaljanu boju', () => {
    expect(validirajAvatarConfig({ ...ZADANI_AVATAR_CONFIG, parts: { ...ZADANI_AVATAR_CONFIG.parts, hair: 'nepoznata' } })).toBe(false);
    expect(validirajAvatarConfig({ ...ZADANI_AVATAR_CONFIG, colors: { skin: 'red' } })).toBe(false);
  });

  it('dopušta opcionalne dijelove Bez', () => {
    expect(validirajAvatarConfig({
      ...ZADANI_AVATAR_CONFIG,
      parts: { ...ZADANI_AVATAR_CONFIG.parts, hair: null, glasses: null, earrings: null, facialHair: null, eyebrows: null, nose: null, shirt: null },
    })).toBe(true);
  });
});
