import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Pristupačnost ostaje kao tema; kako-igrati i ostale stare teme → hub. */
export const load: PageLoad = ({ params }) => {
  if (params.tema === 'pristupacnost') {
    return { tema: 'pristupacnost' as const };
  }
  redirect(308, '/pravila-kaladonta');
};
