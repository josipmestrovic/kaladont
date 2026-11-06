/** Jednostavan serijski red da analitika ne zasiti DB pool tijekom igre/CI-ja. */
let lanac: Promise<void> = Promise.resolve();

export function uRedAnalitike(posao: () => Promise<void>, oznaka: string): void {
  lanac = lanac
    .then(posao)
    .catch((greska) => {
      const poruka = greska instanceof Error ? greska.message : String(greska);
      console.error(`[analitika.red] ${oznaka}: ${poruka}`);
    });
}
