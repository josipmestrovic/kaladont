import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  kanonskiModLjestvice,
  METRIKE_LJESTVICA,
  minimumIgaraZaRazdoblje,
  odaberiSazetakLjestvice,
  PRIKAZI_LJESTVICA,
  prozorOkoMjesta,
  RAZDOBLJA_LJESTVICA,
  VELICINA_PRIKAZA_LJESTVICE,
  type KandidatSazetkaLjestvice,
  type MetrikaLjestvice,
  type OdgovorLjestvice,
  type OdgovorSazetkaLjestvice,
  type PozicijaNaLjestvici,
  type RazdobljeLjestvice,
  type RedakLjestvice,
} from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { pokusajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { odgovorNajopasnijihRijeci } from './najopasnije-rijeci.js';
import { dohvatiPoredak, obuhvatiRazdoblja, pozicijaIgraca, type Poredak, type StavkaPoretka } from './servis.js';

const ShemaUpitaLjestvice = z.object({
  // Stari mod parametri (2p/4p) se kanonski normaliziraju na Troboj — bez tihog miješanja metrika.
  mod: z.enum(['cetiri_igraca', 'dva_igraca', 'tri_igraca']).default('tri_igraca'),
  metrika: z.enum(METRIKE_LJESTVICA).default('prosjek_bodova'),
  razdoblje: z.enum(RAZDOBLJA_LJESTVICA).default('dnevno'),
  prikaz: z.enum(PRIKAZI_LJESTVICA).default('top'),
});

function uRedak(stavka: StavkaPoretka, mojId: string | null): RedakLjestvice {
  return {
    mjesto: stavka.mjesto!,
    igracId: stavka.igracId,
    nadimak: stavka.nadimak,
    jeJavanProfil: stavka.jeJavanProfil,
    jeJa: stavka.igracId === mojId,
    odigraneIgre: stavka.odigraneIgre,
    vrijednost: stavka.vrijednost,
    avatarId: stavka.avatarId,
    avatarConfig: stavka.avatarConfig,
    avatarRevision: stavka.avatarRevision,
  };
}

export async function registrirajLjestviceRute(app: FastifyInstance): Promise<void> {
  app.get('/ljestvice', { preHandler: pokusajIdentifikaciju }, async (zahtjev, odgovor) => {
    const upit = ShemaUpitaLjestvice.safeParse(zahtjev.query);
    if (!upit.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni parametri ljestvice.' });
    }
    const metrika = upit.data.metrika;
    const razdoblje = upit.data.razdoblje;
    const prikaz = upit.data.prikaz;
    const mod = kanonskiModLjestvice(upit.data.mod);
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
    let mojRedak: RedakLjestvice | null = null;
    if (poredak) {
      const prozor = prikaz === 'oko_mene' && mojaPozicija.mjesto !== null
        ? prozorOkoMjesta(mojaPozicija.mjesto, poredak.rangirani.length)
        : { od: 1, do: VELICINA_PRIKAZA_LJESTVICE };
      redci = poredak.rangirani.slice(prozor.od - 1, prozor.do).map((stavka) => uRedak(stavka, mojId));
      if (mojId && mojaPozicija.status === 'rangiran' && mojaPozicija.mjesto !== null) {
        const vlastita = poredak.poIgracu.get(mojId);
        if (vlastita?.mjesto !== null && vlastita?.mjesto !== undefined) {
          mojRedak = uRedak(vlastita, mojId);
        }
      }
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
      mojRedak,
      mojaPozicija,
      pozicijePoRazdobljima,
      svihVremenaOtkljucavaSe: obuhvati.svih_vremena.otkljucavaSe!.toISOString(),
      izracunatoU: sada.toISOString(),
    };
    void odgovor.header('cache-control', 'private, no-store');
    return tijelo;
  });

  app.get('/ljestvice/sazetak', { preHandler: pokusajIdentifikaciju }, async (zahtjev, odgovor) => {
    const mojId = (zahtjev as ZahtjevSIgracem).igrac?.id ?? null;
    const sada = new Date();
    const izracunatoU = sada.toISOString();
    if (!mojId) {
      const tijelo: OdgovorSazetkaLjestvice = { ok: true, status: { vrsta: 'neutralan' }, izracunatoU };
      void odgovor.header('cache-control', 'private, no-store');
      return tijelo;
    }

    const mod = kanonskiModLjestvice('tri_igraca');
    const obuhvati = obuhvatiRazdoblja(sada, new Date(konfiguracija.LJESTVICE_POCETAK));
    const kandidati: KandidatSazetkaLjestvice[] = [];

    await Promise.all(
      METRIKE_LJESTVICA.flatMap((metrika: MetrikaLjestvice) =>
        RAZDOBLJA_LJESTVICA.map(async (razdoblje) => {
          const obuhvat = obuhvati[razdoblje];
          if (obuhvat.zakljucano) return;
          const poredak = await dohvatiPoredak(mod, metrika, razdoblje, obuhvat.od, obuhvat.doUpita, sada);
          kandidati.push({ metrika, razdoblje, pozicija: pozicijaIgraca(poredak, mojId) });
        }),
      ),
    );

    const tijelo: OdgovorSazetkaLjestvice = {
      ok: true,
      status: odaberiSazetakLjestvice(kandidati),
      izracunatoU,
    };
    void odgovor.header('cache-control', 'private, no-store');
    return tijelo;
  });

  app.get('/rijeci/najopasnije', async (zahtjev, odgovor) => {
    const limitSirovi = Number((zahtjev.query as { limit?: string }).limit ?? 10);
    const limit = limitSirovi === 100 ? 100 : 10;
    const tijelo = await odgovorNajopasnijihRijeci(limit);
    void odgovor.header('cache-control', 'public, max-age=15');
    return tijelo;
  });
}
