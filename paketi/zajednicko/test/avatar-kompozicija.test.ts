import { describe, expect, it } from 'vitest';
import { ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from '../src/avatar.js';
import {
  AVATAR_POZADINA,
  AVATAR_RENDERER_VERZIJA,
  REDOSLIJED_SLOJEVA_AVATARA,
  kanonskiZapisAvatara,
  putanjaGeneriranogAvatara,
  slojeviKompozicije,
  velicinaGeneriranogAvatara,
} from '../src/avatar-kompozicija.js';

describe('kompozicija avatara', () => {
  it('drži redoslijed slojeva pregleda i posebne okvire paketa 03', () => {
    const slojevi = slojeviKompozicije(ZADANI_AVATAR_CONFIG);
    expect(slojevi.map((sloj) => sloj.kategorija)).toEqual([...REDOSLIJED_SLOJEVA_AVATARA]);
    expect(slojevi.find((sloj) => sloj.kategorija === 'background')?.vidljiv).toBe(false);
    expect(slojevi.find((sloj) => sloj.kategorija === 'hair')).toMatchObject({
      nazivDatoteke: 'Hair-Mr-T.svg',
      x: 59,
      y: 28,
      visina: 203,
      vidljiv: true,
    });

    const dugaKosa: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      parts: { ...ZADANI_AVATAR_CONFIG.parts, hair: 'k3-long-straight' },
    };
    expect(slojeviKompozicije(dugaKosa).find((sloj) => sloj.kategorija === 'hair')).toMatchObject({
      visina: 300,
      nazivDatoteke: 'Hair-k3-long-straight.svg',
    });
  });

  it('praznu majicu crta kao open u boji kože i skriva naušnice uz odvojene uši', () => {
    const bez: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      parts: { ...ZADANI_AVATAR_CONFIG.parts, shirt: null, ears: 'detached', earrings: 'hoop' },
    };
    const slojevi = slojeviKompozicije(bez);
    expect(slojevi.find((sloj) => sloj.kategorija === 'shirt')).toMatchObject({
      vrijednost: 'open',
      nazivDatoteke: 'Shirt-open.svg',
      boja: ZADANI_AVATAR_CONFIG.colors.skin,
      vidljiv: true,
    });
    expect(slojevi.find((sloj) => sloj.kategorija === 'ears')?.vidljiv).toBe(false);
    expect(slojevi.find((sloj) => sloj.kategorija === 'earrings')?.vidljiv).toBe(false);
    expect(AVATAR_POZADINA).toBe('#FFEDEF');
  });

  it('kanonski zapis ne ovisi o redoslijedu ključeva i uključuje verziju renderera', () => {
    const obrnuto = {
      colors: Object.fromEntries(Object.entries(ZADANI_AVATAR_CONFIG.colors).reverse()),
      parts: Object.fromEntries(Object.entries(ZADANI_AVATAR_CONFIG.parts).reverse()),
      assetVersion: ZADANI_AVATAR_CONFIG.assetVersion,
      schemaVersion: ZADANI_AVATAR_CONFIG.schemaVersion,
    } as AvatarConfigV1;
    expect(kanonskiZapisAvatara(obrnuto)).toBe(kanonskiZapisAvatara(ZADANI_AVATAR_CONFIG));
    expect(kanonskiZapisAvatara(ZADANI_AVATAR_CONFIG).startsWith(`${AVATAR_RENDERER_VERZIJA}\n`)).toBe(true);
  });

  it('bira veličinu iz bijele liste i slaže javnu putanju', () => {
    expect(velicinaGeneriranogAvatara(48)).toBe(64);
    expect(velicinaGeneriranogAvatara(90)).toBe(128);
    expect(velicinaGeneriranogAvatara(200)).toBe(320);
    expect(putanjaGeneriranogAvatara('abc', 128)).toBe('/avatari/g/abc/128.webp');
  });
});
