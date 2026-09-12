# Testiranje

Pravila igre su srce proizvoda — greška u validaciji ili bodovanju izravno krade partije igračima. Zato je pokrivenost pravila **obavezna**, a UI testovi pragmatični.

## Alati

| Razina                 | Alat                      | Opseg                                             |
| ---------------------- | ------------------------- | ------------------------------------------------- |
| Jedinični              | Vitest                    | `paketi/zajednicko` — grafemi, pravila, bodovanje |
| Integracijski          | Vitest + socket.io-client | Engine partije kroz stvarne socket poruke         |
| E2E (nakon MVP jezgre) | Playwright                | Dimni test: landing → red → partija → kraj        |

## Trenutačno i ciljano stanje

Postojeći Vitest i Socket.IO testovi izvršavaju se lokalno uz native PostgreSQL. GitHub CI dodatno gradi i smoke-testira stvarnu amd64 Docker sliku: pokreće PostgreSQL, migracije, sintetički fixture, health check i simulaciju četiri igrača. Lokalni Windows razvoj i dalje ne zahtijeva Docker.

Na GitHubovom Ubuntu runneru stvarna amd64 slika prolazi migracije, sintetički rječnik, `/zdravlje` i simulaciju cijele partije. Nakon zelenog CI-ja zaseban workflow objavljuje image u GHCR-u s commit tagom i digestom. Stvarni hrLex uvoz izvodi se ručno na staging VPS-u, ne u CI-ju.

## Baseline Socket.IO opterećenja

CLI `pnpm --filter posluzitelj opterecenje` pokreće kontrolirano opterećenje prema adresi iz `SIMULACIJA_ADRESA` ili argumenta `--adresa`. Ne pokreće se automatski u CI-ju i ne smije se usmjeriti na produkciju.

```powershell
pnpm --filter posluzitelj opterecenje -- --scenarij=veze --klijenti=100 --val=20 --trajanje-ms=5000
pnpm --filter posluzitelj opterecenje -- --scenarij=red --klijenti=40 --idle=100 --val=20
pnpm --filter posluzitelj opterecenje -- --scenarij=reconnect --klijenti=100 --val=20 --ciklusi=3
```

Scenariji ispisuju JSON s p50/p95 i maksimalnim trajanjem spajanja, odnosno čekanja na sastavljanje stola. `--idle` u scenariju reda drži dodatne veze izvan čekaonice kako bi mjerenje otkrilo regresiju na globalni obilazak socketova. Nakon matchmaking mjerenja alat šalje `partija:izadji` svim uparenim klijentima i zadano čeka 16 sekundi da se stolovi uklone; čekanje se može promijeniti argumentom `--cekaj-ciscenje-ms`. Before/after mjerenje mora koristiti isti stroj, bazu, broj klijenata, veličinu vala i mrežni put. Staging test počinje malim brojem klijenata i povećava se stupnjevito uz praćenje CPU-a, memorije, PostgreSQL-a i pogrešaka.

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
