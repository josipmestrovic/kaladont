import { mkdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type IshodPokusa = 'PASS' | 'FAIL' | 'ABORTED';

export interface IzvjestajPokusa extends Record<string, unknown> {
  verzijaFormata: 1;
  runId: string;
  vrijeme: string;
  cilj: string;
  razina: number;
  lokalniSmoke: boolean;
  pokrenuto: boolean;
  profilId: string;
  digest: string;
  ishod: IshodPokusa;
  razlog: string | null;
  provjere: Record<string, boolean>;
  upozorenja: string[];
}

const NAZIVI_PROVJERA: Record<string, string> = {
  p95Potez: 'Brzina potvrde poteza',
  p95Spremanje: 'Brzina spremanja rezultata',
  igrackiKorisniciOdrzani: 'Prisutnost igraćih korisnika',
  aktivnostIzmjerena: 'Izmjerena aktivnost u igri',
  punoDrzanje: 'Dovršeno vrijeme mjerenja',
  dovoljnoUzoraka: 'Dovoljan broj uzoraka',
  digestNepromijenjen: 'Nepromijenjeno izdanje aplikacije',
  aktivneVeze: 'Održane veze',
  imaPoteza: 'Prihvaćeni potezi',
  imaZavrsenihPartija: 'Završene partije',
  sviNaciniZavrsavaju: 'Završene igre svih načina',
  latencijeSvihNacina: 'Latencije svih načina',
  partijeDovrsene: 'Dovršene preostale partije',
  svaSpremanjaPotvrdena: 'Potvrđena spremanja',
  tehnickeGreske: 'Tehničke pogreške',
  neocekivaniPrekidi: 'Neočekivani prekidi veza',
  httpZahtjevi: 'Izvršeni HTTP zahtjevi',
  httpCiljaniVus: 'Održani HTTP korisnici',
  httpStatusi: 'Ispravni HTTP statusi',
  httpPogreske: 'HTTP pogreške',
  httpP95: 'Brzina HTTP odgovora',
  health: 'Provjere zdravlja aplikacije',
  treningZavrsava: 'Završeni treninzi protiv Računala',
  treninziPrihvaceni: 'Prihvaćeni svi zahtjevi za trening',
  treninziOdrzani: 'Održani istodobni treninzi',
  botBezIsteka: 'Računalo bez isteka vremena',
  botBezTehnickihGresaka: 'Računalo bez tehničkih grešaka',
  latencijeTrening: 'Latencije poteza u treningu',
  eventLoopPosluzitelja: 'Event-loop poslužitelja',
  svePartijePokrenute: 'Sve partije popune pokrenute',
  cekanjeDvoboja: 'Čekanje dvoboja 30 s ±3 s',
  cekanjeCetveroboja: 'Čekanje četveroboja 40 s ±3 s',
  sastavDvoboja: 'Dvoboj: točno 1 bot',
  sastavCetveroboja: 'Četveroboj: točno 3 bota',
  rezervacijeVidljive: 'Rezervirani botovi vidljivi na 20 i 30 s',
  botoviIgraju: 'Botovi odigrali poteze u svakoj partiji',
  fondBezIscrpljenja: 'Fond botova bez iscrpljenja',
};

export function korijenIzvjestaja(): string {
  return process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'), 'Kaladont', 'opterecenje')
    : path.join(homedir(), '.kaladont', 'opterecenje');
}

export function ocistiTerminalTekst(tekst: string): string {
  return tekst.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ');
}

export function prikaziTrajanje(ms: unknown): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return 'nije dostupno';
  const sekunde = Math.floor(ms / 1_000);
  return `${Math.floor(sekunde / 60)}:${String(sekunde % 60).padStart(2, '0')}`;
}

export function formatirajNapredak(ulaz: {
  faza: string;
  protekloMs: number;
  preostaloMs: number | null;
  botovi: {
    spojeni: number; aktivniIgraci: number; aktivnePartije: number;
    poStanjima: Record<string, number>; zavrsenePartije: number;
    tehnickeGreske: number; neocekivaniPrekidi: number;
    aktivniTreninzi?: number;
  };
  zavrsenePoVrsti: Record<string, number>;
  ciljaniIgraci: number;
  planiraniHttp: number;
  healthStarostMs: number | null;
  ciljaniTreninzi?: number;
  racunalo?: { botoviUPartiji: number | null; botIsteci: number | null; eventLoopP95Ms: number | null };
}): string {
  const botovi = ulaz.botovi;
  const stanja = botovi.poStanjima;
  const racunalo = ulaz.racunalo;
  return [
    `[${prikaziTrajanje(ulaz.protekloMs)}] ${ulaz.faza}; preostalo u fazi: ${prikaziTrajanje(ulaz.preostaloMs)}`,
    `Veze ${botovi.spojeni}/${ulaz.ciljaniIgraci}; aktivni sudionici ${botovi.aktivniIgraci}; red ${stanja.red}; ispali ${stanja.ispao}; rezultati ${stanja.rezultati}; partije ${botovi.aktivnePartije}`,
    `Završene igre: dvoboj ${ulaz.zavrsenePoVrsti.dvoboj}, javni četveroboj ${ulaz.zavrsenePoVrsti.javni_cetveroboj}, privatni četveroboj ${ulaz.zavrsenePoVrsti.privatni_cetveroboj}, trening ${ulaz.zavrsenePoVrsti.trening ?? 0}; pogreške ${botovi.tehnickeGreske}; prekidi ${botovi.neocekivaniPrekidi}`,
    `Treninzi ${botovi.aktivniTreninzi ?? 0}/${ulaz.ciljaniTreninzi ?? 0}; Računalo u partijama ${metrika(racunalo?.botoviUPartiji)}; isteci Računala ukupno ${metrika(racunalo?.botIsteci)}; event-loop p95 ${metrika(racunalo?.eventLoopP95Ms, ' ms')}`,
    `HTTP: planirano ${ulaz.planiraniHttp} korisnika; stvarne metrike nakon završetka; health star ${prikaziTrajanje(ulaz.healthStarostMs)}${ulaz.healthStarostMs !== null && ulaz.healthStarostMs > 15_000 ? ' (zastario)' : ''}`,
  ].map(ocistiTerminalTekst).join('\n');
}

function metrika(vrijednost: unknown, jedinica = ''): string {
  return typeof vrijednost === 'number' && Number.isFinite(vrijednost)
    ? `${vrijednost.toLocaleString('hr-HR', { maximumFractionDigits: 2 })}${jedinica}`
    : 'nije dostupno';
}

function objekt(vrijednost: unknown): Record<string, unknown> {
  return typeof vrijednost === 'object' && vrijednost !== null ? vrijednost as Record<string, unknown> : {};
}

export function formatirajSazetak(izvjestaj: IzvjestajPokusa): string {
  const botovi = objekt(izvjestaj.botovi);
  const http = objekt(izvjestaj.http);
  const trajanje = objekt(izvjestaj.trajanje);
  const jePopuna = izvjestaj.vrsta === 'popuna';
  const redci = [
    izvjestaj.zakljuceno === false ? 'ZAPIS NIJE ZAKLJUČEN; još nema konačnog ishoda.' : izvjestaj.pokrenuto === false ? `PRIPREMA ${izvjestaj.ishod === 'ABORTED' ? 'OTKAZANA' : 'NIJE USPJELA'}; opterećenje nije pokrenuto.` : `${jePopuna ? 'PREDTEST POPUNE' : 'TEST'} ${izvjestaj.ishod === 'PASS' ? 'PROŠAO' : izvjestaj.ishod === 'FAIL' ? 'NIJE PROŠAO' : 'PREKINUT'}`,
    `Pokus: ${izvjestaj.runId}`,
    `Okolina: ${izvjestaj.lokalniSmoke ? 'lokalni smoke, nije dokaz staging kapaciteta' : 'staging'}`,
    `Cilj: ${izvjestaj.cilj}`,
    `Ukupno korisnika: ${izvjestaj.razina}`,
    `Izdanje: ${izvjestaj.digest}`,
  ];
  if (jePopuna) {
    redci.push(`Ulasci u red: ${prikaziTrajanje(trajanje.ulasciMs)}; čekanje kraja partija: ${prikaziTrajanje(trajanje.cekanjeKrajaMs)}`);
  } else {
    redci.push(
    `Stvarno držanje: ${prikaziTrajanje(trajanje.stvarnoMijesaniDrzanjeMs)}`,
    `Dovršavanje partija: ${prikaziTrajanje(trajanje.ciscenjeMs)}`,
    `Završno čišćenje: ${prikaziTrajanje(trajanje.zavrsnoCiscenjeMs)}`,
    `Najmanje povezanih igraćih korisnika: ${metrika(botovi.najmanjeIgrackihKorisnika)}`,
    `Najmanje aktivnih sudionika igre: ${metrika(botovi.najmanjeAktivnihIgraca)}`,
    `Završene partije: ${metrika(botovi.zavrsenePartije)}`,
    `P95 poteza / spremanja: ${metrika(botovi.p95PotezMs, ' ms')} / ${metrika(botovi.p95SpremanjeMs, ' ms')}`,
    `HTTP zahtjevi / p95: ${metrika(http.brojZahtjeva)} / ${metrika(http.p95Ms, ' ms')}`,
    `HTTP pogreške: ${metrika(typeof http.stopaGresaka === 'number' ? http.stopaGresaka * 100 : null, ' %')}`,
    );
  }
  for (const [vrsta, mjerenje] of Object.entries(objekt(botovi.latencijePoVrsti))) {
    const podaci = objekt(mjerenje);
    redci.push(`${vrsta}: p95 poteza ${metrika(podaci.p95PotezMs, ' ms')}, spremanja ${metrika(podaci.p95SpremanjeMs, ' ms')}`);
  }
  const racunalo = objekt(izvjestaj.racunalo);
  if (Object.keys(racunalo).length > 0) {
    redci.push(
      `Treninzi protiv Računala: završeno ${metrika(racunalo.zavrseniTreninzi)}, ciljano istodobno ${metrika(racunalo.ciljaniTreninzi)}, medijan istodobnih ${metrika(racunalo.medijanAktivnihTreninga)}, najmanje ${metrika(racunalo.najmanjeAktivnihTreninga)}, odbijeno ${metrika(racunalo.odbijeniTreninzi)}`,
      `Odgovor Računala p50 / p95: ${metrika(racunalo.p50OdgovorRacunalaMs, ' ms')} / ${metrika(racunalo.p95OdgovorRacunalaMs, ' ms')} (${metrika(racunalo.brojOdgovoraRacunala)} odgovora)`,
      `Isteci Računala (poslužitelj / generator): ${metrika(racunalo.istekBotovaPosluzitelj)} / ${metrika(racunalo.istekRacunalaGenerator)}; tehničke greške botova: ${metrika(racunalo.tehnickeGreskeBotovaPosluzitelj)}`,
      `Event-loop poslužitelja p95: ${metrika(racunalo.eventLoopPosluziteljaP95Ms, ' ms')}; fond slobodnih botova početak / kraj: ${metrika(racunalo.fondSlobodniPocetak)} / ${metrika(racunalo.fondSlobodniKraj)}`,
    );
  }
  if (izvjestaj.razlog) redci.push(`Razlog: ${izvjestaj.razlog}`);
  const popuna = objekt(izvjestaj.popuna);
  if (Object.keys(popuna).length > 0) {
    const raspon = (vrijednost: unknown) => {
      const podaci = objekt(vrijednost);
      return `${metrika(typeof podaci.min === 'number' && Number.isFinite(podaci.min) ? podaci.min / 1000 : null, ' s')} – ${metrika(typeof podaci.max === 'number' && Number.isFinite(podaci.max) ? podaci.max / 1000 : null, ' s')}`;
    };
    redci.push(
      `Popuna reda: ${metrika(popuna.brojPoModu)} VU po modu; pokrenuto ${metrika(popuna.pokrenutePartije)}, završeno ${metrika(popuna.zavrsenePartije)} partija`,
      `Čekanje do početka: dvoboj ${raspon(popuna.cekanjeDvobojaMs)} (očekivano 30 s), četveroboj ${raspon(popuna.cekanjeCetverobojaMs)} (očekivano 40 s)`,
      `Fond botova: slobodnih početak / kraj ${metrika(popuna.fondSlobodniPocetak)} / ${metrika(popuna.fondSlobodniKraj)}; u partiji na kraju ${metrika(popuna.botoviUPartijiKraj)}; iscrpljenja ${metrika(popuna.iscrpljenjaDelta)}`,
      `Botovi: isteci ${metrika(popuna.istekBotovaDelta)}, tehničke greške ${metrika(popuna.tehnickeGreskeBotovaDelta)}`,
    );
    for (const mjerenje of Array.isArray(popuna.mjerenja) ? popuna.mjerenja as unknown[] : []) {
      const podaci = objekt(mjerenje);
      const rezervacije = Array.isArray(podaci.rezervacijeMs) ? (podaci.rezervacijeMs as unknown[]).map((ms) => metrika(typeof ms === 'number' ? ms / 1000 : null, ' s')).join(', ') : '';
      redci.push(`  ${podaci.mod === 'dva_igraca' ? 'dvoboj' : 'četveroboj'}: početak ${metrika(typeof podaci.cekanjeMs === 'number' ? podaci.cekanjeMs / 1000 : null, ' s')}, botova ${metrika(podaci.brojBotova)}, rezervacije ${rezervacije || 'nisu viđene'}, poteza bota ${metrika(podaci.potezaBota)}, ${podaci.zavrsena === true ? 'završena' : 'nezavršena'}`);
    }
    for (const greska of Array.isArray(popuna.greskeGeneratora) ? popuna.greskeGeneratora as unknown[] : []) redci.push(`  Greška: ${String(greska)}`);
  }
  for (const [naziv, prosao] of Object.entries(izvjestaj.provjere)) {
    redci.push(`${prosao ? 'U REDU' : 'NEUSPJEH'}: ${NAZIVI_PROVJERA[naziv] ?? naziv}`);
  }
  redci.push(...izvjestaj.upozorenja.map((tekst) => `Napomena: ${tekst}`));
  if (!jePopuna) {
    const generator = objekt(izvjestaj.generator);
    redci.push(`Generator Node: RSS ${metrika(typeof generator.rssBajtovi === 'number' ? generator.rssBajtovi / 1_048_576 : null, ' MiB')}, CPU vrijeme ${metrika(generator.cpuMs, ' ms')}`);
    const uzorci = Array.isArray(izvjestaj.healthUzoraka) ? izvjestaj.healthUzoraka : [];
    const rss = uzorci.map((uzorak: unknown) => objekt(objekt(uzorak).health).rssBajtovi).filter((broj): broj is number => typeof broj === 'number' && Number.isFinite(broj));
    redci.push(`Aplikacija (health): najveći zabilježeni RSS ${metrika(rss.length > 0 ? Math.max(...rss) / 1_048_576 : null, ' MiB')}`);
    redci.push(`Završene igre po načinu: ${Object.entries(objekt(botovi.zavrsenePoVrsti)).map(([vrsta, broj]) => `${vrsta} ${metrika(broj)}`).join(', ') || 'nije dostupno'}`);
  }
  if (izvjestaj.zakljuceno !== false && izvjestaj.ishod === 'PASS' && typeof izvjestaj.sljedecaRazina === 'number') redci.push(`Sljedeća moguća razina za isti profil i izdanje: ${izvjestaj.sljedecaRazina} korisnika.`);
  if (typeof izvjestaj.direktorijIzvjestaja === 'string') redci.push(`Artefakti: ${izvjestaj.direktorijIzvjestaja}`);
  redci.push(izvjestaj.zakljuceno === false ? 'Nedovršen zapis ne potvrđuje prolaz. Ne pokretati veću razinu.' : izvjestaj.pokrenuto === false ? 'Prethodne potvrde nisu poništene; pregledati razlog i ponovno pokrenuti pripremu.' : jePopuna
    ? (izvjestaj.ishod === 'PASS' ? 'Predtest popune ne otključava razine miješanog testa; miješani test traži zasebnu naredbu i potvrdu.' : 'Ne pokretati miješani test s botovima dok popuna ne prođe. Pregledati razlog i neuspjele provjere.')
    : izvjestaj.ishod === 'PASS'
    ? 'Sljedeća razina nije automatski pokrenuta ni odobrena. Potrebna je nova naredba i potvrda.'
    : 'Ne nastavljati na veću razinu. Pregledati razlog i neuspjele provjere.');
  return `${redci.map(ocistiTerminalTekst).join('\n')}\n`;
}

export async function spremiIzvjestaj(izvjestaj: IzvjestajPokusa, direktorij: string): Promise<void> {
  await mkdir(direktorij, { recursive: true, mode: 0o700 });
  for (const [naziv, sadrzaj] of [
    ['sazetak.txt', formatirajSazetak(izvjestaj)],
    ['rezultat.json', JSON.stringify(izvjestaj, null, 2)],
  ]) {
    const privremena = path.join(direktorij, `${naziv}.tmp`);
    await writeFile(privremena, sadrzaj!, { mode: 0o600 });
    await rename(privremena, path.join(direktorij, naziv!));
  }
}

export async function finalizirajIzvjestaj(
  izvjestaj: IzvjestajPokusa,
  opcije: {
    signal: AbortSignal;
    greskeCiscenja?: readonly string[];
    spremi: (izvjestaj: IzvjestajPokusa) => Promise<void>;
    potvrdi: (izvjestaj: IzvjestajPokusa) => Promise<void>;
  },
): Promise<IzvjestajPokusa> {
  const rezultat = { ...izvjestaj, zakljuceno: false };
  if (opcije.greskeCiscenja?.length) {
    rezultat.ishod = 'FAIL';
    rezultat.razlog = [rezultat.razlog, ...opcije.greskeCiscenja].filter(Boolean).join('; ');
  }
  const provjeriPrekid = () => {
    if (opcije.signal.aborted) {
      rezultat.ishod = 'ABORTED';
      rezultat.razlog = rezultat.razlog ?? 'Test je prekinut tijekom završavanja.';
    }
  };
  try {
    provjeriPrekid();
    await opcije.spremi(rezultat);
    provjeriPrekid();
    await opcije.potvrdi(rezultat);
    const prije = rezultat.ishod;
    provjeriPrekid();
    if (prije !== rezultat.ishod) await opcije.potvrdi(rezultat);
    rezultat.zakljuceno = true;
    await opcije.spremi(rezultat);
    const zadnjiIshod = rezultat.ishod;
    provjeriPrekid();
    if (zadnjiIshod !== rezultat.ishod) {
      await opcije.potvrdi(rezultat);
      await opcije.spremi(rezultat);
    }
  } catch (greska) {
    rezultat.ishod = opcije.signal.aborted ? 'ABORTED' : 'FAIL';
    rezultat.razlog = [rezultat.razlog, `Završni zapis nije uspio: ${greska instanceof Error ? greska.message : String(greska)}`].filter(Boolean).join('; ');
    rezultat.zakljuceno = false;
    const zapisi = await Promise.allSettled([opcije.spremi(rezultat), opcije.potvrdi(rezultat)]);
    const neuspjeli = zapisi.filter((zapis): zapis is PromiseRejectedResult => zapis.status === 'rejected');
    if (neuspjeli.length > 0) throw new AggregateError(neuspjeli.map((zapis) => zapis.reason), rezultat.razlog);
    rezultat.zakljuceno = true;
    await opcije.spremi(rezultat);
  }
  return rezultat;
}