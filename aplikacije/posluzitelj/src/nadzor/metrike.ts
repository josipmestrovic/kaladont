import type { UzorakNadzora } from 'zajednicko';

export const MAKS_POVIJESTI = 180;
const MAKS_LATENCIJA = 1_000;

function percentil(vrijednosti: number[]): number | null {
  if (!vrijednosti.length) return null;
  const sortirane = [...vrijednosti].sort((prva, druga) => prva - druga);
  return sortirane[Math.ceil(sortirane.length * 0.95) - 1]!;
}

export class MetrikeNadzora {
  private povijest: UzorakNadzora[] = [];
  private http = { zahtjevi: 0, greske4xx: 0, greske5xx: 0 };
  private socket = { pokusaji: 0, odbijeni: 0, autorizirani: 0, greskeAutorizacije: 0, prekidi: 0, odbijeniOrigin: 0, odbijeniIp: 0, odbijeniLimit: 0 };
  private httpLatencije: number[] = [];
  private autorizacije: number[] = [];
  private brojAutorizacija = 0;
  private cpuPrije: NodeJS.CpuUsage = process.cpuUsage();
  private vrijemePrije = performance.now();
  private baza: UzorakNadzora['baza'] = { dostupna: null, trajanjeMs: null, provjerenoU: null };

  zabiljeziHttp(status: number, trajanjeMs: number): void {
    this.http.zahtjevi += 1;
    if (status >= 500) this.http.greske5xx += 1;
    else if (status >= 400) this.http.greske4xx += 1;
    this.dodajLatenciju(this.httpLatencije, trajanjeMs, this.http.zahtjevi);
  }

  zabiljeziPrihvat(origin: boolean, ip: boolean, limit: boolean): void {
    this.socket.pokusaji += 1;
    if (!origin || !ip || !limit) this.socket.odbijeni += 1;
    if (!origin) this.socket.odbijeniOrigin += 1;
    if (!ip) this.socket.odbijeniIp += 1;
    if (!limit) this.socket.odbijeniLimit += 1;
  }

  zabiljeziAutorizaciju(uspio: boolean, trajanjeMs: number): void {
    if (uspio) this.socket.autorizirani += 1;
    else this.socket.greskeAutorizacije += 1;
    this.brojAutorizacija += 1;
    this.dodajLatenciju(this.autorizacije, trajanjeMs, this.brojAutorizacija);
  }

  zabiljeziPrekid(): void { this.socket.prekidi += 1; }

  zabiljeziBazu(dostupna: boolean, trajanjeMs: number, sada = Date.now()): void {
    this.baza = { dostupna, trajanjeMs, provjerenoU: new Date(sada).toISOString() };
  }

  uzorkuj(igra: UzorakNadzora['igra'], eventLoopP95Ms: number, cpu = process.cpuUsage(), vrijeme = performance.now(), memorija = process.memoryUsage(), sada = Date.now()): UzorakNadzora {
    const proteklo = Math.max(1, vrijeme - this.vrijemePrije);
    const cpuDelta = (cpu.user + cpu.system - this.cpuPrije.user - this.cpuPrije.system) / (proteklo * 10);
    const cpuPostotak = Number.isFinite(cpuDelta) ? Math.max(0, cpuDelta) : 0;
    this.cpuPrije = cpu;
    this.vrijemePrije = vrijeme;
    const uzorak: UzorakNadzora = {
      vrijeme: new Date(sada).toISOString(), cpuPostotak,
      rssBajtovi: memorija.rss, heapBajtovi: memorija.heapUsed, vanjskaMemorijaBajtovi: memorija.external,
      eventLoopP95Ms: Number.isFinite(eventLoopP95Ms) ? Math.max(0, eventLoopP95Ms) : 0,
      http: { ...this.http, p95Ms: percentil(this.httpLatencije) },
      socket: { ...this.socket, p95AutorizacijeMs: percentil(this.autorizacije) },
      igra: { ...igra }, baza: { ...this.baza },
    };
    this.povijest.push(uzorak);
    if (this.povijest.length > MAKS_POVIJESTI) this.povijest.shift();
    this.http = { zahtjevi: 0, greske4xx: 0, greske5xx: 0 };
    this.httpLatencije = [];
    this.autorizacije = [];
    this.brojAutorizacija = 0;
    return uzorak;
  }

  dohvatiPovijest(): UzorakNadzora[] { return structuredClone(this.povijest); }
  dohvatiTrenutno(): UzorakNadzora | null { return structuredClone(this.povijest.at(-1) ?? null); }

  private dodajLatenciju(uzorci: number[], vrijednost: number, broj: number): void {
    if (!Number.isFinite(vrijednost) || vrijednost < 0) return;
    if (uzorci.length < MAKS_LATENCIJA) uzorci.push(vrijednost);
    else {
      const indeks = Math.floor(Math.random() * broj);
      if (indeks < MAKS_LATENCIJA) uzorci[indeks] = vrijednost;
    }
  }
}