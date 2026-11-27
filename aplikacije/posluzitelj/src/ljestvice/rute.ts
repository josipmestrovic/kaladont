import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  jeNapredakMetrika,
  kanonskiModLjestvice,
  METRIKE_LJESTVICA,
  minimumIgaraZaRazdoblje,
  minimumPrihvacenihPotezaZaRazdoblje,
  PRIKAZI_LJESTVICA,
  prozorOkoMjesta,
  RAZDOBLJA_LJESTVICA,
  VELICINA_PRIKAZA_LJESTVICE,
  type MetrikaLjestvice,
  type MetrikaNapretkaLjestvice,
  type MetrikaVremenskaLjestvice,
  type OdgovorLjestvice,
  type PozicijaNaLjestvici,
  type RazdobljeLjestvice,
  type RedakLjestvice,
} from 'zajednicko';
import { konfiguracija } from '../konfiguracija.js';
import { pokusajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { odgovorNajopasnijihRijeci } from './najopasnije-rijeci.js';
import { izgradiOdgovorSazetkaLjestvice } from './sazetak.js';
import { dohvatiPoredak, obuhvatiRazdoblja, pozicijaIgraca, type Poredak, type StavkaPoretka } from './servis.js';
import { dohvatiPoredakNapretka, pozicijaNapretka } from './servis-napredak.js';

const ShemaUpitaLjestvice = z.object({
  // Stari mod parametri (2p/4p) se kanonski normaliziraju na Troboj — bez tihog miješanja metrika.
  mod: z.enum(['cetiri_igraca', 'dva_igraca', 'tri_igraca']).default('tri_igraca'),
  metrika: z.enum(METRIKE_LJESTVICA).default('prosjek_bodova'),
  razdoblje: z.enum(RAZDOBLJA_LJESTVICA).optional(),
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

function izreziPrikaz(
  poredak: Poredak,
  prikaz: 'top' | 'oko_mene',
  mojaPozicija: PozicijaNaLjestvici,
  mojId: string | null,
): { redci: RedakLjestvice[]; mojRedak: RedakLjestvice | null } {
  const prozor = prikaz === 'oko_mene' && mojaPozicija.mjesto !== null
    ? prozorOkoMjesta(mojaPozicija.mjesto, poredak.rangirani.length)
    : { od: 1, do: VELICINA_PRIKAZA_LJESTVICE };
  const redci = poredak.rangirani.slice(prozor.od - 1, prozor.do).map((stavka) => uRedak(stavka, mojId));
  let mojRedak: RedakLjestvice | null = null;
  if (mojId && mojaPozicija.status === 'rangiran' && mojaPozicija.mjesto !== null) {
    const vlastita = poredak.poIgracu.get(mojId);
    if (vlastita?.mjesto !== null && vlastita?.mjesto !== undefined) {
      mojRedak = uRedak(vlastita, mojId);
    }
  }
  return { redci, mojRedak };
}

export async function registrirajLjestviceRute(app: FastifyInstance): Promise<void> {
  app.get('/ljestvice', { preHandler: pokusajIdentifikaciju }, async (zahtjev, odgovor) => {
    const upit = ShemaUpitaLjestvice.safeParse(zahtjev.query);
    if (!upit.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni parametri ljestvice.' });
    }
    const metrika = upit.data.metrika as MetrikaLjestvice;
    const prikaz = upit.data.prikaz;
    const mojId = (zahtjev as ZahtjevSIgracem).igrac?.id ?? null;
    const sada = new Date();

    if (jeNapredakMetrika(metrika)) {
      if (upit.data.razdoblje !== undefined) {
        // Kumulativne metrike ne primaju vremenski filter — zanemari ili odbij?
        // Dokument: ne forsirati razdoblje; zanemarujemo radi kompatibilnosti deep linkova.
      }
      const poredak = await dohvatiPoredakNapretka(metrika as MetrikaNapretkaLjestvice, sada);
      const mojaPozicija = pozicijaNapretka(poredak, mojId);
      const { redci, mojRedak } = izreziPrikaz(poredak, prikaz, mojaPozicija, mojId);
      const tijelo: OdgovorLjestvice = {
        ok: true,
        vrstaOdgovora: 'napredak',
        metrika: metrika as MetrikaNapretkaLjestvice,
        prikaz,
        opisObuhvata: 'Ukupni napredak · Svi podržani modovi',
        redci,
        mojRedak,
        mojaPozicija,
        izracunatoU: sada.toISOString(),
      };
      void odgovor.header('cache-control', 'private, no-store');
      return tijelo;
    }

    const razdoblje = upit.data.razdoblje ?? 'dnevno';
    const vremenska = metrika as MetrikaVremenskaLjestvice;
    const mod = kanonskiModLjestvice(upit.data.mod);
    const obuhvati = obuhvatiRazdoblja(sada, new Date(konfiguracija.LJESTVICE_POCETAK));

    const poretci = new Map<RazdobljeLjestvice, Poredak>();
    await Promise.all(RAZDOBLJA_LJESTVICA.map(async (vrsta) => {
      const obuhvat = obuhvati[vrsta];
      if (obuhvat.zakljucano) return;
      poretci.set(vrsta, await dohvatiPoredak(mod, vremenska, vrsta, obuhvat.od, obuhvat.doUpita, sada));
    }));

    const pozicijePoRazdobljima = Object.fromEntries(RAZDOBLJA_LJESTVICA.map((vrsta) => {
      const poredak = poretci.get(vrsta);
      const pozicija: PozicijaNaLjestvici = poredak
        ? pozicijaIgraca(poredak, mojId)
        : {
          status: 'zakljucano',
          mjesto: null,
          odigraneIgre: null,
          minimumIgara: minimumIgaraZaRazdoblje(vrsta),
          nedostajeIgara: null,
          minimumPoteza: vremenska === 'najbrzi_igraci' ? minimumPrihvacenihPotezaZaRazdoblje(vrsta) : null,
          nedostajePoteza: null,
        };
      return [vrsta, pozicija];
    })) as Record<RazdobljeLjestvice, PozicijaNaLjestvici>;

    const odabrani = obuhvati[razdoblje];
    const poredak = poretci.get(razdoblje);
    const mojaPozicija = pozicijePoRazdobljima[razdoblje];
    let redci: RedakLjestvice[] = [];
    let mojRedak: RedakLjestvice | null = null;
    if (poredak) {
      ({ redci, mojRedak } = izreziPrikaz(poredak, prikaz, mojaPozicija, mojId));
    }

    const tijelo: OdgovorLjestvice = {
      ok: true,
      vrstaOdgovora: 'vremenska',
      mod,
      metrika: vremenska,
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
      minimumPoteza: vremenska === 'najbrzi_igraci' ? minimumPrihvacenihPotezaZaRazdoblje(razdoblje) : null,
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
    const tijelo = await izgradiOdgovorSazetkaLjestvice(mojId);
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
