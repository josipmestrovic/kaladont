import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import {
  BRZA_IGRA,
  jeJavnaKombinacijaAktivna,
  jePoznatiPravilnik,
  type ModPartije,
  type PravilnikPartije,
  ZADANI_PRAVILNIK,
} from 'zajednicko';
import { putanjaBrzeIgre } from '$lib/igraj-rute.js';

/**
 * Stari /red linkovi → kanonska Brza igra prije mounta, da onMount uvijek spoji red.
 */
export const load: PageLoad = ({ url }) => {
  const queryMod = url.searchParams.get('mod');
  const queryPravila = url.searchParams.get('pravila');
  const kanonski = queryMod === BRZA_IGRA.mod && queryPravila === BRZA_IGRA.pravila;
  if (kanonski) {
    return { obavijestLegacy: url.searchParams.get('obavijest') === 'legacy' };
  }

  const trazeniMod: ModPartije =
    queryMod === 'dva_igraca' || queryMod === 'tri_igraca' || queryMod === 'cetiri_igraca'
      ? queryMod
      : BRZA_IGRA.mod;
  const trazenaPravila: PravilnikPartije = jePoznatiPravilnik(queryPravila)
    ? queryPravila
    : queryPravila == null && queryMod == null
      ? BRZA_IGRA.pravila
      : ZADANI_PRAVILNIK;

  const legacy = !jeJavnaKombinacijaAktivna(trazeniMod, trazenaPravila);
  throw redirect(302, `${putanjaBrzeIgre()}${legacy ? '&obavijest=legacy' : ''}`);
};
