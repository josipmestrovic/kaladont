/**
 * Simulacija partije - spaja 4 socket.io-client bota koji igraju stvarnim riječima iz baze.
 * Korisno za ručno/dimno testiranje bez otvaranja 4 preglednika (testiranje.md, PLAN-IMPLEMENTACIJE.md Faza 8).
 * Pokreni: pnpm --filter posluzitelj simulacija (poslužitelj mora već raditi na istoj adresi).
 */
import { randomUUID } from 'node:crypto';
import { io as ioClient } from 'socket.io-client';
import { and, eq } from 'drizzle-orm';
import type {
  Eliminacija,
  KrajPartije,
  OdbijenPotez,
  PocetakPartije,
  PrihvacenPotez,
  RundaOtvorena,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';

const ADRESA = konfiguracija.SIMULACIJA_ADRESA;
const VREMENSKO_OGRANICENJE_MS = 60_000;

async function pronadjiRijec(
  prefiks: string | null,
  iskoristene: Set<string>,
  pokusane: Set<string>,
): Promise<string | null> {
  const uvjet = prefiks ? and(eq(rijeci.aktivna, true), eq(rijeci.prvaDva, prefiks)) : eq(rijeci.aktivna, true);
  const kandidati = await baza.select({ rijec: rijeci.rijec }).from(rijeci).where(uvjet).limit(500);
  const slobodni = kandidati.filter((k) => !iskoristene.has(k.rijec) && !pokusane.has(k.rijec));
  if (slobodni.length === 0) return null;
  return slobodni[Math.floor(Math.random() * slobodni.length)]!.rijec;
}

function odgodi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Bot {
  igracId: string; // gost token je istovremeno igracId (identitet.ts)
  socket: ReturnType<typeof ioClient>;
}

async function glavno(): Promise<void> {
  const botovi: Bot[] = Array.from({ length: 4 }, () => {
    const token = randomUUID();
    return { igracId: token, socket: ioClient(ADRESA, { auth: { token }, forceNew: true }) };
  });

  await Promise.all(
    botovi.map(
      (bot) =>
        new Promise<void>((resolve, reject) => {
          bot.socket.on('connect', () => resolve());
          bot.socket.on('connect_error', reject);
        }),
    ),
  );
  console.log(`4 bota spojena na ${ADRESA}, ulaze u red čekanja...`);

  const iskoristene = new Set<string>();
  // rijeci vec odbijene u trenutnoj rundi za trenutnog igraca - iskljucuju se iz sljedeceg pokusaja
  let pokusaneOvajPotez = new Set<string>();
  let trazenaSlova: string | null = null;
  let naPotezuId: string | null = null;

  async function odigrajAkoJeNaRedu(igracId: string): Promise<void> {
    if (igracId !== naPotezuId) return;
    const bot = botovi.find((b) => b.igracId === igracId);
    if (!bot) return;
    const rijec = await pronadjiRijec(trazenaSlova, iskoristene, pokusaneOvajPotez);
    if (rijec) {
      pokusaneOvajPotez.add(rijec);
      bot.socket.emit('potez:rijec', { rijec });
    } else {
      bot.socket.emit('potez:ne-znam');
    }
  }

  const glavniSocket = botovi[0]!.socket;

  glavniSocket.on('partija:pocetak', (poruka: PocetakPartije) => {
    console.log(
      `Partija ${poruka.partijaId} počinje. Sjedala: ${poruka.sjedala.map((s) => s.nadimak).join(', ')}`,
    );
    pokusaneOvajPotez = new Set();
  });

  glavniSocket.on('potez:prihvacen', (poruka: PrihvacenPotez) => {
    iskoristene.add(poruka.rijec);
    trazenaSlova = poruka.trazenaSlova;
    naPotezuId = poruka.sljedeciId;
    pokusaneOvajPotez = new Set();
    console.log(`${poruka.igracId.slice(0, 8)} -> "${poruka.rijec}" (traži se: ${poruka.trazenaSlova})`);
    void odigrajAkoJeNaRedu(naPotezuId);
  });

  glavniSocket.on('partija:eliminacija', (poruka: Eliminacija) => {
    console.log(`Eliminacija: ${poruka.igracId.slice(0, 8)} (${poruka.razlog}), plasman ${poruka.plasman}.`);
  });

  glavniSocket.on('partija:sustav-bira-rijec', () => {
    console.log('Sustav bira riječ za novu rundu...');
  });

  glavniSocket.on('partija:runda-otvorena', (poruka: RundaOtvorena) => {
    console.log(`Sustav je odabrao riječ "${poruka.rijec}" (traži se: ${poruka.trazenaSlova})`);
    naPotezuId = poruka.naPotezuId;
    trazenaSlova = poruka.trazenaSlova;
    pokusaneOvajPotez = new Set();
    void odigrajAkoJeNaRedu(naPotezuId);
  });

  glavniSocket.on('partija:kraj', (poruka: KrajPartije) => {
    console.log('Partija završena. Plasmani:');
    for (const p of [...poruka.plasmani].sort((a, b) => a.plasman - b.plasman)) {
      console.log(`  ${p.plasman}. mjesto - ${p.igracId.slice(0, 8)} - ${p.bodovi} bodova (${p.eliminacije} elim.)`);
    }
    for (const bot of botovi) bot.socket.disconnect();
    process.exit(0);
  });

  for (const bot of botovi) {
    bot.socket.on('potez:odbijen', async (poruka: OdbijenPotez) => {
      console.log(`${bot.igracId.slice(0, 8)} odbijen (${poruka.kod}) - pokušavam ponovno`);
      await odgodi(150); // izbjegava RS-23 rate limit (max 3 pokusaja/s)
      await odigrajAkoJeNaRedu(bot.igracId);
    });
    bot.socket.on('greska', async (poruka: { kod: string; poruka: string }) => {
      console.log(`${bot.igracId.slice(0, 8)} greška (${poruka.kod}: ${poruka.poruka}) - pokušavam kasnije`);
      if (poruka.kod === 'PREBRZO') {
        await odgodi(1100);
        await odigrajAkoJeNaRedu(bot.igracId);
      }
    });
    bot.socket.emit('red:udji');
  }

  setTimeout(() => {
    console.error('Vremensko ograničenje isteklo - partija nije završila u očekivanom roku.');
    process.exit(1);
  }, VREMENSKO_OGRANICENJE_MS);
}

glavno().catch((greska) => {
  console.error('Simulacija nije uspjela:', greska);
  process.exit(1);
});
