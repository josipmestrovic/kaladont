export const AVATAR_SHEMA_VERZIJA = 1 as const;
export const AVATAR_ASSET_VERZIJA = 'figma-avatar-v1' as const;

// Dijelovi s prefiksom k2- dolaze iz paketa 02, k3- iz paketa 03 (skripte/avatari/).
export const AVATAR_DIJELOVI = {
  base: ['base-1'],
  ears: [
    'attached', 'detached', 'k2-compact', 'k2-rounded', 'k2-pointed', 'k2-angular',
    'k3-elephant', 'k3-fan', 'k3-long-pointed', 'k3-floppy',
  ],
  mouth: [
    'surprised', 'laughing', 'smile', 'smirk', 'sad', 'frown', 'pucker', 'nervous',
    'k2-grin', 'k2-tooth-gap', 'k2-tongue-out', 'k2-braces', 'k2-gentle', 'k2-whistle', 'k2-determined', 'k2-small-oh',
    'k3-toothless-laugh', 'k3-toothless-wide', 'k3-gummy', 'k3-lipstick-smile', 'k3-lipstick-pout', 'k3-crooked-grin',
  ],
  hair: [
    'fonze', 'mr-t', 'doug-funny', 'mr-clean', 'danny-phantom', 'full', 'turban', 'pixie',
    'k2-crop', 'k2-side-part', 'k2-waves', 'k2-curls', 'k2-high-puff', 'k2-double-bun', 'k2-spiky', 'k2-bob', 'k2-short-fringe', 'k2-topknot',
    'k3-long-straight', 'k3-long-waves', 'k3-pigtails', 'k3-twin-braids', 'k3-side-braid', 'k3-high-ponytail',
    'k3-low-ponytail', 'k3-curtain-bangs', 'k3-curly-lob', 'k3-space-buns-loose', 'k3-bow-bob', 'k3-sleek-bun',
  ],
  eyes: [
    'eyes', 'smiling', 'eyeshadow', 'round',
    'k2-wink', 'k2-closed', 'k2-sleepy', 'k2-wide', 'k2-look-left', 'k2-look-right',
    'k3-long-lashes', 'k3-winged-liner', 'k3-wink-lashes', 'k3-dreamy-lashes', 'k3-starry',
  ],
  eyebrows: [
    'up', 'down', 'eyelashes-up', 'eyelashes-down',
    'k2-straight', 'k2-bold', 'k2-one-up', 'k2-concerned', 'k2-soft-arch', 'k2-split',
    'k3-slender-arch', 'k3-swoop', 'k3-zigzag',
  ],
  nose: [
    'curve', 'pointed', 'round', 'k2-button', 'k2-bridge', 'k2-wide', 'k2-angular-soft',
    'k3-giant-button', 'k3-trumpet', 'k3-curly', 'k3-zigzag', 'k3-piggy',
  ],
  shirt: [
    'open', 'crew', 'collared',
    'k2-v-neck', 'k2-hoodie', 'k2-turtleneck', 'k2-jersey', 'k2-bomber', 'k2-striped',
    'k3-peter-pan', 'k3-ruffle', 'k3-sweetheart', 'k3-bow-blouse',
  ],
  glasses: [
    'round', 'square',
    'k2-hexagon', 'k2-oval', 'k2-cat-eye', 'k2-aviator', 'k2-browline', 'k2-sport', 'k2-rimless', 'k2-heart',
    'k3-sun-cat', 'k3-sun-round', 'k3-sun-butterfly', 'k3-sun-visor', 'k3-sun-heart', 'k3-sun-pixel',
  ],
  earrings: [
    'hoop', 'stud', 'k2-drop', 'k2-diamond', 'k2-double-hoop', 'k2-bar',
    'k3-heart-drop', 'k3-moon-drop', 'k3-flower', 'k3-triple-drop', 'k3-star-drop',
  ],
  facialHair: [
    'beard', 'scruff', 'k2-moustache', 'k2-goatee', 'k2-chin-patch', 'k2-sideburns',
    'k3-curly-handlebar', 'k3-three-whiskers',
  ],
  background: ['background'],
} as const;

export type AvatarDio<K extends keyof typeof AVATAR_DIJELOVI = keyof typeof AVATAR_DIJELOVI> =
  (typeof AVATAR_DIJELOVI)[K][number];

export interface AvatarDijelovi {
  base: AvatarDio<'base'>;
  ears: AvatarDio<'ears'>;
  mouth: AvatarDio<'mouth'>;
  hair: AvatarDio<'hair'> | null;
  eyes: AvatarDio<'eyes'>;
  eyebrows: AvatarDio<'eyebrows'> | null;
  nose: AvatarDio<'nose'> | null;
  shirt: AvatarDio<'shirt'> | null;
  glasses: AvatarDio<'glasses'> | null;
  earrings: AvatarDio<'earrings'> | null;
  facialHair: AvatarDio<'facialHair'> | null;
  background: AvatarDio<'background'>;
}

export const AVATAR_BOJNE_ULOGE = [
  'skin',
  'hair',
  'shirt',
  'eyes',
  'eyebrows',
  'glasses',
  'earrings',
  'facialHair',
] as const;

export type AvatarBojnaUloga = (typeof AVATAR_BOJNE_ULOGE)[number];

export type AvatarBoje = Partial<Record<AvatarBojnaUloga, string>>;

export interface AvatarConfigV1 {
  schemaVersion: typeof AVATAR_SHEMA_VERZIJA;
  assetVersion: typeof AVATAR_ASSET_VERZIJA;
  parts: AvatarDijelovi;
  colors: AvatarBoje;
}

export const ZADANI_AVATAR_CONFIG: AvatarConfigV1 = {
  schemaVersion: AVATAR_SHEMA_VERZIJA,
  assetVersion: AVATAR_ASSET_VERZIJA,
  parts: {
    base: 'base-1',
    ears: 'attached',
    mouth: 'laughing',
    hair: 'mr-t',
    eyes: 'smiling',
    eyebrows: 'up',
    nose: 'round',
    shirt: 'collared',
    glasses: null,
    earrings: null,
    facialHair: null,
    background: 'background',
  },
  colors: {
    skin: '#AC6651',
    hair: '#171921',
    shirt: '#6BD9E9',
    eyes: '#171921',
    eyebrows: '#171921',
  },
};

const HEX_BOJA = /^#[0-9A-Fa-f]{6}$/;

function jeJedanOd<T extends readonly string[]>(vrijednost: unknown, izbori: T): vrijednost is T[number] {
  return typeof vrijednost === 'string' && izbori.includes(vrijednost);
}

function jeObjekt(vrijednost: unknown): vrijednost is Record<string, unknown> {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

export function validirajAvatarConfig(vrijednost: unknown): vrijednost is AvatarConfigV1 {
  if (!jeObjekt(vrijednost)) return false;
  if (vrijednost.schemaVersion !== AVATAR_SHEMA_VERZIJA || vrijednost.assetVersion !== AVATAR_ASSET_VERZIJA) return false;
  if (!jeObjekt(vrijednost.parts) || !jeObjekt(vrijednost.colors)) return false;

  for (const [kljuc, izbori] of Object.entries(AVATAR_DIJELOVI)) {
    const dio = vrijednost.parts[kljuc];
    if (kljuc === 'glasses' || kljuc === 'earrings' || kljuc === 'facialHair') {
      if (dio !== null && !jeJedanOd(dio, izbori)) return false;
    } else if (kljuc === 'hair' || kljuc === 'eyebrows' || kljuc === 'nose' || kljuc === 'shirt') {
      if (dio !== null && !jeJedanOd(dio, izbori)) return false;
    } else if (!jeJedanOd(dio, izbori)) {
      return false;
    }
  }

  const boje = vrijednost.colors;
  for (const [uloga, boja] of Object.entries(boje)) {
    if (!AVATAR_BOJNE_ULOGE.includes(uloga as AvatarBojnaUloga) || !HEX_BOJA.test(String(boja))) return false;
  }
  return true;
}