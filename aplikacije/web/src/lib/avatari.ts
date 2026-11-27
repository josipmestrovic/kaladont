/** Statički katalog avatara (legacy ID); preferiraj generirani WebP / konfiguraciju. */
export const AVATARI = [
  { id: 0, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 1' },
  { id: 1, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 2' },
  { id: 2, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 3' },
  { id: 3, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 4' },
  { id: 4, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 5' },
  { id: 5, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 6' },
  { id: 6, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 7' },
  { id: 7, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 8' },
  { id: 8, putanja: '/ikone/29-random-avatar.webp', naziv: 'Avatar 9' },
] as const;

export const BROJ_AVATARA = AVATARI.length;

const BOJE_BORDERA: Record<string, string> = {
  Prvopisac: '#8C8C8C',
  Riječarac: '#B08D57',
  Jezičar: '#C0C0C0',
  Lektor: '#D4AF37',
  Književnik: '#9FD6E0',
  Jezikoslovac: '#2ECC71',
  'Doktor riječi': '#5DADE2',
  'Jezični maestro': '#9B59B6',
  'Gospodar rječnika': '#E67E22',
  Kaladont: '#E4572E',
};

export function putanjaAvatara(avatarId: number): string {
  return AVATARI.find((avatar) => avatar.id === avatarId)?.putanja ?? AVATARI[0].putanja;
}

export function nazivAvatara(avatarId: number): string {
  return AVATARI.find((avatar) => avatar.id === avatarId)?.naziv ?? 'Avatar';
}

export function bojaBordera(rang: string | null): string | null {
  if (!rang) return null;
  return BOJE_BORDERA[rang] ?? null;
}

/** Debljina bordera ranga: manji avatari tanji, veći jače izraženi. */
export function debljinaBorderaRanga(velicina: number): number {
  return Math.min(16, Math.max(3, Math.round(velicina * 0.065)));
}
