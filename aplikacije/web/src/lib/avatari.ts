/** Statički katalog avatara; novi avatar dodaje se ovdje i u static/avatari. */
export const AVATARI = [
  { id: 0, putanja: '/avatari/avatar-borat-1.jpg', naziv: 'Borat 1' },
  { id: 1, putanja: '/avatari/avatar-borat-2.jpg', naziv: 'Borat 2' },
  { id: 2, putanja: '/avatari/avatar-cage-1.jpg', naziv: 'Cage' },
  { id: 3, putanja: '/avatari/avatar-test-1.jpg', naziv: 'Avatar 4' },
  { id: 4, putanja: '/avatari/avatar-test-2.jpg', naziv: 'Avatar 5' },
  { id: 5, putanja: '/avatari/avatar-test-3.jpg', naziv: 'Avatar 6' },
  { id: 6, putanja: '/avatari/avatar-test-4.jpg', naziv: 'Avatar 7' },
  { id: 7, putanja: '/avatari/avatar-test-5.jpg', naziv: 'Avatar 8' },
  { id: 8, putanja: '/avatari/avatar-test-6.jpg', naziv: 'Avatar 9' },
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
  'Gospodar riječnika': '#E67E22',
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

