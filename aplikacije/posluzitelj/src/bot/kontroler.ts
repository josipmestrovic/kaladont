/**
 * Bot kontroler (ADR-017): sluša promjene poteza iz motora i za bota na potezu planira
 * točno jednu akciju po (partijaId, igracId, turnToken). Pri buđenju sve ponovno provjerava.
 */
import type { DogadajPoteza, RezultatNaredbe } from '../igra/politika-ucinka.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import { koeficijentTempaBota, odaberiPotez, stvoriStanjeBota, trajanjeRazmisljanjaMs, type OdlukaBota, type Rng, type StanjeBotaUPartiji } from './odabir-rijeci.js';
import { grafemi } from 'zajednicko';

export type NaredbaBota =
  | { vrsta: 'rijec'; rijec: string; turnToken: string }
  | { vrsta: 'odustani'; turnToken: string };

export interface OvisnostiBotKontrolera {
  rjecnik: Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika'> & { frekvencijaZa(rijec: string): number | null };
  izvrsiNaredbu: (partijaId: string, igracId: string, naredba: NaredbaBota) => RezultatNaredbe;
  konfiguracija: KonfiguracijaBota;
  rng?: Rng;
  sada?: () => number;
  zakazi?: (posao: () => void, ms: number) => NodeJS.Timeout;
  otkazi?: (handle: NodeJS.Timeout) => void;
  zapisi?: (poruka: string, podaci: Record<string, unknown>) => void;
  oznaciNamjerniIstek?: (partijaId: string, igracId: string, turnToken: string) => boolean;
  dohvatiPotez?: (partijaId: string) => DogadajPoteza | null;
  prekiniZbogGreske?: (partijaId: string, igracId: string, turnToken: string) => void;
  naAktivnost?: (igracId: string) => void;
}

export interface BrojaciBota {
  planirano: number;
  odigranihRijeci: number;
  namjernihPropusta: number;
  bezRijeci: number;
  zastarjelo: number;
  tehnickeGreske: number;
  namjernihCekanjaIsteka: number;
  dobrovoljniKa: number;
  prisilniKa: number;
  propustPrimljenogKa: number;
}

interface PlaniranaAkcija {
  handle: NodeJS.Timeout;
  igracId: string;
  turnToken: string;
  izvrsitiUMs: number;
  vrsta: 'rijec' | 'odustani' | 'oporavak';
}

export class BotKontroler {
  private readonly stanjaPoPartiji = new Map<string, Map<string, StanjeBotaUPartiji>>();
  private readonly planirano = new Map<string, PlaniranaAkcija>();
  private readonly namjerniIsteci = new Map<string, string>();
  private readonly aktualniPotezi = new Map<string, DogadajPoteza>();
  private readonly dovrseniTokeni = new Map<string, string>();
  private readonly greskePoBotu = new Map<string, { broj: number; posljednja: string; vrijemeMs: number }>();
  private readonly konfiguracijePartija = new Map<string, KonfiguracijaBota>();
  private readonly odluke = new Map<string, { turnToken: string; odluka: OdlukaBota; verzijaRjecnika: number }>();
  private readonly rng: Rng;
  private readonly sada: () => number;
  private readonly zakazi: (posao: () => void, ms: number) => NodeJS.Timeout;
  private readonly otkazi: (handle: NodeJS.Timeout) => void;
  private readonly zapisi: (poruka: string, podaci: Record<string, unknown>) => void;
  private zaustavljen = false;
  readonly brojaci: BrojaciBota = { planirano: 0, odigranihRijeci: 0, namjernihPropusta: 0, bezRijeci: 0, zastarjelo: 0, tehnickeGreske: 0, namjernihCekanjaIsteka: 0, dobrovoljniKa: 0, prisilniKa: 0, propustPrimljenogKa: 0 };

  constructor(private readonly ovisnosti: OvisnostiBotKontrolera) {
    this.rng = ovisnosti.rng ?? Math.random;
    this.sada = ovisnosti.sada ?? Date.now;
    this.zakazi = ovisnosti.zakazi ?? ((posao, ms) => setTimeout(posao, ms));
    this.otkazi = ovisnosti.otkazi ?? ((handle) => clearTimeout(handle));
    this.zapisi = ovisnosti.zapisi ?? (() => undefined);
  }

  naPromjenuPoteza(dogadaj: DogadajPoteza): void {
    if (this.zaustavljen) return;
    this.aktualniPotezi.set(dogadaj.partijaId, dogadaj);
    try {
      if (!dogadaj.zavrsena && !this.konfiguracijePartija.has(dogadaj.partijaId)) {
        this.konfiguracijePartija.set(dogadaj.partijaId, structuredClone(this.ovisnosti.konfiguracija));
      }
      this.planiraj(dogadaj);
    } catch (greska) {
      this.oporavi(dogadaj, dogadaj.naPotezuId, 0, new Set(), greska);
    }
  }

  private planiraj(dogadaj: DogadajPoteza): void {
    const prethodniPlan = this.planirano.get(dogadaj.partijaId);
    if (!dogadaj.zavrsena && !dogadaj.izborUToku && (prethodniPlan?.turnToken === dogadaj.turnToken || this.namjerniIsteci.get(dogadaj.partijaId) === dogadaj.turnToken || this.dovrseniTokeni.get(dogadaj.partijaId) === dogadaj.turnToken)) return;
    this.otkaziPlan(dogadaj.partijaId);
    this.namjerniIsteci.delete(dogadaj.partijaId);
    if (this.zaustavljen) return;
    if (dogadaj.zavrsena) {
      this.stanjaPoPartiji.delete(dogadaj.partijaId);
      this.aktualniPotezi.delete(dogadaj.partijaId);
      this.dovrseniTokeni.delete(dogadaj.partijaId);
      this.konfiguracijePartija.delete(dogadaj.partijaId);
      this.odluke.delete(dogadaj.partijaId);
      return;
    }
    if (dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.trazenaSlova) return;
    const sudionik = dogadaj.sudionici.find((s) => s.igracId === dogadaj.naPotezuId);
    if (!sudionik || sudionik.upravljac !== 'bot' || !sudionik.aktivan) return;
    if (dogadaj.istekPotezaMs !== null && dogadaj.istekPotezaMs <= this.sada()) return;

    const stanjeBota = this.stanjeBota(dogadaj.partijaId, sudionik.igracId);
    if (stanjeBota.zadnjiToken !== dogadaj.turnToken) {
      stanjeBota.brojPoteza += 1;
      stanjeBota.zadnjiToken = dogadaj.turnToken;
    }
    if (dogadaj.kontekst === 'javna' && !stanjeBota.izostanakPotrosen && stanjeBota.ciljIzostanka === stanjeBota.brojPoteza && dogadaj.istekPotezaMs !== null && dogadaj.istekPotezaMs > this.sada() && this.ovisnosti.oznaciNamjerniIstek?.(dogadaj.partijaId, sudionik.igracId, dogadaj.turnToken)) {
      stanjeBota.izostanakPotrosen = true;
      this.namjerniIsteci.set(dogadaj.partijaId, dogadaj.turnToken);
      this.brojaci.namjernihCekanjaIsteka += 1;
      return;
    }

    const odluka = this.odluci(dogadaj, stanjeBota);
    const rok = dogadaj.istekPotezaMs === null ? null : Math.max(0, dogadaj.istekPotezaMs - this.sada());
    const izracunataOdgoda = trajanjeRazmisljanjaMs(rok, stanjeBota.konfiguracija, this.rng, dogadaj.kontekst, {
      punoTrajanjeMs: dogadaj.trajanjePotezaMs,
      protekloMs: Math.max(0, this.sada() - dogadaj.pocetakPotezaMs),
      koeficijentTempa: stanjeBota.koeficijentTempa,
      brojKandidata: stanjeBota.brojKandidata,
      // Brzi tempo samo kad stvarno igra kaladont na primljeni ka (ne pri propustu).
      primljeniKa: odluka.vrsta === 'rijec' && odluka.rijec === 'kaladont' && dogadaj.trazenaSlova === 'ka',
      ...(odluka.vrsta === 'rijec' ? { brojGrafema: grafemi(odluka.rijec).length, frekvencija: this.ovisnosti.rjecnik.frekvencijaZa(odluka.rijec) } : {}),
    });
    // Bez roka (testni ONEMOGUCI_TIMER / privatno bez tajmera) ne čekaj udio od 30 s — inače CI testovi isteku.
    const odgoda = rok === null && dogadaj.kontekst !== 'trening'
      ? Math.min(izracunataOdgoda, 200)
      : izracunataOdgoda;
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    const turnToken = dogadaj.turnToken;
    const handle = this.zakazi(() => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.turnToken !== turnToken || plan.igracId !== sudionik.igracId) {
        this.brojaci.zastarjelo += 1;
        return;
      }
      this.planirano.delete(dogadaj.partijaId);
      try {
        const aktualni = this.aktualni(dogadaj, sudionik.igracId);
        if (!aktualni) { this.brojaci.zastarjelo += 1; return; }
        const svjezaOdluka = this.ovisnosti.rjecnik.verzijaRjecnika() === verzijaRjecnika ? odluka : this.odluci(aktualni, stanjeBota);
        this.izvrsi(aktualni, sudionik.igracId, turnToken, svjezaOdluka, 0, new Set());
      } catch (greska) {
        this.oporavi(dogadaj, sudionik.igracId, 0, new Set(), greska);
      }
    }, odgoda);
    this.planirano.set(dogadaj.partijaId, { handle, igracId: sudionik.igracId, turnToken, izvrsitiUMs: this.sada() + odgoda, vrsta: odluka.vrsta });
    this.ovisnosti.naAktivnost?.(sudionik.igracId);
    this.brojaci.planirano += 1;
  }

  zaustavi(): void {
    this.zaustavljen = true;
    for (const partijaId of [...this.planirano.keys()]) this.otkaziPlan(partijaId);
    this.stanjaPoPartiji.clear();
    this.namjerniIsteci.clear();
    this.aktualniPotezi.clear();
    this.dovrseniTokeni.clear();
    this.konfiguracijePartija.clear();
    this.odluke.clear();
  }

  brojPlaniranih(): number {
    return this.planirano.size;
  }

  pregledPlanova() {
    return [...this.aktualniPotezi.values()].flatMap((dogadaj) => {
      if (dogadaj.zavrsena || dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.sudionici.some((sudionik) => sudionik.igracId === dogadaj.naPotezuId && sudionik.upravljac === 'bot')) return [];
      const plan = this.planirano.get(dogadaj.partijaId);
      return [{
        partijaId: dogadaj.partijaId,
        igracId: dogadaj.naPotezuId,
        vrsta: this.namjerniIsteci.get(dogadaj.partijaId) === dogadaj.turnToken ? 'izostanak' : plan?.vrsta ?? null,
        izvrsitiUMs: plan?.izvrsitiUMs ?? null,
        istekPotezaMs: dogadaj.istekPotezaMs,
        verzijaPolitike: this.konfiguracijePartija.get(dogadaj.partijaId)?.verzija ?? null,
      }];
    });
  }

  pregledGresaka() {
    return new Map([...this.greskePoBotu].map(([igracId, greska]) => [igracId, { ...greska }]));
  }

  private odluci(dogadaj: DogadajPoteza, stanjeBota: StanjeBotaUPartiji, odbijene: ReadonlySet<string> = new Set(), oporavak = false): OdlukaBota {
    const prethodna = this.odluke.get(dogadaj.partijaId);
    const ista = prethodna?.turnToken === dogadaj.turnToken ? prethodna : undefined;
    if (ista?.odluka.vrsta === 'odustani') return ista.odluka;
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && ista.verzijaRjecnika === verzijaRjecnika) return ista.odluka;
    const kandidati = [...this.ovisnosti.rjecnik.igriviKandidati(dogadaj.trazenaSlova!, dogadaj.iskoristeneGrupe, dogadaj.dopusteneVrste)].filter((rijec) => !odbijene.has(rijec));
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && (kandidati.includes(ista.odluka.rijec) || dogadaj.trazenaSlova === 'ka')) {
      ista.verzijaRjecnika = verzijaRjecnika;
      return ista.odluka;
    }
    const odluka = odaberiPotez({
      trazenaSlova: dogadaj.trazenaSlova!,
      kandidati,
      frekvencijaZa: (rijec) => this.ovisnosti.rjecnik.frekvencijaZa(rijec),
      grupeZa: (rijec) => this.ovisnosti.rjecnik.grupeZa(rijec),
      turnToken: dogadaj.turnToken,
      oporavak: oporavak || ista !== undefined,
    }, stanjeBota, stanjeBota.konfiguracija, this.rng);
    if (odluka.vrsta === 'rijec' && odluka.propustKa) this.brojaci.propustPrimljenogKa += 1;
    if (odluka.vrsta === 'rijec' && odluka.izborKa && stanjeBota.zadnjiTokenKa !== dogadaj.turnToken) {
      stanjeBota.zadnjiTokenKa = dogadaj.turnToken;
      if (odluka.izborKa === 'dobrovoljni') this.brojaci.dobrovoljniKa += 1;
      else this.brojaci.prisilniKa += 1;
    }
    this.odluke.set(dogadaj.partijaId, { turnToken: dogadaj.turnToken, odluka, verzijaRjecnika });
    return odluka;
  }

  private izvrsi(
    dogadaj: DogadajPoteza,
    igracId: string,
    turnToken: string,
    odluka: OdlukaBota,
    pokusaj: number,
    odbijene: Set<string>,
  ): void {
    const naredba: NaredbaBota = odluka.vrsta === 'rijec'
      ? { vrsta: 'rijec', rijec: odluka.rijec, turnToken }
      : { vrsta: 'odustani', turnToken };
    let rezultat: RezultatNaredbe;
    try {
      rezultat = this.ovisnosti.izvrsiNaredbu(dogadaj.partijaId, igracId, naredba);
    } catch (greska) {
      this.oporavi(dogadaj, igracId, pokusaj, odbijene, greska);
      return;
    }
    if (rezultat.ishod === 'prihvacen') {
      this.ovisnosti.naAktivnost?.(igracId);
      if (this.aktualniPotezi.has(dogadaj.partijaId)) this.dovrseniTokeni.set(dogadaj.partijaId, turnToken);
      if (odluka.vrsta === 'rijec') this.brojaci.odigranihRijeci += 1;
      else if (odluka.razlog === 'namjerni_propust') this.brojaci.namjernihPropusta += 1;
      else this.brojaci.bezRijeci += 1;
      return;
    }
    if (rezultat.ishod === 'ignoriran') {
      this.brojaci.zastarjelo += 1;
      return;
    }
    if (rezultat.kod === 'STARI_TURN_TOKEN' || rezultat.kod === 'NIJE_TVOJ_POTEZ' || rezultat.kod === 'SUSTAV_BIRA_RIJEC') {
      this.brojaci.zastarjelo += 1;
      return;
    }
    // Riječ odbijena iako je bila igriva: rječnik se promijenio ili je indeks neusklađen. Tehnički kvar, ne „ljudski” propust.
    if (odluka.vrsta === 'rijec') odbijene.add(odluka.rijec);
    this.oporavi(dogadaj, igracId, pokusaj, odbijene, new Error(`Botova naredba odbijena: ${rezultat.kod}`));
  }

  private aktualni(dogadaj: DogadajPoteza, igracId: string): DogadajPoteza | null {
    const aktualni = this.ovisnosti.dohvatiPotez ? this.ovisnosti.dohvatiPotez(dogadaj.partijaId) : this.aktualniPotezi.get(dogadaj.partijaId);
    if (this.zaustavljen || !aktualni || aktualni.zavrsena || aktualni.izborUToku || aktualni.turnToken !== dogadaj.turnToken || aktualni.naPotezuId !== igracId || !aktualni.sudionici.some((sudionik) => sudionik.igracId === igracId && sudionik.upravljac === 'bot' && sudionik.aktivan)) return null;
    if (aktualni.istekPotezaMs !== null && aktualni.istekPotezaMs <= this.sada()) return null;
    return aktualni;
  }

  private oporavi(dogadaj: DogadajPoteza, igracId: string | null, pokusaj: number, odbijene: Set<string>, greska: unknown): void {
    this.brojaci.tehnickeGreske += 1;
    if (igracId) {
      const prethodna = this.greskePoBotu.get(igracId);
      this.greskePoBotu.set(igracId, {
        broj: (prethodna?.broj ?? 0) + 1,
        posljednja: greska instanceof Error ? greska.name.slice(0, 80) : 'nepoznata pogreška',
        vrijemeMs: this.sada(),
      });
      while (this.greskePoBotu.size > 100) {
        const najstariji = this.greskePoBotu.keys().next().value;
        if (najstariji === undefined) break;
        this.greskePoBotu.delete(najstariji);
      }
    }
    this.zapisi('Tehnička pogreška bota', { partijaId: dogadaj.partijaId, igracId, pokusaj, greska: greska instanceof Error ? greska.message : String(greska) });
    if (!igracId) return;
    const aktualni = this.aktualni(dogadaj, igracId);
    if (!aktualni) return;
    const preostalo = aktualni.istekPotezaMs === null ? Infinity : aktualni.istekPotezaMs - this.sada();
    const konfiguracija = this.konfiguracijePartija.get(dogadaj.partijaId) ?? this.ovisnosti.konfiguracija;
    if (pokusaj >= konfiguracija.maksimalnoOporavakaBota || preostalo <= 150) {
      this.dovrseniTokeni.set(dogadaj.partijaId, dogadaj.turnToken);
      this.ovisnosti.prekiniZbogGreske?.(dogadaj.partijaId, igracId, dogadaj.turnToken);
      return;
    }
    const posao = () => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.turnToken !== dogadaj.turnToken || plan.igracId !== igracId) return;
      this.planirano.delete(dogadaj.partijaId);
      const svjezi = this.aktualni(dogadaj, igracId);
      if (!svjezi) return;
      try {
        const kandidati = [...this.ovisnosti.rjecnik.igriviKandidati(svjezi.trazenaSlova!, svjezi.iskoristeneGrupe, svjezi.dopusteneVrste)].filter((rijec) => !odbijene.has(rijec));
        if (kandidati.length === 0 && svjezi.trazenaSlova?.toLowerCase() !== 'ka') throw new Error('Nema preostalih kandidata tijekom tehničkog oporavka');
        const odluka = this.odluci(svjezi, this.stanjeBota(dogadaj.partijaId, igracId), odbijene, true);
        this.izvrsi(svjezi, igracId, dogadaj.turnToken, odluka, pokusaj + 1, odbijene);
      } catch (novaGreska) {
        this.oporavi(svjezi, igracId, pokusaj + 1, odbijene, novaGreska);
      }
    };
    try {
      const odmak = konfiguracija.odmaciOporavkaBotaMs[pokusaj] ?? konfiguracija.odmaciOporavkaBotaMs.at(-1) ?? 100;
      const odgoda = Math.min(odmak, preostalo - 150);
      const handle = this.zakazi(posao, odgoda);
      this.planirano.set(dogadaj.partijaId, { handle, igracId, turnToken: dogadaj.turnToken, izvrsitiUMs: this.sada() + odgoda, vrsta: 'oporavak' });
    } catch (greskaPlaniranja) {
      this.brojaci.tehnickeGreske += 1;
      this.zapisi('Nije moguće zakazati oporavak bota', { partijaId: dogadaj.partijaId, igracId, greska: greskaPlaniranja instanceof Error ? greskaPlaniranja.message : String(greskaPlaniranja) });
      this.dovrseniTokeni.set(dogadaj.partijaId, dogadaj.turnToken);
      this.ovisnosti.prekiniZbogGreske?.(dogadaj.partijaId, igracId, dogadaj.turnToken);
    }
  }

  private stanjeBota(partijaId: string, igracId: string): StanjeBotaUPartiji {
    let poIgracu = this.stanjaPoPartiji.get(partijaId);
    if (!poIgracu) {
      poIgracu = new Map();
      this.stanjaPoPartiji.set(partijaId, poIgracu);
    }
    let stanje = poIgracu.get(igracId);
    if (!stanje) {
      stanje = stvoriStanjeBota(this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija, this.rng);
      stanje.koeficijentTempa = koeficijentTempaBota(igracId, this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija);
      poIgracu.set(igracId, stanje);
    }
    return stanje;
  }

  private otkaziPlan(partijaId: string): void {
    const plan = this.planirano.get(partijaId);
    if (!plan) return;
    this.otkazi(plan.handle);
    this.planirano.delete(partijaId);
  }
}
