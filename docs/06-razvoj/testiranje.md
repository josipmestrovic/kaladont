# Provjera admin monitoringa

`pnpm --filter posluzitelj exec vitest run test/nadzor.test.ts test/admin-statistika.test.ts test/http-rute.test.ts --hookTimeout=180000 --testTimeout=120000` provjerava ograničenu povijest, CPU delte, alarmne pragove i cooldown, admin pristup i kompatibilnost healtha. `e2e/admin-nadzor.spec.ts` provjerava desktop/mobilni prikaz, zastarjele podatke i izričitu probnu obavijest s mock API-jem. Testovi ne šalju stvarne operativne emailove. Prije uključivanja na stagingu/produkciji operater mora postaviti `DEV_MAIL`, uključiti `NADZOR_EMAIL_OMOGUCEN=true` i provjeriti inbox nakon probne obavijesti; CI ne potvrđuje stvarnu dostavu ni vanjsku dostupnost VPS-a.
# Testiranje

Pravila igre su srce proizvoda — greška u validaciji ili bodovanju izravno krade partije igračima. Zato je pokrivenost pravila **obavezna**, a UI testovi pragmatični.

## Alati

| Razina        | Alat                      | Opseg                                                        |
| ------------- | ------------------------- | ------------------------------------------------------------ |
| Jedinični     | Vitest                    | `paketi/zajednicko` — grafemi, pravila, bodovanje            |
| Integracijski | Vitest + socket.io-client | Engine partije kroz stvarne socket poruke                    |
| E2E           | Playwright                | Kritični browser tokovi: auth, red, partija, soba, reconnect |

## Trenutačno i ciljano stanje

Playwright E2E testovi žive u `e2e/` i pokreću se odvojeno od brzog Vitest ciklusa:

```powershell
# jednom po računalu
pnpm test:e2e:install

# lokalno: native PostgreSQL mora raditi, migracije i sintetički rječnik moraju biti učitani
pnpm test:e2e

# samo emulirani mobilni kritični tokovi (Pixel Chromium + iPhone WebKit)
pnpm test:e2e:mobilni
```

E2E konfiguracija automatski pokreće poslužitelj na portu `3001` i web na portu `5174`. Lokalni
E2E koristi postojeću `.env` konfiguraciju i native PostgreSQL; u CI-ju se koriste CI varijable i
isti sintetički fixture kao za ostale provjere. `pnpm test` namjerno ne pokreće Chromium ni E2E
testove, pa dodavanje browsera ne usporava svakodnevni testni ciklus.

CI dodatno pokreće `pnpm test:e2e:http` protiv izgrađenog imagea na portu 3000 s
`POSLUZUJ_WEB=true`. Taj test provjerava direktan ulazak i refresh stranica na istom Fastify
procesu koji poslužuje API i SvelteKit, uključujući razdvajanje `/api/...` ruta od URL-ova stranica.

CI nakon toga pokreće `pnpm test:e2e:image-smoke` protiv istog buildanog imagea. To je kratki
real-user smoke: browser otvara privatnu sobu, pokreće partiju, završava je kroz „Ne znam”, provjerava
završni poredak i povratak kroz „Igraj ponovno”. Cilj nije zamijeniti sve E2E testove, nego dokazati
da stvarni produkcijski server, cookie/token stanje, SvelteKit stranice i Socket.IO rade zajedno.

Početni kritični paket ima šest testova: registracija/prijava i sesija, javni red za četiri igrača,
javni red za dva igrača, privatna soba s dva igrača i reconnect aktivne partije. Pravila grafema,
detaljno bodovanje i sve timer/reconnect utrke ostaju u jediničnim i Socket.IO integracijskim
testovima; E2E potvrđuje da se web, auth, socket događaji i navigacija zajedno ponašaju ispravno.

Testovi su serijalizirani s jednim workerom radi izolacije zajedničke testne baze. Očekivano trajanje
je približno 20–60 sekundi lokalno nakon pripreme procesa i približno 1–3 minute u CI-ju, ovisno o
instalaciji Chromiuma i pokretanju PostgreSQL-a.

## Mobilni E2E

Puni E2E paket izvršava se jednom na `desktop-chrome`. Datoteka `mobilni-tok.spec.ts` izvršava se
samo na `android-chrome` (Pixel 7, Chromium) i `iphone-webkit` (iPhone 13, WebKit), kako se cijeli
desktop paket ne bi nepotrebno utrostručio. Mobilni paket provjerava responsive raspored, fokus i
tipkovničku navigaciju, privatnu partiju, offline/online reconnect te rezultat i ponovno igranje.

CI instalira Chromium i WebKit. Mobilni paket dodaje četiri testa na svakom projektu; zbog jednog
workera očekivano povećava E2E trajanje približno 1–3 minute. Trace, screenshot i video zadržavaju
se pri neuspjehu prema Playwright konfiguraciji.

Emulacija nije zamjena za stvarni uređaj. Prije releasea ručno provjeriti na Android Chromeu i
iPhone Safariju: otvorenu virtualnu tipkovnicu tijekom poteza, Wi-Fi prema mobilnoj mreži i povratak,
background/foreground, pinch zoom te sistemsku navigaciju naprijed/natrag.

Postojeći Vitest i Socket.IO testovi izvršavaju se lokalno uz native PostgreSQL. GitHub CI dodatno gradi i smoke-testira stvarnu amd64 Docker sliku: pokreće PostgreSQL, migracije, sintetički fixture, health check, browser smoke, kratki load smoke i simulaciju četiri igrača. Lokalni Windows razvoj i dalje ne zahtijeva Docker.

Na GitHubovom Ubuntu runneru stvarna amd64 slika prolazi migracije, sintetički rječnik, `/zdravlje` i simulaciju cijele partije. Nakon zelenog CI-ja zaseban workflow objavljuje image u GHCR-u s commit tagom i digestom. Stvarni hrLex uvoz izvodi se ručno na staging VPS-u, ne u CI-ju.

Prije glavne CI baze pokreće se i migracijski upgrade test nad zasebnom bazom `kaladont_upgrade_ci`.
Taj test primijeni baseline migracije, ubaci sintetičke postojeće podatke, primijeni zadnje migracije i
provjeri da su ključni zapisi i očekivani novi stupci/indeksi očuvani.

## Baseline Socket.IO opterećenja

CLI `pnpm --filter posluzitelj opterecenje` pokreće kontrolirano opterećenje prema adresi iz `SIMULACIJA_ADRESA` ili argumenta `--adresa`. Kratki scenarij `igra` pokreće se automatski u CI-ju protiv buildanog imagea na svakom `main` pushu. Dulji scenariji ostaju ručni staging postupak i ne smiju se usmjeriti na produkciju.

### Ručni test staging veza

Naredba `test:opterecenje` je odvojena od standardnih testova, CI-ja i objave. Zahtijeva ciljnu adresu, broj klijenata i vrijeme držanja, dopušta samo `https://staging.kaladont.hr`, ograničava vrijeme držanja na jednu minutu do dva sata i prihvaća razine 100, 500, 1000, 2000, 5000 i 10000. Valovi su zadano 10 klijenata u sekundi, najviše 100 u sekundi. `trajanje-ms` označava vrijeme držanja nakon rampe; ukupno vrijeme staging testa, uključujući rampu, ograničeno je na dvije ure. Potvrda uspjeha čuva se na računalu generatora sedam dana, a svaka razina traži uspješnu prethodnu razinu. Za 10000 klijenata potrebna je i dodatna potvrda. Neuspješan ili prekinut test poništava potvrdu te i viših razina. Produkcijska domena odbija se i preko stare naredbe `opterecenje`.

Početna ručna inačica podržava samo scenarij veza. Ona mjeri stvarno trajanje držanja veza, broj neočekivanih prekida i najmanji broj istodobno aktivnih veza. Prolaz traži dovršene pokušaje, stopu pogrešaka unutar praga, održavanje najmanje `ceil(klijenti * (1 - maks-stopa-gresaka))` veza te dovršeno nenulto vrijeme držanja. Planirano zatvaranje nakon mjerenja ne računa se kao neočekivan prekid. Ovaj scenarij **ne dokazuje kapacitet aktivne igre ni cilj 7000 igrača i 3000 posjetitelja**. Primjer za 100 veza tijekom minute:

```powershell
pnpm --filter posluzitelj test:opterecenje -- --scenarij=veze --adresa=https://staging.kaladont.hr --klijenti=100 --trajanje-ms=60000
```

Za 10000 klijenata naredbi se mora dodati `--potvrdi-10000=DA`. Pokretati samo jedan korak odjednom; prelazak na višu razinu traži pregled rezultata prethodne razine. Ostali scenariji odbijaju se u ovoj naredbi dok ne dobiju sigurnu podršku za dogovoreni omjer Dvoboja, javnih i privatnih Četveroboja te HTTP posjetitelja.

Lokalna brava sprječava paralelne testove s istog računala. Za miješani test dodatni staging lease dopušta samo jedan `runId` na cijelom stagingu; obnavlja se svakih 10 sekundi, istječe nakon 30 sekundi i test se prekida ako se obnova izgubi. Lease ruta postoji samo u stagingu i prihvaća zahtjev samo s točne `STAGING_TEST_IP` adrese koju postavlja Caddy. Privremena IP iznimka također postoji samo u stagingu. Staging Caddy prepisuje `X-Kaladont-IP-Klijenta` adresom spajanja, a poslužitelj je koristi samo u stagingu. Produkcijski Caddy uklanja takvo ulazno zaglavlje, a produkcijski poslužitelj ga zanemaruje. Izvan staging/produkcijskog proxy puta poslužitelj ne vjeruje proslijeđenim IP zaglavljima. Iznimka obuhvaća samo ograničenje novih veza i HTML dokumenata, ne opće API rute. U staging `.env` iznimku postaviti samo za dogovoreni termin, a nakon testa ukloniti je i vratiti uobičajene limite. `docker-compose.staging.yml` podržava privremeno povećanje limita preko `STAGING_TEST_MAKSIMALNO_VEZA`, `STAGING_TEST_MAKSIMALNO_SOBA`, `STAGING_TEST_MAKSIMALNO_PARTIJA` i `STAGING_TEST_DOGADAJI_PO_PROZORU`; bez tih varijabli ostaju dosadašnje vrijednosti. Ne mijenjati produkcijske limite.

Testni računi i partije ostaju u staging bazi. Nakon svakog testa provjeriti `/zdravlje`, stanje aplikacije i baze te ukloniti privremenu IP iznimku i povećane limite. Staging test ne pokretati tijekom uobičajene provjere izmjena; potreban je izričit zahtjev korisnika.

### Miješani test igre i javnih stranica

`test:opterecenje:mijesano` je zaseban, ručni CLI; nije pozvan iz `pnpm test`, CI-ja ni objave. Na stagingu zahtijeva lokalni k6 i interaktivni terminal. Botovi koriste Socket.IO polling s nadogradnjom na WebSocket, a HTTP korisnici šalju javne GET zahtjeve na naslovnicu (60%), ljestvice (20%), novosti (10%) i `/pravila-kaladonta?tema=pravila` (10%). Svaki pokus dobiva svoju trajnu mapu `%LOCALAPPDATA%\Kaladont\opterecenje\<runId>` na Windowsu, odnosno `~/.kaladont/opterecenje/<runId>` na drugim sustavima. Izvještaji i snimka rječnika ne spremaju se u repozitorij.

Snimku pripremiti jednokratno na staging VPS-u, unutar aplikacijskog kontejnera, i prenijeti je na generator samo odobrenim SSH/SCP kanalom. Ne otvarati PostgreSQL prema internetu. Primjer izvoza:

```powershell
docker compose exec aplikacija node dist/cli/izvezi-opterecenje-rjecnika.js --izlaz=/tmp/kaladont-opterecenje-rjecnik.jsonl.gz
```

Na generatoru pokreni razinu po razinu. Primjer za 100 ukupnih virtualnih korisnika:

```powershell
pnpm --filter posluzitelj test:opterecenje:mijesano -- --adresa=https://staging.kaladont.hr --klijenti=100 --trajanje-ms=600000 --rjecnik-snimka="C:\Temp\kaladont-opterecenje-rjecnik.jsonl.gz"
```

`--trajanje-ms` je vrijeme punog miješanog opterećenja nakon rampi botova i HTTP VU-a; ukupno trajanje s rampama i čišćenjem mora ostati kraće od dva sata. Razina 10000 zahtijeva dodatno `--potvrdi-10000=DA` te uspješne prethodne razine za isti profil i digest. Prekid, HTTP prag, health pogreška, promjena digesta ili nedostatan broj igrača ne spremaju potvrdu uspjeha.

Naredba nakon nužnih read-only provjera prikazuje cilj, razinu, stvarnu raspodjelu, profil, digest, prethodni `runId`, vremena i mapu izvještaja. Prije leasea, botova i k6-a zahtijeva točan unos `POKRENI 100` (ili broj tražene razine). To vrijedi i za prvu razinu. Pogrešan ili prazan unos, EOF i Ctrl+C otkazuju bez opterećenja i bez poništavanja prethodnih potvrda. Nema `yes` opcije ni CI iznimke. Nakon unosa ponovno se provjeravaju aktualni digest i prethodni prolaz; promjena prekida pripremu. Pokretanje bez interaktivnog ulaza odbija se prije kontakta sa stagingom.

Terminal prikazuje faze pripreme, rampe igrača i HTTP korisnika, mjerenja, dovršavanja partija i čišćenja. Otprilike svakih deset sekundi ispisuje stvarne veze, aktivne sudionike, red, ispale igrače, rezultate, partije, završene igre po načinu, pogreške i starost health provjere. HTTP broj u živom statusu je **plan**, ne mjerenje; stvarni VU-i, zahtjevi i latencije dostupni su u završnom k6 sažetku. Zdravstvena provjera starija od 15 sekundi označava se zastarjelom.

U mapi pokusa nalaze se `rezultat.json`, hrvatski `sazetak.txt`, `dnevnik.txt` (najviše 4000 zapisa od po 2048 znakova) i `k6-sazetak.json` kada je k6 korišten i uspio ga zapisati. Dnevnik se trajno zapisuje pri završavanju; prisilno gašenje procesa ili računala može ostaviti nepotpunu mapu. Konačan ishod nastaje nakon čišćenja botova, čekanja HTTP generatora i oslobađanja leasea/brave. Pogreške obveznih završnih koraka ruše prolaz. JSON s `zakljuceno: false` nije dokaz kapaciteta. Neuspjela priprema s `pokrenuto: false` odvojena je od pada pokrenutog testa i ne poništava ranije potvrde.

Nove potvrde miješanog testa nalaze se u podmapi `potvrde`, imaju verziju 2 i vežu razinu uz cilj, profil, digest, vrijeme, `runId` i putanju dovršenog PASS izvještaja. Vrijede sedam dana. Stare potvrde samo s vremenom završetka, test veza i lokalni smoke ne otključavaju miješani staging profil. Prolaz je tehnički preduvjet, **ne odobrenje sljedeće razine**. Svaka razina završava CLI proces; sljedeća zahtijeva novu naredbu i novi unos nakon pregleda rezultata i VPS metrika.

Operater može iznimno dodati `--preskoci-prethodnu-razinu=DA` za ručno preskakanje provjere prethodne razine. Zadano ostaje strogi redoslijed. Override je dopušten samo za staging; ne preskače interaktivni `POKRENI <razina>`, dodatnu potvrdu za 10000, provjeru ciljne adrese i digesta, lokalnu bravu, staging lease ni kriterije PASS-a. Konzola i TXT izvještaj prikazuju upozorenje, a JSON bilježi `prethodnaRazinaPreskocena: true`. Raniji FAIL izvještaji i potvrde nižih razina ne mijenjaju se niti se stvaraju umjetne potvrde. Novi pokus ocjenjuje se po istim kriterijima; stvarni PASS vrijedi samo za njegovu razinu.

Za dijagnostiku zastoja polling transporta može se dodati `--transport=websocket`. Zadano je `polling-websocket`, kao u web klijentu. Izravni WebSocket ima zaseban profil (sufiks `:websocket`), bilježi transport u JSON-u i upozorenje u TXT-u te ne otključava standardni profil. Taj pokus mjeri igru i HTTP opterećenje, ali nije dokaz rada polling putanje ili nadogradnje na WebSocket. Sigurnosni gateovi, pragovi i rokovi ostaju isti.

Lokalni pregled posljednjih 20 mapa pokusa i najviše valjane potvrde posljednjeg staging profila:

```powershell
pnpm --filter posluzitelj opterecenje:status
```

Status ništa ne zapisuje, ne šalje mrežne zahtjeve i ne stječe lease. Zna samo pohranjeni digest; ne zna je li staging u međuvremenu objavljen. Nedostajući, nepotpuni, istekli ili nepodudarni dokaz ne dopušta nastavak. Operativni pregled u dva terminala opisan je u [nadzor-i-dnevnici.md](../07-operacije/nadzor-i-dnevnici.md#praćenje-ručnog-staging-pokusa).

Bez Dockera lokalni smoke koristi `pnpm --filter posluzitelj test:opterecenje:lokalno -- --adresa=http://localhost:3000 --web-adresa=http://localhost:5173 --trajanje-ms=90000 --rjecnik-snimka="C:\Temp\kaladont-opterecenje-rjecnik.jsonl.gz"`. Pokreni lokalni server i Vite (`pnpm dev`) prvo; lokalni profil je fiksnih 11 igraćih korisnika (2 dvoboj, 4 javni četveroboj, 4 privatni četveroboj, 1 trening protiv Računala) i 3 HTTP korisnika, traje 15 do 120 sekundi, zadano ne koristi k6, staging lease ni gateove i ne zapisuje potvrdu razine. Za provjeru stvarnog k6 procesa dodaj `--http-generator=k6`; ako Vite sluša samo IPv6, koristi `--web-adresa=http://[::1]:5173`. Kratko trajanje ne jamči da će svaki način dovršiti igru. Trening zahtijeva `TRENING_OMOGUCEN=true` (zadano) na lokalnom poslužitelju; popuna javnog reda botovima nije dio ovog profila.

Početni pragovi miješanog testa: p95 poteza do 250 ms, p95 spremanja do 1 s, HTTP p95 do 1 s i manje od 0,5% tehničkih/HTTP pogrešaka. Rezultat vrijedi samo ako generator dosegne zadane VU-e, k6 i botovi uspješno završe te se uzmu health uzorci. CPU/RAM PostgreSQL-a i Caddyja pratiti zasebno na VPS-u; lokalni izvještaj mjeri TypeScript generatora, ne cijelog k6 procesa.

Potvrđeni profil od 9. 10. 2026. jest fiksnih 10.000 korisnika: 7.000 igraćih korisnika prolazi realan ciklus igranja, a 3.000 pregledava javne HTML stranice. To nije zahtjev za 7.000 neprekidno aktivnih sudionika partija. Red, eliminirani igrači i rezultati prikazuju se odvojeno od stvarno aktivnih igrača; nema rezervnih botova ni skrivenog povećavanja ukupnog broja korisnika. U držanju treba održati najmanje 99,5% zadanih igraćih korisnika povezanima i mjeriti aktivnost. Provjeravaju se latencije ukupno i za svaki način, valjani nenulti uzorci, dovršeno držanje te završetak svih načina igre. Izostanak napretka bota ili partije dulji od 60 sekundi prekida test. Staging botovi razmišljaju 3–10 sekundi; lokalni smoke koristi brže poteze (1–3 s) i kraće igre. Tempo VU-a mora ostati ispod poslužiteljskog limita od 30 događaja u minuti po igraču i vrsti događaja (`SOCKET_DOGADAJI_PO_PROZORU`): višak se tiho odbacuje i VU čeka istek poteza, što izgleda kao zastoj.

#### Profil v5: računalni protivnici u stres testu

Profil `mijesani-k6-socket-v5` (lokalno `lokalni-smoke-v5`) uključuje Zagrijavanje iz [ADR-017](../03-arhitektura/odluke/017-botovi-i-zagrijavanje.md): dio igraćih korisnika igra trening protiv poslužiteljskog „Računala” umjesto javnih partija. Na 10.000 korisnika to je 100 istodobnih treninga (ulaze u 7.000 igraćih, ukupno ostaje 10.000); manje razine skaliraju broj (100 → 2, 500 → 6, 1000 → 10, 2000 → 20, 5000 → 50), a ostatak igraćih dijeli se 45/45/10 na Dvoboj, javni i privatni Četveroboj. Trening VU nakon svakog `partija:kraj` odmah traži novi `trening:zapocni`; odbijanje poslužitelja (limit `MAKSIMALNO_AKTIVNIH_TRENINGA`, isključeno Zagrijavanje) ruši provjeru `treninziPrihvaceni`, nikad se ne prikriva. Trening se ne sprema u bazu, pa za njega nema mjerenja spremanja ni provjere `partijeBezSpremanja`. Javni fond botova se u ovom profilu ne forsira: popuna reda provjerava se zasebnim predtestom (dolje).

Dodatni kriteriji prolaza (uz postojeće): bar jedan završen trening kad su planirani; medijan istodobnih treninga tijekom držanja ≥ 90 % planiranih; **0** eliminacija računalnog protivnika istekom vremena (health `botIsteci` delta i brojanje generatora); **0** tehničkih grešaka bot kontrolera (`botTehnickeGreske` delta); p95 poteza VU-a u treningu ≤ 250 ms; p95 event-loop laga poslužitelja (`eventLoopP95Ms` iz health uzoraka) ≤ 100 ms. Informativno se bilježe p50/p95 vremena odgovora Računala i broj vanjskih sudionika u javnim partijama (očekivano 0 kad je popuna isključena). Priprema odbija poslužitelj čiji `/zdravlje` ne izlaže metrike botova; potvrde profila v4 ne otključavaju v5.

#### Predtest popune reda botovima

`pnpm --filter posluzitelj test:opterecenje:popuna` zaseban je ručni CLI koji provjerava pragove popune iz [botovi.md](../02-pravila-igre/botovi.md): zadano 10 VU-a u Dvoboju i 10 u Četveroboju (`--broj=1..10`). Unutar moda VU-ovi ulaze **strogo serijski** (sljedeći tek kad prethodni dobije `partija:pocetak`), pa u redu nikad nisu dva čovjeka; modovi teku usporedno jer imaju odvojene redove. Mjeri se vrijeme od potvrde `red:udji` do `partija:pocetak` (očekivano 30 s za Dvoboj, 40 s za Četveroboj, tolerancija ±3 s), broj sudionika koji nisu VU (1 odnosno 3), pojava rezerviranih botova u `red:stanje` četveroboja (20 s i 30 s ±3 s), da botovi odigraju poteze u svakoj partiji te delte health brojača `botIsteci`, `botTehnickeGreske` i `fondIscrpljenja` (sve moraju biti 0). VU odigra dvije riječi i preda; botovi zatim sami dovršavaju partiju, a CLI čeka krajeve do `--rok-kraja-ms` (zadano 4 min) i upozorava ako fond nije vraćen na početnu vrijednost. Preduvjeti: health s metrikama botova, `botoviDvoboj` i `botoviCetveroboj` uključeni, najmanje 4 slobodna bota i miran poslužitelj bez aktivnih partija. Na stagingu traži interaktivnu potvrdu `POKRENI 20`, lokalnu bravu i staging lease kao miješani test; lokalno `--lokalno=DA` prema `http://localhost:3000`. Izvještaj (`vrsta: 'popuna'`) sprema se u istu mapu pokusa, ali **ne zapisuje potvrdu razine** i ne otključava miješani test.

```powershell
pnpm --filter posluzitelj test:opterecenje:popuna -- --adresa=https://staging.kaladont.hr --rjecnik-snimka="C:\Temp\kaladont-opterecenje-rjecnik.jsonl.gz"
```

K6 skript zahtijeva HTTP 200, rok zahtjeva od 3 sekunde i stvarne aktivne VU-e tijekom držanja. Parser podržava izravni JSON iz `--summary-export` i format s `values`; nedostajuće metrike su greška. Potvrde profila v5 uključuju SHA-256 snimke i vrijeme držanja uz digest servera, pa starije potvrde ne otključavaju novu ocjenu. Na svim stepenicama koristi iste postavke i vrijeme držanja. Health i zastoji nadziru se i tijekom rampe. Nakon mjerenja zaustavljaju se nove partije i postojeće dobivaju najviše 60 sekundi lokalno, odnosno 180 sekundi na stagingu, za dovršetak (četveroboj započet pred kraj treba tri eliminacije uz 10 s izbora riječi sustava, oko 40 s). Čišćenje se prikazuje zasebno i ne produljuje prikazano puno opterećenje. Ukupni rok uključuje i taj završetak.

K6 je moguće instalirati bez Dockera i administratorskih prava raspakiravanjem službenog Windows ZIP izdanja uz SHA-256 provjeru iz službene checksums datoteke. Korisnička instalacija nalazi se u `%LOCALAPPDATA%\Programs\k6`, a njezina mapa s `k6.exe` dodaje se u korisnički PATH. Već otvoreni VS Code možda treba ponovno pokrenuti da naslijedi novi PATH.

Mali pokus stvarnog k6 skripta može se pokrenuti zasebno i samo lokalno (najviše 3 VU-a, najviše 120 sekundi držanja). Primjer za Vite koji sluša IPv6 loopback:

```powershell
k6 run --summary-export "$env:TEMP\kaladont-k6-http-lokalno.json" -e LOKALNI_SMOKE=DA -e CILJNA_ADRESA=http://[::1]:5173 -e BROJ_POSJETITELJA=3 -e RAMPA_MS=1000 -e DRZANJE_MS=15000 skripte/testiranje/opterecenje-http.js
```

Izvještaj se sprema i pri neuspjehu ili prekidu. Sigurnosni timer zaustavlja dugotrajni test, a botovi nakon signala prekida ne smiju poslati novi potez. Ovi lokalni pokusi ne spremaju staging potvrde. Ne uključivati ih u automatsku objavu.

### Priprema staging pokusa

`STAGING_TEST_IP` prihvaća jednu IP adresu ili popis točnih IP adresa odvojenih zarezom. Ako mreža generatora koristi više javnih izlaznih adresa, dopustiti samo pojedinačno potvrđene adrese za termin, primjerice `203.0.113.10,203.0.113.11`. Svaka se adresa validira; CIDR rasponi, zamjenski znakovi i produkcijska iznimka nisu dopušteni. Acquire, renew i release leasea mogu doći s različitih dopuštenih adresa, ali vlasnik ostaje isti `runId`. Nakon termina ukloniti cijeli popis. Promjena izlazne adrese izvan popisa i dalje prekida test.

1. Pregledati promjene i pokrenuti CI. Push na main može objaviti novi staging digest, ali ne smije pokrenuti veliki test. Test se ne pokreće dok objava i migracije nisu završene.
2. Pripremiti snimku stvarnog staging rječnika i prenijeti je sigurnim kanalom. Staging mora imati svoju bazu; ne kopirati produkcijske račune. Ne mijenjati rječnik ili objavljivati aplikaciju tijekom pokusa.
3. Postaviti točan `STAGING_TEST_IP`, potvrditi da aplikacijski port nije javno izložen i provjeriti acquire/renew/release leasea kroz Caddy. Lokalni unit test leasea nije dokaz postavki proxyja na VPS-u.
4. Za termin s računalnim protivnicima u `/opt/kaladont/.env` staginga privremeno postaviti `TRENING_OMOGUCEN=true`, `BOTOVI_DVOBOJ=true`, `BOTOVI_CETVEROBOJ=true` i `MAKSIMALNO_AKTIVNIH_TRENINGA=100`, uz staging limite `STAGING_TEST_MAKSIMALNO_PARTIJA` ≥ 4000, `STAGING_TEST_MAKSIMALNO_VEZA` ≥ 8000 i `STAGING_TEST_MAKSIMALNO_SOBA` ≥ 200; zatim `docker compose -f docker-compose.staging.yml up -d --no-deps aplikacija` i seed fonda `docker compose -f docker-compose.staging.yml exec aplikacija node dist/cli/seed-botova.js --broj=40`. Provjeriti `/zdravlje`: `fondSlobodni` 40, `botoviDvoboj`/`botoviCetveroboj` `true`, `botIsteci` i `botTehnickeGreske` zabilježiti kao početne vrijednosti.
5. Pratiti CPU, RAM i disk VPS-a, PostgreSQL i aplikacijske dnevnike te računalo generatora. Za mali početni profil koristiti postojeće limite; za više razine povećati samo staging limite uz rezervu za kratko zadržane završene partije. Ni jedan limit nije dokaz kapaciteta hardvera.
6. Redoslijed termina: najprije predtest popune (`test:opterecenje:popuna`, `POKRENI 20`), pregled sažetka i `/admin` statistike čekanja; tek potom, na izričit zahtjev, miješani test 100 korisnika uz 10 minuta držanja. Nakon pregleda rezultata zasebno nastaviti na 500, 1000, 2000, 5000 i 10000, bez automatskog skoka; nakon svake razine pregledati sažetak (treninzi, isteci Računala, event-loop), `/admin` i VPS metrike. Deset tisuća je test granice; najveća stabilna razina može biti niža.
7. Poslije pokusa vratiti IP iznimku, limite i zastavice botova na uobičajene vrijednosti, provjeriti health, preostale veze/sobe i rezultate u bazi. Testni podaci ostaju na stagingu; treninzi se ne upisuju, a javne partije predtesta imaju `broj_botova` > 0. Prvi staging pokus provjerava i operativne postavke, ne samo brzinu.

Caddy konfiguracije mogu se validirati nativnim službenim Caddyjem 2.9.1 (`caddy validate --config Caddyfile --adapter caddyfile` i isti poziv za staging datoteku), bez pokretanja poslužitelja i bez lokalnog Dockera. Kontrolnu sumu izdanja provjeriti prema službenoj checksum datoteci; ovo izdanje koristi SHA-512. U CI-ju ostaje obvezna validacija Linux Docker slike i mali postojeći test.

HTTP profil mjeri HTML zahtjeve, ne izvođenje JavaScripta preglednika ni sve njegove API-je i statičke resurse. Izvještaj ne dokazuje 10.000 punih browser sesija niti oporavak aktivnih partija nakon restarta. Spremanje u botovu izvještaju potvrđeno je događajem `partija:kraj`; pregled trajnih zapisa, duplikata i VPS resursa dodatna je operativna provjera prije zaključka o kapacitetu.

```powershell
pnpm --filter posluzitelj opterecenje -- --scenarij=veze --klijenti=100 --val=20 --trajanje-ms=5000
pnpm --filter posluzitelj opterecenje -- --scenarij=red --klijenti=40 --idle=100 --val=20
pnpm --filter posluzitelj opterecenje -- --scenarij=reconnect --klijenti=100 --val=20 --ciklusi=3
pnpm --filter posluzitelj opterecenje -- --scenarij=igra --partije=4 --timeout-ms=120000
```

Scenariji ispisuju JSON s p50/p95 i maksimalnim trajanjem spajanja, odnosno čekanja na sastavljanje stola. `--idle` u scenariju reda drži dodatne veze izvan čekaonice kako bi mjerenje otkrilo regresiju na globalni obilazak socketova. Nakon matchmaking mjerenja alat šalje `partija:izadji` svim uparenim klijentima i zadano čeka 16 sekundi da se stolovi uklone; čekanje se može promijeniti argumentom `--cekaj-ciscenje-ms`. Svi scenariji automatski vraćaju non-zero izlaz kada `--maks-stopa-gresaka` bude prekoračena.

### Dokaz kapaciteta igre

Scenarij `igra` grupira botove po četiri, ulazi u javni red, igra stvarne partije riječima iz baze i
računa partiju uspješnom tek nakon `partija:kraj`. Mjeri prihvaćene poteze, vrijeme od
`partija:spremanje-rezultata` do `partija:kraj`, broj grešaka te health snapshot-e prije, tijekom i
nakon čišćenja.

Zadani kriteriji prolaza su:

- sve planirane partije završavaju;
- stopa grešaka <= `0,005`;
- p95 prihvaćenog poteza <= `250 ms`;
- p95 završnog spremanja <= `1 s`;
- nakon čišćenja nema aktivnih partija;
- RSS delta nakon čišćenja <= `256 MB`.

Pragovi su podesivi parametrima `--maks-stopa-gresaka`, `--p95-potez-ms`,
`--p95-spremanje-ms`, `--maks-aktivnih-partija-nakon-ciscenja` i `--maks-rss-delta-mb`.
`aktivneVeze` se izvještava odvojeno od `aktivnePartije`: broj socket veza nije broj igrača koje
igra pouzdano podržava.

Timer se ne miješa u brzi bot smoke. Za zasebni timer test koristi se `--timer-test=true`; jedan bot
namjerno šuti na potezu, a alat mjeri razliku između autoritativnog `istekPotezaIso` i eliminacije
razlogom `istek`. Kriterij prolaza je p95 drift <= `250 ms`.

Za kratki CI smoke koristi se nekoliko partija i stroži pragovi dovoljno brzi da blokiraju loš `main`
push bez velikog čekanja. Srednji ručni staging test koristi desetke ili stotine partija na istom
fixtureu i bilježi commit, verziju baze, resurse stroja i rezultat. Višesatni staging test ima
warm-up, periodično health uzorkovanje te nadzor PostgreSQL CPU-a, konekcija, lockova, Node RSS-a i
heap-a. Nijedan test se ne usmjerava na produkciju.

## Botovi i Zagrijavanje (ADR-017)

Obvezni testovi i njihovi rizici:

| Datoteka | Što dokazuje |
| --- | --- |
| `test/bot-odabir.test.ts` | Vrećice poštuju udjele; cijeli popis kandidata dostupan (i riječ bez frekvencije); isti RNG daje isti izbor neovisno o protivnikovim nastavcima; propust nemoguć na lakom prefiksu i najviše jedan na teškom; KA odgovor i rijetko ostavljanje KA; tempo unutar roka; kontroler ne igra sa starim tokenom, nakon kraja ni tijekom izbora sustava; promjena rječnika ponovno bira riječ. |
| `test/trening.test.ts` | Gost igra protiv Računala; `partija:kraj` bez XP/forme/DNK/kolekcije; **snimka svih tablica igre i napretka identična prije i poslije**; drugi trening odbijen dok prvi traje. |
| `test/botovi-identitet.test.ts` | Bot ne dobiva sesiju ni razrješenje identiteta; nije na ljestvici iako ima partije; fond nadimaka valjan; avatar generator ponovljiv; fond rezervacija bez duplikata, generacija štiti novu rezervaciju. |
| `test/raspored-popune.test.ts` | Lani sat: granice 19 999/20 000, 29 999/30 000, 39 999/40 000 ms; drugi čovjek prije praga oslobađa bota; izlazak najstarijeg ponovno računa; iscrpljen fond čeka; neuspjeli start oslobađa; isključena zastavica; nikad partija bez čovjeka. |
| `test/popuna-reda.test.ts` | Integracija s kratkim pragovima (`popunaBotovima` opcija poslužitelja): bot ulazi nakon praga, `partije.broj_botova = 1`, čekanje bota 0, isti javni obračun ljudima, fond oslobođen nakon spremanja; četveroboj prikazuje rezerviranog bota u čekaonici; dva čovjeka prije praga igraju bez bota. |
| `test/admin-statistika.test.ts` | 401/403/400/200 i izračun čekanja samo ljudima, raspodjela po broju botova, pobjede po sastavu i načini ispadanja botova na fiksturi. |
| `e2e/zagrijavanje.spec.ts` | Kartica → partija s Računalom → kraj treninga bez napretka → novi trening u stvarnom pregledniku. |

Produkcijske zastavice `BOTOVI_*` zadano su isključene, pa postojeći CI smoke i testovi reda rade bez botova; testovi popune uključuju botove isključivo opcijom `izgradiPosluzitelj({ popunaBotovima })`. Lokalno ručno testiranje popune: `pnpm --filter posluzitelj seed-botova -- --broj=40`, zatim `BOTOVI_DVOBOJ=true` u `.env` i jedan preglednik u Dvoboju; bot ulazi nakon 30 s.

## Provjera indeksa

CLI `pnpm --filter posluzitelj provjera-indeksa` stvara privremene PostgreSQL tablice s 50.000 igrača,
100.000 partija, 400.000 sudionika i 800.000 poteza. Pokreće `EXPLAIN (ANALYZE, BUFFERS)` za email
pretragu, povijest jednog igrača i poteze jedne partije. Tablice su privremene i uklanjaju se nakon
transakcije; naredba se ne smije pokretati prema staging ili produkcijskoj bazi.

Očekivanje je indeksni scan (ili bitmap index scan kod većeg broja pogodaka), bez sekvencijalnog skeniranja velikih tablica:
`uq_igraci_email_lower`, `idx_sudionici_partije_igrac_id_partija_id` i
`idx_potezi_partija_id_redni_broj`. Globalni upit top riječi nije obuhvaćen tim indeksima jer radi
agregaciju preko svih poteza.

Javni endpoint `/rijeci/top` koristi procesni TTL cache od 30 sekundi. Profil učitava najviše 200
otključanih riječi po kategoriji, a povijest poteza najviše 500 redaka po stranici. Testovi trebaju
provjeriti limite i metapodatke (`ukupno`, `imaJos`) bez ovisnosti o velikom rječniku.

Velike kolekcije koriste cursor paginaciju: `/povijest/:igracId` po `(pocetak, partija_id)`,
`/partije/:partijaId/potezi` po `(redni_broj, id)`, a `/profil/rijeci` i javna varijanta po
`rijec`. Cursor je opaque base64url vrijednost; klijent ne koristi `OFFSET`.

Profilna aktivnost (`/aktivnost/:igracId` i `/povijest/:igracId`) dostupna je samo administratoru.
Testirati `401` bez prijave, `403` za ne-admin sesiju i uspješan dohvat s admin sesijom.

## Obavezno pokriveno jediničnim testovima

### Grafemi (`grafemi.ts`)

- Parsiranje digrafa: `konj → [k,o,nj]`, `džamija → [dž,a,m,i,j,a]`, `ljubav → [lj,u,b,a,v]`
- Iznimke: `injekcija → [i,n,j,...]` (prva dva = „in", ne „inj")
- `zadnjaDva("kaladont") = "nt"`, `zadnjaDva("kralj") = "alj"`, `prvaDva("aljkavost") = "alj"`
- Dvografemske riječi: `zadnjaDva("uš") = "uš"`

### Pravila (`pravila.ts`) — mapiranje na rubne slučajeve

| Test                                                                       | RS    |
| -------------------------------------------------------------------------- | ----- |
| Početna riječ bez nastavka se odbija                                       | RS-01 |
| Mrtva slova iz baze → eliminacija sljedećeg, razlog `mrtva_slova_baza`     | RS-02 |
| Svi nastavci iskorišteni → razlog `mrtva_slova_iskoristeno`                | RS-03 |
| Neispravan upis ne mijenja stanje niti troši potez                         | RS-04 |
| Riječ jednaka traženim grafemima je valjana                                | RS-06 |
| Ponovljena riječ iz **ranije runde** se odbija (zabrana na razini partije) | —     |
| Strogi dijakritici: „cesta" ne prolazi kad se traži „česta"                | —     |

### Bodovanje (`bodovanje.ts`)

- Primjer iz [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md) (Cvita 6, Damir 2, Ana 2, Boris 0) kao zlatni test.
- Suma stola = 10 kad nema samoeliminacija; manje kad ih ima (RS-10).
- Savršena partija = 7; pobjednik minimalno 5.

### Engine partije (integracijski)

- Puna simulirana partija: 4 socket klijenta, nasumične valjane riječi → partija završi, plasmani konzistentni, agregati točni.
- Istek timera eliminira šutljivog klijenta (ubrzani sat u testu).
- Prekid veze kraći od 10 sekundi obnavlja sobu i potpuno stanje bez pomicanja timera poteza.
- Prekid veze dulji od 10 sekundi na potezu / izvan poteza → RS-09 / RS-10 bodovi.
- Zamjena stare veze novom vezom istog identiteta ne eliminira igrača iz aktivne partije; u redu čekanja stara veza odmah gubi mjesto, a nova ulazi na kraj.
- Dobrovoljni izlazak eliminira odmah, bez tolerancije.
- Utrka potez vs. istek: potez pristigao „prekasno" se ignorira (RS-14).
- Utrka isteka poteza i tolerancije prekida daje točno jednu eliminaciju; raniji istek određuje razlog.

## Svojstveni test (property-based, poželjno)

Generator: nasumičan niz valjanih poteza nad malim testnim rječnikom. Invarijante koje **uvijek** vrijede:

1. Nijedna riječ se ne ponavlja u partiji.
2. Svaki potez počinje na zadnja dva grafema prethodnog.
3. Zbroj bodova stola = 10 − (broj samoeliminacija prekidom izvan poteza × 1).
4. Točno jedan pobjednik; plasmani su permutacija {1,2,3,4}.

## Testni rječnik

Mali kontrolirani skup (~50 riječi) u `zajednicko/test/rjecnik-test.ts` — uključuje digrafe, iznimke, mrtve parove i lance za RS-03. Testovi ne ovise o pravom hrLexu.

## CI pragovi

- Svi testovi zeleni = uvjet za merge.
- Pokrivenost `paketi/zajednicko`: cilj ≥ 90 % linija (mjeri se, ne blokira prvi mjesec).

## Audio testovi (ručno, nema automatiziranih)

Audio manager i događajna integracija su implementirani (vidi [audio.md](audio.md)), ali nemaju automatizirane teste. Ručno prije svakog releasea provjeriti mute/volume, `localStorage` postavke, autoplay fallback nakon refresha (prva korisnička interakcija naoružava zvuk), SSR-safe ponašanje i deduplikaciju nakon Socket.IO reconnecta ili ponovnog mountanja. Posebno potvrditi da prihvaćena i odbijena riječ sviraju samo autoru poteza, dok eliminacija, nova runda i kraj partije (tek na prikazu konačnih rezultata) sviraju svim igračima. Potpuna matrica je u [audio.md](audio.md).
