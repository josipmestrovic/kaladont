# Protokol poruka (Socket.IO)

Svi nazivi događaja i polja su hrvatski bez dijakritika. Tipovi payloada definirani su u `paketi/zajednicko` i dijele ih klijent i poslužitelj — protokol je **jedini ugovor** između njih.

## Autentikacija veze

Pri uspostavi veze klijent u handshake šalje:

```ts
interface PodaciVeze {
  /** UUID gosta iz localStoragea ILI sesijski token registriranog igrača */
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
| `potez:rijec` | `{ rijec: string }` | Pokušaj poteza |
| `potez:ne-znam` | `{}` | Predaja poteza (klijent traži potvrdu prije slanja) |
| `reakcija:posalji` | `{ poruka: BrzaPoruka }` | Predefinirana brza poruka (rate limit 1/2 s) |
| `partija:izadji` | `{}` | Napuštanje stola (aktivni igrač = predaja, klijent traži potvrdu prije slanja; promatrač = izlaz bez potvrde) |

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
| `partija:kraj` | `KrajPartije` | Konačni plasmani i bodovi |
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
  sjedala: { igracId: string; nadimak: string; avatarId: number; rang: string | null }[]; // redom 0-3
  // naPotezuId/istekPotezaIso više se ne šalju ovdje - dolaze tek u RundaOtvorena, nakon
  // što sustav odabere prvu riječ (vidi partija:sustav-bira-rijec / partija:runda-otvorena)
}

interface StanjePartije {
  partijaId: string;
  mojIgracId: string;
  sjedala: { igracId: string; nadimak: string; avatarId: number; rang: string | null }[];
  naPotezuId: string;
  trazenaSlova: string | null;
  istekPotezaIso: string;
  runda: number;
  brojIskoristenih: number;
  eliminacije: Eliminacija[];
  sustavBiraRijec: boolean;
  istekIzboraIso: string | null;
}

/** Sustav je počeo birati riječ za otvaranje runde. */
interface SustavBiraRijec {
  istekIzboraIso: string;      // apsolutno vrijeme kad se riječ otkriva (server je sat)
}

/** Sustav je otkrio nasumično odabranu riječ; igrač na potezu na nju odgovara kao na normalan nastavak. */
interface RundaOtvorena {
  rijec: string;
  trazenaSlova: string;
  naPotezuId: string;
  istekPotezaIso: string;      // apsolutno vrijeme isteka 30s timera (server je sat)
  runda: number;
}

interface PrihvacenPotez {
  igracId: string;
  rijec: string;
  trazenaSlova: string;        // dva grafema za sljedećeg
  sljedeciId: string;
  istekPotezaIso: string;
  brojIskoristenih: number;    // za prikaz napretka partije
}

interface OdbijenPotez {
  kod: "RIJEC_NE_POSTOJI" | "KRIVA_SLOVA" | "RIJEC_ISKORISTENA" | "NIJE_TVOJ_POTEZ";
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

type KodGreske = "PREBRZO" | "NISI_U_PARTIJI" | "VEC_U_REDU" | "INTERNA";
```

## Pravila protokola

1. **Server je sat.** Klijent prikazuje odbrojavanje prema `istekPotezaIso`, ali presudu donosi isključivo server (RS-14).
2. **Resinkronizacija:** nakon svakog ponovnog spajanja klijent dobiva `partija:stanje` ili `red:stanje` — UI se uvijek može obnoviti iz jedne poruke.
3. **Promatrači** (eliminirani igrači) primaju sve događaje stola; smiju slati samo `reakcija:posalji` i `partija:izadji`.
4. **Idempotentnost:** ponovljeni `red:udji` dok je igrač već u redu vraća `greska { kod: "VEC_U_REDU" }` bez nuspojava.
5. Svaka poruka poslužitelja nosi spreman hrvatski tekst (`poruka`) — klijent ne sastavlja poruke pravila sam.
