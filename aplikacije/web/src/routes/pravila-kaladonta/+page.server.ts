import { redirect } from '@sveltejs/kit';
import { normalizirajTemu, putanjaPravilaTeme } from '$lib/seo.js';
import type { PageServerLoad } from './$types';

/** Stari `?tema=` URL-ovi → kanonski path (308). */
export const load: PageServerLoad = ({ url }) => {
  const sirova = url.searchParams.get('tema');
  if (!sirova) return {};

  const tema = normalizirajTemu(sirova);
  if (!tema) {
    redirect(308, '/pravila-kaladonta');
  }

  redirect(308, putanjaPravilaTeme(tema));
};
