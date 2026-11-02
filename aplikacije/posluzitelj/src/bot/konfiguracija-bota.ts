/**
 * Verzionirani parametri ponašanja bota (ADR-017, docs/02-pravila-igre/botovi.md).
 * Postoci se mijenjaju ovdje ili env varijablama, ne skrivenim konstantama u logici.
 */
import { z } from 'zod';
import { PRAGOVI_POPUNE_MS } from '../red/raspored-popune.js';

export const VERZIJA_BOT_POLITIKE = 3;

export type KategorijaRijeci = 'uobicajena' | 'srednja' | 'rijetka';

export interface KonfiguracijaBota {
  verzija: typeof VERZIJA_BOT_POLITIKE;
  /** Korpusna frekvencija: >= uobicajena je uobičajena, >= srednja je srednja, ostalo (uključujući 0) rijetko. */
  pragFrekvencije: { uobicajena: number; srednja: number };
  marginaRokaMs: number;
  /** Vjerojatnost da bot ostavi riječ na „ka” kad takva postoji među poznatim kandidatima. */
  vjerojatnostOstavljanjaKa: number;
  /** Vjerojatnost da bot propusti tuđi „ka” i igra običnu riječ umjesto kaladonta. */
  vjerojatnostPropustaKa: number;
  vjerojatnostNeznanjaPoSudjelovanju: number;
  vjerojatnostIzostankaPoSudjelovanju: number;
  treningRazmisljanjeMinMs: number;
  treningRazmisljanjeMaksMs: number;
  brziRazvoj: boolean;
  udioBrzih: number;
  udioUobicajenih: number;
  rasponBrzih: readonly [number, number];
  rasponUobicajenih: readonly [number, number];
  rasponSporih: readonly [number, number];
  rasponPotezaIzostanka: readonly [number, number];
  rasponTeskogPotezaNeznanja: readonly [number, number];
  odstupanjaPopuneMs: Record<'dva_igraca' | 'cetiri_igraca', readonly number[]>;
  pragoviPopuneMs: Record<'dva_igraca' | 'cetiri_igraca', readonly number[]>;
  treningOmogucen: boolean;
  botoviDvoboj: boolean;
  botoviCetveroboj: boolean;
  treningUpozorenjeNeaktivnostiMs: number;
  treningZatvaranjeNeaktivnostiMs: number;
  udioImenica: number;
  skalaLogFrekvencije: number;
  ponderDuljinePoGrafemu: number;
  koeficijentTempaMin: number;
  koeficijentTempaMaks: number;
  korekcijaDuljinePoGrafemu: number;
  maksimalnaKorekcijaDuljine: number;
  korekcijaRijetkosti: number;
  korekcijaTeskogPrefiksa: number;
  minimalniUdioPoteza: number;
  maksimalniUdioPoteza: number;
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

export const ZADANA_KONFIGURACIJA_BOTA: KonfiguracijaBota = {
  verzija: VERZIJA_BOT_POLITIKE,
  pragFrekvencije: { uobicajena: 100, srednja: 10 },
  marginaRokaMs: 1_500,
  vjerojatnostOstavljanjaKa: 0.015,
  vjerojatnostPropustaKa: 0.08,
  vjerojatnostNeznanjaPoSudjelovanju: 0.2,
  vjerojatnostIzostankaPoSudjelovanju: 0.02,
  treningRazmisljanjeMinMs: 1_000,
  treningRazmisljanjeMaksMs: 3_000,
  brziRazvoj: false,
  udioBrzih: 0.2,
  udioUobicajenih: 0.65,
  rasponBrzih: [0.08, 0.2],
  rasponUobicajenih: [0.2, 0.55],
  rasponSporih: [0.55, 0.85],
  rasponPotezaIzostanka: [2, 12],
  rasponTeskogPotezaNeznanja: [1, 3],
  odstupanjaPopuneMs: { dva_igraca: [4_000], cetiri_igraca: [3_000, 3_000, 3_000] },
  pragoviPopuneMs: structuredClone(PRAGOVI_POPUNE_MS),
  treningOmogucen: true,
  botoviDvoboj: false,
  botoviCetveroboj: false,
  treningUpozorenjeNeaktivnostiMs: 240_000,
  treningZatvaranjeNeaktivnostiMs: 300_000,
  udioImenica: 0.9,
  skalaLogFrekvencije: 1,
  ponderDuljinePoGrafemu: 0.1,
  koeficijentTempaMin: 0.9,
  koeficijentTempaMaks: 1.1,
  korekcijaDuljinePoGrafemu: 0.005,
  maksimalnaKorekcijaDuljine: 0.05,
  korekcijaRijetkosti: 0.03,
  korekcijaTeskogPrefiksa: 0.015,
  minimalniUdioPoteza: 0.08,
  maksimalniUdioPoteza: 0.85,
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
const UdioPoteza = z.number().finite().min(0.01).max(0.99);
const Vrijeme = z.number().int().min(0).max(300_000);
const BrojPoteza = z.number().int().min(1).max(100);
const Raspon = z.tuple([UdioPoteza, UdioPoteza]).refine(([od, doVrijednosti]) => od <= doVrijednosti, 'Početak raspona mora biti manji od kraja.');
const RasponPoteza = z.tuple([BrojPoteza, BrojPoteza]).refine(([od, doVrijednosti]) => od <= doVrijednosti, 'Početak raspona mora biti manji od kraja.');
const Pragovi = z.object({ dva_igraca: z.tuple([Vrijeme]), cetiri_igraca: z.tuple([Vrijeme, Vrijeme, Vrijeme]) }).strict();

export const ShemaKonfiguracijeBota = z.object({
  verzija: z.literal(VERZIJA_BOT_POLITIKE),
  pragFrekvencije: z.object({ uobicajena: z.number().int().min(0).max(2_000_000_000), srednja: z.number().int().min(0).max(2_000_000_000) }).strict(),
  marginaRokaMs: z.number().int().min(150).max(1_500),
  vjerojatnostOstavljanjaKa: Vjerojatnost,
  vjerojatnostPropustaKa: Vjerojatnost.default(0.08),
  vjerojatnostNeznanjaPoSudjelovanju: Vjerojatnost,
  vjerojatnostIzostankaPoSudjelovanju: Vjerojatnost,
  treningRazmisljanjeMinMs: z.number().int().min(100).max(30_000),
  treningRazmisljanjeMaksMs: z.number().int().min(100).max(30_000),
  brziRazvoj: z.boolean(),
  udioBrzih: Vjerojatnost,
  udioUobicajenih: Vjerojatnost,
  rasponBrzih: Raspon,
  rasponUobicajenih: Raspon,
  rasponSporih: Raspon,
  rasponPotezaIzostanka: RasponPoteza,
  rasponTeskogPotezaNeznanja: RasponPoteza,
  odstupanjaPopuneMs: Pragovi,
  pragoviPopuneMs: Pragovi,
  treningOmogucen: z.boolean(),
  botoviDvoboj: z.boolean(),
  botoviCetveroboj: z.boolean(),
  treningUpozorenjeNeaktivnostiMs: z.number().int().min(60_000).max(86_400_000),
  treningZatvaranjeNeaktivnostiMs: z.number().int().min(60_000).max(86_400_000),
  udioImenica: Vjerojatnost,
  skalaLogFrekvencije: z.number().finite().min(0).max(10),
  ponderDuljinePoGrafemu: z.number().finite().min(0).max(2),
  koeficijentTempaMin: z.number().finite().min(0.5).max(1.5),
  koeficijentTempaMaks: z.number().finite().min(0.5).max(1.5),
  korekcijaDuljinePoGrafemu: z.number().finite().min(0).max(0.02),
  maksimalnaKorekcijaDuljine: z.number().finite().min(0).max(0.15),
  korekcijaRijetkosti: z.number().finite().min(0).max(0.15),
  korekcijaTeskogPrefiksa: z.number().finite().min(0).max(0.15),
  minimalniUdioPoteza: UdioPoteza,
  maksimalniUdioPoteza: UdioPoteza,
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
  if (postavke.udioBrzih + postavke.udioUobicajenih > 1) pogreska('udioUobicajenih', 'Ukupan udio ne smije prelaziti 100 %.');
  if (postavke.koeficijentTempaMin > postavke.koeficijentTempaMaks) pogreska('koeficijentTempaMaks', 'Gornja granica osobnog tempa mora biti veća ili jednaka donjoj.');
  if (postavke.minimalniUdioPoteza > postavke.maksimalniUdioPoteza) pogreska('maksimalniUdioPoteza', 'Najveći udio mora biti veći ili jednak najmanjem.');
  if (postavke.odmaciOporavkaBotaMs.length < postavke.maksimalnoOporavakaBota) pogreska('odmaciOporavkaBotaMs', 'Za svaki oporavak mora postojati odmak.');
  if (postavke.treningRazmisljanjeMinMs > postavke.treningRazmisljanjeMaksMs) pogreska('treningRazmisljanjeMaksMs', 'Najveće vrijeme ne smije biti manje od najmanjeg.');
  if (postavke.treningUpozorenjeNeaktivnostiMs >= postavke.treningZatvaranjeNeaktivnostiMs) pogreska('treningZatvaranjeNeaktivnostiMs', 'Zatvaranje mora biti nakon upozorenja.');
  if (postavke.pragFrekvencije.srednja > postavke.pragFrekvencije.uobicajena) pogreska('pragFrekvencije', 'Srednji prag ne smije prelaziti uobičajeni.');
  if (postavke.rasponBrzih[1] > postavke.rasponUobicajenih[0] || postavke.rasponUobicajenih[1] > postavke.rasponSporih[0]) pogreska('rasponUobicajenih', 'Rasponi kategorija moraju biti poredani.');
  for (const mod of ['dva_igraca', 'cetiri_igraca'] as const) {
    const pragovi = postavke.pragoviPopuneMs[mod];
    if (pragovi.some((prag, indeks) => prag < postavke.odstupanjaPopuneMs[mod][indeks]! || (indeks > 0 && prag < pragovi[indeks - 1]!))) pogreska('pragoviPopuneMs', 'Pragovi moraju biti poredani i barem jednaki odstupanju.');
  }
});

function postotak(vrijednost: string | undefined, zadano: number): number {
  const broj = Number(vrijednost);
  return vrijednost !== undefined && Number.isFinite(broj) && broj >= 0 && broj <= 1 ? broj : zadano;
}

export function ucitajKonfiguracijuBota(env: NodeJS.ProcessEnv = process.env): KonfiguracijaBota {
  const lokalnoTestiranje = env.NODE_ENV === 'development' && env.BOTOVI_BRZI_RAZVOJ !== 'false';
  return {
    ...structuredClone(ZADANA_KONFIGURACIJA_BOTA),
    treningOmogucen: env.TRENING_OMOGUCEN !== 'false',
    botoviDvoboj: env.BOTOVI_DVOBOJ === 'true',
    botoviCetveroboj: env.BOTOVI_CETVEROBOJ === 'true',
    brziRazvoj: lokalnoTestiranje,
    vjerojatnostOstavljanjaKa: postotak(env.BOT_VJEROJATNOST_KA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostOstavljanjaKa),
    vjerojatnostPropustaKa: postotak(env.BOT_VJEROJATNOST_PROPUSTA_KA, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostPropustaKa),
    vjerojatnostNeznanjaPoSudjelovanju: postotak(env.BOT_NEZNANJE_PO_SUDJELOVANJU, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostNeznanjaPoSudjelovanju),
    vjerojatnostIzostankaPoSudjelovanju: lokalnoTestiranje ? 0 : postotak(env.BOT_IZOSTANAK_PO_SUDJELOVANJU, ZADANA_KONFIGURACIJA_BOTA.vjerojatnostIzostankaPoSudjelovanju),
  };
}
