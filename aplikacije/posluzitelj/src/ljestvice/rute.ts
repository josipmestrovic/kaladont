import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  METRIKE_LJESTVICA,
  minimumIgaraZaRazdoblje,
  PRIKAZI_LJESTVICA,
  prozorOkoMjesta,
  RAZDOBLJA_LJESTVICA,
  VELICINA_PRIKAZA_LJESTVICE,
  type OdgovorLjestvice,
  type PozicijaNaLjestvici,
  type RazdobljeLjestvice,
  type RedakLjestvice,
} from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { pokusajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { dohvatiPoredak, obuhvatiRazdoblja, pozicijaIgraca, type Poredak } from './servis.js';

const ShemaUpitaLjestvice = z.object({
  mod: z.enum(['cetiri_igraca', 'dva_igraca']).default('cetiri_igraca'),
  metrika: z.enum(METRIKE_LJESTVICA).default('prosjek_bodova'),
  razdoblje: z.enum(RAZDOBLJA_LJESTVICA).default('dnevno'),
  prikaz: z.enum(PRIKAZI_LJESTVICA).default('top'),
});

export async function registrirajLjestviceRute(app: FastifyInstance): Promise<void> {
  app.get('/ljestvice', { preHandler: pokusajIdentifikaciju }, async (zahtjev, odgovor) => {
    const upit = ShemaUpitaLjestvice.safeParse(zahtjev.query);
    if (!upit.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni parametri ljestvice.' });
    }
    const { mod, metrika, razdoblje, prikaz } = upit.data;
    const mojId = (zahtjev as ZahtjevSIgracem).igrac?.id ?? null;
    const sada = new Date();
    const obuhvati = obuhvatiRazdoblja(sada, new Date(konfiguracija.LJESTVICE_POCETAK));

    const poretci = new Map<RazdobljeLjestvice, Poredak>();
    await Promise.all(RAZDOBLJA_LJESTVICA.map(async (vrsta) => {
      const obuhvat = obuhvati[vrsta];
      if (obuhvat.zakljucano) return;
      poretci.set(vrsta, await dohvatiPoredak(mod, metrika, vrsta, obuhvat.od, obuhvat.doUpita, sada));
    }));

    const pozicijePoRazdobljima = Object.fromEntries(RAZDOBLJA_LJESTVICA.map((vrsta) => {
      const poredak = poretci.get(vrsta);
      const pozicija: PozicijaNaLjestvici = poredak
        ? pozicijaIgraca(poredak, mojId)
        : { status: 'zakljucano', mjesto: null, odigraneIgre: null, minimumIgara: minimumIgaraZaRazdoblje(vrsta), nedostajeIgara: null };
      return [vrsta, pozicija];
    })) as Record<RazdobljeLjestvice, PozicijaNaLjestvici>;

    const odabrani = obuhvati[razdoblje];
    const poredak = poretci.get(razdoblje);
    const mojaPozicija = pozicijePoRazdobljima[razdoblje];
    let redci: RedakLjestvice[] = [];
    if (poredak) {
      const prozor = prikaz === 'oko_mene' && mojaPozicija.mjesto !== null
        ? prozorOkoMjesta(mojaPozicija.mjesto, poredak.rangirani.length)
        : { od: 1, do: VELICINA_PRIKAZA_LJESTVICE };
      redci = poredak.rangirani.slice(prozor.od - 1, prozor.do).map((stavka) => ({
        mjesto: stavka.mjesto!,
        igracId: stavka.igracId,
        nadimak: stavka.nadimak,
        jeJavanProfil: stavka.jeJavanProfil,
        jeJa: stavka.igracId === mojId,
        odigraneIgre: stavka.odigraneIgre,
        vrijednost: stavka.vrijednost,
      }));
    }

    const tijelo: OdgovorLjestvice = {
      ok: true,
      mod,
      metrika,
      prikaz,
      razdoblje: {
        vrsta: razdoblje,
        od: odabrani.od.toISOString(),
        do: odabrani.do?.toISOString() ?? null,
        podaciOd: new Date(konfiguracija.LJESTVICE_POCETAK).toISOString(),
        stanje: odabrani.zakljucano ? 'zakljucano' : 'aktivno',
        otkljucavaSe: odabrani.otkljucavaSe?.toISOString() ?? null,
      },
      minimumIgara: minimumIgaraZaRazdoblje(razdoblje),
      redci,
      mojaPozicija,
      pozicijePoRazdobljima,
      svihVremenaOtkljucavaSe: obuhvati.svih_vremena.otkljucavaSe!.toISOString(),
      izracunatoU: sada.toISOString(),
    };
    void odgovor.header('cache-control', 'private, no-store');
    return tijelo;
  });
}
