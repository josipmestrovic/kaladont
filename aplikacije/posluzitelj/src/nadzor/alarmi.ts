import type { StanjeAlarma, UzorakNadzora } from 'zajednicko';

export interface PragoviAlarma {
  cpuPostotak: number;
  rssMiB: number;
  eventLoopMs: number;
  httpMs: number;
}

interface InterniAlarm extends StanjeAlarma {
  iznadOd: number | null;
  pokusajU: number | null;
  obavijestenAktivan: boolean;
}

export class AlarmiNadzora {
  private readonly stanja = new Map<string, InterniAlarm>();
  private slanjeUTijeku = false;
  private zaustavljen = false;
  private zadnjaBazaU: string | null = null;
  private neuspjeleBaze = 0;
  private prethodniBotovi: { isteci: number; greske: number } | null = null;
  private botoviProblemDo = 0;
  private probniPokusajU: number | null = null;

  constructor(
    readonly omogucen: boolean,
    private readonly pragovi: PragoviAlarma,
    private readonly posalji: (predmet: string, tekst: string) => Promise<boolean>,
    private readonly pokrenutU = Date.now(),
  ) {}

  async provjeri(povijest: UzorakNadzora[], sada = Date.now()): Promise<void> {
    if (this.zaustavljen || this.slanjeUTijeku || !povijest.length) return;
    const zadnji = povijest.at(-1)!;
    if (zadnji.baza.provjerenoU !== this.zadnjaBazaU) {
      this.zadnjaBazaU = zadnji.baza.provjerenoU;
      this.neuspjeleBaze = zadnji.baza.dostupna === false ? this.neuspjeleBaze + 1 : 0;
    }
    if (this.prethodniBotovi && (zadnji.igra.isteciBotova > this.prethodniBotovi.isteci || zadnji.igra.greskeBotova > this.prethodniBotovi.greske)) this.botoviProblemDo = sada + 120_000;
    this.prethodniBotovi = { isteci: zadnji.igra.isteciBotova, greske: zadnji.igra.greskeBotova };
    const minuta = povijest.filter((uzorak) => Date.parse(uzorak.vrijeme) > sada - 60_000);
    const zahtjevi = minuta.reduce((zbroj, uzorak) => zbroj + uzorak.http.zahtjevi, 0);
    const greske = minuta.reduce((zbroj, uzorak) => zbroj + uzorak.http.greske5xx, 0);
    const sporiIntervali = minuta.filter((uzorak) => uzorak.http.p95Ms !== null && uzorak.http.p95Ms > this.pragovi.httpMs);
    const sporiZahtjevi = sporiIntervali.reduce((zbroj, uzorak) => zbroj + uzorak.http.zahtjevi, 0);
    const provjere: [string, string, boolean, number][] = [
      ['cpu', 'CPU aplikacije', zadnji.cpuPostotak > this.pragovi.cpuPostotak, 120_000],
      ['memorija', 'Memorija aplikacije', zadnji.rssBajtovi > this.pragovi.rssMiB * 1_048_576, 120_000],
      ['event-loop', 'Event-loop aplikacije', zadnji.eventLoopP95Ms > this.pragovi.eventLoopMs, 120_000],
      ['http-latencija', 'HTTP latencija', zahtjevi >= 20 && sporiZahtjevi / zahtjevi >= 0.5, 120_000],
      ['http-greske', 'HTTP 5xx greške', zahtjevi >= 20 && greske / zahtjevi >= 0.01, 120_000],
      ['baza', 'Dostupnost baze', this.neuspjeleBaze >= 2, 0],
      ['botovi', 'Botovi: istek ili tehnička greška', sada < this.botoviProblemDo, 0],
    ];
    for (const [kljuc, naziv, iznad, odgoda] of provjere) {
      let stanje = this.stanja.get(kljuc);
      if (!stanje) {
        stanje = { kljuc, naziv, aktivan: false, zadnjaObavijest: null, greskaSlanja: false, iznadOd: null, pokusajU: null, obavijestenAktivan: false };
        this.stanja.set(kljuc, stanje);
      }
      if (sada - this.pokrenutU < 60_000) continue;
      if (iznad) {
        stanje.iznadOd ??= sada;
        stanje.aktivan = sada - stanje.iznadOd >= odgoda;
      } else {
        stanje.iznadOd = null;
        stanje.aktivan = false;
      }
    }
    if (!this.omogucen) return;
    const zaSlanje = [...this.stanja.values()].filter((stanje) => {
      const promjena = stanje.aktivan !== stanje.obavijestenAktivan;
      const podsjetnik = stanje.aktivan && stanje.zadnjaObavijest !== null && sada - Date.parse(stanje.zadnjaObavijest) >= 900_000;
      const odgodaPokusaja = stanje.greskaSlanja ? 900_000 : 60_000;
      return (promjena || podsjetnik) && (stanje.pokusajU === null || sada - stanje.pokusajU >= odgodaPokusaja);
    });
    if (!zaSlanje.length) return;
    this.slanjeUTijeku = true;
    const promjene = zaSlanje.map((stanje) => ({ stanje, aktivan: stanje.aktivan }));
    for (const { stanje } of promjene) stanje.pokusajU = sada;
    try {
      const tekst = promjene.map(({ stanje, aktivan }) => `${aktivan ? 'ALARM' : 'OPORAVAK'}: ${stanje.naziv}`).join('\n');
      const uspio = await this.posalji('Kaladont: nadzor poslužitelja', `${tekst}\nVrijeme: ${new Date(sada).toISOString()}\nPregledati admin nadzor i VPS resurse. CPU/RAM odnose se na Node proces.`).catch(() => false);
      for (const { stanje, aktivan } of promjene) {
        stanje.greskaSlanja = !uspio;
        if (uspio) {
          stanje.zadnjaObavijest = new Date(sada).toISOString();
          stanje.obavijestenAktivan = aktivan;
        }
      }
    } finally { this.slanjeUTijeku = false; }
  }

  dohvatiStanja(): StanjeAlarma[] {
    return [...this.stanja.values()].map(({ kljuc, naziv, aktivan, zadnjaObavijest, greskaSlanja }) => ({ kljuc, naziv, aktivan, zadnjaObavijest, greskaSlanja }));
  }

  async posaljiProbnu(sada = Date.now()): Promise<boolean> {
    if (!this.omogucen) throw new Error('Email alarmi nisu uključeni.');
    if (this.slanjeUTijeku || this.zaustavljen || (this.probniPokusajU !== null && sada - this.probniPokusajU < 60_000)) throw new Error('Pričekaj minutu prije ponovne probne obavijesti.');
    this.probniPokusajU = sada;
    this.slanjeUTijeku = true;
    try { return await this.posalji('Kaladont: probna obavijest nadzora', 'Probna obavijest pokrenuta je iz admin sučelja. Potvrdi primitak u svojem inboxu.').catch(() => false); }
    finally { this.slanjeUTijeku = false; }
  }

  zaustavi(): void { this.zaustavljen = true; }
}