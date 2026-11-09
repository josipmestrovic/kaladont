import type { LayoutServerLoad } from './$types.js';

/** Jedini dopušteni tracker origin (usklađeno s CSP u Caddyfile). */
const DOPUSTENI_UMAMI_URL = 'https://analitika.kaladont.hr';

/**
 * Runtime env (isti digest na staging/prod): prazan URL ili website ID = tracker isključen.
 * Ne peći VITE_/PUBLIC_ vrijednosti u build — vidi ADR-012.
 */
export const load: LayoutServerLoad = () => {
  const url = (process.env.PUBLIC_UMAMI_URL || process.env.UMAMI_URL || '').trim().replace(/\/$/, '');
  const websiteId = (process.env.PUBLIC_UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID || '').trim();
  const ukljucen = url === DOPUSTENI_UMAMI_URL && websiteId.length > 0;
  return {
    umami: ukljucen ? { url, websiteId } : null,
  };
};
