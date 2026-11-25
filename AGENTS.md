# AGENTS.md — Kaladont

Trajne upute za AI agente koji rade u ovom repozitoriju. Vrijede za cijeli repozitorij, osim gdje konkretnije upute za poddirektorij propisuju dodatna pravila. Korisnik odobrava opseg, push (prema dogovoru), merge i objavu. Ovaj dokument ne daje ovlast za izmjene produkcije.

## 1. Način rada

- Prije rada pročitaj ovaj dokument, postojeće Cursor rules, `README.md`, relevantne ADR-ove i dokumentaciju iz `docs/README.md`. Provjeri stvarni kod; dokumentacija može biti zastarjela.
- Provjeri `git status --short --branch`, trenutnu granu i postojeće lokalne promjene. Nikad ne prepisuj tuđi rad, ne resetiraj granu, ne briši nepoznate datoteke i ne radi force-push.
- **Ask:** razumij problem, postojeće ponašanje, rubne slučajeve i opseg. Ne implementiraj bez odobrenja.
- **Plan:** navedi konkretne datoteke, promjene, rizike, testove i kriterije prihvaćanja. Ako postoje otvorena pitanja koja mijenjaju produkt, iznesi ih prije implementacije.
- **Build:** implementiraj odobreni plan u malim logičkim cjelinama. Testiraj svaku cjelinu, ispravi uzrok greške i provjeri regresije. Ne širi opseg bez dogovora.
- Jedan PR po smislenoj funkcionalnoj ili infrastrukturnoj cjelini. Ne stvaraj dodatne PR-ove ni grane bez potrebe. Ako je zadatak dio postojećeg PR-a, radi u njemu.

## 2. Jezik, struktura i kvaliteta

- Komunikacija, dokumentacija, poruke u sučelju, nazivi testova, novi projektni identifikatori i komentari u pravilu su na hrvatskom, u skladu s postojećim kodom. Standardni tehnički identifikatori, nazivi vanjskih API-ja, biblioteka, protokola i Git konvencije ostaju u izvornom obliku. Ne preimenuj postojeće ugovore samo radi jezika.
- Commit poruke: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:` i jasan opis na hrvatskom.
- Poštuj postojeću arhitekturu: `aplikacije/web`, `aplikacije/posluzitelj`, `paketi/zajednicko`, `e2e`, `skripte` i `docs`. Zajedničke tipove i pravila ne dupliciraj.
- Koristi postojeće komponente, stilove, obrasce i testove. Ne dodaj ovisnost ako postojeća rješenja dostaju. Ne radi masovno formatiranje, preimenovanja, prepisivanje dokumentacije ili veliki refaktor izvan zadatka.
- Poslužitelj je autoritet za stanje igre, tajmere, završetak, nagrade i trajni napredak. Klijent prikazuje potvrđeno stanje. Obrada ponovljenih događaja i retryja mora ostati idempotentna.
- Kod promjena gameplaya uzmi u obzir Brzu igru, Trening, Privatne sobe i Izazove. Ne pretpostavljaj da svi konteksti imaju jednaka pravila gamifikacije.
- Testiraj stvarno ponašanje, uključujući rubne slučajeve i regresije. Samostalno odaberi i pokreni postojeće relevantne testove. Nove testove, proširenje postojećih testova, nove funkcionalnosti, ovisnosti, refaktore ili druge izmjene izvan odobrenog plana nemoj dodavati na svoju ruku. Predloži ih korisniku uz konkretan razlog, prednosti, nedostatke, cijenu održavanja i preporuku; čekaj odobrenje. Testovi izričito uključeni u odobreni plan smiju se implementirati.

## 3. Lokalni razvoj i izolacija

- Koristi Node.js 22, pnpm 9.15.9 i PostgreSQL 16, odnosno verzije koje propisuju `package.json` i aktualni `.github/workflows/ci.yml`. Instalacija: `pnpm install --frozen-lockfile`.
- Windows je primarna lokalna razvojna okolina. Docker, WSL i virtualizacija nisu preduvjet lokalnih aplikacijskih provjera.
- Ručni razvoj i igranje (`pnpm dev`) koriste razvojnu bazu i stvarni rječnik. Automatizirani lokalni CI koristi zasebnu, privremenu lokalnu testnu bazu s postojećim `ci-fixture` podacima.
- **Nikad ne pokreći migracije, fixture, integracijske ili destruktivne testove prema razvojnoj, staging ili produkcijskoj bazi.** Provjeri i `BAZA_URL` i `BAZA_URL_MIGRACIJE`. Testna konfiguracija ne smije naslijediti razvojne tajne, stvarne API ključeve ili adrese vanjskih servisa.
- Za testove s bazom koristi izolirajuće CI naredbe. Ne pokreći obični `pnpm test` ili E2E iz neprovjerene okoline. Ne koristi zadani Playwright fallback na `kaladont_dev` za automatizirane provjere.
- Ne zaustavljaj korisnikov razvojni server, PostgreSQL servis ili tuđe procese radi CI-ja. Testni serveri moraju biti novi i ne smiju koristiti zauzete portove ili postojeće procese.
- Ne instaliraj globalne alate, mijenjaj sistemske postavke, omogućuj virtualizaciju, niti mijenjaj stvarne DB korisnike bez odobrenja. Ne commitaj `.env`, lokalne tajne, testne izvještaje, traceove ni privremene baze.

## 4. Obvezne lokalne provjere

GitHub Actions je završna neovisna provjera (puni suite, migracije, E2E, Bugbot). Lokalno agent **nikad** ne pokreće puni CI.

**Zabranjeno bez eksplicitnog zahtjeva korisnika:** `pnpm ci:lokalni`, `pnpm ci:puni`, `pnpm ci:e2e` bez filtera (glavni suite), te bilo koji ekvivalent koji pokreće sve Vitest testove ili sva tri Playwright projekta. To je sporo i duplicira GitHub.

**Dopuštene lokalne provjere (samo osnovne / ciljane):**

| Naredba | Kada | Što provjerava |
| --- | --- | --- |
| `pnpm ci:brzi` | Tijekom implementacije i prije pusha | Zajednički build, lint, Svelte/TypeScript; bez DB-a i browsera. |
| `pnpm ci:test -- <datoteka ili filter>` | Kod promjena poslužitelja | Samo odabrani Vitest na izoliranoj testnoj bazi. |
| `pnpm ci:e2e -- <Playwright argumenti>` | Kod promjena UI-ja ili gameplaya | Samo odabrani E2E (datoteka, grep, project). **Uvijek** uz filter; nikad cijeli suite. |
| `pnpm --filter web test -- <filter>` / `pnpm --filter zajednicko test` | Čisti unit testovi | Ciljani paketni testovi. |

- Nakon svake logičke cjeline pokreni `ci:brzi` i najmanji relevantni ciljani test (jedna datoteka / jedan filter). Ne širi na „za svaki slučaj” cijeli paket.
- Prije draft pusha i prije Ready for review: dovoljno je `ci:brzi` + postojeći relevantni ciljani testovi za promjene od prethodnog pusha. Ne čekaj lokalni puni profil.
- Ako ciljana provjera padne, analiziraj uzrok, popravi i ponovi **samo** taj test (po potrebi uzak regresijski filter). Ne pokreći puni suite radi potvrde.
- Za nestabilnost koristi ciljano ponavljanje (npr. `pnpm ci:e2e -- e2e/izazovi.spec.ts:37 --project=desktop-chrome --repeat-each=5 --retries=0`). Retry nije zamjena za popravak.
- Ne uklanjaj test, ne mijenjaj očekivanje, ne povećavaj timeout, ne dodaj `skip`, `only`, proizvoljan sleep ili retry samo radi zelenog statusa.
- Ako osnovna lokalna provjera ne može raditi zbog okoline, reci što nedostaje. Push uz nedovršene osnovne provjere zahtijeva odobrenje korisnika; GitHub obvezne provjere ostaju uključene.

## 5. Git, draft PR, CI i Bugbot

### Razvoj (draft)

- Svaki PR otvaraj kao draft. Commitaj logičke cjeline lokalno; pushaj ih u dogovorenim turama u isti draft PR nakon uspješnih relevantnih lokalnih provjera. Ne moraš čekati puni GitHub CI niti Bugbot tijekom razvoja. Ne pushaj svaku sitnu izmjenu.
- Ciljana konfiguracija: draft PR preskače skupe GitHub CI jobove i automatski Bugbot review. Dopuštena je samo kratka GitHub kontrola draft statusa; ona nije dokaz prolaza. Dok konfiguracija nije primijenjena i provjerena, ne tvrdi da draft gasi CI ili Bugbot.
- Prije svakog pusha pregledaj diff, status, baznu granu i udaljene promjene (`git fetch`, usporedba lokalne i udaljene grane). Kod konflikta ili neočekivanih promjena stani; ne prepisuj povijest.

### Prijelaz u review

- Kad je cijeli odobreni opseg gotov, dovoljni su `ci:brzi` i ciljani relevantni testovi. Izvijesti korisnika o tome što je lokalno pokrenuto i što ostaje GitHubu. Ako predlažeš nove testove ili izmjene izvan plana, navedi razlog, pros/cons i preporuku; ne implementiraj ih bez odobrenja.
- Pushaj konačno stanje, zatim **odmah označi PR Ready for review** na tom zadnjem SHA-u kako bi se pokrenuli puni GitHub CI i Bugbot. Ne čekaj lokalni puni CI ni dodatno odobrenje samo za Ready ako je odobreni opseg dovršen i osnovne lokalne provjere prošle. Provjeri da su se puni GitHub CI i Bugbot za posljednji SHA stvarno pokrenuli. Ne radi prazne commitove za pokretanje reviewa. Merge i objava i dalje zahtijevaju eksplicitno odobrenje.

### Review: popravci u turama (chunkovima)

- Prati CI jobove, logove, artefakte i Bugbot komentare/status za posljednji head SHA i odgovarajući PR merge SHA; pričekaj završetak relevantnih jobova i reviewa prije planiranja ture, osim kod potvrđene blokade ili otkazivanja. Ne tretiraj starije zelene rezultate ni neutralni Bugbot status kao dokaz odsutnosti nalaza.
- Prikupi sve nalaze iste ture. Razvrstaj: potvrđena greška u odobrenom opsegu, povezani simptomi istog uzroka, infrastrukturni/flaky problem, neutemeljen nalaz, prijedlog izvan opsega. Navedi dokaz i prioritet. Popravi potvrđene greške unutar odobrenog opsega; za sve ostalo predloži opcije, razlog, prednosti, nedostatke i preporuku te čekaj odobrenje. Ne proširuj opseg prema Bugbotu na svoju ruku.
- Reproduciraj padove lokalno, popravi grupu povezanih uzroka i pokreni neuspjele te relevantne postojeće regresijske testove. Agent samostalno odabire dodatne postojeće testove i obrazlaže izbor. Nove testove ili promjene testnih očekivanja mimo odobrenog plana samo predloži. Ne iskrivljuj test radi zelenog statusa.
- Kad su svi popravci ture gotovi, pokreni `ci:brzi` i ciljane testove za popravljeno, commitaj logičke cjeline i napravi jedan grupirani push u isti PR. Ne pokreći lokalni puni CI. PR ostaje Ready for review tijekom review popravaka; ne vraćaj ga u draft nakon svake greške. Prati novi GitHub CI i Bugbot za novi SHA i ponovi postupak. Potvrđenu prolaznu infrastrukturnu grešku rješavaj ograničenim rerunom neuspjelih jobova istog SHA, bez praznih commitova. Kod ponavljajućeg istog pada ili nedostupnog reviewa prijavi blokadu umjesto beskonačnih pokušaja.
- Ne zatvaraj Bugbot nalaz samo radi zelenog statusa. Za potvrđeni popravak navedi commit/test; za pogrešan nalaz obrazloži dokaz; za stvarni nalaz izvan opsega zatraži odluku. Ne tvrdi da je review dovršen bez potvrde. Ako agent nema pristup statusima/logovima, ne glumi praćenje; zatraži odgovarajući pristup ili rezultat korisnika.
- Spremno za merge tek kad je puni obvezni GitHub CI zelen za aktualnu reviziju, Bugbot pregled aktualan i nema neriješenih blokirajućih nalaza, a sva ograničenja i odobrene iznimke su evidentirane. Nikad ne zaobilazi granske zaštite, ne mergeaj i ne objavljuj bez eksplicitnog odobrenja. Staging i produkcija slijede postojeće procedure.

## 6. Izvještaj na kraju rada

Navedi: što je promijenjeno i zašto; relevantne datoteke; stvarno pokrenute naredbe, broj prolaznih/neuspjelih/flaky testova ako je poznat, trajanje i status (`PROŠLO`, `PALO`, `BLOKIRANO`, `NIJE POKRENUTO`, `NIJE PRIMJENJIVO`); što ostaje za GitHub/staging; eventualne rizike i odstupanja; status CI-ja i Bugbota po SHA-u, popis nalaza i popravaka po turama te prijedloge neimplementiranih dodatnih testova/izmjena s pros/cons; commit SHA-ove i PR ako postoje. Ne tvrdi da je CI zelen ako nije potvrđen za točan commit. Ne tvrdi da si ručno testirao browser, mobilni uređaj ili produkcijsku sliku ako nisi.

## 7. Dokumentacija

- [Kazalo dokumentacije](docs/README.md)
- [Lokalno postavljanje okoline](docs/06-razvoj/postavljanje-okoline.md)
- [Testiranje](docs/06-razvoj/testiranje.md)
- [CI/CD](docs/07-operacije/ci-cd.md)
- [Pravila igre](docs/02-pravila-igre/pravila-igre.md)

Aktualni kod i `.github/workflows/ci.yml` određuju stvarno tehničko ponašanje; odobrene produktne odluke određuju cilj. Ako se ne slažu, navedi razliku i predloži ciljanu korekciju. Dokumentiraj novu operativnu naredbu uz njezinu implementaciju.
