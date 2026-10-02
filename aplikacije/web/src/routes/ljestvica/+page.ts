import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Stara adresa: `?tab=rijeci` postaje `?kategorija=rijeci`, ostali parametri se zadržavaju. */
export const load: PageLoad = ({ url }) => {
  const parametri = new URLSearchParams(url.searchParams);
  if (parametri.get('tab') === 'rijeci') parametri.set('kategorija', 'rijeci');
  parametri.delete('tab');
  const upit = parametri.toString();
  redirect(308, `/ljestvice${upit ? `?${upit}` : ''}`);
};
