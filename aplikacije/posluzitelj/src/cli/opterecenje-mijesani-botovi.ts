import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import type {
  Eliminacija,
  KrajPartije,
  PrihvacenPotez,
  PocetakPartije,
  RundaOtvorena,
  SpremanjeRezultataPartije,
  StanjePrivatneSobe,
} from 'zajednicko';
import type { RaspodjelaMijesanogTesta } from './opterecenje-postavke.js';
import type { SnimkaRjecnika } from './opterecenje-rjecnik.js';

export type NacinBotIgre = 'dva_igraca' | 'cetiri_igraca';
/** Vrste virtualnih korisnika generatora; `trening` igra Zagrijavanje protiv serverskog Računala. */
export type VrstaBota = 'dvoboj' | 'javni_cetveroboj' | 'privatni_cetveroboj' | 'trening';
export type StanjeBota = 'spajanje' | 'red' | 'igra' | 'ispao' | 'rezultati' | 'zatvoren';

export interface GrupaBotova {
  vrsta: VrstaBota;
  botovi: BotIgrac[];
}

export interface BotIgrac {
  token: string;
  socket: Socket;
  vrsta: VrstaBota;
  mod: NacinBotIgre;
  stanje: StanjeBota;
  igracId: string | null;
  partijaId: string | null;
  kodSobe: string | null;
  vlasnikSobe: boolean;
  zadnjiTokenPoteza: string | null;
  poslanPotezU: Map<string, number>;
  timerPoteza: NodeJS.Timeout | null;
  cekaOdMs: number;
}

interface MjerenaPartija {
  id: string;
  mod: NacinBotIgre;
  kontekst: 'javna' | 'privatna' | 'trening';
  jePrivatna: boolean;
  kodSobe: string | null;
  vlasnikId: string | null;
  igraci: Set<string>;
  /** Sudionici koje ne vodi generator (računalni protivnici poslužitelja). */
  vanjskiIgraci: Set<string>;
  aktivniIgraci: Set<string>;
  zavrsili: Set<string>;
  iskoristeneGrupe: Set<string>;
  pokusaneRijeci: Set<string>;
  obradenTokenPoteza: Set<string>;
  brojPrihvacenihPoteza: number;
  poteziMs: number[];
  odgovorRacunalaPoceoU: number | null;
  odgovoriRacunalaMs: number[];
  spremanjePoceloU: number | null;
  spremanjaMs: number[];
  zapoceloU: number;
  zavrsenoU: number | null;
  zavrsavanje: boolean;
  naPotezuId: string | null;
  trazenaSlova: string | null;
  turnToken: string | null;
  generacijaRunde: number;
  zadnjiDogadajMs: number;
}

export interface OpcijeSimulatoraBotova {
  adresa: string;
  timeoutMs: number;
  cekanjePotezaMinMs: number;
  cekanjePotezaMaksMs: number;
  maksPotezaPoPartiji: number;
  transport?: 'polling-websocket' | 'websocket';
}

export interface UzorakBotova {
  spojeni: number;
  poStanjima: Record<StanjeBota, number>;
  aktivnePartije: number;
  aktivniIgraci: number;
  aktivniTreninzi: number;
  privatneSobe: number;
  prihvaceniPotezi: number;
  zavrsenePartije: number;
  neocekivaniPrekidi: number;
  tehnickeGreske: number;
}

const POSTAVKE_PRIVATNE_SOBE = {
  trajanjePotezaSek: 30,
  dopusteneVrste: [],
  eliminacijskiBodovi: false,
};
const MAKS_UZORAKA_LATENCIJE = 50_000;

export function izradiGrupuBotova(vrsta: VrstaBota): GrupaBotova {
  const brojBotova = vrsta === 'dvoboj' ? 2 : vrsta === 'trening' ? 1 : 4;
  const botovi = Array.from({ length: brojBotova }, () => ({
    token: `gost.${randomUUID().replaceAll('-', '')}`,
    socket: null as unknown as Socket,
    vrsta,
    mod: vrsta === 'dvoboj' || vrsta === 'trening' ? 'dva_igraca' as const : 'cetiri_igraca' as const,
    stanje: 'spajanje' as const,
    igracId: null,
    partijaId: null,
    kodSobe: null,
    vlasnikSobe: false,
    zadnjiTokenPoteza: null,
    poslanPotezU: new Map<string, number>(),
    timerPoteza: null,
    cekaOdMs: performance.now(),
  }));
  return { vrsta, botovi };
}

export function izradiGrupeBotova(raspodjela: RaspodjelaMijesanogTesta): GrupaBotova[] {
  const grupe: GrupaBotova[] = [];
  const dodajGrupe = (vrsta: VrstaBota, brojIgraca: number, velicinaGrupe: number) => {
    for (let pocetak = 0; pocetak < brojIgraca; pocetak += velicinaGrupe) {
      grupe.push(izradiGrupuBotova(vrsta));
    }
  };

  dodajGrupe('dvoboj', raspodjela.brojIgracaDvoboja, 2);
  dodajGrupe('javni_cetveroboj', raspodjela.brojIgracaJavnogCetveroboja, 4);
  dodajGrupe('privatni_cetveroboj', raspodjela.brojIgracaPrivatnogCetveroboja, 4);
  // Treninzi se raspršuju kroz rampu da limit istodobnih treninga ne bude pogođen odjednom.
  const treninzi = Array.from({ length: raspodjela.brojIgracaTreninga }, () => izradiGrupuBotova('trening'));
  if (treninzi.length === 0) return grupe;
  const korak = Math.max(1, Math.floor(grupe.length / treninzi.length));
  treninzi.forEach((grupa, indeks) => grupe.splice(Math.min(grupe.length, indeks * (korak + 1)), 0, grupa));
  return grupe;
}

export class SimulatorMijesanihBotova {
  private readonly botovi = new Set<BotIgrac>();
  private readonly botPoIgracu = new Map<string, BotIgrac>();
  private readonly partije = new Map<string, MjerenaPartija>();
  private readonly otvoreniSocketi = new Set<Socket>();
  private readonly pogreske: string[] = [];
  private readonly uzorciPotezaMs: number[] = [];
  private readonly uzorciSpremanjaMs: number[] = [];
  private readonly latencijePoVrsti: Record<VrstaBota, { poteziMs: number[]; spremanjaMs: number[]; brojPoteza: number; brojSpremanja: number }> = {
    dvoboj: { poteziMs: [], spremanjaMs: [], brojPoteza: 0, brojSpremanja: 0 },
    javni_cetveroboj: { poteziMs: [], spremanjaMs: [], brojPoteza: 0, brojSpremanja: 0 },
    privatni_cetveroboj: { poteziMs: [], spremanjaMs: [], brojPoteza: 0, brojSpremanja: 0 },
    trening: { poteziMs: [], spremanjaMs: [], brojPoteza: 0, brojSpremanja: 0 },
  };
  private readonly odgovoriRacunalaMs: number[] = [];
  private brojOdgovoraRacunala = 0;
  private brojIstekaRacunala = 0;
  private brojOdbijenihTreninga = 0;
  private brojVanjskihSudionikaJavnih = 0;
  private brojUzorakaPoteza = 0;
  private brojUzorakaSpremanja = 0;
  private ukupnoPoteza = 0;
  private ukupnoZavrsenihPartija = 0;
  private readonly zavrsenePoVrsti: Record<VrstaBota, number> = {
    dvoboj: 0,
    javni_cetveroboj: 0,
    privatni_cetveroboj: 0,
    trening: 0,
  };
  private ukupnoPartijaBezSpremanja = 0;
  private brojNeocekivanihPrekida = 0;
  private brojTehnickihGresaka = 0;
  private planiranoZatvaranje = false;
  private zavrsavanjePokusa = false;
  private signalPrekida: AbortSignal | undefined;

  constructor(
    private readonly opcije: OpcijeSimulatoraBotova,
    private readonly rjecnik: SnimkaRjecnika,
    private readonly prekini: (razlog: string) => void,
  ) {}

  async pokreniGrupu(grupa: GrupaBotova, signal: AbortSignal): Promise<void> {
    this.signalPrekida = signal;
    const ishodi = await Promise.allSettled(grupa.botovi.map((bot) => this.spojiBota(bot)));
    const neuspjeli = ishodi.filter((ishod) => ishod.status === 'rejected');
    if (neuspjeli.length > 0) {
      this.brojTehnickihGresaka += neuspjeli.length;
      const razlozi = neuspjeli.map((ishod) => ishod.reason instanceof Error ? ishod.reason.message : String(ishod.reason));
      this.pogreske.push(...razlozi);
      throw new Error(`${neuspjeli.length} botova nije se uspjelo spojiti: ${razlozi.join('; ')}.`);
    }

    if (grupa.vrsta === 'privatni_cetveroboj') {
      await this.stvoriPrivatnuSobu(grupa.botovi, signal);
    } else if (grupa.vrsta === 'trening') {
      await this.zapocniTrening(grupa.botovi[0]!, signal);
    } else {
      await Promise.all(grupa.botovi.map((bot) => this.udjiUJavniRed(bot, signal)));
    }
  }

  uzorak(): UzorakBotova {
    if (!this.planiranoZatvaranje && !this.signalPrekida?.aborted) {
      const sada = performance.now();
      const cekaURedu = [...this.botovi].find((bot) => bot.stanje === 'red' && sada - bot.cekaOdMs > 60_000);
      const neaktivnaPartija = [...this.partije.values()].find((partija) => partija.zavrsenoU === null && sada - partija.zadnjiDogadajMs > 60_000);
      if (cekaURedu) this.prekini(`Virtualni igrač čeka dulje od 60 sekundi: vrsta=${cekaURedu.vrsta}, mod=${cekaURedu.mod}, partija=${cekaURedu.partijaId ?? 'nema'}.`);
      else if (neaktivnaPartija) this.prekini(`Partija nema napretka dulje od 60 sekundi: id=${neaktivnaPartija.id}, kontekst=${neaktivnaPartija.kontekst}, mod=${neaktivnaPartija.mod}, naPotezu=${neaktivnaPartija.naPotezuId ?? 'nema'}.`);
    }
    const poStanjima: Record<StanjeBota, number> = {
      spajanje: 0,
      red: 0,
      igra: 0,
      ispao: 0,
      rezultati: 0,
      zatvoren: 0,
    };
    for (const bot of this.botovi) poStanjima[bot.stanje] += 1;
    const aktivnePartije = [...this.partije.values()].filter((partija) => !partija.zavrsavanje);
    return {
      spojeni: [...this.botovi].filter((bot) => bot.socket.connected).length,
      poStanjima,
      aktivnePartije: aktivnePartije.length,
      aktivniIgraci: aktivnePartije.reduce((zbroj, partija) => zbroj + [...partija.aktivniIgraci].filter((id) => !partija.vanjskiIgraci.has(id)).length, 0),
      aktivniTreninzi: aktivnePartije.filter((partija) => partija.kontekst === 'trening').length,
      privatneSobe: [...this.botovi].filter((bot) => bot.vlasnikSobe && bot.kodSobe !== null).length,
      prihvaceniPotezi: this.ukupnoPoteza + [...this.partije.values()].filter((partija) => partija.zavrsenoU === null)
        .reduce((zbroj, partija) => zbroj + partija.brojPrihvacenihPoteza, 0),
      zavrsenePartije: this.ukupnoZavrsenihPartija,
      neocekivaniPrekidi: this.brojNeocekivanihPrekida,
      tehnickeGreske: this.brojTehnickihGresaka,
    };
  }

  sazetak() {
    return {
      brojPoteza: this.ukupnoPoteza,
      poteziMs: this.uzorciPotezaMs,
      spremanjaMs: this.uzorciSpremanjaMs,
      zavrsenePartije: this.ukupnoZavrsenihPartija,
      zavrsenePoVrsti: { ...this.zavrsenePoVrsti },
      latencijePoVrsti: this.latencijePoVrsti,
      partijeBezSpremanja: this.ukupnoPartijaBezSpremanja,
      brojNeocekivanihPrekida: this.brojNeocekivanihPrekida,
      brojTehnickihGresaka: this.brojTehnickihGresaka,
      odgovoriRacunalaMs: this.odgovoriRacunalaMs,
      brojOdgovoraRacunala: this.brojOdgovoraRacunala,
      istekRacunala: this.brojIstekaRacunala,
      odbijeniTreninzi: this.brojOdbijenihTreninga,
      vanjskiSudioniciJavnih: this.brojVanjskihSudionikaJavnih,
      greske: this.pogreske.slice(0, 30),
    };
  }

  async dovrsiPartije(timeoutMs: number, signal: AbortSignal): Promise<void> {
    this.zavrsavanjePokusa = true;
    const rok = performance.now() + timeoutMs;
    while ([...this.partije.values()].some((partija) => partija.zavrsenoU === null)) {
      if (performance.now() >= rok) throw new Error('Preostale partije nisu dovršene unutar roka čišćenja.');
      await odgodi(100, signal);
    }
  }

  async zatvori(): Promise<void> {
    this.planiranoZatvaranje = true;
    for (const bot of this.botovi) {
      if (bot.timerPoteza) clearTimeout(bot.timerPoteza);
      if (bot.socket.connected) {
        bot.socket.emit('red:izadji');
        if (bot.partijaId) bot.socket.emit('partija:izadji');
        if (bot.kodSobe) bot.socket.emit('soba:izadji');
      }
      bot.stanje = 'zatvoren';
      bot.socket.disconnect();
      bot.socket.removeAllListeners();
    }
    this.otvoreniSocketi.clear();
  }

  private async spojiBota(bot: BotIgrac): Promise<void> {
    if (this.signalPrekida?.aborted) throw new Error('Test je prekinut.');
    const pocetak = performance.now();
    const socket = io(this.opcije.adresa, {
      auth: { token: bot.token },
      forceNew: true,
      reconnection: false,
      transports: this.opcije.transport === 'websocket' ? ['websocket'] : ['polling', 'websocket'],
      timeout: this.opcije.timeoutMs,
    });
    bot.socket = socket;
    this.botovi.add(bot);
    this.otvoreniSocketi.add(socket);
    let transportOtvorenU: number | null = null;
    const naOtvaranjeTransporta = () => { transportOtvorenU = performance.now(); };
    socket.io.on('open', naOtvaranjeTransporta);

    try {
      await cekajDogadaj(socket, 'connect', this.opcije.timeoutMs, () => true, this.signalPrekida);
    } catch (greska) {
      const faza = transportOtvorenU === null ? 'Engine.IO handshake' : 'Socket.IO autorizacija';
      const trajanjeMs = Math.round(performance.now() - pocetak);
      const otvorenihVeza = [...this.botovi].filter((igrac) => igrac.socket.connected).length;
      const memorijaMiB = Math.round(process.memoryUsage().rss / 1_048_576);
      socket.disconnect();
      this.otvoreniSocketi.delete(socket);
      throw new Error(`${greska instanceof Error ? greska.message : String(greska)}; faza=${faza}, trajanjeMs=${trajanjeMs}, otvoreneVeze=${otvorenihVeza}, generatorRssMiB=${memorijaMiB}`);
    } finally {
      socket.io.off('open', naOtvaranjeTransporta);
    }
    bot.stanje = 'red';
    bot.cekaOdMs = performance.now();
    this.registrirajDogadajeBota(bot);
    if (performance.now() - pocetak > this.opcije.timeoutMs) throw new Error('Spajanje je premašilo vremensko ograničenje.');
  }

  private registrirajDogadajeBota(bot: BotIgrac): void {
    bot.socket.on('partija:pocetak', (poruka: PocetakPartije) => this.naPocetakPartije(bot, poruka));
    bot.socket.on('partija:runda-otvorena', (poruka: RundaOtvorena) => this.naOtvorenaRunda(bot, poruka));
    bot.socket.on('partija:eliminacija', (poruka: Eliminacija) => this.naEliminaciju(bot, poruka));
    bot.socket.on('potez:prihvacen', (poruka: PrihvacenPotez) => this.naPrihvacenPotez(bot, poruka));
    bot.socket.on('potez:odbijen', (poruka) => this.naOdbijenPotez(bot, poruka));
    bot.socket.on('partija:spremanje-rezultata', (poruka: SpremanjeRezultataPartije) => this.naSpremanje(bot, poruka));
    bot.socket.on('partija:kraj', (poruka: KrajPartije) => this.naKrajPartije(bot, poruka));
    bot.socket.on('greska', (poruka: { kod: string; poruka: string }) => {
      this.brojTehnickihGresaka += 1;
      this.pogreske.push(`${poruka.kod}: ${poruka.poruka}`);
    });
    bot.socket.on('disconnect', (razlog: string) => {
      this.otvoreniSocketi.delete(bot.socket);
      if (!this.planiranoZatvaranje && !this.signalPrekida?.aborted) {
        this.brojNeocekivanihPrekida += 1;
        bot.stanje = 'zatvoren';
        this.prekini(`Neočekivani prekid Socket.IO veze (${razlog}).`);
      }
    });
  }

  private naPocetakPartije(bot: BotIgrac, poruka: PocetakPartije): void {
    let partija = this.partije.get(poruka.partijaId);
    if (!partija) {
      const kontekst = poruka.kontekst ?? (poruka.jePrivatna || bot.vrsta === 'privatni_cetveroboj' ? 'privatna' : 'javna');
      const sviIgraci = poruka.sjedala.map((sjedalo) => sjedalo.igracId);
      partija = {
        id: poruka.partijaId,
        mod: poruka.mod ?? bot.mod,
        kontekst,
        jePrivatna: kontekst === 'privatna',
        kodSobe: poruka.kodSobe ?? bot.kodSobe,
        vlasnikId: null,
        igraci: new Set(sviIgraci),
        // U treningu je jedini VU sam primatelj; ostali su Računalo. Javne vanjske sudionike otkrivamo pri kraju.
        vanjskiIgraci: new Set(kontekst === 'trening' ? sviIgraci.filter((id) => id !== poruka.mojIgracId) : []),
        aktivniIgraci: new Set(sviIgraci),
        zavrsili: new Set(),
        iskoristeneGrupe: new Set(),
        pokusaneRijeci: new Set(),
        obradenTokenPoteza: new Set(),
        brojPrihvacenihPoteza: 0,
        poteziMs: [],
        odgovorRacunalaPoceoU: null,
        odgovoriRacunalaMs: [],
        spremanjePoceloU: null,
        spremanjaMs: [],
        zapoceloU: performance.now(),
        zavrsenoU: null,
        zavrsavanje: false,
        naPotezuId: null,
        trazenaSlova: null,
        turnToken: null,
        generacijaRunde: 0,
        zadnjiDogadajMs: performance.now(),
      };
      this.partije.set(poruka.partijaId, partija);
    }
    bot.igracId = poruka.mojIgracId;
    if (bot.timerPoteza) clearTimeout(bot.timerPoteza);
    bot.timerPoteza = null;
    bot.zadnjiTokenPoteza = null;
    bot.poslanPotezU.clear();
    bot.partijaId = poruka.partijaId;
    bot.stanje = 'igra';
    this.botPoIgracu.set(poruka.mojIgracId, bot);
  }

  private naOtvorenaRunda(bot: BotIgrac, poruka: RundaOtvorena): void {
    const partija = bot.partijaId ? this.partije.get(bot.partijaId) : undefined;
    if (!partija || partija.zavrsavanje || partija.zavrsenoU !== null) return;
    if (partija.turnToken !== poruka.turnToken) {
      partija.zadnjiDogadajMs = performance.now();
      for (const grupa of this.rjecnik.grupeZaRijec(poruka.rijec)) partija.iskoristeneGrupe.add(grupa);
      partija.naPotezuId = poruka.naPotezuId;
      partija.trazenaSlova = poruka.trazenaSlova;
      partija.turnToken = poruka.turnToken;
      partija.generacijaRunde += 1;
      partija.pokusaneRijeci.clear();
      partija.odgovorRacunalaPoceoU = partija.vanjskiIgraci.has(poruka.naPotezuId) ? performance.now() : null;
    }
    if (bot.igracId === poruka.naPotezuId) this.zakaziPotez(bot, partija, partija.generacijaRunde);
  }

  private zakaziPotez(bot: BotIgrac, partija: MjerenaPartija, generacijaRunde: number): void {
    if (!partija.trazenaSlova || !partija.turnToken || !bot.igracId || partija.zavrsavanje) return;
    if (bot.zadnjiTokenPoteza === partija.turnToken) return;
    if (bot.timerPoteza) clearTimeout(bot.timerPoteza);
    const cekanje = this.opcije.cekanjePotezaMinMs + Math.random() *
      (this.opcije.cekanjePotezaMaksMs - this.opcije.cekanjePotezaMinMs);
    const igracId = bot.igracId;
    const trazeniPrefiks = partija.trazenaSlova;
    const turnToken = partija.turnToken;
    bot.timerPoteza = setTimeout(() => {
      bot.timerPoteza = null;
      if (
        this.planiranoZatvaranje || this.signalPrekida?.aborted ||
        partija.generacijaRunde !== generacijaRunde ||
        partija.turnToken !== turnToken ||
        partija.naPotezuId !== bot.igracId ||
        partija.zavrsavanje
      ) return;

      if (partija.brojPrihvacenihPoteza >= this.opcije.maksPotezaPoPartiji) {
        bot.socket.emit('potez:ne-znam');
        return;
      }

      void (async () => {
        const rijec = await this.rjecnik.nasumicnaRijec(
          trazeniPrefiks,
          partija.iskoristeneGrupe,
          partija.pokusaneRijeci,
        );
        if (
          this.planiranoZatvaranje || this.signalPrekida?.aborted ||
          partija.generacijaRunde !== generacijaRunde ||
          partija.turnToken !== turnToken ||
          partija.naPotezuId !== bot.igracId ||
          partija.zavrsavanje
        ) return;
        if (!rijec) {
          bot.socket.emit('potez:ne-znam');
          return;
        }
        partija.pokusaneRijeci.add(rijec);
        bot.poslanPotezU.set(igracId, performance.now());
        bot.zadnjiTokenPoteza = turnToken;
        bot.socket.emit('potez:rijec', { rijec });
      })().catch((greska: unknown) => {
        this.brojTehnickihGresaka += 1;
        this.pogreske.push(greska instanceof Error ? greska.message : String(greska));
        this.prekini('Lokalna snimka rječnika nije mogla pripremiti potez.');
      });
    }, cekanje);
  }

  private naPrihvacenPotez(bot: BotIgrac, poruka: PrihvacenPotez): void {
    const partija = bot.partijaId ? this.partije.get(bot.partijaId) : undefined;
    const kljucDogadaja = `${poruka.turnToken}:${poruka.igracId}:${poruka.rijec}`;
    if (!partija || !partija.igraci.has(poruka.igracId) || partija.obradenTokenPoteza.has(kljucDogadaja)) return;
    partija.obradenTokenPoteza.add(kljucDogadaja);
    partija.zadnjiDogadajMs = performance.now();
    partija.brojPrihvacenihPoteza += 1;
    for (const grupa of this.rjecnik.grupeZaRijec(poruka.rijec)) partija.iskoristeneGrupe.add(grupa);
    const autor = this.botPoIgracu.get(poruka.igracId);
    if (autor) autor.zadnjiTokenPoteza = null;
    const poslanoU = autor?.poslanPotezU.get(poruka.igracId);
    if (autor && poslanoU !== undefined) {
      partija.poteziMs.push(performance.now() - poslanoU);
      autor.poslanPotezU.delete(poruka.igracId);
    }
    if (partija.vanjskiIgraci.has(poruka.igracId) && partija.odgovorRacunalaPoceoU !== null) {
      partija.odgovoriRacunalaMs.push(performance.now() - partija.odgovorRacunalaPoceoU);
    }
    partija.naPotezuId = poruka.sljedeciId;
    partija.trazenaSlova = poruka.trazenaSlova;
    partija.turnToken = poruka.turnToken;
    partija.odgovorRacunalaPoceoU = partija.vanjskiIgraci.has(poruka.sljedeciId) ? performance.now() : null;
    if (poruka.istekPotezaIso === undefined) return;

    partija.generacijaRunde += 1;
    partija.pokusaneRijeci.clear();
    const sljedeci = this.botPoIgracu.get(poruka.sljedeciId);
    if (sljedeci) this.zakaziPotez(sljedeci, partija, partija.generacijaRunde);
  }

  private naOdbijenPotez(bot: BotIgrac, poruka: { kod: string }): void {
    const partija = bot.partijaId ? this.partije.get(bot.partijaId) : undefined;
    if (!partija || bot.igracId !== partija.naPotezuId) return;
    if (poruka.kod === 'RIJEC_ISKORISTENA') {
      bot.zadnjiTokenPoteza = null;
      this.zakaziPotez(bot, partija, partija.generacijaRunde);
      return;
    }
    this.brojTehnickihGresaka += 1;
    this.pogreske.push(`Botu je odbijen potez: ${poruka.kod}`);
  }

  private naEliminaciju(bot: BotIgrac, poruka: Eliminacija): void {
    const partija = bot.partijaId ? this.partije.get(bot.partijaId) : undefined;
    if (!partija || !partija.aktivniIgraci.delete(poruka.igracId)) return;
    partija.zadnjiDogadajMs = performance.now();
    // Istek računalnog protivnika znači da bot kontroler nije stigao odigrati: signal zagušenja.
    if (partija.vanjskiIgraci.has(poruka.igracId) && poruka.razlog === 'istek') this.brojIstekaRacunala += 1;
    const eliminirani = this.botPoIgracu.get(poruka.igracId);
    if (eliminirani) {
      eliminirani.stanje = 'ispao';
      if (eliminirani.timerPoteza) clearTimeout(eliminirani.timerPoteza);
    }
  }

  private naSpremanje(bot: BotIgrac, poruka: SpremanjeRezultataPartije): void {
    const partija = bot.partijaId ? this.partije.get(poruka.partijaId) : undefined;
    if (partija && partija.spremanjePoceloU === null) partija.spremanjePoceloU = performance.now();
  }

  private naKrajPartije(bot: BotIgrac, poruka: KrajPartije): void {
    const partija = bot.partijaId ? this.partije.get(poruka.partijaId) : undefined;
    if (!partija || !bot.igracId || partija.zavrsili.has(bot.igracId)) return;
    partija.zadnjiDogadajMs = performance.now();
    partija.zavrsili.add(bot.igracId);
    bot.stanje = 'rezultati';
    if (partija.spremanjePoceloU !== null) {
      partija.spremanjaMs.push(performance.now() - partija.spremanjePoceloU);
      partija.spremanjePoceloU = null;
    }
    // Vanjski sudionici (Računalo, javni bot iz fonda) ne šalju kraj; čekaju se samo VU-ovi.
    for (const igracId of partija.igraci) {
      if (!this.botPoIgracu.has(igracId) && !partija.vanjskiIgraci.has(igracId)) partija.vanjskiIgraci.add(igracId);
    }
    const brojVu = partija.igraci.size - partija.vanjskiIgraci.size;
    if (partija.zavrsili.size >= brojVu && !partija.zavrsavanje) {
      partija.zavrsavanje = true;
      partija.zavrsenoU = performance.now();
      this.ukupnoPoteza += partija.brojPrihvacenihPoteza;
      this.ukupnoZavrsenihPartija += 1;
      const vrsta: VrstaBota = partija.kontekst === 'trening'
        ? 'trening'
        : partija.jePrivatna ? 'privatni_cetveroboj' : partija.mod === 'dva_igraca' ? 'dvoboj' : 'javni_cetveroboj';
      this.zavrsenePoVrsti[vrsta] += 1;
      if (partija.kontekst === 'javna') this.brojVanjskihSudionikaJavnih += partija.vanjskiIgraci.size;
      const latencije = this.latencijePoVrsti[vrsta];
      // Trening se ne sprema u bazu, pa izostanak spremanja nije greška.
      if (partija.spremanjaMs.length === 0 && partija.kontekst !== 'trening') this.ukupnoPartijaBezSpremanja += 1;
      for (const uzorak of partija.odgovoriRacunalaMs) {
        this.brojOdgovoraRacunala += 1;
        this.dodajUzorak(this.odgovoriRacunalaMs, uzorak, this.brojOdgovoraRacunala);
      }
      for (const uzorak of partija.poteziMs) {
        latencije.brojPoteza += 1;
        this.dodajUzorak(latencije.poteziMs, uzorak, latencije.brojPoteza);
        this.brojUzorakaPoteza += 1;
        this.dodajUzorak(this.uzorciPotezaMs, uzorak, this.brojUzorakaPoteza);
      }
      for (const uzorak of partija.spremanjaMs) {
        latencije.brojSpremanja += 1;
        this.dodajUzorak(latencije.spremanjaMs, uzorak, latencije.brojSpremanja);
        this.brojUzorakaSpremanja += 1;
        this.dodajUzorak(this.uzorciSpremanjaMs, uzorak, this.brojUzorakaSpremanja);
      }
      void this.nastaviNakonPartije(partija).catch((greska: unknown) => {
        this.brojTehnickihGresaka += 1;
        this.pogreske.push(greska instanceof Error ? greska.message : String(greska));
        this.prekini('Pogreška pri ponovnom ulasku bota nakon partije.');
      });
    }
  }

  private async nastaviNakonPartije(partija: MjerenaPartija): Promise<void> {
    if (this.planiranoZatvaranje || this.zavrsavanjePokusa || this.signalPrekida?.aborted) return;
    const botovi = [...partija.igraci]
      .filter((igracId) => !partija.vanjskiIgraci.has(igracId))
      .map((igracId) => this.botPoIgracu.get(igracId))
      .filter((bot): bot is BotIgrac => bot !== undefined);
    if (botovi.length !== partija.igraci.size - partija.vanjskiIgraci.size) {
      throw new Error(`Nedostaje bot za partiju ${partija.id}.`);
    }

    for (const bot of botovi) {
      bot.socket.emit('partija:izadji');
      bot.partijaId = null;
      bot.stanje = 'red';
      bot.cekaOdMs = performance.now();
    }

    await odgodi(50, this.signalPrekida);
    if (partija.kontekst === 'trening') {
      await this.zapocniTrening(botovi[0]!, this.signalPrekida);
    } else if (partija.jePrivatna) {
      const vlasnik = botovi.find((bot) => bot.vlasnikSobe);
      if (!vlasnik) throw new Error(`Privatna partija ${partija.id} nema bota-vlasnika.`);
      const stanje = await cekajStanjeSobe(vlasnik.socket, (vrijednost) =>
        vrijednost.status === 'cekanje' && vrijednost.partijaId === null && vrijednost.clanovi.length === 4,
        this.opcije.timeoutMs,
        this.signalPrekida,
        () => vlasnik.socket.emit('soba:stanje'),
      );
      if (stanje.kod !== partija.kodSobe) throw new Error('Promijenio se kod privatne sobe tijekom testa.');
      vlasnik.socket.emit('soba:pokreni');
    } else {
      await Promise.all(botovi.map((bot) => this.udjiUJavniRed(bot, this.signalPrekida)));
    }
    this.partije.delete(partija.id);
  }

  private async udjiUJavniRed(bot: BotIgrac, signal: AbortSignal | undefined): Promise<void> {
    if (signal?.aborted) throw new Error('Test je prekinut.');
    bot.stanje = 'red';
    bot.cekaOdMs = performance.now();
    await new Promise<void>((resolve, reject) => {
      let dovrseno = false;
      const zavrsi = (greska?: Error) => {
        if (dovrseno) return;
        dovrseno = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', prekid);
        bot.socket.off('disconnect', odspojen);
        bot.socket.off('partija:pocetak', partijaPokrenuta);
        if (greska) reject(greska); else resolve();
      };
      const prekid = () => zavrsi(new Error('Test je prekinut.'));
      const odspojen = () => zavrsi(new Error('Veza je prekinuta prije potvrde ulaska u red.'));
      const partijaPokrenuta = (poruka: PocetakPartije) => {
        if (poruka.kontekst === 'javna' && poruka.mod === bot.mod) zavrsi();
      };
      const timer = setTimeout(() => zavrsi(new Error(`Ulazak bota u javni red nije potvrđen: mod=${bot.mod}, stanje=${bot.stanje}, partija=${bot.partijaId ?? 'nema'}, veza=${bot.socket.connected}, transport=${bot.socket.io.engine.transport.name}.`)), this.opcije.timeoutMs);
      signal?.addEventListener('abort', prekid, { once: true });
      bot.socket.once('disconnect', odspojen);
      bot.socket.on('partija:pocetak', partijaPokrenuta);
      bot.socket.emit('red:udji', { mod: bot.mod }, (stanje: unknown) => {
        if (!stanje) {
          zavrsi(new Error('Poslužitelj je odbio ulazak bota u javni red.'));
          return;
        }
        zavrsi();
      });
    });
  }

  /** Zagrijavanje: odbijanje poslužitelja (limit, isključeno) broji se zasebno, jer je to provjera kapaciteta, ne kvar VU-a. */
  private async zapocniTrening(bot: BotIgrac, signal: AbortSignal | undefined): Promise<void> {
    if (signal?.aborted) throw new Error('Test je prekinut.');
    bot.stanje = 'red';
    bot.cekaOdMs = performance.now();
    await new Promise<void>((resolve, reject) => {
      const zavrsi = (greska?: Error) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', prekid);
        bot.socket.off('disconnect', odspojen);
        if (greska) reject(greska); else resolve();
      };
      const prekid = () => zavrsi(new Error('Test je prekinut.'));
      const odspojen = () => zavrsi(new Error('Veza je prekinuta prije potvrde treninga.'));
      const timer = setTimeout(() => zavrsi(new Error('Pokretanje treninga nije potvrđeno.')), this.opcije.timeoutMs);
      signal?.addEventListener('abort', prekid, { once: true });
      bot.socket.once('disconnect', odspojen);
      bot.socket.emit('trening:zapocni', (ishod: { pokrenut: boolean; kod?: string; poruka?: string }) => {
        if (!ishod?.pokrenut) {
          this.brojOdbijenihTreninga += 1;
          zavrsi(new Error(`Poslužitelj je odbio trening: ${ishod?.kod ?? 'nepoznato'}.`));
          return;
        }
        zavrsi();
      });
    });
  }

  private async stvoriPrivatnuSobu(botovi: BotIgrac[], signal: AbortSignal | undefined): Promise<void> {
    const vlasnik = botovi[0]!;
    vlasnik.vlasnikSobe = true;
    const stvorena = cekajDogadaj<{ kod: string }>(
      vlasnik.socket,
      'soba:stvorena',
      this.opcije.timeoutMs,
      (vrijednost) => typeof vrijednost.kod === 'string',
      signal,
    );
    vlasnik.socket.emit('soba:stvori', { postavke: POSTAVKE_PRIVATNE_SOBE });
    const { kod } = await stvorena;
    vlasnik.kodSobe = kod;

    for (let indeks = 1; indeks < botovi.length; indeks += 1) {
      if (signal?.aborted) throw new Error('Test je prekinut.');
      const cekanjeStanja = cekajStanjeSobe(
        vlasnik.socket,
        (stanje) => stanje.kod === kod && stanje.status === 'cekanje' && stanje.clanovi.length === indeks + 1,
        this.opcije.timeoutMs,
        signal,
      );
      botovi[indeks]!.kodSobe = kod;
      botovi[indeks]!.socket.emit('soba:udji', { kod });
      await cekanjeStanja;
    }

    vlasnik.socket.emit('soba:pokreni');
  }

  private dodajUzorak(uzorci: number[], vrijednost: number, ukupanBrojUzoraka: number): void {
    if (uzorci.length < MAKS_UZORAKA_LATENCIJE) {
      uzorci.push(vrijednost);
      return;
    }
    const indeks = Math.floor(Math.random() * ukupanBrojUzoraka);
    if (indeks < MAKS_UZORAKA_LATENCIJE) uzorci[indeks] = vrijednost;
  }
}

async function cekajDogadaj<T>(
  socket: Socket,
  dogadaj: string,
  timeoutMs: number,
  valjan: (vrijednost: T) => boolean,
  signal: AbortSignal | undefined,
): Promise<T> {
  if (signal?.aborted) throw new Error('Test je prekinut.');
  return new Promise<T>((resolve, reject) => {
    const zavrsi = (funkcija: () => void) => {
      clearTimeout(timer);
      socket.off(dogadaj, slusac);
      socket.off('connect_error', greskaSpajanja);
      socket.off('disconnect', odspojen);
      signal?.removeEventListener('abort', prekid);
      funkcija();
    };
    const slusac = (vrijednost: T) => {
      if (valjan(vrijednost)) zavrsi(() => resolve(vrijednost));
    };
    const prekid = () => zavrsi(() => reject(new Error('Test je prekinut.')));
    const greskaSpajanja = (greska: Error & { description?: unknown; data?: { kod?: string } }) => {
      const transportnaGreska = greska.description !== null && typeof greska.description === 'object'
        ? greska.description as { error?: unknown; message?: unknown } : undefined;
      const opis = transportnaGreska?.error instanceof Error ? transportnaGreska.error.message
        : typeof transportnaGreska?.message === 'string' ? transportnaGreska.message
        : typeof greska.description === 'string' || typeof greska.description === 'number' ? String(greska.description) : undefined;
      const detalji = [greska.message, opis, greska.data?.kod].filter(Boolean).join('; ');
      zavrsi(() => reject(new Error(detalji)));
    };
    const odspojen = () => zavrsi(() => reject(new Error(`Veza je prekinuta dok se čeka ${dogadaj}.`)));
    const timer = setTimeout(() => zavrsi(() => reject(new Error(`Događaj ${dogadaj} nije stigao na vrijeme.`))), timeoutMs);
    socket.on(dogadaj, slusac);
    socket.once('connect_error', greskaSpajanja);
    socket.once('disconnect', odspojen);
    signal?.addEventListener('abort', prekid, { once: true });
  });
}

async function cekajStanjeSobe(
  socket: Socket,
  valjano: (stanje: StanjePrivatneSobe) => boolean,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  zatraziStanje?: () => void,
): Promise<StanjePrivatneSobe> {
  const cekanje = cekajDogadaj(socket, 'soba:stanje', timeoutMs, valjano, signal);
  zatraziStanje?.();
  return cekanje;
}

function odgodi(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Test je prekinut.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', prekid);
      resolve();
    }, ms);
    const prekid = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', prekid);
      reject(new Error('Test je prekinut.'));
    };
    signal?.addEventListener('abort', prekid, { once: true });
  });
}