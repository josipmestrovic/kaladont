import { konfiguracija } from '../konfiguracija.js';

/** Jednostavan serijski red da analitika ne zasiti DB pool tijekom igre/CI-ja. */
let lanac: Promise<void> = Promise.resolve();

export function uRedAnalitike(posao: () => Promise<void>, oznaka: string): void {
  // Integracijski testovi igre ne trebaju trajne analitičke upise; izbjegava pritisak na pool.
  if (konfiguracija.NODE_ENV === 'test' && process.env.ANALITIKA_U_TESTU !== '1') return;
  lanac = lanac
    .then(posao)
    .catch((greska) => {
      const poruka = greska instanceof Error ? greska.message : String(greska);
      console.error(`[analitika.red] ${oznaka}: ${poruka}`);
    });
}
