import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { RIJECI_KALADONT, type KrajPartije, type PocetakPartije, type PrihvacenPotez, type PravilnikPartije, type RundaOtvorena } from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, igraci, otkljucaneGrupeIgraca, pobjedeTreninga } from '../src/baza/shema.js';
import { izdajSesiju } from '../src/racuni/sesije.js';
import { zabiljeziPobjeduTreninga } from '../src/trening/upis-napretka.js';
import { PRIHVAT_UVJETA_ZA_TEST } from './pomocnici/uvjeti.js';

let posluzitelj: Posluzitelj;
let adresa: string;
const igraciZaBrisanje: string[] = [];

beforeAll(async () => {
  posluzitelj = await izgradiPosluzitelj({ socketOgranicenja: { handshakePoIpMinuti: 1_000 }, postavkeMotora: { timerOnemogucen: false, trajanjePotezaMs: 50 } });
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
});

afterAll(async () => {
  await posluzitelj.zaustavi();
  for (const igracId of igraciZaBrisanje) {
    await baza.delete(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  }
});

const TABLICE_NAPRETKA = [
  'partije', 'sudionici_partije', 'potezi', 'obracuni_partija', 'rezultati_forme_igraca', 'nizovi_pobjeda_igraca',
  'otkljucane_grupe_igraca', 'otkljucane_rijeci_igraca', 'napredak_dostignuca_igraca', 'dostignuca_igraca',
  'trening_rijeci_igraca', 'pobjede_treninga',
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

async function odigrajTreningDoKraja(
  socket: ClientSocket,
  zahtijevajPotezBota = false,
  pravila?: PravilnikPartije,
): Promise<{ pocetak: PocetakPartije; kraj: KrajPartije; botIgrao: boolean }> {
  const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
  const rundaPromise = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
  const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 30_000);
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
    // PR08: stari ulaz = samo callback; novi = { pravila } + callback.
    const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => {
      if (pravila) socket.emit('trening:zapocni', { pravila }, resolve);
      else socket.emit('trening:zapocni', resolve);
    });
    expect(potvrda.pokrenut).toBe(true);
    const pocetak = await pocetakPromise;
    expect((await rundaPromise).istekPotezaIso).toBeNull();
    const kraj = await Promise.race([krajPromise, greskaPrvogPoteza]);
    return { pocetak, kraj, botIgrao: posluzitelj.brojaciBota.odigranihRijeci > brojRijeciPrije };
  } finally {
    socket.off('partija:pocetak', naPocetak);
    socket.off('partija:runda-otvorena', naRundu);
    socket.off('potez:prihvacen', naPotez);
  }
}

describe('Zagrijavanje', () => {
  it('registrirani čovjek dobiva kolekciju i XP riječi, a potez se prihvaća bez upisa partije', async () => {
    const igracId = randomUUID();
    igraciZaBrisanje.push(igracId);
    const email = `trening-${igracId}@example.com`;
    const iskustvoPrije = 5_000;
    await baza.insert(igraci).values({
      id: igracId,
      vrsta: 'registriran',
      nadimak: `Tr${igracId.slice(0, 6)}`,
      email,
      emailPotvrdjen: true,
      iskustvoUkupno: iskustvoPrije,
      ...PRIHVAT_UVJETA_ZA_TEST,
    });
    const sesija = await izdajSesiju(igracId);
    const socket = await spoji(sesija.token);
    let odigraoRijec = false;
    let mojId = '';
    const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
    const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
    const naPocetak = (pocetak: PocetakPartije) => { mojId = pocetak.mojIgracId; };
    const naRunda = (runda: RundaOtvorena) => {
      if (runda.naPotezuId === igracId && odigraoRijec) socket.emit('potez:ne-znam', { turnToken: runda.turnToken });
    };
    const naPrihvacen = (potez: PrihvacenPotez) => {
      if (potez.sljedeciId === igracId && odigraoRijec) socket.emit('potez:ne-znam', { turnToken: potez.turnToken });
    };
    socket.on('partija:pocetak', naPocetak);
    socket.on('partija:runda-otvorena', naRunda);
    socket.on('potez:prihvacen', naPrihvacen);

    async function pronadjiValjanPotez(prefiks: string, zadnjaRijec: string): Promise<string | null> {
      const [kandidat] = await baza.execute<{ rijec: string }>(sql`
        select kandidat.rijec from rijeci kandidat
        left join rijeci pocetna on pocetna.rijec = ${zadnjaRijec}
        where kandidat.aktivna and kandidat.prva_dva = ${prefiks}
          and kandidat.zadnja_dva <> 'ka'
          and kandidat.rijec <> ${zadnjaRijec}
          and (pocetna.rijec is null or not (kandidat.grupe && pocetna.grupe))
        order by kandidat.rijec limit 1
      `);
      return kandidat?.rijec ?? null;
    }

    // Preskoči kaladont / mrtva-slova prijelaze (prihvaćen stiže prije eliminacije/nove runde).
    function cekajIgrivPotez(): Promise<{ rijec: string; trazenaSlova: string; turnToken: string; kandidat: string }> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Nema igrivog trening poteza unutar 15000 ms')), 15_000);
        const pokusaj = (rijec: string, trazenaSlova: string, turnToken: string) => {
          if (RIJECI_KALADONT.has(rijec)) return;
          void pronadjiValjanPotez(trazenaSlova, rijec).then((kandidat) => {
            if (!kandidat) return;
            clearTimeout(timer);
            socket.off('partija:runda-otvorena', naOtvorenu);
            socket.off('potez:prihvacen', naPotez);
            resolve({ rijec, trazenaSlova, turnToken, kandidat });
          }).catch(reject);
        };
        const naOtvorenu = (runda: RundaOtvorena) => {
          if (runda.naPotezuId === igracId) pokusaj(runda.rijec, runda.trazenaSlova, runda.turnToken);
        };
        const naPotez = (potez: PrihvacenPotez) => {
          if (potez.sljedeciId === igracId) pokusaj(potez.rijec, potez.trazenaSlova, potez.turnToken);
        };
        socket.on('partija:runda-otvorena', naOtvorenu);
        socket.on('potez:prihvacen', naPotez);
      });
    }

    try {
      // Slušaj igrivi potez prije započinjanja — inače se propusti prva runda kad čovjek ide prvi.
      const igrivPotezPromise = cekajIgrivPotez();
      expect((await new Promise<{ pokrenut: boolean }>((resolve) => socket.emit('trening:zapocni', resolve))).pokrenut).toBe(true);
      const pocetak = await pocetakPromise;
      const runda = await igrivPotezPromise;
      expect(mojId).toBe(igracId);
      const prihvacenPromise = cekaj<PrihvacenPotez>(socket, 'potez:prihvacen', (potez) => potez.igracId === igracId);
      socket.emit('potez:rijec', { rijec: runda.kandidat, turnToken: runda.turnToken });
      const prihvacen = await prihvacenPromise;
      odigraoRijec = true;
      expect(prihvacen.rijec).toBe(runda.kandidat);
      const [oblik] = await baza.execute<{ rijec: string }>(sql`select rijec from trening_rijeci_igraca where igrac_id = ${igracId} and rijec = ${runda.kandidat}`);
      expect(oblik).toBeUndefined();
      const grupePrijeKraja = await baza.select({ grupa: otkljucaneGrupeIgraca.grupa }).from(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId));
      expect(grupePrijeKraja).toHaveLength(0);
      const kraj = await krajPromise;
      expect(kraj.kontekst).toBe('trening');
      expect(kraj.kolekcija).toBeDefined();
      expect(kraj.mojeIskustvo).not.toBeNull();
      expect(kraj.mojeIskustvo!.prije.ukupno).toBe(iskustvoPrije);
      expect(kraj.mojeIskustvo!.osvojenoIskustvo).toBeGreaterThan(0);
      expect(kraj.mojeIskustvo!.osvojenoIskustvo).toBeLessThan(iskustvoPrije);
      expect(kraj.mojaForma).toBeUndefined();
      expect(kraj.mojRang).toBeNull();
      if (kraj.ukupnoIskustvo) {
        expect(kraj.ukupnoIskustvo.prije.ukupno).toBe(iskustvoPrije);
        expect(kraj.ukupnoIskustvo.partijskiXpStvarno).toBe(kraj.mojeIskustvo!.osvojenoIskustvo);
        expect(kraj.ukupnoIskustvo.partijskiXpStvarno).toBeLessThan(iskustvoPrije);
      }
      const [partija] = await baza.execute<{ broj: number }>(sql`select count(*)::int as broj from partije where id = ${pocetak.partijaId}`);
      expect(partija?.broj).toBe(0);
      const grupe = await baza.select({ grupa: otkljucaneGrupeIgraca.grupa }).from(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId));
      expect(grupe.length).toBeGreaterThan(0);
      const [igrac] = await baza.select({ iskustvo: igraci.iskustvoUkupno, odigrane: igraci.odigrane }).from(igraci).where(eq(igraci.id, igracId));
      // Trening zbraja XP riječi (prije misije), ali ne odigrane/rang/formu.
      expect(igrac?.odigrane).toBe(0);
      expect(igrac?.iskustvo).toBeGreaterThan(iskustvoPrije);
      expect(igrac?.iskustvo).toBe(
        kraj.ukupnoIskustvo?.poslije.ukupno
          ?? kraj.mojeIskustvo!.poslije.ukupno,
      );
    } finally {
      socket.off('partija:pocetak', naPocetak);
      socket.off('partija:runda-otvorena', naRunda);
      socket.off('potez:prihvacen', naPrihvacen);
      socket.disconnect();
    }
  });

  it('Zagrijan se otključava na 1/5/20/50/100 pobjeda i ponovljeni trening ne broji dvaput', async () => {
    const igracId = randomUUID();
    igraciZaBrisanje.push(igracId);
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: `Pob${igracId.slice(0, 6)}`, email: `pobjede-${igracId}@example.com`, emailPotvrdjen: true, ...PRIHVAT_UVJETA_ZA_TEST });
    const ids: string[] = [];
    for (let broj = 1; broj <= 100; broj += 1) {
      const treningId = randomUUID();
      ids.push(treningId);
      const pobjeda = await zabiljeziPobjeduTreninga(treningId, igracId);
      expect(pobjeda?.pobjede).toBe(broj);
      if ([1, 5, 20, 50, 100].includes(broj)) expect(pobjeda?.novaRazina).toBe([1, 5, 20, 50, 100].indexOf(broj) + 1);
      else expect(pobjeda?.novaRazina).toBe(0);
    }
    const ponovljeno = await zabiljeziPobjeduTreninga(ids[0]!, igracId);
    expect(ponovljeno).toMatchObject({ pobjede: 100, novaRazina: 0, maksimalnaRazina: 5 });
    expect(ponovljeno?.ishodMisija).toBeTruthy();
    const [dostignuce] = await baza.select().from(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
    expect(dostignuce).toMatchObject({ dostignuceId: 'zagrijan', razina: 5 });
    expect(await baza.select().from(pobjedeTreninga).where(eq(pobjedeTreninga.igracId, igracId))).toHaveLength(100);
  });

  it('gost igra protiv Iskusnog (zadani profil) bez riječi: bez XP/ranga/forme', async () => {
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const { pocetak, kraj } = await odigrajTreningDoKraja(socket);
      expect(pocetak.kontekst).toBe('trening');
      expect(pocetak.mod).toBe('dva_igraca');
      expect(pocetak.sjedala).toHaveLength(2);
      expect(pocetak.sjedala.some((s) => s.nadimak === 'BOTANIČAR')).toBe(true);
      expect(kraj.kontekst).toBe('trening');
      // Default odigrajTreningDoKraja samo „ne znam” → nema osvojenog XP.
      expect(kraj.mojeIskustvo).toBeNull();
      expect(kraj.mojaForma).toBeUndefined();
      expect(kraj.mojDnk).toBeUndefined();
      expect(kraj.mojRang).toBeNull();
      expect(kraj.plasmani.every((p) => p.bodovi === 0)).toBe(true);
    } finally {
      socket.disconnect();
    }
  });

  it('bot odigra legalnu riječ kad je na potezu i isti igrač može odmah u novi trening', async () => {
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
      const prvaRunda = cekaj(socket, 'partija:runda-otvorena');
      const prvi = await new Promise<{ pokrenut: boolean }>((resolve) => socket.emit('trening:zapocni', resolve));
      expect(prvi.pokrenut).toBe(true);
      await prvaRunda;
      const drugi = await new Promise<{ pokrenut: boolean; kod?: string }>((resolve) => socket.emit('trening:zapocni', resolve));
      expect(drugi).toMatchObject({ pokrenut: false, kod: 'VEC_U_PARTIJI' });
      socket.emit('partija:izadji');
      await cekaj(socket, 'partija:kraj', () => true, 20_000);
    } finally {
      socket.disconnect();
    }
  });

  // PR08 — tri ulaza (klasični Troboj-trening / KA-ZNA / Dokaži) + izolacija javnih agregata.
  it('PR08 klasični trening: tri_igraca, Iskusni 1/2 i različiti avatari', async () => {
    const prije = await snimkaNapretka();
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
      const rundaPromise = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
      const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => {
        socket.emit('trening:zapocni', { pravila: 'klasicni' }, resolve);
      });
      expect(potvrda.pokrenut).toBe(true);
      const pocetak = await pocetakPromise;
      const runda = await rundaPromise;
      expect(runda.naPotezuId).toBe(pocetak.mojIgracId);
      expect(runda.istekPotezaIso).toBeNull();
      expect(pocetak.mod).toBe('tri_igraca');
      expect(pocetak.pravila).toBe('klasicni');
      expect(pocetak.kontekst).toBe('trening');
      expect(pocetak.sjedala).toHaveLength(3);
      const racunala = pocetak.sjedala.filter((s) => s.jeBot);
      expect(racunala).toHaveLength(2);
      expect(racunala.map((s) => s.nadimak).sort()).toEqual(['BOTANIČAR', 'BOTOGRAF']);
      const avatari = new Set(racunala.map((s) => JSON.stringify(s.avatarConfig)));
      expect(avatari.size).toBe(2);
      // #108: ispadanje jedinog čovjeka odmah završava Zagrijavanje (bez bot-vs-bot).
      const kraj = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 5_000);
      socket.emit('partija:izadji');
      await kraj;
    } finally {
      socket.disconnect();
    }
    expect(await snimkaNapretka()).toEqual(prije);
  });

  it('PR08 ka_zna i dokazi_nastavak trening ostaju Dvoboj s jednim Iskusnim', async () => {
    for (const pravila of ['ka_zna', 'dokazi_nastavak'] as const) {
      const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
      try {
        const { pocetak } = await odigrajTreningDoKraja(socket, false, pravila);
        expect(pocetak.mod).toBe('dva_igraca');
        expect(pocetak.pravila).toBe(pravila);
        expect(pocetak.sjedala).toHaveLength(2);
        expect(pocetak.sjedala.filter((s) => s.jeBot)).toHaveLength(1);
        expect(pocetak.sjedala.some((s) => s.nadimak === 'BOTANIČAR')).toBe(true);
      } finally {
        socket.disconnect();
      }
    }
  }, 60_000);

  it('PR02 eksplicitni profil Majstor i stari klijent bez profileId → Iskusni', async () => {
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
      const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => {
        socket.emit('trening:zapocni', { pravila: 'ka_zna', brojRacunala: 1, profileId: 'majstor' }, resolve);
      });
      expect(potvrda.pokrenut).toBe(true);
      const pocetak = await pocetakPromise;
      expect(pocetak.sjedala.some((s) => s.nadimak === 'BOTOKRAT')).toBe(true);
      const konfig = posluzitelj.dohvatiKonfiguracijuBotaPartije(pocetak.partijaId);
      expect(konfig?.vjerojatnostTaktickogPoteza).toBe(0.5);
      socket.emit('partija:izadji');
      await cekaj(socket, 'partija:kraj', () => true, 10_000);
    } finally {
      socket.disconnect();
    }
  });

  it('PR08 stari ulaz bez payload-a ostaje ka_zna Dvoboj', async () => {
    const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
    try {
      const { pocetak } = await odigrajTreningDoKraja(socket);
      expect(pocetak.mod).toBe('dva_igraca');
      expect(pocetak.pravila ?? 'ka_zna').toBe('ka_zna');
      expect(pocetak.sjedala).toHaveLength(2);
    } finally {
      socket.disconnect();
    }
  });

  it('PR08 izlazak čovjeka ne upisuje pobjedu treninga', async () => {
    const igracId = randomUUID();
    igraciZaBrisanje.push(igracId);
    await baza.insert(igraci).values({
      id: igracId,
      vrsta: 'registriran',
      nadimak: `Iz${igracId.slice(0, 6)}`,
      email: `izlaz-${igracId}@example.com`,
      emailPotvrdjen: true,
      ...PRIHVAT_UVJETA_ZA_TEST,
    });
    const sesija = await izdajSesiju(igracId);
    const socket = await spoji(sesija.token);
    const prije = await baza.select().from(pobjedeTreninga).where(eq(pobjedeTreninga.igracId, igracId));
    try {
      const runda = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
      const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => {
        socket.emit('trening:zapocni', { pravila: 'ka_zna' }, resolve);
      });
      expect(potvrda.pokrenut).toBe(true);
      await runda;
      const kraj = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
      socket.emit('partija:izadji');
      await kraj;
      const poslije = await baza.select().from(pobjedeTreninga).where(eq(pobjedeTreninga.igracId, igracId));
      expect(poslije).toHaveLength(prije.length);
    } finally {
      socket.disconnect();
    }
  });

  it('#108 Troboj/Četveroboj trening: izlazak čovjeka odmah šalje partija:kraj', async () => {
    for (const brojRacunala of [2, 3] as const) {
      const socket = await spoji(`gost.${randomUUID().replaceAll('-', '')}`);
      try {
        const runda = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
        const potvrda = await new Promise<{ pokrenut: boolean }>((resolve) => {
          socket.emit('trening:zapocni', { pravila: 'klasicni', brojRacunala }, resolve);
        });
        expect(potvrda.pokrenut).toBe(true);
        await runda;
        const kraj = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 5_000);
        socket.emit('partija:izadji');
        const krajPoruka = await kraj;
        expect(krajPoruka.plasmani.some((p) => p.jeBot !== true)).toBe(true);
      } finally {
        socket.disconnect();
      }
    }
  });

  it('PR08 zabiljeziPobjeduTreninga prihvaća tri_igraca bez bacanja', async () => {
    const igracId = randomUUID();
    igraciZaBrisanje.push(igracId);
    await baza.insert(igraci).values({
      id: igracId,
      vrsta: 'registriran',
      nadimak: `T3${igracId.slice(0, 6)}`,
      email: `troboj-trening-${igracId}@example.com`,
      emailPotvrdjen: true,
      ...PRIHVAT_UVJETA_ZA_TEST,
    });
    const treningId = randomUUID();
    const pobjeda = await zabiljeziPobjeduTreninga(treningId, igracId, new Date(), {
      mod: 'tri_igraca',
      plasman: 1,
      nacinIspadanja: 'pobjednik',
      prihvaceneRijeci: 1,
      najduziNiz: 1,
    });
    expect(pobjeda?.pobjede).toBe(1);
    expect(pobjeda?.novaRazina).toBe(1);
  });
});
