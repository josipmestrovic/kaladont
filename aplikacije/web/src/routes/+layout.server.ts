import type { LayoutServerLoad } from './$types.js';

/**
 * Runtime env (isti digest na staging/prod): prazan URL ili website ID = tracker isključen.
 * Ne peći VITE_/PUBLIC_ vrijednosti u build — vidi ADR-012.
 */
export const load: LayoutServerLoad = () => {
  const url = (process.env.PUBLIC_UMAMI_URL || process.env.UMAMI_URL || '').replace(/\/$/, '');
  const websiteId = process.env.PUBLIC_UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID || '';
  return {
    umami: url && websiteId ? { url, websiteId } : null,
  };
};
