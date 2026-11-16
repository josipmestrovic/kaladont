/**
 * PR11 — prijelaz otvorenih vremenskih ljestvica / Top10 dokaza.
 *
 * Zašto postoji: snižavanje praga (5 dnevno / 10 dulje) ODMAH mijenja čitanje
 * javnih ljestvica. Top10 dokazi se inače upisuju samo na sljedeću promjenu
 * konkurencije. Ovaj CLI jednom snimi trenutni Top10 otvorenih razdoblja
 * postojećim idempotentnim putem (zabiljeziTop10NakonPromjene).
 *
 * OPS (nakon deploya builda s PR11, staging pa produkcija):
 *   1) pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --usporedi
 *   2) pnpm --filter posluzitelj prijelaz-ljestvice-pr11 -- --primijeni=DA
 *      (produkcija: dodaj --odrzavanje-produkcije=DA)
 *   3) ponovno --usporedi; drugi --primijeni=DA mora biti no-op
 *
 * HINT: samo OTVORENA razdoblja (dnevno/tjedno/mjesečno). Ne izmišljati ulaske
 * u zatvorenim periodima. Ne dira rang/DNK/XP. „Na dvije fronte” pairing ostaje
 * 4p↔2p do PR13; Troboj dokazi se ipak bilježe.
 */
import { and, eq, sql } from 'drizzle-orm';
import { kalendarskeGranice, type MetrikaLjestvice, type ModPartije } from 'zajednicko';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { dokaziTop10Ulazaka } from '../baza/shema.js';
import {
  obradiNeobradeneTop10Dokaze,
  REDOSLIJED_MODOVA_TOP10,
  zabiljeziTop10NakonPromjene,
} from '../dostignuca/top10.js';
import { konfiguracija } from '../konfiguracija.js';
import { izracunajPoredak, ocistiMemorijuLjestvica } from '../ljestvice/servis.js';

const RAZDOBLJA = ['dnevno', 'tjedno', 'mjesecno'] as const;
const METRIKE: readonly MetrikaLjestvice[] = ['prosjek_bodova', 'niz_pobjeda'];

function imaZastavicu(ime: string): boolean {
  return process.argv.includes(ime);
}

async function usporediOtvorene(sada: Date): Promise<void> {
  const pocetak = new Date(konfiguracija.LJESTVICE_POCETAK);
  const poModu: Record<string, {
    razdoblje: string;
    uTop10: number;
    bezDokaza: number;
    /** Broj igrača u Top10 koji još nemaju dokaz za taj kalendarski početak. */
    noviKandidati: number;
  }[]> = {};

  for (const mod of REDOSLIJED_MODOVA_TOP10) {
    poModu[mod] = [];
    for (const vrsta of RAZDOBLJA) {
      const kalendar = kalendarskeGranice(vrsta, sada);
      const od = kalendar.od < pocetak ? pocetak : kalendar.od;
      const doUpita = kalendar.do;
      const najbolje = new Map<string, number>();
      for (const metrika of METRIKE) {
        const poredak = await izracunajPoredak(mod, metrika, vrsta, od, doUpita);
        for (const stavka of poredak.rangirani) {
          if (stavka.mjesto === null || stavka.mjesto > 10) continue;
          const postojece = najbolje.get(stavka.igracId);
          if (postojece === undefined || stavka.mjesto < postojece) {
            najbolje.set(stavka.igracId, stavka.mjesto);
          }
        }
      }

      let bezDokaza = 0;
      for (const igracId of najbolje.keys()) {
        const [red] = await baza
          .select({ igracId: dokaziTop10Ulazaka.igracId })
          .from(dokaziTop10Ulazaka)
          .where(and(
            eq(dokaziTop10Ulazaka.igracId, igracId),
            eq(dokaziTop10Ulazaka.vrstaRazdoblja, vrsta),
            eq(dokaziTop10Ulazaka.kalendarskiPocetak, kalendar.od),
            eq(dokaziTop10Ulazaka.mod, mod),
          ))
          .limit(1);
        if (!red) bezDokaza += 1;
      }

      poModu[mod]!.push({
        razdoblje: vrsta,
        uTop10: najbolje.size,
        bezDokaza,
        noviKandidati: bezDokaza,
      });
    }
  }

  console.log(JSON.stringify({
    usporedba: {
      napomena: 'Bez PII. uTop10 = rangirani ≤10 pod novim minom; noviKandidati = još nemaju dokaz za otvoreni kalendarski početak.',
      sada: sada.toISOString(),
      pocetakPracenja: pocetak.toISOString(),
      poModu,
    },
  }, null, 2));
}

async function primijeniSnimku(sada: Date): Promise<{ upisaniDokaziPrije: number; upisaniDokaziPoslije: number; obradenoIgraca: number }> {
  const [prije] = await baza.select({ broj: sql<number>`count(*)::int` }).from(dokaziTop10Ulazaka);
  await baza.transaction(async (tx) => {
    await zabiljeziTop10NakonPromjene(tx, {
      modovi: [...REDOSLIJED_MODOVA_TOP10] as ModPartije[],
      opazenoU: sada,
      izvor: 'partija',
      partijaId: null,
    });
  });
  // Obradi neobrađene u serijama; tvrdi strop sprječava beskonačnu petlju ako neki dokaz zapne.
  let obradenoIgraca = 0;
  for (let serija = 0; serija < 50; serija += 1) {
    const mapa = await obradiNeobradeneTop10Dokaze({ limit: 100 });
    obradenoIgraca += mapa.size;
    if (mapa.size === 0) break;
  }
  ocistiMemorijuLjestvica();
  const [poslije] = await baza.select({ broj: sql<number>`count(*)::int` }).from(dokaziTop10Ulazaka);
  return {
    upisaniDokaziPrije: prije?.broj ?? 0,
    upisaniDokaziPoslije: poslije?.broj ?? 0,
    obradenoIgraca,
  };
}

async function glavno(): Promise<void> {
  const primijeni = imaZastavicu('--primijeni=DA');
  const usporedi = imaZastavicu('--usporedi');
  const odrzavanjeProdukcije = imaZastavicu('--odrzavanje-produkcije=DA');
  const sada = new Date();

  if (konfiguracija.NODE_ENV === 'production' && primijeni && !odrzavanjeProdukcije) {
    throw new Error('U produkciji prijelaz ljestvica traži --odrzavanje-produkcije=DA.');
  }

  if (!primijeni && !usporedi) {
    console.log('Pregled: dodaj --usporedi. Za upis Top10 dokaza otvorenih tablica: --primijeni=DA.');
  }

  if (usporedi) await usporediOtvorene(sada);

  if (primijeni) {
    const rez = await primijeniSnimku(sada);
    console.log(JSON.stringify({
      primijeni: {
        ...rez,
        noviDokazi: rez.upisaniDokaziPoslije - rez.upisaniDokaziPrije,
        napomena: 'Drugi prolaz mora imati noviDokazi=0 (idempotentno).',
      },
    }, null, 2));
  }

  if (usporedi && primijeni) {
    await usporediOtvorene(sada);
  }

  console.log(JSON.stringify({
    sazetak: {
      primijeni,
      usporedi,
      sada: sada.toISOString(),
      modovi: [...REDOSLIJED_MODOVA_TOP10],
    },
  }, null, 2));
}

const pokrenutIzravno = process.argv[1]?.replace(/\\/g, '/').endsWith('/cli/prijelaz-ljestvice-pr11.ts');
if (pokrenutIzravno) {
  glavno().catch((pogreska: unknown) => {
    console.error(pogreska instanceof Error ? pogreska.message : String(pogreska));
    process.exitCode = 1;
  }).finally(() => zatvoriBazu());
}
