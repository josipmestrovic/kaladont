export interface PostavkeSocketOgranicenja {
  handshakePoIpMinuti: number;
  maksimalnoAktivnihVeza: number;
  maksimalnoPrivatnihSoba: number;
  maksimalnoAktivnihPartija: number;
  prozorDogadajaMs: number;
  dogadajiPoProzoru: number;
}

export class OgranicivacDogadaja {
  private readonly pozivi = new Map<string, number[]>();
  private readonly cistac: NodeJS.Timeout;

  constructor(private readonly prozorMs: number) {
    this.cistac = setInterval(() => {
      const granica = Date.now() - this.prozorMs;
      for (const [kljuc, povijest] of this.pozivi) {
        if (povijest.every((vrijeme) => vrijeme <= granica)) this.pozivi.delete(kljuc);
      }
    }, Math.max(1_000, this.prozorMs));
    this.cistac.unref();
  }

  dopusti(kljuc: string, maksimum: number, sada = Date.now()): boolean {
    const granica = sada - this.prozorMs;
    const povijest = (this.pozivi.get(kljuc) ?? []).filter((vrijeme) => vrijeme > granica);
    if (povijest.length >= maksimum) {
      this.pozivi.set(kljuc, povijest);
      return false;
    }
    povijest.push(sada);
    this.pozivi.set(kljuc, povijest);
    return true;
  }
}

export type ProvjeriOgranicenjeDogadaja = (igracId: string, dogadaj: string) => boolean;