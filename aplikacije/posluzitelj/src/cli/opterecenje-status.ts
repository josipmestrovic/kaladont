import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatirajSazetak, korijenIzvjestaja, ocistiTerminalTekst, prikaziTrajanje, type IzvjestajPokusa } from './opterecenje-izvjestaj.js';
import { provjeriPotvrduRazine, sljedecaRazina, type PotvrdaPokusa } from './opterecenje-postavke.js';

function jeIzvjestaj(ulaz: unknown): ulaz is IzvjestajPokusa {
  if (!ulaz || typeof ulaz !== 'object') return false;
  const podaci = ulaz as Record<string, unknown>;
  return podaci.verzijaFormata === 1 && typeof podaci.runId === 'string' &&
    typeof podaci.vrijeme === 'string' && Number.isFinite(Date.parse(podaci.vrijeme)) &&
    typeof podaci.cilj === 'string' && typeof podaci.razina === 'number' &&
    typeof podaci.lokalniSmoke === 'boolean' && typeof podaci.pokrenuto === 'boolean' && typeof podaci.profilId === 'string' &&
    typeof podaci.digest === 'string' && ['PASS', 'FAIL', 'ABORTED'].includes(String(podaci.ishod)) &&
    (podaci.razlog === null || typeof podaci.razlog === 'string') &&
    podaci.provjere !== null && typeof podaci.provjere === 'object' &&
    Object.values(podaci.provjere as object).every((vrijednost) => typeof vrijednost === 'boolean') &&
    Array.isArray(podaci.upozorenja) && podaci.upozorenja.every((tekst) => typeof tekst === 'string');
}

export async function prikaziStatusPokusa(
  korijen = korijenIzvjestaja(),
  ispisi: (tekst: string) => void = console.log,
): Promise<void> {
  const ispis = (tekst: string) => ispisi(tekst.split('\n').map(ocistiTerminalTekst).join('\n'));
  ispis(`Lokalna evidencija: ${korijen}`);
  ispis('Staging nije kontaktiran. Aktualno izdanje nije poznato bez nove pripreme pokusa.');
  let mape;
  try { mape = await readdir(korijen, { withFileTypes: true }); }
  catch (greska) {
    if ((greska as NodeJS.ErrnoException).code !== 'ENOENT') throw greska;
    ispis('Nema spremljenih pokusa. Početna staging razina je 100 uz zasebnu naredbu i potvrdu.');
    return;
  }
  const kandidati = await Promise.all(mape.filter((mapa) => mapa.isDirectory() && /^[a-f0-9-]{36}$/i.test(mapa.name))
    .map(async (mapa) => ({ naziv: mapa.name, promijenjenoU: (await stat(path.join(korijen, mapa.name))).mtimeMs })));
  kandidati.sort((prvi, drugi) => drugi.promijenjenoU - prvi.promijenjenoU);
  let zadnji: IzvjestajPokusa | undefined;
  let zadnjiStaging: IzvjestajPokusa | undefined;
  for (const kandidat of kandidati.slice(0, 20)) {
    try {
      const podaci: unknown = JSON.parse(await readFile(path.join(korijen, kandidat.naziv, 'rezultat.json'), 'utf8'));
      if (!jeIzvjestaj(podaci) || podaci.runId !== kandidat.naziv) throw new Error('Nepotpun format izvještaja.');
      if (podaci.zakljuceno !== true) {
        ispis(`NEDOVRŠEN ZAPIS: ${kandidat.naziv}; ne potvrđuje razinu.`);
        continue;
      }
      zadnji ??= podaci;
      if (!podaci.lokalniSmoke && podaci.pokrenuto) zadnjiStaging ??= podaci;
      ispis(`${podaci.vrijeme} | ${podaci.lokalniSmoke ? 'lokalno' : 'staging'} | ${podaci.razina} | ${podaci.pokrenuto ? podaci.ishod : 'nije pokrenuto'} | runId ${podaci.runId}`);
    } catch {
      ispis(`BEZ VALJANOG REZULTATA: ${kandidat.naziv}; priprema, nepotpun ili nečitljiv zapis.`);
    }
  }
  if (!zadnji) { ispis('Nema dovršenih izvještaja novog formata.'); return; }
  ispis('\nPosljednji dovršeni pokus:\n');
  ispis(formatirajSazetak(zadnji));
  if (!zadnjiStaging) {
    ispis(zadnji.lokalniSmoke
      ? 'Lokalni smoke ne otključava staging. Početna staging razina je 100.'
      : 'Nema dovršenih pokrenutih staging pokusa u posljednjih 20 izvještaja; priprema ne potvrđuje kapacitet.');
    return;
  }
  ispis(`Posljednji staging profil: ${zadnjiStaging.profilId}; digest: ${zadnjiStaging.digest}; prethodni runId: ${String(zadnjiStaging.prethodniRunId ?? 'nema')}`);
  let zadnjaPotvrda: PotvrdaPokusa | undefined;
  for (const razina of [10_000, 5_000, 2_000, 1_000, 500, 100]) {
    try {
      zadnjaPotvrda = await provjeriPotvrduRazine(zadnjiStaging.cilj, razina, path.join(korijen, 'potvrde'), Date.now(), zadnjiStaging.profilId, zadnjiStaging.digest);
      if (zadnjaPotvrda) break;
    } catch { continue; }
  }
  ispis(zadnjaPotvrda
    ? `Najviša važeća potvrda ovog profila: ${zadnjaPotvrda.brojKorisnika}, runId ${zadnjaPotvrda.runId}; starost ${prikaziTrajanje(Date.now() - zadnjaPotvrda.zavrsenoU)}; vrijedi najviše sedam dana.`
    : 'Nema važeće potpune potvrde ovog profila i izdanja.');
  const sljedeca = sljedecaRazina(zadnjiStaging.razina);
  if (zadnjiStaging.ishod !== 'PASS') { ispis(`Povećanje razine nije dopušteno: posljednji staging pokus nije prošao. Pregledati pogreške i ponoviti razinu ${zadnjiStaging.razina} uz novu potvrdu.`); return; }
  try {
    const potvrda = await provjeriPotvrduRazine(
      zadnjiStaging.cilj, zadnjiStaging.razina, path.join(korijen, 'potvrde'), Date.now(), zadnjiStaging.profilId, zadnjiStaging.digest,
    );
    if (!potvrda || potvrda.runId !== zadnjiStaging.runId) throw new Error('Nema podudarne potvrde posljednjeg prolaza.');
    ispis(sljedeca === null
      ? 'Dosegnuta je posljednja razina 10000. Nema automatskog nastavka.'
      : `Sljedeća moguća razina: ${sljedeca}, samo za isti profil i izdanje, uz pregled VPS metrika, novu naredbu i unos POKRENI ${sljedeca}.`);
  } catch (greska) {
    ispis(`Nastavak nije dopušten: ${greska instanceof Error ? greska.message : String(greska)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void prikaziStatusPokusa().catch((greska: unknown) => {
    console.error(ocistiTerminalTekst(`Pregled nije uspio: ${greska instanceof Error ? greska.message : String(greska)}`));
    process.exitCode = 1;
  });
}