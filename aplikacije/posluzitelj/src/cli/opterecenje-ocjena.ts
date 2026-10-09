export function procitajHttpSazetak(sazetak: Record<string, unknown>) {
  const metrike = sazetak.metrics as Record<string, Record<string, unknown>> | undefined;
  function vrijednost(naziv: string, kljuc: string, alternativa?: string): number {
    const metrika = metrike?.[naziv];
    const podaci = (metrika?.values ?? metrika) as Record<string, unknown> | undefined;
    const rezultat = podaci?.[kljuc] ?? (alternativa ? podaci?.[alternativa] : undefined);
    if (typeof rezultat !== 'number' || !Number.isFinite(rezultat) || rezultat < 0) {
      throw new Error(`K6 sažetak nema valjanu metriku ${naziv}.${kljuc}.`);
    }
    return rezultat;
  }
  return {
    stopaGresaka: vrijednost('http_req_failed', 'rate', 'value'),
    p95Ms: vrijednost('http_req_duration', 'p(95)'),
    brojZahtjeva: vrijednost('http_reqs', 'count'),
    najviseVus: vrijednost('kaladont_aktivni_http_drzanje', 'max'),
    najmanjeVusDrzanja: vrijednost('kaladont_aktivni_http_drzanje', 'min'),
    brojZahtjevaDrzanja: vrijednost('kaladont_http_zahtjevi_drzanje', 'count'),
    udioValjanihOdgovora: vrijednost('checks', 'rate', 'value'),
  };
}

export function percentilMjerenja(vrijednosti: readonly number[], udio: number): number | null {
  if (vrijednosti.length === 0 || vrijednosti.some((vrijednost) => !Number.isFinite(vrijednost) || vrijednost < 0)) return null;
  const sortirano = [...vrijednosti].sort((prva, druga) => prva - druga);
  return sortirano[Math.max(0, Math.ceil(sortirano.length * udio) - 1)]!;
}

export function ocijeniMijesanoMjerenje(ulaz: {
  poteziMs: readonly number[];
  spremanjaMs: readonly number[];
  aktivniIgraci: readonly number[];
  igrackiKorisnici: readonly number[];
  ciljaniIgraci: number;
  planiranoDrzanjeMs: number;
  stvarnoDrzanjeMs: number;
}) {
  const p95PotezMs = percentilMjerenja(ulaz.poteziMs, 0.95);
  const p95SpremanjeMs = percentilMjerenja(ulaz.spremanjaMs, 0.95);
  const najmanjeAktivnihIgraca = ulaz.aktivniIgraci.length > 0
    ? Math.min(...ulaz.aktivniIgraci)
    : null;
  const najmanjeIgrackihKorisnika = ulaz.igrackiKorisnici.length > 0
    ? Math.min(...ulaz.igrackiKorisnici)
    : null;
  return {
    p95PotezMs,
    p95SpremanjeMs,
    najmanjeAktivnihIgraca,
    najmanjeIgrackihKorisnika,
    provjere: {
      p95Potez: p95PotezMs !== null && p95PotezMs <= 250,
      p95Spremanje: p95SpremanjeMs !== null && p95SpremanjeMs <= 1_000,
      igrackiKorisniciOdrzani: najmanjeIgrackihKorisnika !== null &&
        ulaz.igrackiKorisnici.every((broj) => Number.isSafeInteger(broj) && broj >= 0 && broj <= ulaz.ciljaniIgraci) &&
        najmanjeIgrackihKorisnika >= Math.ceil(ulaz.ciljaniIgraci * 0.995),
      aktivnostIzmjerena: ulaz.aktivniIgraci.length > 0 &&
        ulaz.aktivniIgraci.every((broj) => Number.isSafeInteger(broj) && broj >= 0 && broj <= ulaz.ciljaniIgraci) &&
        ulaz.aktivniIgraci.some((broj) => broj > 0),
      punoDrzanje: ulaz.planiranoDrzanjeMs > 0 && ulaz.stvarnoDrzanjeMs >= ulaz.planiranoDrzanjeMs,
      dovoljnoUzoraka: ulaz.igrackiKorisnici.length === ulaz.aktivniIgraci.length &&
        ulaz.aktivniIgraci.length >= Math.max(1, Math.floor(ulaz.planiranoDrzanjeMs / 1_000) - 2),
    },
  };
}

export const MAKS_EVENT_LOOP_P95_MS = 100;
export const MIN_UDIO_ODRZANIH_TRENINGA = 0.9;

export type ModPopune = 'dva_igraca' | 'cetiri_igraca';
/** Autoritativni pragovi popune (docs/02-pravila-igre/botovi.md): početak partije od ulaska jedinog čovjeka. */
export const OCEKIVANO_CEKANJE_POPUNE_MS: Record<ModPopune, number> = { dva_igraca: 30_000, cetiri_igraca: 40_000 };
/** Trenuci u kojima se u čekaonici četveroboja pojavljuju rezervirani botovi prije početka. */
export const OCEKIVANE_REZERVACIJE_MS: Record<ModPopune, readonly number[]> = { dva_igraca: [], cetiri_igraca: [20_000, 30_000] };
export const OCEKIVANI_BOTOVI_POPUNE: Record<ModPopune, number> = { dva_igraca: 1, cetiri_igraca: 3 };
export const TOLERANCIJA_POPUNE_MS = 3_000;

export interface MjerenjePopune {
  mod: ModPopune;
  /** `red:udji` ack → `partija:pocetak`; `null` ako partija nije počela. */
  cekanjeMs: number | null;
  /** Sudionici koji nisu VU prema `partija:pocetak`. */
  brojBotova: number | null;
  /** Vrijeme od ulaska do pojave k-tog rezerviranog bota u `red:stanje`. */
  rezervacijeMs: number[];
  potezaBota: number;
  zavrsena: boolean;
}

function unutarTolerancije(izmjereno: number | undefined, ocekivano: number): boolean {
  return izmjereno !== undefined && Math.abs(izmjereno - ocekivano) <= TOLERANCIJA_POPUNE_MS;
}

/**
 * Ocjena predtesta popune reda: svaki VU ulazi sam u red, pa poslužitelj mora rezervirati i dovesti botove
 * točno po pragovima. Delte health brojača računaju se od početnog uzorka; `null` znači nedostupnu metriku.
 */
export function ocijeniPopunuReda(ulaz: {
  mjerenja: readonly MjerenjePopune[];
  planirano: Record<ModPopune, number>;
  istekBotovaDelta: number | null;
  tehnickeGreskeBotovaDelta: number | null;
  iscrpljenjaDelta: number | null;
  tehnickeGreskeGeneratora: number;
}) {
  const poModu = (mod: ModPopune) => ulaz.mjerenja.filter((mjerenje) => mjerenje.mod === mod);
  const pokrenute = ulaz.mjerenja.filter((mjerenje) => mjerenje.cekanjeMs !== null);
  const cekanjeUredno = (mod: ModPopune) => poModu(mod).every((mjerenje) =>
    mjerenje.cekanjeMs !== null && unutarTolerancije(mjerenje.cekanjeMs, OCEKIVANO_CEKANJE_POPUNE_MS[mod]));
  const sastavUredan = (mod: ModPopune) => poModu(mod).every((mjerenje) => mjerenje.brojBotova === OCEKIVANI_BOTOVI_POPUNE[mod]);
  const rezervacijeUredne = (mod: ModPopune) => poModu(mod).every((mjerenje) =>
    OCEKIVANE_REZERVACIJE_MS[mod].every((ocekivano, indeks) => unutarTolerancije(mjerenje.rezervacijeMs[indeks], ocekivano)));
  const svePlanirane = (['dva_igraca', 'cetiri_igraca'] as const).every((mod) => poModu(mod).length === ulaz.planirano[mod]);
  const cekanja = (mod: ModPopune) => poModu(mod).map((mjerenje) => mjerenje.cekanjeMs).filter((broj): broj is number => broj !== null);
  return {
    pokrenutePartije: pokrenute.length,
    zavrsenePartije: ulaz.mjerenja.filter((mjerenje) => mjerenje.zavrsena).length,
    cekanjeDvobojaMs: { min: Math.min(...cekanja('dva_igraca')), max: Math.max(...cekanja('dva_igraca')) },
    cekanjeCetverobojaMs: { min: Math.min(...cekanja('cetiri_igraca')), max: Math.max(...cekanja('cetiri_igraca')) },
    provjere: {
      svePartijePokrenute: svePlanirane && pokrenute.length === ulaz.mjerenja.length && ulaz.mjerenja.length > 0,
      cekanjeDvoboja: cekanjeUredno('dva_igraca'),
      cekanjeCetveroboja: cekanjeUredno('cetiri_igraca'),
      sastavDvoboja: sastavUredan('dva_igraca'),
      sastavCetveroboja: sastavUredan('cetiri_igraca'),
      rezervacijeVidljive: rezervacijeUredne('cetiri_igraca'),
      botoviIgraju: ulaz.mjerenja.every((mjerenje) => mjerenje.potezaBota > 0),
      botBezIsteka: ulaz.istekBotovaDelta === 0,
      botBezTehnickihGresaka: ulaz.tehnickeGreskeBotovaDelta === 0,
      fondBezIscrpljenja: ulaz.iscrpljenjaDelta === 0,
      tehnickeGreske: ulaz.tehnickeGreskeGeneratora === 0,
    },
  };
}

/**
 * Ocjena računalnih protivnika (ADR-017) u stres testu. Delte health brojača računaju se od
 * početnog uzorka; `null` metrika znači da poslužitelj ne izlaže podatak i provjera pada.
 */
export function ocijeniRacunalneProtivnike(ulaz: {
  brojTreninga: number;
  zavrsenihTreninga: number;
  aktivniTreninziUzorci: readonly number[];
  poteziTreningaMs: readonly number[];
  istekRacunalaGenerator: number;
  odbijeniTreninzi: number;
  botIsteciPocetak: number | null;
  botIsteciKraj: number | null;
  botTehnickeGreskePocetak: number | null;
  botTehnickeGreskeKraj: number | null;
  eventLoopP95Uzorci: readonly (number | null)[];
}) {
  const trazeniTreninzi = ulaz.brojTreninga > 0;
  const valjaniLag = ulaz.eventLoopP95Uzorci.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
  const eventLoopP95Ms = valjaniLag.length === ulaz.eventLoopP95Uzorci.length && valjaniLag.length > 0 ? Math.max(...valjaniLag) : null;
  const p95PotezTreningaMs = percentilMjerenja(ulaz.poteziTreningaMs, 0.95);
  const najmanjeTreninga = ulaz.aktivniTreninziUzorci.length > 0 ? Math.min(...ulaz.aktivniTreninziUzorci) : null;
  // Između dva treninga VU je nekoliko stotina ms bez partije, pa se održanost mjeri medijanom, ne minimumom.
  const medijanTreninga = percentilMjerenja(ulaz.aktivniTreninziUzorci, 0.5);
  const deltaIsteka = ulaz.botIsteciPocetak !== null && ulaz.botIsteciKraj !== null ? ulaz.botIsteciKraj - ulaz.botIsteciPocetak : null;
  const deltaGresaka = ulaz.botTehnickeGreskePocetak !== null && ulaz.botTehnickeGreskeKraj !== null
    ? ulaz.botTehnickeGreskeKraj - ulaz.botTehnickeGreskePocetak
    : null;
  return {
    eventLoopP95Ms,
    p95PotezTreningaMs,
    najmanjeTreninga,
    medijanTreninga,
    deltaIsteka,
    deltaGresaka,
    provjere: {
      treningZavrsava: !trazeniTreninzi || ulaz.zavrsenihTreninga > 0,
      treninziPrihvaceni: ulaz.odbijeniTreninzi === 0,
      treninziOdrzani: !trazeniTreninzi || (medijanTreninga !== null && medijanTreninga >= Math.ceil(ulaz.brojTreninga * MIN_UDIO_ODRZANIH_TRENINGA)),
      botBezIsteka: deltaIsteka === 0 && ulaz.istekRacunalaGenerator === 0,
      botBezTehnickihGresaka: deltaGresaka === 0,
      latencijeTrening: !trazeniTreninzi || (p95PotezTreningaMs !== null && p95PotezTreningaMs <= 250),
      eventLoopPosluzitelja: eventLoopP95Ms !== null && eventLoopP95Ms <= MAKS_EVENT_LOOP_P95_MS,
    },
  };
}