/**
 * Reproducibilni Socket.IO baseline za veze, red čekanja i reconnect churn.
 * Pokreće se isključivo protiv kontroliranog lokalnog ili staging okruženja.
 */
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';

type Scenarij = 'veze' | 'red' | 'reconnect';

interface Postavke {
  scenarij: Scenarij;
  adresa: string;
  brojKlijenata: number;
  velicinaVala: number;
  razmakValaMs: number;
  trajanjeMs: number;
  brojCiklusa: number;
  timeoutMs: number;
  brojIdleKlijenata: number;
  cekanjeCiscenjaMs: number;
}

interface Klijent {
  token: string;
  socket: Socket;
}

interface RezultatSpajanja {
  klijenti: Klijent[];
  trajanja: number[];
  greske: string[];
}

const otvoreniSocketi = new Set<Socket>();

const argumenti = new Map(
  process.argv.slice(2).map((argument) => {
    const [naziv, ...ostatak] = argument.replace(/^--/, '').split('=');
    return [naziv, ostatak.join('=')] as const;
  }),
);

function brojArgumenta(naziv: string, zadano: number, najmanje = 0): number {
  const sirovo = argumenti.get(naziv);
  const vrijednost = sirovo === undefined ? zadano : Number(sirovo);
  if (!Number.isInteger(vrijednost) || vrijednost < najmanje) {
    throw new Error(`--${naziv} mora biti cijeli broj >= ${najmanje}.`);
  }
  return vrijednost;
}

function ucitajPostavke(): Postavke {
  const scenarij = (argumenti.get('scenarij') ?? 'veze') as Scenarij;
  if (!['veze', 'red', 'reconnect'].includes(scenarij)) {
    throw new Error('--scenarij mora biti veze, red ili reconnect.');
  }

  const postavke: Postavke = {
    scenarij,
    adresa: argumenti.get('adresa') ?? process.env.SIMULACIJA_ADRESA ?? 'http://localhost:3000',
    brojKlijenata: brojArgumenta('klijenti', 100, 1),
    velicinaVala: brojArgumenta('val', 20, 1),
    razmakValaMs: brojArgumenta('razmak-vala-ms', 50),
    trajanjeMs: brojArgumenta('trajanje-ms', 5_000),
    brojCiklusa: brojArgumenta('ciklusi', 3, 1),
    timeoutMs: brojArgumenta('timeout-ms', 30_000, 1),
    brojIdleKlijenata: brojArgumenta('idle', 0),
    cekanjeCiscenjaMs: brojArgumenta('cekaj-ciscenje-ms', 16_000),
  };

  if (postavke.scenarij === 'red' && postavke.brojKlijenata % 4 !== 0) {
    throw new Error('--klijenti za scenarij red mora biti djeljiv s 4.');
  }
  return postavke;
}

function odgodi(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sOgranicenjem<T>(obecanje: Promise<T>, timeoutMs: number, opis: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${opis}: isteklo ${timeoutMs} ms.`)),
      timeoutMs,
    );
    obecanje.then(
      (vrijednost) => {
        clearTimeout(timer);
        resolve(vrijednost);
      },
      (greska: unknown) => {
        clearTimeout(timer);
        reject(greska);
      },
    );
  });
}

function percentil(vrijednosti: readonly number[], udio: number): number {
  if (vrijednosti.length === 0) return 0;
  const sortirano = [...vrijednosti].sort((a, b) => a - b);
  const indeks = Math.min(sortirano.length - 1, Math.ceil(sortirano.length * udio) - 1);
  return sortirano[indeks]!;
}

function statistika(vrijednosti: readonly number[]) {
  return {
    broj: vrijednosti.length,
    p50Ms: percentil(vrijednosti, 0.5),
    p95Ms: percentil(vrijednosti, 0.95),
    maksimumMs: vrijednosti.length > 0 ? Math.max(...vrijednosti) : 0,
  };
}

async function spojiKlijenta(
  adresa: string,
  token: string,
  timeoutMs: number,
): Promise<{ klijent: Klijent; trajanjeMs: number }> {
  const pocetak = performance.now();
  const socket = io(adresa, {
    auth: { token },
    forceNew: true,
    reconnection: false,
    transports: ['websocket'],
  });
  otvoreniSocketi.add(socket);

  await sOgranicenjem(
    new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    }),
    timeoutMs,
    `Spajanje klijenta ${token.slice(0, 8)}`,
  ).catch((greska) => {
    socket.disconnect();
    otvoreniSocketi.delete(socket);
    throw greska;
  });

  return { klijent: { token, socket }, trajanjeMs: Math.round(performance.now() - pocetak) };
}

async function spojiUValovima(
  postavke: Postavke,
  tokeni: readonly string[],
): Promise<RezultatSpajanja> {
  const klijenti: Klijent[] = [];
  const trajanja: number[] = [];
  const greske: string[] = [];

  for (let pocetak = 0; pocetak < tokeni.length; pocetak += postavke.velicinaVala) {
    const val = tokeni.slice(pocetak, pocetak + postavke.velicinaVala);
    const ishodi = await Promise.allSettled(
      val.map((token) => spojiKlijenta(postavke.adresa, token, postavke.timeoutMs)),
    );
    for (const ishod of ishodi) {
      if (ishod.status === 'fulfilled') {
        klijenti.push(ishod.value.klijent);
        trajanja.push(ishod.value.trajanjeMs);
      } else {
        greske.push(ishod.reason instanceof Error ? ishod.reason.message : String(ishod.reason));
      }
    }
    if (pocetak + postavke.velicinaVala < tokeni.length) await odgodi(postavke.razmakValaMs);
  }

  return { klijenti, trajanja, greske };
}

function odspojiSve(klijenti: readonly Klijent[]): void {
  for (const klijent of klijenti) {
    klijent.socket.removeAllListeners();
    klijent.socket.disconnect();
    otvoreniSocketi.delete(klijent.socket);
  }
}

function odspojiSveOtvorene(): void {
  for (const socket of otvoreniSocketi) {
    socket.removeAllListeners();
    socket.disconnect();
  }
  otvoreniSocketi.clear();
}

async function scenarijVeze(postavke: Postavke, tokeni: readonly string[]) {
  const { klijenti, trajanja, greske } = await spojiUValovima(postavke, tokeni);
  await odgodi(postavke.trajanjeMs);
  odspojiSve(klijenti);
  return {
    spajanje: statistika(trajanja),
    brojGresaka: greske.length,
    greske,
    trajanjeDrzanjaMs: postavke.trajanjeMs,
  };
}

async function scenarijReconnect(postavke: Postavke, tokeni: readonly string[]) {
  let spojeni = await spojiUValovima(postavke, tokeni);
  const pocetnoSpajanje = {
    ...statistika(spojeni.trajanja),
    brojGresaka: spojeni.greske.length,
    greske: spojeni.greske,
  };
  const ciklusi: Array<ReturnType<typeof statistika> & { brojGresaka: number; greske: string[] }> =
    [];

  for (let ciklus = 1; ciklus <= postavke.brojCiklusa; ciklus += 1) {
    odspojiSve(spojeni.klijenti);
    await odgodi(postavke.razmakValaMs);
    spojeni = await spojiUValovima(postavke, tokeni);
    ciklusi.push({
      ...statistika(spojeni.trajanja),
      brojGresaka: spojeni.greske.length,
      greske: spojeni.greske,
    });
  }

  odspojiSve(spojeni.klijenti);
  return { pocetnoSpajanje, ciklusi };
}

async function scenarijRed(postavke: Postavke, tokeni: readonly string[]) {
  const idleTokeni = Array.from({ length: postavke.brojIdleKlijenata }, () => randomUUID());
  const idle = await spojiUValovima(postavke, idleTokeni);
  const { klijenti, trajanja, greske } = await spojiUValovima(postavke, tokeni);
  const ulazakPoTokenu = new Map<string, number>();
  const cekanja: number[] = [];
  const brojZaStolove = klijenti.length - (klijenti.length % 4);

  try {
    const pocetci = klijenti.slice(0, brojZaStolove).map(
      (klijent) =>
        new Promise<void>((resolve) => {
          klijent.socket.once('partija:pocetak', () => {
            cekanja.push(
              Math.round(
                performance.now() - (ulazakPoTokenu.get(klijent.token) ?? performance.now()),
              ),
            );
            resolve();
          });
        }),
    );

    for (let pocetak = 0; pocetak < klijenti.length; pocetak += postavke.velicinaVala) {
      const val = klijenti.slice(pocetak, pocetak + postavke.velicinaVala);
      for (const klijent of val) {
        ulazakPoTokenu.set(klijent.token, performance.now());
        klijent.socket.emit('red:udji');
      }
      if (pocetak + postavke.velicinaVala < klijenti.length) await odgodi(postavke.razmakValaMs);
    }

    if (pocetci.length > 0) {
      await sOgranicenjem(
        Promise.all(pocetci).then(() => undefined),
        postavke.timeoutMs,
        'Sastavljanje svih stolova',
      );
    }

    return {
      spajanje: statistika(trajanja),
      idleSpajanje: statistika(idle.trajanja),
      cekanjeNaStol: statistika(cekanja),
      brojGresaka: greske.length + idle.greske.length,
      greske: [...idle.greske, ...greske],
      neupareni: klijenti.length - brojZaStolove,
    };
  } finally {
    for (const klijent of klijenti.slice(0, brojZaStolove)) klijent.socket.emit('partija:izadji');
    if (brojZaStolove > 0) await odgodi(postavke.cekanjeCiscenjaMs);
    odspojiSve(klijenti);
    odspojiSve(idle.klijenti);
  }
}

async function glavno(): Promise<void> {
  const postavke = ucitajPostavke();
  const tokeni = Array.from({ length: postavke.brojKlijenata }, () => randomUUID());
  const pocetak = performance.now();

  console.log(
    `Scenarij=${postavke.scenarij} adresa=${postavke.adresa} klijenti=${postavke.brojKlijenata} idle=${postavke.brojIdleKlijenata}`,
  );

  try {
    const rezultat =
      postavke.scenarij === 'veze'
        ? await scenarijVeze(postavke, tokeni)
        : postavke.scenarij === 'red'
          ? await scenarijRed(postavke, tokeni)
          : await scenarijReconnect(postavke, tokeni);

    console.log(
      JSON.stringify(
        {
          vrijeme: new Date().toISOString(),
          ukupnoTrajanjeMs: Math.round(performance.now() - pocetak),
          postavke,
          rezultat,
        },
        null,
        2,
      ),
    );
  } finally {
    odspojiSveOtvorene();
  }
}

glavno().catch((greska) => {
  console.error(greska instanceof Error ? greska.message : greska);
  process.exitCode = 1;
});
