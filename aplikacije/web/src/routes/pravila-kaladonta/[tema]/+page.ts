import { error, redirect } from '@sveltejs/kit';
import { jePravilaTema, putanjaPravilaTeme } from '$lib/seo.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const sirova = params.tema;

  if (sirova === 'kako-igrati' || sirova === 'pravila') {
    redirect(308, putanjaPravilaTeme('kako-igrati'));
  }

  if (!jePravilaTema(sirova)) {
    error(404, 'Nepoznata tema pravila');
  }

  return { tema: sirova };
};
