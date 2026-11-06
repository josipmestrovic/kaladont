import { konfiguracija } from '../konfiguracija.js';

/** Jednostavan serijski red da analitika ne zasiti DB pool tijekom igre/CI-ja. */
let lanac: Promise<void> = Promise.resolve();

function jeTestOkruzenje(): boolean {
  return (
    process.env.VITEST === 'true'
    || process.env.NODE_ENV === 'test'
    || konfiguracija.NODE_ENV === 'test'
  );
}

export function uRedAnalitike(posao: () => Promise<void>, oznaka: string): void {
  // Integracijski testovi igre ne trebaju trajne analitičke upise; izbjegava pritisak na pool.
  // VITEST/process.env imaju prednost jer dotenv može zamrznuti konfiguracija.NODE_ENV na development.
  if (jeTestOkruzenje() && process.env.ANALITIKA_U_TESTU !== '1') return;
  lanac = lanac
    .then(posao)
    .catch((greska) => {
      const poruka = greska instanceof Error ? greska.message : String(greska);
      console.error(`[analitika.red] ${oznaka}: ${poruka}`);
    });
}
