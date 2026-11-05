import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { Eliminacija, KrajPartije, PocetakPartije, PrihvacenPotez, RundaOtvorena, StanjeReda } from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { botovi, igraci, partije, sudioniciPartije } from '../src/baza/shema.js';
import { ucitajIdentiteteBotova } from '../src/bot/fond.js';

let posluzitelj: Posluzitelj;
let adresa: string;
const testniBotovi = Array.from({ length: 3 }, () => randomUUID());
/** Brzi motor za CI: isključen timer, kratki potez i brzo otpuštanje veze da fond ne ostane zaključan. */
const postavkeTestMotora = {
  timerOnemogucen: true,
  trajanjePotezaMs: 2_000,
  odgodaPocetkaPartijeMs: 0,
  tolerancijaPrekidaMs: 200,
  odgodaObradePrekidaMs: 0,
} as const;

beforeAll(async () => {
  await baza.insert(igraci).values(testniBotovi.map((id) => ({
    id, vrsta: 'registriran' as const, upravljac: 'bot' as const,
    nadimak: `Bot${id.slice(0, 6)}`, emailPotvrdjen: true,
  })));
  await baza.insert(botovi).values(testniBotovi.map((igracId) => ({ igracId, kljucSeeda: `test-${igracId}` })));
  posluzitelj = await izgradiPosluzitelj({
    socketOgranicenja: { handshakePoIpMinuti: 1_000 },
    postavkeMotora: postavkeTestMotora,
    popunaBotovima: { dvoboj: true, cetveroboj: true, pragoviMs: { dva_igraca: [1_000], cetiri_igraca: [1_000, 1_500, 2_000] } },
  });
  posluzitelj.fondBotova.postaviIdentitete((await ucitajIdentiteteBotova()).filter((bot) => testniBotovi.includes(bot.igracId)));
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
});

async function cekajOslobodjenFond(timeoutMs = 20_000): Promise<void> {
  if (!posluzitelj) return;
  await expect.poll(() => posluzitelj.fondBotova.stanje().uPartiji, { timeout: timeoutMs }).toBe(0);
  await expect.poll(() => posluzitelj.fondBotova.stanje().slobodni, { timeout: timeoutMs })
    .toBe(posluzitelj.fondBotova.stanje().ukupno);
}

afterEach(async () => {
  await cekajOslobodjenFond();
});

afterAll(async () => {
  await posluzitelj?.zaustavi();
  await baza.delete(botovi).where(inArray(botovi.igracId, testniBotovi));
});

function spoji(): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token: `gost.${randomUUID().replaceAll('-', '')}` }, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function cekaj<T>(socket: ClientSocket, dogadaj: string, filter: (p: T) => boolean = () => true, timeoutMs = 15_000): Promise<T> {
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

/** Red događaja koji hvata emit i prije nego test stigne na await (bot ≤200 ms). */
function napraviRedDogadaja<T>() {
  const spremni: T[] = [];
  const cekanja: Array<{ predikat: (p: T) => boolean; resolve: (p: T) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];

  return {
    push(payload: T) {
      const indeks = cekanja.findIndex((c) => c.predikat(payload));
      if (indeks >= 0) {
        const [cekanje] = cekanja.splice(indeks, 1);
        clearTimeout(cekanje!.timer);
        cekanje!.resolve(payload);
        return;
      }
      spremni.push(payload);
    },
    next(predikat: (p: T) => boolean = () => true, timeoutMs = 15_000, opis = 'događaj'): Promise<T> {
      const indeks = spremni.findIndex(predikat);
      if (indeks >= 0) {
        const [payload] = spremni.splice(indeks, 1);
        return Promise.resolve(payload!);
      }
      return new Promise((resolve, reject) => {
        const unos = {
          predikat,
          resolve,
          reject,
          timer: setTimeout(() => {
            const i = cekanja.indexOf(unos);
            if (i >= 0) cekanja.splice(i, 1);
            reject(new Error(`Nema ${opis} unutar ${timeoutMs} ms`));
          }, timeoutMs),
        };
        cekanja.push(unos);
      });
    },
    ocisti() {
      for (const c of cekanja) clearTimeout(c.timer);
      cekanja.length = 0;
      spremni.length = 0;
    },
  };
}

describe('popuna javnog reda botovima', () => {
  it('izlazak posljednjeg čovjeka prije prve riječi poništava početak bez rezultata', async () => {
    const lokalni = await izgradiPosluzitelj({
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      postavkeMotora: { ...postavkeTestMotora, odgodaPocetkaPartijeMs: 5_000 },
      popunaBotovima: { dvoboj: true, pragoviMs: { dva_igraca: [10] } },
    });
    lokalni.fondBotova.postaviIdentitete((await ucitajIdentiteteBotova()).filter((bot) => testniBotovi.includes(bot.igracId)));
    let socket: ClientSocket | null = null;
    try {
      await lokalni.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = lokalni.app.server.address();
      socket = ioClient(`http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`, { auth: { token: `gost.${randomUUID().replaceAll('-', '')}` }, forceNew: true });
      await new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); });
      let rezultati = 0;
      let eliminacije = 0;
      let otvoreneRunde = 0;
      socket.on('partija:kraj', () => { rezultati += 1; });
      socket.on('partija:eliminacija', () => { eliminacije += 1; });
      socket.on('partija:runda-otvorena', () => { otvoreneRunde += 1; });
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
      socket.emit('red:udji', { mod: 'dva_igraca' });
      const pocetak = await pocetakPromise;
      const ponistena = cekaj<{ partijaId: string }>(socket, 'partija:ponistena');
      socket.emit('partija:izadji');
      expect((await ponistena).partijaId).toBe(pocetak.partijaId);
      await expect.poll(async () => {
        const [redak] = await baza.select({ status: partije.status }).from(partije).where(eq(partije.id, pocetak.partijaId));
        return redak?.status;
      }).toBe('ponistena');
      await expect.poll(() => lokalni.fondBotova.stanje().slobodni).toBe(3);
      expect(rezultati).toBe(0);
      expect(eliminacije).toBe(0);
      expect(otvoreneRunde).toBe(0);
    } finally {
      socket?.disconnect();
      await lokalni.zaustavi();
    }
  }, 30_000);

  it('dvoboj: sam čovjek dobiva bota nakon praga, partija se upisuje s brojem botova i bot se oslobađa', async () => {
    // Zaseban server: dijeljeni beforeAll fond ostaje netaknut (CI je znao isteći na kraj/spremanju
    // dok je isti proces držao i lokalni i dijeljeni poslužitelj s istim bot ID-evima).
    const lokalni = await izgradiPosluzitelj({
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      postavkeMotora: postavkeTestMotora,
      popunaBotovima: { dvoboj: true, pragoviMs: { dva_igraca: [50] } },
    });
    lokalni.fondBotova.postaviIdentitete((await ucitajIdentiteteBotova()).filter((bot) => testniBotovi.includes(bot.igracId)));
    expect(lokalni.fondBotova.stanje().ukupno).toBeGreaterThan(0);
    let socket: ClientSocket | null = null;
    const runde = napraviRedDogadaja<RundaOtvorena>();
    const potezi = napraviRedDogadaja<PrihvacenPotez>();
    const eliminacije = napraviRedDogadaja<Eliminacija>();
    const krajevi = napraviRedDogadaja<KrajPartije>();
    const handleri = {
      runda: (p: RundaOtvorena) => runde.push(p),
      potez: (p: PrihvacenPotez) => potezi.push(p),
      eliminacija: (p: Eliminacija) => eliminacije.push(p),
      kraj: (p: KrajPartije) => krajevi.push(p),
    };
    try {
      await lokalni.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = lokalni.app.server.address();
      socket = ioClient(`http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`, { auth: { token: `gost.${randomUUID().replaceAll('-', '')}` }, forceNew: true });
      await new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); });

      // Buffer prije red:udji — bot može odigrati ≤200 ms prije nego petlja stigne na await.
      socket.on('partija:runda-otvorena', handleri.runda);
      socket.on('potez:prihvacen', handleri.potez);
      socket.on('partija:eliminacija', handleri.eliminacija);
      socket.on('partija:kraj', handleri.kraj);

      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak', () => true, 10_000);
      socket.emit('red:udji', { mod: 'dva_igraca' });
      // U Dvoboju rezervacija i pokretanje padaju u isti trenutak praga; nema zasebne faze prikaza bota.
      const pocetak = await pocetakPromise;
      expect(pocetak.kontekst).toBe('javna');
      expect(pocetak.sjedala).toHaveLength(2);
      const mojId = pocetak.mojIgracId;
      const botSjedalo = pocetak.sjedala.find((s) => s.igracId !== mojId)!;
      expect(botSjedalo.jeGost).toBe(false);

      const krajPromise = krajevi.next(() => true, 30_000, 'partija:kraj');
      const runda = await runde.next(() => true, 10_000, 'partija:runda-otvorena');
      let naPotezu = runda.naPotezuId;
      let turnToken = runda.turnToken;
      let odustao = false;
      for (let korak = 0; korak < 6; korak += 1) {
        if (naPotezu === mojId) {
          socket.emit('potez:ne-znam', { turnToken });
          const ishod = await Promise.race([
            eliminacije.next((e) => e.igracId === mojId, 10_000, 'partija:eliminacija').then(() => 'eliminacija' as const),
            krajPromise.then(() => 'kraj' as const),
          ]);
          odustao = ishod === 'eliminacija' || ishod === 'kraj';
          break;
        }
        const ishod = await Promise.race([
          potezi.next((p) => p.igracId === naPotezu, 5_000, `potez:prihvacen od ${naPotezu}`).then((p) => ({ vrsta: 'potez' as const, p })),
          krajPromise.then(() => ({ vrsta: 'kraj' as const })),
        ]);
        if (ishod.vrsta === 'kraj') {
          odustao = true;
          break;
        }
        naPotezu = ishod.p.sljedeciId;
        turnToken = ishod.p.turnToken;
      }
      if (!odustao) {
        throw new Error('Dvoboj petlja nije eliminirala čovjeka ni primila partija:kraj.');
      }
      const kraj = await krajPromise;
      expect(kraj.kontekst).toBe('javna');
      // Isti javni obračun kao bez bota: čovjek ima XP obračun i plasman.
      expect(kraj.mojeIskustvo).not.toBeNull();
      expect(kraj.plasmani).toHaveLength(2);

      const [partija] = await baza.select().from(partije).where(eq(partije.id, kraj.partijaId));
      expect(partija?.brojBotova).toBe(1);
      expect(partija?.status).toBe('zavrsena');
      const sudionici = await baza.select().from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, kraj.partijaId));
      expect(sudionici).toHaveLength(2);
      expect(sudionici.find((s) => s.igracId === botSjedalo.igracId)?.cekanjeMs).toBe(0);

      // Nakon kraja osvjeziProfile privremeno stavlja bota u neaktualni — čekaj puni fond, ne samo uPartiji===0.
      await expect.poll(() => {
        const stanje = lokalni.fondBotova.stanje();
        return stanje.uPartiji === 0 && stanje.slobodni === stanje.ukupno;
      }, { timeout: 10_000 }).toBe(true);
    } finally {
      if (socket) {
        socket.off('partija:runda-otvorena', handleri.runda);
        socket.off('potez:prihvacen', handleri.potez);
        socket.off('partija:eliminacija', handleri.eliminacija);
        socket.off('partija:kraj', handleri.kraj);
        socket.disconnect();
      }
      runde.ocisti();
      potezi.ocisti();
      eliminacije.ocisti();
      krajevi.ocisti();
      await lokalni.zaustavi();
    }
  }, 45_000);

  it('četveroboj: rezervirani bot se prikazuje u čekaonici prije pokretanja, a partija kreće s tri bota', async () => {
    // Zaseban server s odgodom prve riječi: izlazak prije runde poništava stol i odmah vraća botove u fond.
    const lokalni = await izgradiPosluzitelj({
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      postavkeMotora: { ...postavkeTestMotora, odgodaPocetkaPartijeMs: 5_000 },
      popunaBotovima: { cetveroboj: true, pragoviMs: { cetiri_igraca: [50, 100, 150] } },
    });
    lokalni.fondBotova.postaviIdentitete((await ucitajIdentiteteBotova()).filter((bot) => testniBotovi.includes(bot.igracId)));
    let socket: ClientSocket | null = null;
    try {
      await lokalni.app.listen({ port: 0, host: '127.0.0.1' });
      const podaci = lokalni.app.server.address();
      socket = ioClient(`http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`, { auth: { token: `gost.${randomUUID().replaceAll('-', '')}` }, forceNew: true });
      await new Promise<void>((resolve, reject) => { socket!.once('connect', resolve); socket!.once('connect_error', reject); });
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak', () => true, 15_000);
      socket.emit('red:udji', { mod: 'cetiri_igraca' });
      const stanjeReda = await cekaj<StanjeReda>(socket, 'red:stanje', (s) => s.mod === 'cetiri_igraca' && s.mjesta.filter(Boolean).length === 2, 5_000);
      expect(stanjeReda.mjesta.filter(Boolean)).toHaveLength(2);
      const pocetak = await pocetakPromise;
      expect(pocetak.sjedala).toHaveLength(4);
      expect(pocetak.sjedala.filter((s) => s.igracId !== pocetak.mojIgracId)).toHaveLength(3);
      const ponistena = cekaj<{ partijaId: string }>(socket, 'partija:ponistena');
      socket.emit('partija:izadji');
      expect((await ponistena).partijaId).toBe(pocetak.partijaId);
      await expect.poll(() => lokalni.fondBotova.stanje().slobodni).toBe(3);
    } finally {
      socket?.disconnect();
      await lokalni.zaustavi();
    }
  }, 30_000);

  it('drugi čovjek prije praga igra protiv čovjeka, bez bota', async () => {
    const prvi = await spoji();
    const drugi = await spoji();
    try {
      const pocetakPromise = cekaj<PocetakPartije>(prvi, 'partija:pocetak');
      const rundaPromise = cekaj<RundaOtvorena>(prvi, 'partija:runda-otvorena');
      const krajPromise = cekaj<KrajPartije>(prvi, 'partija:kraj', () => true, 30_000);
      await new Promise<void>((resolve) => prvi.emit('red:udji', { mod: 'dva_igraca' }, () => resolve()));
      drugi.emit('red:udji', { mod: 'dva_igraca' });
      const pocetak = await pocetakPromise;
      expect(pocetak.sjedala.every((s) => s.jeGost)).toBe(true);
      const runda = await rundaPromise;
      const naPotezu = runda.naPotezuId === pocetak.mojIgracId ? prvi : drugi;
      naPotezu.emit('potez:ne-znam', { turnToken: runda.turnToken });
      const kraj = await krajPromise;
      const [partija] = await baza.select().from(partije).where(eq(partije.id, kraj.partijaId));
      expect(partija?.brojBotova).toBe(0);
      expect(posluzitelj.fondBotova.stanje().rezervirani).toBe(0);
    } finally {
      prvi.disconnect();
      drugi.disconnect();
    }
  });
});
