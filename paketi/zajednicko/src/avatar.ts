export const AVATAR_SHEMA_VERZIJA = 1 as const;
export const AVATAR_ASSET_VERZIJA = 'figma-avatar-v1' as const;

export const AVATAR_DIJELOVI = {
  base: ['base-1'],
  ears: ['attached', 'detached'],
  mouth: ['surprised', 'laughing', 'smile', 'smirk', 'sad', 'frown', 'pucker', 'nervous'],
  hair: ['fonze', 'mr-t', 'doug-funny', 'mr-clean', 'danny-phantom', 'full', 'turban', 'pixie'],
  eyes: ['eyes', 'smiling', 'eyeshadow', 'round'],
  eyebrows: ['up', 'down', 'eyelashes-up', 'eyelashes-down'],
  nose: ['curve', 'pointed', 'round'],
  shirt: ['open', 'crew', 'collared'],
  glasses: ['round', 'square'],
  earrings: ['hoop', 'stud'],
  facialHair: ['beard', 'scruff'],
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