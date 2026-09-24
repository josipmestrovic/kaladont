import { redirect } from '@sveltejs/kit';

export function load({ url }) {
  const query = url.searchParams.toString();
  redirect(308, `/pravila-kaladonta${query ? `?${query}` : ''}`);
}
