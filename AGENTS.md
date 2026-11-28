# AGENTS.md — Kaladont

Trajne upute za AI agente koji rade u ovom repozitoriju. Vrijede za cijeli repozitorij, osim gdje konkretnije upute za poddirektorij propisuju dodatna pravila. Korisnik odobrava opseg, merge i objavu. Push nakon dovršene odobrene cjeline u **draft** PR je zadano (vidi §5.2). Ovaj dokument ne daje ovlast za izmjene produkcije.

## 1. Način rada

- Prije rada pročitaj ovaj dokument, postojeće Cursor rules, `README.md`, relevantne ADR-ove i dokumentaciju iz `docs/README.md`. Provjeri stvarni kod; dokumentacija može biti zastarjela.
- Provjeri `git status --short --branch`, trenutnu granu i postojeće lokalne promjene. Nikad ne prepisuj tuđi rad, ne resetiraj granu, ne briši nepoznate datoteke i ne radi force-push.
- **Ask:** razumij problem, postojeće ponašanje, rubne slučajeve i opseg. Ne implementiraj bez odobrenja.
- **Plan:** navedi konkretne datoteke, promjene, rizike, testove i kriterije prihvaćanja. Ako postoje otvorena pitanja koja mijenjaju produkt, iznesi ih prije implementacije.
- **Build:** implementiraj odobreni plan u malim logičkim cjelinama. Testiraj logiku u kodu; lokalni `ci:*` i Playwright samo na zahtjev (vidi §4). Završetak pojedinog commita nije kontrolna točka za GitHub CI i Bugbot (vidi §5). Ne širi opseg bez dogovora.
- Jedan PR po smislenoj funkcionalnoj ili infrastrukturnoj cjelini. Ne stvaraj dodatne PR-ove ni grane bez potrebe. Ako je zadatak dio postojećeg PR-a, radi u njemu.

## 2. Jezik, struktura i kvaliteta

- Komunikacija, dokumentacija, poruke u sučelju, nazivi testova, novi projektni identifikatori i komentari u pravilu su na hrvatskom, u skladu s postojećim kodom. Standardni tehnički identifikatori, nazivi vanjskih API-ja, biblioteka, protokola i Git konvencije ostaju u izvornom obliku. Ne preimenuj postojeće ugovore samo radi jezika.
- Commit poruke: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` i jasan opis na hrvatskom.
- Poštuj postojeću arhitekturu: `aplikacije/web`, `aplikacije/posluzitelj`, `paketi/zajednicko`, `e2e`, `skripte` i `docs`. Zajedničke tipove i pravila ne dupliciraj.
- Koristi postojeće komponente, stilove, obrasce i testove. Ne dodaj ovisnost ako postojeća rješenja dostaju. Ne radi masovno formatiranje, preimenovanja, prepisivanje dokumentacije ili veliki refaktor izvan zadatka.
- Poslužitelj je autoritet za stanje igre, tajmere, završetak, nagrade i trajni napredak. Klijent prikazuje potvrđeno stanje. Obrada ponovljenih događaja i retryja mora ostati idempotentna.
- Kod promjena gameplaya uzmi u obzir Brzu igru, Trening, Privatne sobe i Izazove. Ne pretpostavljaj da svi konteksti imaju jednaka pravila gamifikacije.
- Testiraj stvarno ponašanje, uključujući rubne slučajeve i regresije. Nove testove, proširenje postojećih testova, nove funkcionalnosti, ovisnosti, refaktore ili druge izmjene izvan odobrenog plana nemoj dodavati na svoju ruku. Predloži ih korisniku uz konkretan razlog, prednosti, nedostatke, cijenu održavanja i preporuku; čekaj odobrenje. Testovi izričito uključeni u odobreni plan smiju se implementirati. Pokretanje lokalnog `ci:*` / Playwrighta: vidi §4.

## 3. Lokalni razvoj i izolacija

- Koristi Node.js 22, pnpm 9.15.9 i PostgreSQL 16, odnosno verzije koje propisuju `package.json` i aktualni `.github/workflows/ci.yml`. Instalacija: `pnpm install --frozen-lockfile`.
- Windows je primarna lokalna razvojna okolina. Docker, WSL i virtualizacija nisu preduvjet lokalnih aplikacijskih provjera.
- Ručni razvoj i igranje (`pnpm dev`) koriste razvojnu bazu i stvarni rječnik. Automatizirani lokalni CI koristi zasebnu, privremenu lokalnu testnu bazu s postojećim `ci-fixture` podacima.
- **Nikad ne pokreći migracije, fixture, integracijske ili destruktivne testove prema razvojnoj, staging ili produkcijskoj bazi.** Provjeri i `BAZA_URL` i `BAZA_URL_MIGRACIJE`. Testna konfiguracija ne smije naslijediti razvojne tajne, stvarne API ključeve ili adrese vanjskih servisa.
- Za testove s bazom koristi izolirajuće CI naredbe. Ne pokreći obični `pnpm test` ili E2E iz neprovjerene okoline. Ne koristi zadani Playwright fallback na `kaladont_dev` za automatizirane provjere.
- Ne zaustavljaj korisnikov razvojni server, PostgreSQL servis ili tuđe procese radi CI-ja. Testni serveri moraju biti novi i ne smiju koristiti zauzete portove ili postojeće procese.
- Ne instaliraj globalne alate, mijenjaj sistemske postavke, omogućuj virtualizaciju, niti mijenjaj stvarne DB korisnike bez odobrenja. Ne commitaj `.env`, lokalne tajne, testne izvještaje, traceove ni privremene baze.

## 4. Lokalne provjere

GitHub Actions (puni suite, migracije, E2E) i Bugbot služe za neovisnu provjeru na dogovorenim kontrolnim točkama i na kraju PR-a. Lokalno agent ne pokreće puni CI bez eksplicitnog zahtjeva korisnika.

**Zabranjeno bez eksplicitnog zahtjeva korisnika** (nikad „usput”, „nakon cjeline” ni „prije pusha”):
- svi lokalni `pnpm ci:*` profili: `ci:brzi`, `ci:test`, `ci:e2e`, `ci:lokalni`, `ci:puni` i ekvivalenti
- Playwright / E2E na bilo koji način (`pnpm ci:e2e`, `pnpm exec playwright`, …)

Kad korisnik **izričito** zatraži takvu naredbu:
- Preferiraj najuži smisleni filter (datoteka / grep / project); ne širi na cijeli paket ili suite „za svaki slučaj”.
- `pnpm ci:e2e` **uvijek** uz filter; nikad cijeli Playwright suite osim ako korisnik to eksplicitno zatraži.
- Ako zatražena provjera padne, analiziraj uzrok i predloži/popravi u odobrenom opsegu; ponovno pokretanje opet samo na zahtjev (osim ako korisnik kaže „popravi i ponovi”).
- Za nestabilnost, kad je zatraženo: ciljano ponavljanje (npr. `pnpm ci:e2e -- e2e/izazovi.spec.ts:37 --project=desktop-chrome --repeat-each=5 --retries=0`). Retry nije zamjena za popravak.
- Ne uklanjaj test, ne mijenjaj očekivanje, ne povećavaj timeout, ne dodaj `skip`, `only`, proizvoljan sleep ili retry samo radi zelenog statusa.
- Ako zatražena lokalna provjera ne može raditi zbog okoline, reci što nedostaje. Push bez lokalnog `ci:*`/Playwrighta je uobičajen; GitHub obvezne provjere ostaju uključene.

**Referenca — `ci:*` / Playwright (samo na zahtjev):**

| Naredba | Što provjerava |
| --- | --- |
| `pnpm ci:brzi` | Zajednički build, lint, Svelte/TypeScript; bez DB-a i browsera. |
| `pnpm ci:test -- <datoteka ili filter>` | Odabrani Vitest na izoliranoj testnoj bazi. |
| `pnpm ci:e2e -- <Playwright argumenti>` | Odabrani E2E (datoteka, grep, project). |
| `pnpm ci:lokalni` / `pnpm ci:puni` | Širi lokalni CI profili (ne pokretati bez zahtjeva). |

Paketni Vitest / `node:test` (`pnpm --filter … test`) nisu `ci:*` ni Playwright; ne pokreći ih masovno ni „za svaki slučaj”, a ciljano samo kad ima smisla za zadatak ili kad korisnik zatraži.

## 5. Git, draft PR, CI i Bugbot

**Osnovno pravilo: commit je logička razvojna cjelina, a kontrolna točka je trenutak za puni CI i Bugbot. To nisu iste stvari.** Tijekom razvoja nije potrebno imati zelen CI i završen Bugbot nakon svakog commita. Cilj je dovršiti odobreni opseg uz kvalitetan kod, a skupe provjere i popravke grupirati.

### 5.1. Planiranje kontrolnih točaka

- Pri planiranju PR-a predloži logičke cjeline (commitove), redoslijed i eventualne međukontrolne točke. Kontrolne točke dogovori s korisnikom; nemoj ih uvoditi samostalno nakon svake cjeline.
- Zadano je dovoljna **jedna završna kontrolna točka** nakon cijelog odobrenog opsega. Za veće ili rizične PR-ove predloži najviše tri ukupno: početnu nakon temelja, srednju nakon najosjetljivijih tehničkih cjelina i obveznu završnu. Dodatne kontrolne točke samo po dogovoru ili zbog stvarne blokade.
- Početna i srednja kontrolna točka nisu obvezne. Odaberi ih prema riziku (npr. migracije, autentikacija, matchmaking, zajednički protokoli ili promjene arhitekture), a ne prema broju commitova.
- Ne pokreći niti čekaj puni GitHub CI ili Bugbot samo zato što je dovršen commit, push ili pojedinačna funkcionalna cjelina. Korisnik može izričito zatražiti raniju provjeru.

### 5.2. Razvoj (draft)

- Svaki novi PR otvaraj kao draft. Tijekom razvoja PR **mora ostati draft** — draft je namjera da se ne pokreću skupi GitHub CI jobovi ni automatski Bugbot.
- Commitaj odobrene logičke cjeline lokalno. **Nakon svake dovršene odobrene cjeline** (kad bi inače stao i izvijestio): commit → `git diff --check` i ciljane lokalne provjere prema §4 → **odmah push** na granu draft PR-a. Ne čekaj da korisnik kaže „pushaj”. Ne pushaj svaku sitnu međuizmjenu unutar još nedovršene cjeline.
- Prije pusha: potvrdi da je PR draft (`gh pr ready --undo` / `gh pr view` ako treba); pregledaj diff, status, baznu granu i udaljene promjene (`git fetch`, usporedba). Kod konflikta ili neočekivanih promjena stani; ne prepisuj povijest.
- Ne pokreći lokalni `ci:*` / Playwright bez eksplicitnog zahtjeva. Nemoj dodavati neodobrene testove ili širiti opseg. Ne čekaj GitHub CI ni Bugbot nakon pusha u draft.
- Ako je odobreno više cjelina, nastavi na sljedeću bez čekanja CI-ja ili Bugbota. Ako je odobrena samo jedna cjelina, pushaj je u draft i zaustavi se uz izvještaj (§6). Zastoj radi odluke o opsegu nije kontrolna točka.
- Ciljana konfiguracija: draft PR preskače skupe GitHub CI jobove i automatski Bugbot review. Dopuštena je kratka GitHub kontrola draft statusa; ona nije dokaz prolaza. Dok konfiguracija nije primijenjena i provjerena, ne tvrdi da draft gasi CI ili Bugbot. Ako se provjere ipak pokreću, ne čekaj ih tijekom razvoja. Promjene workflowa ili Bugbot konfiguracije predloži zasebno; ne mijenjaj ih bez odobrenja.
- Ako se nakon dogovorene kontrolne točke nastavlja implementacija novih funkcionalnih cjelina, vrati PR u draft prije nastavka razvoja (i prije pusha nove cjeline). Ako je postojeći PR već Ready, a korisnik odobri nastavak razvoja, također ga vrati u draft. Ne vraćaj ga u draft između pojedinačnih popravaka unutar iste review ture.

### 5.3. Nalazi tijekom razvoja

- Ako CI ili Bugbot ipak prijave problem tijekom razvoja, evidentiraj nalaz, zahvaćeni SHA, prioritet i dokaz. Ne prekidaj razvoj radi svakog nalaza i ne pokreći novu turu provjera nakon svakog popravka.
- Potvrđene kritične probleme koji ugrožavaju sigurnost, privatnost, integritet podataka, migracije, gameplay ili mogućnost nastavka razvoja riješi odmah unutar odobrenog opsega. Ako popravak izlazi iz opsega, prijavi blokadu i zatraži odluku korisnika.
- Ostale potvrđene nalaze grupiraj za dogovorenu kontrolnu točku, osim ako ih je jednostavnije i sigurnije riješiti unutar aktualne cjeline bez širenja opsega. Ne zanemaruj ih i ne označavaj riješenima bez dokaza.
- Pri kontrolnoj točki ponovno provjeri vrijedi li raniji nalaz za aktualni kod. Ne popravljaj zastarjele nalaze samo zato što su ostali u komentaru.

### 5.4. Prijelaz u review na kontrolnoj točki

- Kad je dogovorena kontrolna točka dosegnuta, izvijesti korisnika što je gotovo, koje provjere su stvarno izvršene i što ostaje GitHubu. Lokalni `ci:*` / Playwright predloži; pokreni samo na zahtjev.
- Pushaj grupirano stanje na kontrolnoj točki, zatim označi PR **Ready for review** na zadnjem SHA-u. Na završnoj kontrolnoj točki učini to odmah nakon dovršetka cijelog odobrenog opsega; ne čekaj lokalni `ci:*` / Playwright ni dodatno odobrenje samo za Ready. Push ostaje prema dogovoru s korisnikom.
- Provjeri da su se puni GitHub CI i Bugbot za aktualni SHA stvarno pokrenuli. Ne radi prazne commitove za pokretanje reviewa. Ako se provjere ne pokrenu, prijavi konkretan razlog i koristi postojeći podržani način pokretanja, ako je dostupan i odobren.
- Na kontrolnoj točki čekaj relevantne rezultate za aktualni SHA i riješi potvrđene nalaze u grupiranim turama prema §5.5. Tijekom ove faze ne miješaj razvoj novih funkcionalnosti s review popravcima.
- Nakon uspješne međukontrolne točke izvijesti korisnika i nastavi preostali odobreni razvoj u draftu. Zeleni rezultati međukontrolne točke nisu zamjena za završnu provjeru cijelog PR-a.

### 5.5. Review: popravci u turama (chunkovima)

- Prati CI jobove, logove, artefakte i Bugbot komentare/status za posljednji head SHA i odgovarajući PR merge SHA; pričekaj završetak relevantnih jobova i reviewa prije planiranja ture, osim kod potvrđene blokade ili otkazivanja. Ne tretiraj starije zelene rezultate ni neutralni Bugbot status kao dokaz odsutnosti nalaza.
- Prikupi sve nalaze iste ture, uključujući još relevantne nalaze iz razvoja. Razvrstaj: potvrđena greška u odobrenom opsegu, povezani simptomi istog uzroka, infrastrukturni/flaky problem, neutemeljen nalaz, prijedlog izvan opsega. Navedi dokaz i prioritet. Popravi potvrđene greške unutar odobrenog opsega; za sve ostalo predloži opcije, razlog, prednosti, nedostatke i preporuku te čekaj odobrenje. Ne proširuj opseg prema Bugbotu na svoju ruku.
- Analiziraj padove iz GitHub logova/artefakata; lokalni `ci:*` / Playwright za reprodukciju pokreni **samo** na eksplicitni zahtjev. Popravi grupu povezanih uzroka u odobrenom opsegu. Nove testove ili promjene testnih očekivanja mimo odobrenog plana samo predloži. Ne iskrivljuj test radi zelenog statusa.
- Kad su svi popravci ture gotovi, commitaj logičke cjeline i napravi jedan grupirani push u isti PR. Ne pushaj nakon svakog pojedinačnog nalaza i ne pokreći lokalni `ci:*` / Playwright bez zahtjeva. PR ostaje Ready for review tijekom review popravaka. Prati novi GitHub CI i Bugbot za novi SHA i ponovi postupak.
- Potvrđenu prolaznu infrastrukturnu grešku rješavaj ograničenim rerunom neuspjelih jobova istog SHA, bez praznih commitova. Kod ponavljajućeg istog pada ili nedostupnog reviewa prijavi blokadu umjesto beskonačnih pokušaja.
- Ne zatvaraj Bugbot nalaz samo radi zelenog statusa. Za potvrđeni popravak navedi commit/test; za pogrešan nalaz obrazloži dokaz; za stvarni nalaz izvan opsega zatraži odluku. Ne tvrdi da je review dovršen bez potvrde. Ako agent nema pristup statusima/logovima, ne glumi praćenje; zatraži odgovarajući pristup ili rezultat korisnika.

### 5.6. Završna kontrolna točka i merge

- Završna kontrolna točka je obvezna za cijeli aktualni PR, neovisno o broju ranijih zelenih provjera. Ako se nakon nje izmijeni kod, potrebno je ponovno potvrditi relevantne obvezne provjere za novu reviziju.
- Spremno za merge tek kad je puni obvezni GitHub CI zelen za aktualnu reviziju, Bugbot pregled aktualan i nema neriješenih blokirajućih nalaza, a sva ograničenja i odobrene iznimke su evidentirane.
- Ako provjere još traju ili nisu dostupne, izvijesti korisnika o stvarnom stanju. Ne predstavljaj PR kao spreman za merge.
- Nikad ne zaobilazi granske zaštite, ne mergeaj i ne objavljuj bez eksplicitnog odobrenja. Staging, ručni QA i produkcija slijede postojeće procedure.

## 6. Izvještaj na kraju rada

Nakon pojedine razvojne cjeline: pushaj u draft (§5.2), zatim navedi sažeto što je dovršeno, commit SHA, lokalne provjere, potvrdu pusha i draft statusa PR-a, poznate nalaze i rizike te sljedeću odobrenu cjelinu ili kontrolnu točku. CI i Bugbot tijekom draft razvoja: „ODGOĐENO DO KONTROLNE TOČKE” (ne čekaj ih). Ako su se ipak automatski pokrenuli, navedi stvarni poznati status bez čekanja.

Na kontrolnoj točki i pri završetku PR-a navedi: što je promijenjeno i zašto; relevantne datoteke; stvarno pokrenute naredbe (`ci:*`/Playwright samo ako ih je korisnik zatražio), broj prolaznih/neuspjelih/flaky testova ako je poznat, trajanje i status (`PROŠLO`, `PALO`, `BLOKIRANO`, `NIJE POKRENUTO`, `NIJE PRIMJENJIVO`); što ostaje za GitHub/staging; eventualne rizike i odstupanja; status CI-ja i Bugbota po SHA-u, popis nalaza i popravaka po turama te prijedloge neimplementiranih dodatnih testova/izmjena s pros/cons; commit SHA-ove i PR ako postoje. Ne tvrdi da je CI zelen ako nije potvrđen za točan commit. Ne tvrdi da si ručno testirao browser, mobilni uređaj ili produkcijsku sliku ako nisi.

## 7. Dokumentacija

- [Kazalo dokumentacije](docs/README.md)
- [Lokalno postavljanje okoline](docs/06-razvoj/postavljanje-okoline.md)
- [Testiranje](docs/06-razvoj/testiranje.md)
- [CI/CD](docs/07-operacije/ci-cd.md)
- [Pravila igre](docs/02-pravila-igre/pravila-igre.md)

Aktualni kod i `.github/workflows/ci.yml` određuju stvarno tehničko ponašanje; odobrene produktne odluke određuju cilj. Ako se ne slažu, navedi razliku i predloži ciljanu korekciju. Dokumentiraj novu operativnu naredbu uz njezinu implementaciju.
