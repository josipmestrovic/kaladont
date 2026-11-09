import { redirect } from '@sveltejs/kit';
import { normalizirajTemu, putanjaPravilaTeme } from '$lib/seo.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  const tema = normalizirajTemu(url.searchParams.get('tema'));
  redirect(308, putanjaPravilaTeme(tema ?? 'kako-igrati'));
};
