/**
 * Definicije 8 avatara (apstraktni oblik + boje) i 10 border boja po rangu,
 * usklađeno s Figma "Avatari"/"Borderi" komponentama (docs/05-ux-ui/vizualni-identitet.md).
 */
export const BROJ_AVATARA = 8;

export type OblikSimbola = 'krug' | 'trokut' | 'kvadrat' | 'zvijezda' | 'romb' | 'poligon';

export interface DizajnAvatara {
  bg: string;
  simbol: string;
  oblik: OblikSimbola;
}

export const DIZAJNI_AVATARA: readonly DizajnAvatara[] = [
  { bg: '#2FA98C', simbol: '#FAF3E3', oblik: 'krug' },
  { bg: '#E4572E', simbol: '#F4C95D', oblik: 'trokut' },
  { bg: '#F4C95D', simbol: '#26221B', oblik: 'kvadrat' },
  { bg: '#1D6F5C', simbol: '#FAF3E3', oblik: 'zvijezda' },
  { bg: '#7A7264', simbol: '#F4C95D', oblik: 'krug' },
  { bg: '#26221B', simbol: '#2FA98C', oblik: 'romb' },
  { bg: '#FAF3E3', simbol: '#E4572E', oblik: 'trokut' },
  { bg: '#2FA98C', simbol: '#26221B', oblik: 'poligon' },
];

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

export function dizajnAvatara(avatarId: number): DizajnAvatara {
  return DIZAJNI_AVATARA[avatarId % DIZAJNI_AVATARA.length]!;
}

export function bojaBordera(rang: string | null): string | null {
  if (!rang) return null;
  return BOJE_BORDERA[rang] ?? null;
}

