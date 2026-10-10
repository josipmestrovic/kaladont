import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { KrajPartije, PocetakPartije, PrihvacenPotez, RundaOtvorena } from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';

let posluzitelj: Posluzitelj;
let adresa: string;

beforeAll(async () => {
  posluzitelj = await izgradiPosluzitelj({ socketOgranicenja: { handshakePoIpMinuti: 1_000 }, postavkeMotora: { timerOnemogucen: false, trajanjePotezaMs: 50 } });
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
});

afterAll(async () => {
  await posluzitelj.zaustavi();
});

const TABLICE_NAPRETKA = [
  'partije', 'sudionici_partije', 'potezi', 'obracuni_partija', 'rezultati_forme_igraca', 'nizovi_pobjeda_igraca',
  'otkljucane_grupe_igraca', 'otkljucane_rijeci_igraca', 'napredak_dostignuca_igraca', 'dostignuca_igraca',
  'dnk_statistike_igraca', 'statistike_rijeci_igraca',
] as const;

async function snimkaNapretka(): Promise<Record<string, unknown>> {
  const snimka: Record<string, unknown> = {};
  for (const tablica of TABLICE_NAPRETKA) {
    const [redak] = await baza.execute<{ broj: string }>(sql.raw(`select count(*)::text as broj from ${tablica}`));
    snimka[tablica] = redak?.broj;
  }
  const [agregati] = await baza.execute<{ zbroj: string }>(sql`select coalesce(sum(odigrane + odigrane_1v1 + bodovi_ukupno + iskustvo_ukupno), 0)::text as zbroj from igraci`);
  snimka.igraciAgregati = agregati?.zbroj;
  return snimka;
}

function spoji(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function cekaj<T>(socket: ClientSocket, dogadaj: string, filter: (p: T) => boolean = () => true, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Nema događaja ${dogadaj} unutar ${timeoutMs} ms`)), timeoutMs);
    const slusac = (payload: T) => {
      if (!filter(payload)) return;
      clearTimeout(timer);
      socket.off(dogadaj, slusac);
      resolve(payload);
    };
    socket.on(dogadaj, slusac);
  });
}

async function odigrajTreningDoKraja(socket: ClientSocket, zahtijevajPotezBota = false): Promise<{ pocetak: PocetakPartije; kraj: KrajPartije; botIgrao: boolean }> {
  const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
  const rundaPromise = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
  const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
  const brojRijeciPrije = posluzitelj.brojaciBota.odigranihRijeci;
  let mojId: string | null = null;
  let odbijPrviPotez: (greska: unknown) => void = () => undefined;
  const greskaPrvogPoteza = new Promise<never>((_resolve, reject) => { odbijPrviPotez = reject; });
  const naPocetak = (poruka: PocetakPartije) => { mojId = poruka.mojIgracId; };
  const naRundu = (poruka: RundaOtvorena) => {
    if (poruka.naPotezuId !== mojId) return;
    if (!zahtijevajPotezBota || posluzitelj.brojaciBota.odigranihRijeci > brojRijeciPrije) {
      socket.emit('potez:ne-znam', { turnToken: poruka.turnToken });
      return;
    }
    void baza.execute<{ rijec: string }>(sql`
      select kandidat.rijec from rijeci kandidat
      join rijeci pocetna on pocetna.rijec = ${poruka.rijec}
      where kandidat.aktivna and kandidat.prva_dva = ${poruka.trazenaSlova}
        and not (kandidat.grupe && pocetna.grupe)
        and exists (
          select 1 from rijeci nastavak
          where nastavak.aktivna and nastavak.prva_dva = kandidat.zadnja_dva
            and not (nastavak.grupe && (pocetna.grupe || kandidat.grupe))
        )
      order by kandidat.rijec limit 1
    `).then(([kandidat]) => {
      if (!kandidat) throw new Error(`Nema testnog poteza sa slobodnim nastavkom na ${poruka.trazenaSlova}`);
      socket.emit('potez:rijec', { rijec: kandidat.rijec, turnToken: poruka.turnToken });
    }).catch(odbijPrviPotez);
  };
  const naPotez = (poruka: PrihvacenPotez) => {
    if (poruka.sljedeciId === mojId && poruka.istekPotezaIso !== undefined) socket.emit('potez:ne-znam', { turnToken: poruka.turnToken });
  };
  socket.on('partija:pocetak', naPocetak);
  socket.on('partija:runda-otvorena', naRundu);
  socket.on('potez:prihvacen', naPotez);
  try {
    const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => socket.emit('trening:zapocni', resolve));
    expect(potvrda.pokrenut).toBe(true);
    const pocetak = await pocetakPromise;
    expect((await rundaPromise).istekPotezaIso).toBe('');
    const kraj = await Promise.race([krajPromise, greskaPrvogPoteza]);
    return { pocetak, kraj, botIgrao: posluzitelj.brojaciBota.odigranihRijeci > brojRijeciPrije };
  } finally {
    socket.off('partija:pocetak', naPocetak);
    socket.off('partija:runda-otvorena', naRundu);
    socket.off('potez:prihvacen', naPotez);
  }
}

describe('Zagrijavanje', () => {
  it('gost igra protiv Računala, dobiva kraj bez napretka i baza ostaje netaknuta', async () => {
    const prije = await snimkaNapretka();
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const { pocetak, kraj } = await odigrajTreningDoKraja(socket);
      expect(pocetak.kontekst).toBe('trening');
      expect(pocetak.mod).toBe('dva_igraca');
      expect(pocetak.sjedala).toHaveLength(2);
      expect(pocetak.sjedala.some((s) => s.nadimak === 'Računalo')).toBe(true);
      expect(kraj.kontekst).toBe('trening');
      expect(kraj.mojeIskustvo).toBeNull();
      expect(kraj.novaDostignuca).toEqual([]);
      expect(kraj.mojaForma).toBeUndefined();
      expect(kraj.mojDnk).toBeUndefined();
      expect(kraj.kolekcija).toBeUndefined();
      expect(kraj.plasmani.every((p) => p.bodovi === 0)).toBe(true);
    } finally {
      socket.disconnect();
    }
    // Gost je stvoren pri spajanju; sve tablice igre i napretka moraju biti identične.
    expect(await snimkaNapretka()).toEqual(prije);
  });

  it('Računalo odigra legalnu riječ kad je na potezu i isti igrač može odmah u novi trening', async () => {
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const prvi = await odigrajTreningDoKraja(socket, true);
      expect(prvi.botIgrao).toBe(true);
      const drugi = await odigrajTreningDoKraja(socket, true);
      expect(drugi.botIgrao).toBe(true);
      expect(drugi.pocetak.partijaId).not.toBe(prvi.pocetak.partijaId);
      expect(posluzitelj.brojaciBota.odigranihRijeci).toBeGreaterThan(0);
      expect(posluzitelj.brojaciBota.tehnickeGreske).toBe(0);
    } finally {
      socket.disconnect();
    }
  });

  it('ne pokreće drugi trening dok je prvi aktivan', async () => {
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const prvi = await new Promise<{ pokrenut: boolean }>((resolve) => socket.emit('trening:zapocni', resolve));
      expect(prvi.pokrenut).toBe(true);
      await cekaj(socket, 'partija:runda-otvorena');
      const drugi = await new Promise<{ pokrenut: boolean; kod?: string }>((resolve) => socket.emit('trening:zapocni', resolve));
      expect(drugi).toMatchObject({ pokrenut: false, kod: 'VEC_U_PARTIJI' });
      socket.emit('partija:izadji');
      await cekaj(socket, 'partija:kraj', () => true, 20_000);
    } finally {
      socket.disconnect();
    }
  });
});
