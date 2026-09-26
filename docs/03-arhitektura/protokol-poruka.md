# Protokol poruka (Socket.IO)

Svi nazivi događaja i polja su hrvatski bez dijakritika. Tipovi payloada definirani su u `paketi/zajednicko` i dijele ih klijent i poslužitelj — protokol je **jedini ugovor** između njih.

## Autentikacija veze

Pri uspostavi veze klijent u handshake šalje:

```ts
interface PodaciVeze {
  /** Opaque guest token iz localStoragea ILI sesijski token registriranog igrača */
  token: string;
}
```

Poslužitelj razrješava identitet (ili stvara novog gosta) i veže socket uz `igracId`. Po identitetu je dopuštena **jedna aktivna veza** — nova zamjenjuje staru (RS-18).

## Događaji: klijent → poslužitelj

| Događaj | Payload | Opis |
|---|---|---|
| `red:udji` | `{}` | Ulazak u red čekanja |
| `red:izadji` | `{}` | Dobrovoljni izlazak iz reda |
| `partija:stanje` | `{}` | Zahtjev za trenutačnim stanjem partije nakon ponovnog spajanja |
| `potez:rijec` | `{ rijec: string, turnToken?: string }` | Pokušaj poteza vezan uz trenutačni potez |
| `potez:ne-znam` | `{ turnToken?: string }` | Predaja poteza (klijent traži potvrdu prije slanja) |
| `reakcija:posalji` | `{ poruka: BrzaPoruka }` | Predefinirana brza poruka (rate limit 1/2 s) |

```ts
type BrzaPoruka = "pozdrav" | "sorry" | "dobro-odigrano" | "najjaci";
// UI prikaz: 👋 Pozdrav! • 😅 Sorry! • 👏 Dobro odigrano! • 😎 Hvala
```

## Događaji: poslužitelj → klijent

| Događaj | Payload | Opis |
|---|---|---|
| `red:stanje` | `StanjeReda` | Real-time popunjenost mjesta; šalje se svima u redu pri svakoj promjeni |
| `partija:pocetak` | `PocetakPartije` | Stol popunjen, partija kreće |
| `partija:stanje` | `StanjePartije` | Potpuno stanje — šalje se pri ulasku/za resinkronizaciju |
| `potez:prihvacen` | `PrihvacenPotez` | Valjan potez; svi za stolom |
| `potez:odbijen` | `OdbijenPotez` | Samo igraču koji je pokušao |
| `partija:eliminacija` | `Eliminacija` | Netko je ispao; svi za stolom |
| `partija:sustav-bira-rijec` | `SustavBiraRijec` | Sustav počinje birati riječ za otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta) - 5s, nitko ne može igrati |
| `partija:runda-otvorena` | `RundaOtvorena` | Sustav je otkrio odabranu riječ; red ide na sljedećeg aktivnog igrača nakon napadača |
| `partija:spremanje-rezultata` | `SpremanjeRezultataPartije` | Igra je završila, ali se konačni rezultat još pokušava spremiti; šalje se pri svakom ponovnom pokušaju/reconnectu |
| `partija:ponistena` | `PonistenaPartija` | Partija je prekinuta restartom ili kontroliranim gašenjem; rezultat nije dodijeljen |
| `partija:kraj` | `KrajPartije` | Konačni plasmani, bodovi i privatni XP obračun primatelja |
| `iskustvo:obracun` | `ObracunIskustvaTijekomPartije` | Privatni XP obračun eliminiranog igrača |
| `reakcija:nova` | `{ igracId: string, poruka: BrzaPoruka }` | |
| `greska` | `{ kod: KodGreske, poruka: string }` | Općenite greške (npr. `PREBRZO`) |

## Tipovi payloada

```ts
interface StanjeReda {
  /** 4 mjesta; null = prazno. Igrači vide tko sjeda u real-timeu, s punom statistikom. */
  mjesta: ({
    nadimak: string;
    avatarId: number;
    rang: string | null;      // null dok je Piskaralo (< 10 partija)
    prosjekBodova: number;
    postotakPobjeda: number;
  } | null)[];
  /** Prosjek čekanja zadnjih 100 partija, u sekundama */
  prosjekCekanjaSek: number;
}

interface PocetakPartije {
  partijaId: string;
  mojIgracId: string; // identitet primatelja; poruka se šalje pojedinačno svakom socketu
    sjedala: { igracId: string; nadimak: string; avatarId: number; avatarConfig: AvatarConfigV1 | null; avatarRevision: number; rang: string | null; razina: number; trenutniNiz: number; razinaVatre: 0 | 1 | 2 | 3 }[]; // redom 0-3
  // naPotezuId/istekPotezaIso više se ne šalju ovdje - dolaze tek u RundaOtvorena, nakon
  // što sustav odabere prvu riječ (vidi partija:sustav-bira-rijec / partija:runda-otvorena)
}

interface StanjePartije {
  partijaId: string;
  mojIgracId: string;
  sjedala: { igracId: string; nadimak: string; avatarId: number; rang: string | null }[];
  turnToken: string;                         // jedinstveni identifikator ove instance poteza
  naPotezuId: string;
  trazenaSlova: string | null;
  istekPotezaIso: string;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
  zadnjaRijec: string | null;             // autoritativna zadnja riječ za obnovu prikaza
  zadnjaRijecIgracId: string | null;      // null za sustavsku riječ
  zadnjaRijecVrsta: "rijec" | "sustav_rijec" | null;
  zavrsena: boolean;                      // završena partija nije aktivna za nove poteze
  statusSpremanja: "nije_zavrsena" | "spremanje_rezultata" | "rezultati_spremljeni";
}

/** Sustav je počeo birati riječ za otvaranje runde. */
interface SustavBiraRijec {
  istekIzboraIso: string;      // apsolutno vrijeme kad se riječ otkriva (server je sat)
}

// Timer poteza
// `serverVrijemeIso` je trenutak servera u kojem je poruka sastavljena. Klijent
// koristi razliku prema vlastitom satu samo za vizualno odbrojavanje; server
// i dalje donosi konačnu odluku o isteku.

/** Sustav je otkrio nasumično odabranu riječ; igrač na potezu na nju odgovara kao na normalan nastavak. */
interface RundaOtvorena {
  rijec: string;
  trazenaSlova: string;
  naPotezuId: string;
  turnToken: string;                          // isti token vrijedi do promjene poteza
  istekPotezaIso: string;      // apsolutno vrijeme isteka 30s timera (server je sat)
  serverVrijemeIso: string;
  runda: number;
}

interface PrihvacenPotez {
  igracId: string;
  rijec: string;
  trazenaSlova: string;        // dva grafema za sljedećeg
  sljedeciId: string;
  turnToken: string;                          // token novog poteza
  istekPotezaIso: string;
  brojIskoristenih: number;    // za prikaz napretka partije
  nagrada: NagradaZaRijec | null; // jedan efekt; null za običnu riječ
}

interface KrajPartije {
  // Polje je personalizirano po primatelju; nikad ne sadrži tuđe XP stavke.
  mojeIskustvo: ObracunIskustva | null; // null za privatnu sobu
}

interface SpremanjeRezultataPartije {
  partijaId: string;
  poruka: string;
}

interface PonistenaPartija {
  partijaId: string;
  poruka: string;
}

interface NagradaZaRijec {
  intenzitet: "mali" | "srednji" | "veliki";
  rijetkost: "rijetka" | "srednje_rijetka" | "jako_rijetka" | null;
  duljina: "duga" | "srednje_duga" | "jako_duga" | null;
  tekst: string; // npr. „Pogođena je jako rijetka i srednje duga riječ!"
  streak: number; // trenutni streak autora nakon prihvaćenog poteza
}

interface OdbijenPotez {
  kod: "RIJEC_NE_POSTOJI" | "KRIVA_SLOVA" | "RIJEC_ISKORISTENA" | "NIJE_TVOJ_POTEZ" | "STARI_TURN_TOKEN" | "SUSTAV_BIRA_RIJEC";
  poruka: string;              // spreman UI tekst na hrvatskom
}

interface Eliminacija {
  igracId: string;
  plasman: 2 | 3 | 4;
  razlog: "ne_znam" | "istek" | "mrtva_slova_baza" | "mrtva_slova_iskoristeno" | "prekid" | "kaladont";
  /** Tko dobiva bod; null kod samoeliminacije prekidom izvan poteza */
  bodZa: string | null;
  /** Uz razlog mrtva_slova_*: slova koja su ostala bez odgovora */
  slova: string | null;
}

interface KrajPartije {
  partijaId: string;
  plasmani: {
    igracId: string;
    plasman: 1 | 2 | 3 | 4;
    bodovi: number;            // plasman + eliminacije + bonus
    eliminacije: number;
  }[];
  /** Samo za primatelja: novi prosjek i rang (null dok je Piskaralo) */
  mojNoviProsjek: number;
  mojRang: string | null;
}

type KodGreske = "PREBRZO" | "NISI_U_PARTIJI" | "VEC_U_REDU" | "EMAIL_NIJE_POTVRDEN" | "INTERNA";
```

## Pravila protokola

1. **Server je sat.** Klijent prikazuje odbrojavanje prema `istekPotezaIso`, ali presudu donosi isključivo server (RS-14).
2. **Token poteza:** `turnToken` se mijenja pri svakoj promjeni instance poteza. Timer i klijentske akcije vezani su uz token; zakašnjeli timer ili payload sa starim tokenom ne smije promijeniti stanje i dobiva `STARI_TURN_TOKEN`.
3. **Resinkronizacija:** nakon ponovnog spajanja istim identitetom poslužitelj vraća vezu u sobu aktivne partije i šalje `partija:stanje`; timer poteza nastavlja teći prema izvornom `istekPotezaIso`. U redu čekanja nema 10-sekundne tolerancije: svaki prekid odmah oslobađa mjesto, a klijent na `/red` nakon povratka ponovno šalje `red:udji` i ulazi na kraj reda. UI aktivne partije uvijek se može obnoviti iz jedne poruke.
4. **Promatrači** (eliminirani igrači) primaju sve događaje stola i smiju slati `reakcija:posalji`.
5. **Idempotentnost:** ponovljeni `red:udji` dok je igrač već u redu ponovno šalje `red:stanje` bez promjene položaja.
6. **Potvrda emaila:** nepotvrđeni registrirani račun dobiva `EMAIL_NIJE_POTVRDEN` pri ulasku u javni red i stvaranju, ulasku ili pokretanju privatne sobe. Gost i račun s potvrđenim aktivnim emailom (i emailom na čekanju) mogu igrati.
7. Svaka poruka poslužitelja nosi spreman hrvatski tekst (`poruka`) — klijent ne sastavlja poruke pravila sam.
8. `nagrada` se izračunava isključivo na poslužitelju nakon prihvaćene riječi igrača. Početne i druge sustavske riječi, kao i odbijeni potezi, nemaju nagradu.
9. Ako riječ istovremeno zadovoljava kriterij rijetkosti i duljine, šalje se jedan `NagradaZaRijec` s oba razloga. Klijent ne pušta dva zvuka i ne stvara dva odvojena efekta.
10. Nagrada se može prikazati svim klijentima u sobi, ali se ista leksemska grupa nagrađuje najviše jednom u jednoj partiji.
