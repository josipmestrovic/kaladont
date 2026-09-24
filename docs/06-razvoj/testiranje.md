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
