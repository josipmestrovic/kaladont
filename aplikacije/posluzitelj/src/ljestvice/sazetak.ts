/**
 * Izgradnja sažetka ljestvice bez HTTP sloja — dijeli `/ljestvice/sazetak` i `/naslovnica/sazetak`.
 */
import {
  METRIKE_NAPRETKA_LJESTVICA,
  METRIKE_VREMENSKE_LJESTVICA,
  RAZDOBLJA_LJESTVICA,
  kanonskiModLjestvice,
  odaberiSazetakLjestvice,
  type KandidatSazetkaLjestvice,
  type OdgovorSazetkaLjestvice,
} from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { dohvatiPoredakNapretka, pozicijaNapretka } from './servis-napredak.js';
import { dohvatiPoredak, obuhvatiRazdoblja, pozicijaIgraca } from './servis.js';

export async function izgradiOdgovorSazetkaLjestvice(
  igracId: string | null,
  sada = new Date(),
): Promise<OdgovorSazetkaLjestvice> {
  const izracunatoU = sada.toISOString();
  if (!igracId) {
    return { ok: true, status: { vrsta: 'neutralan' }, izracunatoU };
  }

  const mod = kanonskiModLjestvice('tri_igraca');
  const obuhvati = obuhvatiRazdoblja(sada, new Date(konfiguracija.LJESTVICE_POCETAK));
  const kandidati: KandidatSazetkaLjestvice[] = [];

  await Promise.all([
    ...METRIKE_VREMENSKE_LJESTVICA.flatMap((metrika) =>
      RAZDOBLJA_LJESTVICA.map(async (razdoblje) => {
        const obuhvat = obuhvati[razdoblje];
        if (obuhvat.zakljucano) return;
        const poredak = await dohvatiPoredak(mod, metrika, razdoblje, obuhvat.od, obuhvat.doUpita, sada);
        kandidati.push({ metrika, razdoblje, pozicija: pozicijaIgraca(poredak, igracId) });
      }),
    ),
    ...METRIKE_NAPRETKA_LJESTVICA.map(async (metrika) => {
      const poredak = await dohvatiPoredakNapretka(metrika, sada);
      kandidati.push({ metrika, razdoblje: null, pozicija: pozicijaNapretka(poredak, igracId) });
    }),
  ]);

  return {
    ok: true,
    status: odaberiSazetakLjestvice(kandidati),
    izracunatoU,
  };
}
