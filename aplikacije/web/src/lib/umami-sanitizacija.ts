/**
 * Sanitizacija Umami pageview/event payloada — bez osobnih/dinamičkih identifikatora.
 * Handler se registrira na window prije učitavanja trackera (vidi +layout.svelte).
 */

export const IME_UMAMI_BEFORE_SEND = 'kaladontUmamiBeforeSend';

/** Marketinški UTM parametri koje zadržavamo radi kampanja. */
export const UTM_ALLOWLISTA = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const UUID_SEGMENT =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const CUID_ILI_ID = '[A-Za-z0-9_-]{8,}';
const KOD_SOBE = '[A-Za-z0-9]{4,12}';

const PUTANJE: Array<{ uzorak: RegExp; zamjena: string }> = [
  { uzorak: new RegExp(`^/partija/arhiva/${UUID_SEGMENT}$`, 'i'), zamjena: '/partija/arhiva/:id' },
  { uzorak: new RegExp(`^/partija/${UUID_SEGMENT}$`, 'i'), zamjena: '/partija/:id' },
  { uzorak: new RegExp(`^/partija/${CUID_ILI_ID}$`, 'i'), zamjena: '/partija/:id' },
  { uzorak: new RegExp(`^/soba/${KOD_SOBE}$`, 'i'), zamjena: '/soba/:kod' },
  { uzorak: new RegExp(`^/profil/javni/${UUID_SEGMENT}$`, 'i'), zamjena: '/profil/javni/:id' },
  { uzorak: new RegExp(`^/profil/javni/${CUID_ILI_ID}$`, 'i'), zamjena: '/profil/javni/:id' },
  { uzorak: new RegExp(`^/pravila-kaladonta/${CUID_ILI_ID}$`, 'i'), zamjena: '/pravila-kaladonta/:tema' },
];

const NASLOV_OSJETLJIVO = new RegExp(UUID_SEGMENT, 'ig');

export function sanitizirajUmamiPutanju(putanja: string): string {
  const cista = putanja.split('?')[0]?.split('#')[0] || '/';
  for (const { uzorak, zamjena } of PUTANJE) {
    if (uzorak.test(cista)) return zamjena;
  }
  return cista || '/';
}

function filtrirajQuery(searchParams: URLSearchParams): string {
  const zadrzani = new URLSearchParams();
  for (const kljuc of UTM_ALLOWLISTA) {
    const vrijednost = searchParams.get(kljuc);
    if (vrijednost != null && vrijednost !== '') {
      zadrzani.set(kljuc, vrijednost);
    }
  }
  const tekst = zadrzani.toString();
  return tekst ? `?${tekst}` : '';
}

/**
 * Normalizira apsolutni ili relativni URL za Umami payload.
 * Vraća path (+ dopušteni UTM), bez origin-a kad je ista domena — kompatibilno s trackerom.
 */
export function sanitizirajUmamiUrl(sirovi: string, baza = 'https://kaladont.hr'): string {
  const url = new URL(sirovi, baza);
  const putanja = sanitizirajUmamiPutanju(url.pathname);
  const query = filtrirajQuery(url.searchParams);
  return `${putanja}${query}`;
}

export function sanitizirajUmamiReferrer(sirovi: string, baza = 'https://kaladont.hr'): string {
  if (!sirovi) return '';
  try {
    const url = new URL(sirovi, baza);
    // Vanjski referrer: zadrži origin + sanitiziranu putanju (bez tokena u queryju).
    const putanja = sanitizirajUmamiPutanju(url.pathname);
    const query = filtrirajQuery(url.searchParams);
    if (url.origin === new URL(baza).origin || url.origin === 'https://kaladont.hr') {
      return `${putanja}${query}`;
    }
    return `${url.origin}${putanja}${query}`;
  } catch {
    return '';
  }
}

export function sanitizirajUmamiNaslov(naslov: unknown): string {
  if (typeof naslov !== 'string') return '';
  return naslov.replace(NASLOV_OSJETLJIVO, ':id');
}

export type UmamiBeforeSendPayload = Record<string, unknown>;

/**
 * Umami `data-before-send` handler.
 * Pri grešci ili neispravnom payloadu vraća falsy → tracker ne šalje.
 */
export function umamiBeforeSend(
  _type: string,
  payload: UmamiBeforeSendPayload | null | undefined,
): UmamiBeforeSendPayload | false {
  try {
    if (!payload || typeof payload !== 'object') return false;

    const rezultat: UmamiBeforeSendPayload = { ...payload };
    const baza =
      typeof globalThis.location?.href === 'string'
        ? globalThis.location.origin
        : 'https://kaladont.hr';

    if (typeof rezultat.url === 'string') {
      rezultat.url = sanitizirajUmamiUrl(rezultat.url, baza);
    }

    if (typeof rezultat.referrer === 'string') {
      rezultat.referrer = sanitizirajUmamiReferrer(rezultat.referrer, baza);
    }

    if ('title' in rezultat) {
      rezultat.title = sanitizirajUmamiNaslov(rezultat.title);
    }

    return rezultat;
  } catch {
    return false;
  }
}

export function registrirajUmamiBeforeSend(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[IME_UMAMI_BEFORE_SEND] = umamiBeforeSend;
}
