import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Stare teme (/pravila-kaladonta/bodovi …) → jedna stranica pravila. */
export const load: PageLoad = () => {
  redirect(308, '/pravila-kaladonta');
};
