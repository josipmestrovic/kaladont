import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import type { KrajPartije, PocetakPartije, PrihvacenPotez, RundaOtvorena, StanjeReda } from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { botovi, igraci, partije, sudioniciPartije } from '../src/baza/shema.js';
import { ucitajIdentiteteBotova } from '../src/bot/fond.js';

let posluzitelj: Posluzitelj;
let adresa: string;
const testniBotovi = Array.from({ length: 3 }, () => randomUUID());

beforeAll(async () => {
  await baza.insert(igraci).values(testniBotovi.map((id) => ({
    id, vrsta: 'registriran' as const, upravljac: 'bot' as const,
    nadimak: `Bot${id.slice(0, 6)}`, emailPotvrdjen: true,
  })));
  await baza.insert(botovi).values(testniBotovi.map((igracId) => ({ igracId, kljucSeeda: `test-${igracId}` })));
  posluzitelj = await izgradiPosluzitelj({
    socketOgranicenja: { handshakePoIpMinuti: 1_000 },
    popunaBotovima: { dvoboj: true, cetveroboj: true, pragoviMs: { dva_igraca: [1_000], cetiri_igraca: [1_000, 1_500, 2_000] } },
  });
  posluzitelj.fondBotova.postaviIdentitete((await ucitajIdentiteteBotova()).filter((bot) => testniBotovi.includes(bot.igracId)));
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
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

describe('popuna javnog reda botovima', () => {
  it('dvoboj: sam čovjek dobiva bota nakon praga, partija se upisuje s brojem botova i bot se oslobađa', async () => {
    expect(posluzitelj.fondBotova.stanje().ukupno).toBeGreaterThan(0);
    const socket = await spoji();
    try {
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
      const rundaPromise = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
      const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 30_000);
      socket.emit('red:udji', { mod: 'dva_igraca' });
      // U Dvoboju rezervacija i pokretanje padaju u isti trenutak praga; nema zasebne faze prikaza bota.
      const pocetak = await pocetakPromise;
      expect(pocetak.kontekst).toBe('javna');
      expect(pocetak.sjedala).toHaveLength(2);
      const mojId = pocetak.mojIgracId;
      const botSjedalo = pocetak.sjedala.find((s) => s.igracId !== mojId)!;
      expect(botSjedalo.jeGost).toBe(false);

      const runda = await rundaPromise;
      let naPotezu = runda.naPotezuId;
      let turnToken = runda.turnToken;
      let botIgrao = false;
      for (let korak = 0; korak < 6; korak += 1) {
        if (naPotezu === mojId) {
          socket.emit('potez:ne-znam', { turnToken });
          break;
        }
        const ishod = await Promise.race([
          cekaj<PrihvacenPotez>(socket, 'potez:prihvacen', (p) => p.igracId === naPotezu).then((p) => ({ vrsta: 'potez' as const, p })),
          krajPromise.then(() => ({ vrsta: 'kraj' as const })),
        ]);
        if (ishod.vrsta === 'kraj') break;
        botIgrao = true;
        naPotezu = ishod.p.sljedeciId;
        turnToken = ishod.p.turnToken;
      }
      const kraj = await krajPromise;
      expect(kraj.kontekst).toBe('javna');
      // Isti javni obračun kao bez bota: čovjek ima XP obračun i plasman.
      expect(kraj.mojeIskustvo).not.toBeNull();
      expect(kraj.plasmani).toHaveLength(2);
      void botIgrao;

      const [partija] = await baza.select().from(partije).where(eq(partije.id, kraj.partijaId));
      expect(partija?.brojBotova).toBe(1);
      expect(partija?.status).toBe('zavrsena');
      const sudionici = await baza.select().from(sudioniciPartije).where(eq(sudioniciPartije.partijaId, kraj.partijaId));
      expect(sudionici).toHaveLength(2);
      expect(sudionici.find((s) => s.igracId === botSjedalo.igracId)?.cekanjeMs).toBe(0);

      // Nakon spremljenog rezultata fond ponovno nudi sve identitete.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(posluzitelj.fondBotova.stanje().uPartiji).toBe(0);
      expect(posluzitelj.fondBotova.stanje().slobodni).toBe(posluzitelj.fondBotova.stanje().ukupno);
    } finally {
      socket.disconnect();
    }
  });

  it('četveroboj: rezervirani bot se prikazuje u čekaonici prije pokretanja, a partija kreće s tri bota', async () => {
    const socket = await spoji();
    try {
      const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak', () => true, 15_000);
      socket.emit('red:udji', { mod: 'cetiri_igraca' });
      const stanjeReda = await cekaj<StanjeReda>(socket, 'red:stanje', (s) => s.mod === 'cetiri_igraca' && s.mjesta.filter(Boolean).length === 2, 5_000);
      expect(stanjeReda.mjesta.filter(Boolean)).toHaveLength(2);
      const pocetak = await pocetakPromise;
      expect(pocetak.sjedala).toHaveLength(4);
      expect(pocetak.sjedala.filter((s) => s.igracId !== pocetak.mojIgracId)).toHaveLength(3);
      socket.emit('partija:izadji');
    } finally {
      socket.disconnect();
    }
  });

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
