/**
 * Verzionirani parametri ponašanja bota (ADR-017, docs/02-pravila-igre/botovi.md).
 * Postoci se mijenjaju ovdje ili env varijablama, ne skrivenim konstantama u logici.
 */
import { z } from 'zod';
import { PRAGOVI_POPUNE_MS } from '../red/raspored-popune.js';

/** PR02 + v8: agresivnost poolova, shield i repertoar. */
export const VERZIJA_BOT_POLITIKE = 8;

export type PrioritetPoolova = 'p2_p1' | 'p1_p2';

export type KategorijaRijeci = 'uobicajena' | 'srednja' | 'rijetka';

export interface KonfiguracijaBota {
  verzija: typeof VERZIJA_BOT_POLITIKE;
  /** Korpusna frekvencija: >= uobicajena je uobičajena, >= srednja je srednja, ostalo (uključujući 0) rijetko. */
  pragFrekvencije: { uobicajena: number; srednja: number };
  marginaRokaMs: number;
  /** Ciljano trajanje razmišljanja od početka poteza (ms). */
  trajanjePotezaBotaMs: number;
  /** Simetrični jitter oko trajanjePotezaBotaMs (ms). */
  jitterPotezaBotaMs: number;
  /** Minimalna odgoda reakcije prije slanja (ms); plus nasumično 0–1000 ms. */
  odgodaReakcijeMinMs: number;
  /** Vjerojatnost „Ne znam” kad je poznati skup mali (1–N opcija bez česte sigurne). */
  vjerojatnostNeznanjaUMalomSkupu: number;
  /** Gornja granica neovisnih opcija koja još čini „mali” skup. */
  maksimalnoOpcijaMalogSkupa: number;
  /** Udio poteza u kojima bot traži riječ u taktičkim poolovima (jedan roll po tokenu). */
  vjerojatnostAgresivnosti: number;
  /** Udio poteza u dvoboju (2 aktivna) u kojem bot preferira „sigurne” riječi (jedan roll po tokenu). */
  vjerojatnostShielda: number;
  /** Redoslijed pregleda pool_1 / pool_2 kad je agresivnost aktivna. */
  prioritetPoolova: PrioritetPoolova;
  brziRazvoj: boolean;
  odstupanjaPopuneMs: Record<'dva_igraca' | 'tri_igraca' | 'cetiri_igraca', readonly number[]>;
  pragoviPopuneMs: Record<'dva_igraca' | 'tri_igraca' | 'cetiri_igraca', readonly number[]>;
  treningOmogucen: boolean;
  botoviDvoboj: boolean;
  botoviTroboj: boolean;
  botoviCetveroboj: boolean;
  treningUpozorenjeNeaktivnostiMs: number;
  treningZatvaranjeNeaktivnostiMs: number;
  udioImenica: number;
  skalaLogFrekvencije: number;
  ponderDuljinePoGrafemu: number;
  maksimalnoAktivnihBotova: number;
  maksimalnoOporavakaBota: number;
  odmaciOporavkaBotaMs: readonly number[];
  pokusajiOsvjezavanjaProfila: number;
  odmakOsvjezavanjaProfilaMs: number;
  brojNedavnihProtivnika: number;
  vijekNedavnihProtivnikaMs: number;
  maksimalnoZapisaProtivnika: number;
  odmaciPonovnogPokretanjaRedaMs: readonly number[];
}

/** Stara polja v3–v5 koja se pri migraciji tiho odbacuju. */
export const ZASTARJELA_POLJA_BOT_POLITIKE = [
  'vjerojatnostIzostankaPoSudjelovanju',
  'vjerojatnostReakcijePozdravNaPocetku',
  'vjerojatnostReakcijeSorryPriEliminaciji',
  'vjerojatnostReakcijeBravoPriIspadanju',
  'vjerojatnostReakcijeHvalaPriIspadanju',
  'treningRazmisljanjeMinMs',
  'treningRazmisljanjeMaksMs',
  'udioBrzih',
  'udioUobicajenih',
  'rasponBrzih',
  'rasponUobicajenih',
  'rasponSporih',
  'rasponPotezaIzostanka',
  'koeficijentTempaMin',
  'koeficijentTempaMaks',
  'korekcijaDuljinePoGrafemu',
  'maksimalnaKorekcijaDuljine',
  'korekcijaRijetkosti',
  'korekcijaTeskogPrefiksa',
  'minimalniUdioPoteza',
  'maksimalniUdioPoteza',
  'vjerojatnostNeznanjaPoSudjelovanju',
  'rasponTeskogPotezaNeznanja',
  // Botovi V8: Dokaži-specifične poluge — strip iz starih admin JSON snapshotova.
  'dokaziBudzetDetaljneProvjere',
  'dokaziBudzetDodatneProvjere',
  'vjerojatnostDokaziPreskokaPotvrde',
  'dokaziFaktorPropusaPotvrde',
  // Botovi V8: KA bez vjerojatnosti propusta/ostavljanja.
  'vjerojatnostOstavljanjaKa',
  'vjerojatnostPropustaKa',
  // Botovi V8 C10: stara 1-ply taktika.
  'vjerojatnostTaktickogPoteza',
  'maksimalnoTaktickihKandidata',
] as const;

export const ZADANA_KONFIGURACIJA_BOTA: KonfiguracijaBota = {
  verzija: VERZIJA_BOT_POLITIKE,
  pragFrekvencije: { uobicajena: 100, srednja: 10 },
  marginaRokaMs: 1_500,
  trajanjePotezaBotaMs: 4_000,
  jitterPotezaBotaMs: 300,
  odgodaReakcijeMinMs: 2_000,
  vjerojatnostNeznanjaUMalomSkupu: 0.1,
  maksimalnoOpcijaMalogSkupa: 3,
  vjerojatnostAgresivnosti: 0.3,
  vjerojatnostShielda: 0.3,
  prioritetPoolova: 'p2_p1',
  brziRazvoj: false,
  odstupanjaPopuneMs: { dva_igraca: [4_000], tri_igraca: [0, 0], cetiri_igraca: [3_000, 3_000, 3_000] },
  pragoviPopuneMs: structuredClone(PRAGOVI_POPUNE_MS),
  treningOmogucen: true,
  botoviDvoboj: false,
  botoviTroboj: false,
  botoviCetveroboj: false,
  treningUpozorenjeNeaktivnostiMs: 240_000,
  treningZatvaranjeNeaktivnostiMs: 300_000,
  udioImenica: 0.9,
  skalaLogFrekvencije: 1,
  ponderDuljinePoGrafemu: 0.1,
  maksimalnoAktivnihBotova: 100,
  maksimalnoOporavakaBota: 2,
  odmaciOporavkaBotaMs: [100, 200],
  pokusajiOsvjezavanjaProfila: 3,
  odmakOsvjezavanjaProfilaMs: 1_000,
  brojNedavnihProtivnika: 2,
  vijekNedavnihProtivnikaMs: 86_400_000,
  maksimalnoZapisaProtivnika: 50_000,
  odmaciPonovnogPokretanjaRedaMs: [1_000, 2_000, 4_000, 5_000],
};

const Vjerojatnost = z.number().finite().min(0).max(1);
const Vrijeme = z.number().int().min(0).max(300_000);
const Pragovi = z.object({
  dva_igraca: z.tuple([Vrijeme]),
  tri_igraca: z.tuple([Vrijeme, Vrijeme]),
  cetiri_igraca: z.tuple([Vrijeme, Vrijeme, Vrijeme]),
}).strict();

export const ShemaKonfiguracijeBota = z.object({
  verzija: z.literal(VERZIJA_BOT_POLITIKE),
  pragFrekvencije: z.object({ uobicajena: z.number().int().min(0).max(2_000_000_000), srednja: z.number().int().min(0).max(2_000_000_000) }).strict(),
  marginaRokaMs: z.number().int().min(150).max(1_500),
  trajanjePotezaBotaMs: z.number().int().min(500).max(30_000),
  jitterPotezaBotaMs: z.number().int().min(0).max(2_000),
  odgodaReakcijeMinMs: z.number().int().min(0).max(10_000),
  vjerojatnostNeznanjaUMalomSkupu: Vjerojatnost,
  maksimalnoOpcijaMalogSkupa: z.number().int().min(1).max(20),
  vjerojatnostAgresivnosti: Vjerojatnost,
  vjerojatnostShielda: Vjerojatnost,
  prioritetPoolova: z.enum(['p2_p1', 'p1_p2']),
  brziRazvoj: z.boolean(),
  odstupanjaPopuneMs: Pragovi,
  pragoviPopuneMs: Pragovi,
  treningOmogucen: z.boolean(),
  botoviDvoboj: z.boolean(),
  botoviTroboj: z.boolean(),
  botoviCetveroboj: z.boolean(),
  treningUpozorenjeNeaktivnostiMs: z.number().int().min(60_000).max(86_400_000),
  treningZatvaranjeNeaktivnostiMs: z.number().int().min(60_000).max(86_400_000),
  udioImenica: Vjerojatnost,
  skalaLogFrekvencije: z.number().finite().min(0).max(10),
  ponderDuljinePoGrafemu: z.number().finite().min(0).max(2),
  maksimalnoAktivnihBotova: z.number().int().min(1).max(100),
  maksimalnoOporavakaBota: z.number().int().min(0).max(5),
  odmaciOporavkaBotaMs: z.array(z.number().int().min(10).max(5_000)).max(5),
  pokusajiOsvjezavanjaProfila: z.number().int().min(1).max(10),
  odmakOsvjezavanjaProfilaMs: z.number().int().min(100).max(30_000),
  brojNedavnihProtivnika: z.number().int().min(0).max(10),
  vijekNedavnihProtivnikaMs: z.number().int().min(60_000).max(604_800_000),
  maksimalnoZapisaProtivnika: z.number().int().min(0).max(100_000),
  odmaciPonovnogPokretanjaRedaMs: z.array(z.number().int().min(100).max(60_000)).min(1).max(10),
}).strict().superRefine((postavke, provjera) => {
  const pogreska = (polje: string, poruka: string) => provjera.addIssue({ code: z.ZodIssueCode.custom, path: [polje], message: poruka });
  if (postavke.odmaciOporavkaBotaMs.length < postavke.maksimalnoOporavakaBota) pogreska('odmaciOporavkaBotaMs', 'Za svaki oporavak mora postojati odmak.');
  if (postavke.treningUpozorenjeNeaktivnostiMs >= postavke.treningZatvaranjeNeaktivnostiMs) pogreska('treningZatvaranjeNeaktivnostiMs', 'Zatvaranje mora biti nakon upozorenja.');
  if (postavke.pragFrekvencije.srednja > postavke.pragFrekvencije.uobicajena) pogreska('pragFrekvencije', 'Srednji prag ne smije prelaziti uobičajeni.');
  if (postavke.jitterPotezaBotaMs > postavke.trajanjePotezaBotaMs) pogreska('jitterPotezaBotaMs', 'Jitter ne smije prelaziti trajanje poteza.');
  for (const mod of ['dva_igraca', 'tri_igraca', 'cetiri_igraca'] as const) {
    const pragovi = postavke.pragoviPopuneMs[mod];
    if (pragovi.some((prag, indeks) => prag < postavke.odstupanjaPopuneMs[mod][indeks]! || (indeks > 0 && prag < pragovi[indeks - 1]!))) pogreska('pragoviPopuneMs', 'Pragovi moraju biti poredani i barem jednaki odstupanju.');
  }
});

function postotak(vrijednost: string | undefined, zadano: number): number {
  const broj = Number(vrijednost);
  return vrijednost !== undefined && Number.isFinite(broj) && broj >= 0 && broj <= 1 ? broj : zadano;
}

function cijeliBroj(vrijednost: string | undefined, zadano: number, min: number, max: number): number {
  const broj = Number(vrijednost);
  return vrijednost !== undefined && Number.isInteger(broj) && broj >= min && broj <= max ? broj : zadano;
}

export function ucitajKonfiguracijuBota(env: NodeJS.ProcessEnv = process.env): KonfiguracijaBota {
  const lokalnoTestiranje = env.NODE_ENV === 'development' && env.BOTOVI_BRZI_RAZVOJ !== 'false';
  return {
    ...structuredClone(ZADANA_KONFIGURACIJA_BOTA),
    treningOmogucen: env.TRENING_OMOGUCEN !== 'false',
    botoviDvoboj: env.BOTOVI_DVOBOJ === 'true',
    botoviTroboj: env.BOTOVI_TROBOJ === 'true',
    botoviCetveroboj: env.BOTOVI_CETVEROBOJ === 'true',
    brziRazvoj: lokalnoTestiranje,
    vjerojatnostNeznanjaUMalomSkupu: postotak(env.BOT_NEZNANJE_U_MALOM_SKUPU, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostNeznanjaUMalomSkupu),
    maksimalnoOpcijaMalogSkupa: cijeliBroj(env.BOT_MAKS_OPCIJA_MALOG_SKUPA, ZADANA_KONFIGURACIJA_BOTA.maksimalnoOpcijaMalogSkupa, 1, 20),
    vjerojatnostAgresivnosti: postotak(env.BOT_VJEROJATNOST_AGRESIVNOSTI, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostAgresivnosti),
    vjerojatnostShielda: postotak(env.BOT_VJEROJATNOST_SHIELDA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostShielda),
    prioritetPoolova: env.BOT_PRIORITET_POOLOVA === 'p1_p2' ? 'p1_p2' : ZADANA_KONFIGURACIJA_BOTA.prioritetPoolova,
  };
}
