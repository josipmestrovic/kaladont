# Kaladont — CalVer izdanja, javni dnevnik ažuriranja i tiha ažuriranja

- **Datum:** 17. studenoga 2026.
- **Grana:** `feat/calver-izdanja-i-novosti`
- **Pregledana baza:** [`693f7d5`](https://github.com/josipmestrovic/kaladont/commit/693f7d511c6a6ec93fdf77c8d634cc3c9c969e1a) (`main`), 17. 11. 2026.; izvedeno nad [`8fcb697`](https://github.com/josipmestrovic/kaladont/commit/8fcb697) (`main` nakon PR #93)
- **Produkcija u trenutku pregleda:** [`6d17dac`](https://github.com/josipmestrovic/kaladont/commit/6d17dacb29ede44b532c61accebb3fbcc863b772), promovirana 14. 11. 2026.

Dokument je samostalan i u cijelosti zamjenjuje raniju specifikaciju „Kaladont: prelazak na CalVer i javni dnevnik ažuriranja”. Najvažnija razlika prema njoj: **nije svaka produkcijska objava izdanje.**

Faze A–D izvodi agent. Fazu E i svaku produkcijsku promociju izvodi vlasnik.

## Stanje izvedbe

**Faze A–C su izvedene** u PR-u s grane `feat/calver-izdanja-i-novosti`, koji sadrži i ovaj dokument. **Faze D i E nisu izvedene:** GitHub Releaseovi i tagovi nisu dirani, a produkcija nije promovirana. Nakon spajanja PR-a operativni izvor istine su [ADR-018](03-arhitektura/odluke/018-calver-izdanja-i-tiha-azuriranja.md), [release shema](07-operacije/release-shema.md), [CI/CD](07-operacije/ci-cd.md) i [runbook](07-operacije/runbook-objava-i-rollback.md); ako se ovaj dokument i oni razlikuju, vrijede oni.

Redoslijed koji ostaje vlasniku:

1. Spojiti PR. Staging tada prikazuje „Zadnje ažuriranje: 14. 11. 2026.” i Novosti s jednim zapisom.
2. Faza D (poglavlje 10), prije bilo koje produkcijske promocije. Do tada čuvar datuma blokira svaku promociju, jer izdanje `2026-11-14` nema oznaku.
3. Faza E (poglavlje 11) na dan izdanja paketa Troboj.

Odstupanja izvedbe od poglavlja niže (tekst poglavlja je usklađen gdje je bilo potrebno):

| # | Poglavlje | Odstupanje i razlog |
| --- | --- | --- |
| 1 | 8.1 | Stavka prvog izdanja „Klasični Kaladont — igra na zadnja dva grafema…” ostala je kako je predložena, iako naziv „Klasični Kaladont” na commitu `6d17dac` ne postoji (uveo ga je paket Troboj). Ostale stavke su potvrđene nad tim commitom. Tekst potvrđuje ili mijenja vlasnik. |
| 2 | 8.2 | Validacija u TypeScriptu odbija i nepoznata polja zapisa, da tipfeler u neobaveznom polju (npr. `nastavk`) ne prođe nezapaženo. |
| 3 | 8.4 | Blok i footer dijele omotač `div.landing-dno`. Od 1000 px naviše blok je izvan toka (apsolutno iznad footera, u praznom lijevom stupcu), jer je u toku uz font za disleksiju uvodio okomito pomicanje (npr. 17 px na 1440×900). Na zaslonima užim od 380 px i uvijek uz font za disleksiju „Vidi što je novo” ide u vlastiti redak, bez razdjelnika. |
| 4 | 8.5 | Zajednička logika je u jq biblioteci `skripte/izdanja/izdanja.jq`, koju koriste obje skripte. Bez baze vremenskih zona skripta ne pada, nego koristi isto pravilo u POSIX obliku (`CET-1CEST,M3.5.0,M10.5.0/3`); test provjerava da se dva izračuna slažu. `upozorenje` se popunjava i bez `--samo-izvjestaj`. Testova skripti ima više od 15. Novi `.gitattributes` skriptama izdanja zadržava LF završetke i u radnom stablu na Windowsu, jer se pokreću i lokalno u Git Bashu (faza D). |
| 5 | 8.6 | Job `izdanje` provjerava oblik oznake i SHA-a prije poziva GitHuba, a commit postojeće oznake čita preko `commits/refs/tags/<oznaka>`. Ako `gh release create` ne uspije, sažetak ispisuje postupak oporavka (vidi napomenu o dozvoli za workflowe u 8.6). |
| 6 | 8.7 | Informativni korak staginga uz hvatanje grešaka ima i `continue-on-error: true`. |
| 7 | 8.9 | Raspored se provjerava na šest zaslona (320×568, 380×760, 390×844, 1100×700, 1440×900, 1366×500) u dvije kombinacije (tamna tema; svijetla tema s fontom za disleksiju), uz provjeru da blok na desktopu ne povećava visinu stranice. |
| 8 | 8.10 | Oznaka „0.2.0” zamijenjena je nazivom „paket Troboj” i u dva komentara u kodu (`paketi/zajednicko/src/katalog-partije.ts`, `aplikacije/posluzitelj/src/baza/shema.ts`) te u `docs/02-pravila-igre/bodovanje-i-rangovi.md` i `docs/07-operacije/odrzavanje.md`. |

Što lokalno nije moglo biti provjereno (Windows bez Dockera): izvođenje skripti na Linuxu s bazom vremenskih zona, stvarni workflowi i ugovorna provjera nad izgrađenom slikom. Mjerodavan je CI na PR-u; job `izdanje` prvi se put stvarno izvodi u fazi E.

## 1. Cilj

1. Javna izdanja označavati kalendarskim datumom (CalVer) umjesto oznaka `0.1.0` i `0.2.0`.
2. Na naslovnici prikazati „Zadnje ažuriranje” s datumom zadnjeg izdanja, povezano sa stranicom `/novosti`.
3. Omogućiti brze popravke na produkciji bez novog izdanja.
4. Učiniti nemogućim da datum u Novostima, datum u Git tagu i stvarni dan objave budu različiti.
5. Zamijeniti zastarjele GitHub Releaseove novom poviješću.

## 2. Odluke vlasnika

Ove odluke su donesene i ne preispituju se. Ako se neka pokaže neizvedivom, stani i prijavi.

| # | Tema | Odluka |
| --- | --- | --- |
| 1 | Datum izdanja | Upisuje se u repozitorij. Produkcijski workflow odbija promovirati novo izdanje čiji datum nije današnji (Europe/Zagreb). |
| 2 | Tag i GitHub Release | Stvara ih workflow automatski, u zasebnom jobu, nakon uspješne produkcijske provjere. |
| 3 | Brzi popravci | Promocija bez novog datiranog zapisa je tiho ažuriranje: bez taga, bez unosa u Novostima. Workflow razliku prepoznaje sam. |
| 4 | Hitna grana | Ne uvodi se. Produkcija dobiva samo ono što je na `main`. |
| 5 | Prvo izdanje | `v2026.11.14` na commitu `6d17dacb29ede44b532c61accebb3fbcc863b772`. |
| 6 | Paket Troboj | Ovaj sustav spaja se na `main` uz paket koji je već ondje. Paket ide na produkciju jednom promocijom nakon toga i prvo je izdanje koje prolazi automatskim putem. |
| 7 | Stari Releaseovi i tagovi | Brišu se sva tri Releasea i sva tri taga `v0.*-closed-alpha.1`. |
| 8 | Stare bilješke | Briše se svih šest datoteka `docs/07-operacije/release-notes-*.md`. |
| 9 | Stara sidra | `#v0-1-0` i `#v0-2-0` se ne prenose, jer nikad nisu bila javna na produkciji. |

## 3. Pojmovi

| Pojam | Značenje |
| --- | --- |
| Objava | Svaka uspješna promocija digesta na produkciju. |
| Izdanje | Objava koja na produkciju prvi put donosi novi datirani zapis iz `izdanja.json`. Ima CalVer oznaku, GitHub Release i unos u Novostima. |
| Tiho ažuriranje | Objava bez novog datiranog zapisa: popravci, sitnice, rollback. |
| Nacrt | Zapis s `objavljeno: null`. Nigdje se ne prikazuje. |
| Oznaka izdanja | Git tag `vYYYY.MM.DD`, ili `vYYYY.MM.DD.N` za drugo i svako sljedeće izdanje istoga dana. |
| Čuvar datuma | Provjera u produkcijskom workflowu koja ne dopušta novo izdanje čiji datum nije današnji. |

## 4. Provjereno stanje (17. 11. 2026.)

Prije rada ponovno provjeri prva dva retka. Ako se razlikuju, stani i prijavi vlasniku. Redak o `main` i stagingu smije se razlikovati, jer se `main` u međuvremenu pomiče.

| Što | Vrijednost |
| --- | --- |
| Produkcijski commit | `6d17dacb29ede44b532c61accebb3fbcc863b772` (merge PR #69) |
| Produkcijski digest | `sha256:d7d2877548349bff6736b49949a82c2d7a907172d1a5a3df05dc91b3834a6589` |
| Promovirano | 14. 11. 2026. u 09:04 (Europe/Zagreb), workflow run `43574041648` |
| Prethodni digest za rollback | `sha256:8f102faa1a13894635b29a1ebea7a08fa19a2a1c8837a44d89c6478771b352b1` (commit `74b39fe98d8010c77ecec90a66ae4f0cb07ffb55`) |
| `main` i staging | `693f7d511c6a6ec93fdf77c8d634cc3c9c969e1a`, 74 commita ispred produkcije |
| `/novosti` na produkciji | HTTP 307 na `/o-igri`; stranica Novosti nikad nije bila javna |
| GitHub Releaseovi | `v0.1.0-closed-alpha.1`, `v0.2.0-closed-alpha.1`, `v0.3.0-closed-alpha.1` (svi pre-release) |
| Koriste li se stari tagovi | Ne. Workflowi i skripte koriste samo puni digest i commit SHA. |
| Trajanje CI-ja na `main` | Oko 10 minuta (zadnjih osam runova: 8,5–11 min); staging deploy slijedi automatski |
| Jedinični testovi u `aplikacije/web` | Ne postoje; Vitest `^3.2.7` koristi `paketi/zajednicko` |

Naredbe za ponovnu provjeru:

```bash
curl -s https://kaladont.hr/zdravlje
gh release list --repo josipmestrovic/kaladont --limit 100
git ls-remote --tags origin
```

## 5. Stroga pravila

1. Ne pokreći workflow „Promoviraj produkciju”. Produkcijsku promociju radi isključivo vlasnik.
2. Ne pokreći test opterećenja staginga.
3. Bez `force push`, bez prepisivanja povijesti `main`, bez brisanja grana, GHCR slika i sigurnosnih kopija.
4. Ne mijenjaj značenje vrijednosti `RELEASE_VERSION`, `VERZIJA` i `DIGEST`. CalVer je oznaka izdanja, a ne identitet Docker slike.
5. Zadrži sve postojeće mehanizme: PR i CI provjere, GHCR promociju, staging gate po digestu, ručnu promociju, backup gate, health check i rollback.
6. Ne izmišljaj datume ni stanja deploymenta. Neprovjerljivu činjenicu izdvoji kao blokirajuću nedoumicu.
7. U javnom sučelju ne smiju se pojaviti SemVer, CalVer oznake, commit SHA ni `alpha`.
8. Oznaku DEMO na naslovnici ne diraj.
9. Bez poziva GitHub API-ja pri otvaranju stranice i bez `new Date()` za datum zadnjeg ažuriranja.
10. Identifikatori na hrvatskom bez dijakritika; komentari, dokumentacija, commit poruke i UI tekstovi na hrvatskom s dijakriticima. Commit poruke počinju glagolom u infinitivu.
11. Brisanje Releaseova i tagova izvodi se tek uz izričitu potvrdu vlasnika.

## 6. Pregled rješenja

```text
aplikacije/web/src/lib/izdanja.json      jedini izvor istine o izdanjima
        │
        ├─► aplikacije/web/src/lib/izdanja.ts ─► /novosti i naslovnica
        │
        └─► skripte/izdanja/odredi-izdanje.sh
                ├─► Promoviraj produkciju: vrsta objave i čuvar datuma
                │       └─► job „izdanje”: Git tag i GitHub Release
                ├─► Objaviti staging: najava vrste sljedeće promocije
                └─► CI: provjera da izgrađena slika prikazuje isto izdanje
```

Kako workflow odlučuje:

1. Uzme najnoviji datirani zapis iz `izdanja.json` na commitu slike.
2. Izračuna oznaku, npr. `v2026.11.23`.
3. Ako taj tag već postoji na GitHubu, objava je **tiho ažuriranje**.
4. Ako tag ne postoji, objava je **izdanje**. Tada datum zapisa mora biti jednak današnjem; inače workflow staje prije nego dirne produkciju.
5. Nakon uspješne produkcijske provjere zaseban job stvara tag na commitu slike i GitHub Release.
6. Ako je objava tiha, a datoteka sadrži nacrt, workflow to ispiše kao upozorenje, ali ne blokira.

Tako su tri datuma uvijek ista: datum u Novostima dolazi iz slike, tag se računa iz tog istog datuma, a čuvar jamči da je to stvarni dan objave.

Postojanje taga znači „ovo je izdanje već objavljeno”. Iz toga slijede dva svojstva na koja se ostatak dokumenta oslanja:

- rollback na sliku čije najnovije izdanje ima tag, kao i na sliku stariju od ovog sustava, uvijek je tiho ažuriranje i čuvar ga ne blokira;
- ručno stvoren tag na commitu izdanja jedini je način da se čuvar svjesno zaobiđe (vidi poglavlje 12).

## 7. Faza A — priprema i analiza

1. Glavno radno stablo vlasnik koristi paralelno: može biti na drugoj grani i imati necommitane izmjene i privremene datoteke (npr. `tmp-ci/`). Ne diraj ga, ne mijenjaj mu granu i ništa iz njega ne commitaj. Radi u zasebnom worktreeu:

   ```bash
   git fetch origin
   git worktree add -b feat/calver-izdanja-i-novosti ../Kaladont-calver origin/main
   ```

   Ako ovaj dokument još nije na `origin/main`, kopiraj ga iz glavnog radnog stabla u worktree i uključi u PR, da specifikacija bude verzionirana uz ostale u `docs/`. To je jedina datoteka koju smiješ preuzeti iz glavnog radnog stabla.

2. Ponovi provjere iz poglavlja 4.
3. Pročitaj `docs/07-operacije/release-shema.md`, `ci-cd.md`, `runbook-objava-i-rollback.md` i `docs/03-arhitektura/odluke/014-operativni-model-mvp-a.md`.
4. Usporedi stavke prvog izdanja (poglavlje 8.1) sa stvarnim stanjem commita `6d17dacb…`. Provjera od 17. 11. 2026. našla je jedno odstupanje: naziv „Klasični Kaladont” na tom commitu ne postoji u `aplikacije/web/src`, jer ga je uveo tek paket Troboj. Nazivi ostalih značajki iz popisa (Dvoboj, Četveroboj, Privatna soba, Zagrijavanje, kolekcija, misije, dostignuća, ljestvice, sandučić, avatari) na tom commitu postoje; brojke i pojedinosti, npr. „2–8 igrača”, ipak provjeri. Odstupanja ne ispravljaj napamet: predloži tekst vlasniku u opisu PR-a.

## 8. Faza B — implementacija

Sve izmjene u repozitoriju idu u **jedan PR** prema `main`.

### 8.1 Podaci: `aplikacije/web/src/lib/izdanja.json`

Polje zapisa, najnoviji prvi. Početni sadržaj:

```json
[
  {
    "objavljeno": null,
    "naslov": "Troboj i nova pravila igre",
    "stavke": [
      "Troboj (3 igrača) uz postojeći Dvoboj i Četveroboj",
      "Tri pravilnika — Klasični Kaladont, KA-zna, Dokaži nastavak — biraju se prije formata",
      "Jedan univerzalni rang i jedan Kaladont DNK za sve javne formate",
      "Ljestvice po formatu; ulaz 5 partija dnevno / 10 dulje razdoblje",
      "Novi paket misija i dostignuća (Troboj, dokaz, Klasični, KA-zna)"
    ]
  },
  {
    "objavljeno": "2026-11-14",
    "naslov": "Prvo javno izdanje",
    "stavke": [
      "Klasični Kaladont — igra na zadnja dva grafema, 30 s po potezu, hrLex rječnik",
      "Javni formati Dvoboj i Četveroboj",
      "Privatna soba (2–8 igrača) i Zagrijavanje protiv Računala",
      "Računi, profil i javni profil",
      "XP, razine, dnevne i tjedne misije te dostignuća",
      "Javne ljestvice",
      "Kolekcija riječi, editor avatara i sandučić obavijesti",
      "Popuna javnog reda botovima"
    ]
  }
]
```

Naslovi su prijedlog; vlasnik ih potvrđuje u PR-u.

Polja:

| Polje | Tip | Pravilo |
| --- | --- | --- |
| `objavljeno` | `"YYYY-MM-DD"` ili `null` | Dan stvarne produkcijske objave u zoni Europe/Zagreb. `null` znači nacrt. |
| `nastavak` | cijeli broj ≥ 1, neobavezno | Samo za drugo i svako sljedeće izdanje istoga dana: drugo ima `1`, treće `2`. Prvo izdanje dana ga nema. Nije dopušten na nacrtu. |
| `naslov` | tekst | Neprazan, jedan redak. |
| `stavke` | polje tekstova | Barem jedna stavka; nijedna prazna. |

Zapis nema polje `id`. Sve se izvodi iz datuma i nastavka, da se dva polja ne mogu razići:

| Izvedeno | Bez `nastavak` | S `nastavak: 1` |
| --- | --- | --- |
| `id` | `2026-11-23` | `2026-11-23-1` |
| `sidro` | `izdanje-2026-11-23` | `izdanje-2026-11-23-1` |
| `oznaka` | `v2026.11.23` | `v2026.11.23.1` |
| `datumHr` | `23. 11. 2026.` | `23. 11. 2026.` |

Hrvatski datum nema vodeće nule: `2026-12-05` daje `5. 12. 2026.`. Tag i ISO datum ih imaju.

### 8.2 Modul: `aplikacije/web/src/lib/izdanja.ts`

Izvozi:

| Izvoz | Opis |
| --- | --- |
| `interface Izdanje` | `id`, `objavljeno`, `nastavak`, `naslov`, `stavke`, `sidro`, `oznaka`, `datumHr` |
| `pripremiIzdanja(sirova: unknown): Izdanje[]` | Validira, izbacuje nacrte, izvodi polja i sortira silazno po datumu pa po nastavku. |
| `formatirajDatumHr(iso: string): string` | `2026-11-23` → `23. 11. 2026.` |
| `urlIzdanja(izdanje: Izdanje): string` | `/novosti#izdanje-2026-11-23` |
| `IZDANJA` | `pripremiIzdanja` nad uvezenim JSON-om |
| `NAJNOVIJE_IZDANJE` | `IZDANJA[0] ?? null` |

Zahtjevi:

- Čista logika, bez ovisnosti o SvelteKitu, da se može jedinično testirati.
- Datum se rastavlja kao tekst. Ne koristi `new Date(iso)` za prikaz, jer vremenska zona poslužitelja može pomaknuti dan. Valjanost kalendarskog datuma (npr. odbijanje `2026-02-30`) provjeri preko `Date.UTC` i usporedbe dijelova.
- Neispravni podaci bacaju `Error` s jasnom hrvatskom porukom. Tako build, testovi i SSR padaju glasno umjesto da prikažu krivi podatak.
- Validacija odbija: krivi oblik ili nepostojeći datum, dvostruki par datum i nastavak, `nastavak` na nacrtu, `nastavak` koji nije cijeli broj ≥ 1, `nastavak` N bez zapisa istoga dana s nastavcima 1 do N−1 i bez zapisa bez nastavka, prazan ili višeredni `naslov`, prazne `stavke`.
- JSON uvezi izravno (`resolveJsonModule` je već uključen u `aplikacije/web/tsconfig.json`).
- Uvozi u Svelte datotekama prate postojeći obrazac: `import { IZDANJA } from '$lib/izdanja.js';`.

### 8.3 Stranica Novosti: `aplikacije/web/src/routes/novosti/+page.svelte`

Zadrži postojeću strukturu, izgled zapisa, popis stavki i poveznice „O igri” i „Pravila”.

- Ukloni lokalno polje `objave` i čitaj `IZDANJA`.
- Svaki zapis: `<article class="objava" id={izdanje.sidro}>`.
- Naslov zapisa je datum: `<h2><time datetime={izdanje.objavljeno}>{izdanje.datumHr}</time></h2>`.
- Ispod datuma ide kratki naslov izdanja kao odlomak, npr. „Troboj i nova pravila igre”.
- Nacrti se ne prikazuju ni u kojem obliku.
- Stara sidra `v0-1-0` i `v0-2-0` se uklanjaju, zajedno s HINT komentarom koji ih spominje.
- U `SeoGlava` zamijeni formulaciju „po verziji” formulacijom vezanom uz izdanja. Stranica ostaje indeksabilna i u sitemapu; `seo.ts` i `sitemap.xml/+server.ts` ne treba mijenjati.
- Bez filtara, paginacije, API poziva i novih kontrola.

### 8.4 Naslovnica: `aplikacije/web/src/routes/+page.svelte`

Dodaj blok s točnim tekstom:

**Zadnje ažuriranje: 23. 11. 2026. · Vidi što je novo**

Ponašanje:

- „Zadnje ažuriranje:” je običan tekst, nije poveznica.
- Datum je običan `<time datetime="YYYY-MM-DD">` (nije poveznica). Samo „Vidi što je novo” vodi na `/novosti`.
- „Vidi što je novo” je zasebna poveznica na `/novosti`.
- Razdjelnik `·` ima `aria-hidden="true"`.
- Ako nema objavljenog izdanja, blok se ne renderira.
- Blok mora biti u SSR HTML-u, jer ga CI i produkcijski workflow provjeravaju `curl`-om.
- Bez oznaka „novo”, animacija, popupova i ikona.

Smještaj i izgled:

- Blok i `<footer class="landing-footer">` dijele omotač `<div class="landing-dno">` unutar `<main class="landing">`; blok je neposredno ispred footera. Ne stavljaj ga unutar footera: postojeći testovi mjere međusobni položaj navigacije i copyrighta u footeru.
- Širina i poravnanje prate footer: omotač ima `width: min(100%, 980px)`, blok je lijevo poravnat od 1000 px naviše, a centriran ispod toga.
- Od 1000 px naviše blok je izvan toka (`position: absolute; bottom: 100%`), u praznom lijevom stupcu pored kontrola pristupačnosti, pa ne povećava visinu stranice. Ispod 1000 px ostaje u toku.
- Na zaslonima užim od 380 px i uvijek uz font za disleksiju „Vidi što je novo” ide u vlastiti redak, a razdjelnik se skriva.
- Tipografija i boje iz postojećeg sustava: `var(--tekst-sitni)`, `var(--boja-tekst-sekundarni)`, podcrtane poveznice kao u footeru. Mora biti manji i nenametljiviji od glavne navigacije.
- Omotač treba `position: relative` i `z-index: 1`, kao footer, da ne završi ispod pozadinskih slojeva.
- Tekst se na uskim zaslonima smije prelomiti. Ne smije nastati vodoravni overflow.
- Naslovnica je visinski ugođena preko `clamp()` i `dvh` varijabli. Koristi kompaktne razmake u istom stilu i provjeri niske zaslone i font za disleksiju. Okomito pomicanje naslovnice je dopušteno (tako stoji i u komentaru na vrhu postojećeg CSS-a); vodoravno nije.
- Blok ne smije prekriti glavnu navigaciju, kontrole pristupačnosti ni ilustraciju (komponenta `Kaladont2d5d`, klasa `.scena-2d5d`; skrivena ispod 1000 px širine i na vrlo niskim zaslonima).
- Postojeća poveznica „Novosti” u footeru ostaje.

### 8.5 Skripte izdanja: `skripte/izdanja/`

Logika odluke živi u skriptama, a ne u YAML-u workflowa, da se može testirati. Skripte koriste samo `bash` i `jq`, koji su već dostupni na runnerima i već se koriste u workflowima. Skripte nemaju mrežne pozive. Zajednička pravila (validacija, izvođenje oznake i sidra, odluka, bilješke) su u jq biblioteci `skripte/izdanja/izdanja.jq`, koju obje skripte uključuju.

#### `skripte/izdanja/odredi-izdanje.sh`

```text
odredi-izdanje.sh --izdanja <putanja.json> [--oznake <datoteka>] [--danas YYYY-MM-DD] [--samo-izvjestaj]
```

- `--oznake`: datoteka s postojećim Git tagovima, jedan po retku. Priprema je workflow. Ako se izostavi, smatra se da tagova nema.
- `--danas`: zadano `TZ=Europe/Zagreb date +%F`. Parametar postoji radi testova. Ako baza vremenskih zona na stroju nije dostupna (npr. Git Bash na Windowsu), skripta koristi isto pravilo u POSIX obliku (`CET-1CEST,M3.5.0,M10.5.0/3`), da se datum nikad ne računa po UTC-u.
- `--samo-izvjestaj`: ništa ne blokira; služi stagingu i CI-ju. Slučajevi koji bi inače završili izlazom 3 vraćaju `vrsta=izdanje`, izlaz 0 i popunjeno `upozorenje`.

Izlaz na stdout su retci `kljuc=vrijednost`, spremni za `$GITHUB_OUTPUT`:

- `vrsta`: `izdanje` ili `tiho`.
- `oznaka`, `datum`, `sidro`: podaci najnovijeg datiranog zapisa; prazni ako ga nema.
- `naslov_releasea`: naslov GitHub Releasea, npr. `Kaladont | 23. 11. 2026.`; za `nastavak` N dobiva dodatak ` (N+1)`, npr. `Kaladont | 23. 11. 2026. (2)`.
- `nacrta`: broj nacrta u datoteci.
- `razlog`: jedna rečenica koja objašnjava odluku.
- `upozorenje`: prazno, osim kad bi promocija danas bila blokirana; tada sadrži razlog. Uz `--samo-izvjestaj` to je jedini trag blokade, jer je izlaz 0.

Sve vrijednosti su jednoredne i sastavlja ih skripta. Slobodan tekst iz `izdanja.json` (naslovi i stavke) ne ide u izlaz, nego samo na stderr. Poruke za čovjeka idu na stderr, na hrvatskom.

Pravila odluke:

| Situacija | Rezultat |
| --- | --- |
| Datoteka `izdanja.json` ne postoji (slika starija od ovog sustava) | `vrsta=tiho`, izlaz 0 |
| Nema nijednog datiranog zapisa | `vrsta=tiho`, izlaz 0 |
| Oznaka najnovijeg datiranog zapisa postoji među tagovima | `vrsta=tiho`, izlaz 0 |
| Oznaka ne postoji, datum je današnji i sva starija datirana izdanja imaju tag | `vrsta=izdanje`, izlaz 0 |
| Oznaka ne postoji, a datum nije današnji | izlaz 3; poruka objašnjava popravak |
| Oznaka ne postoji, a neko starije datirano izdanje nema tag | izlaz 3; poruka imenuje tag koji nedostaje |
| Neispravan JSON ili neispravan datum | izlaz 2 |

Najnoviji zapis određuje se sortiranjem po paru datum i nastavak, pri čemu izostavljen `nastavak` vrijedi 0. Redoslijed zapisa u datoteci ne utječe na odluku. Oznaka se s popisom tagova uspoređuje kao cijeli redak, a ne kao podniz ili regularni izraz: `v2026.11.23` ne smije „postojati” samo zato što postoji `v2026.11.23.1`.

Poruka za izlaz 3 mora čovjeku reći što učiniti. Primjer:

```text
Izdanje 2026-11-23 nema oznaku v2026.11.23, a danas je 2026-11-24.
Novo izdanje smije se promovirati samo na dan upisan u izdanja.json.
- Ako izdanje još nije objavljeno: novim PR-om upiši današnji datum ili vrati "objavljeno" na null.
- Ako je izdanje već na produkciji, a oznaka nedostaje: stvori je ručno na commitu tog izdanja (runbook, tablica „Što ako”).
```

Format `izdanja.json` smije se mijenjati samo tako da skripta i dalje čita starije datoteke: pri rollbacku se podaci čitaju sa starog commita, a skripta s `main`.

#### `skripte/izdanja/biljeske-izdanja.sh`

```text
biljeske-izdanja.sh --izdanja <putanja.json> --oznaka <vYYYY.MM.DD[.N]>
```

Ispisuje Markdown tijelo GitHub Releasea. Izlaz 2 ako nijedan zapis ne odgovara oznaci.

```markdown
**Troboj i nova pravila igre**

- Troboj (3 igrača) uz postojeći Dvoboj i Četveroboj
- …

Javni zapis: https://kaladont.hr/novosti#izdanje-2026-11-23
```

#### Testovi skripti: `skripte/testovi/izdanja/pokreni.sh`

Slijedi obrazac iz `skripte/testovi/backup/pokreni.sh`: `bash -n` za sve skripte, zatim slučajevi nad privremenim datotekama. Obavezni slučajevi:

1. Nema datoteke → `tiho`.
2. Samo nacrti → `tiho`, a `nacrta` odgovara broju nacrta.
3. Najnoviji zapis ima tag → `tiho`.
4. Novi zapis s današnjim datumom → `izdanje`, točni `oznaka`, `sidro`, `datum` i `naslov_releasea`.
5. Novi zapis s jučerašnjim datumom → izlaz 3.
6. Novi zapis s budućim datumom → izlaz 3.
7. Novi današnji zapis, a starijem nedostaje tag → izlaz 3.
8. Dva izdanja isti dan: `nastavak: 1` daje `v2026.11.23.1`, `izdanje-2026-11-23-1` i naslov s dodatkom ` (2)` te je noviji od zapisa bez nastavka.
9. Datum u naslovu nema vodeće nule: `2026-12-05` → `Kaladont | 5. 12. 2026.`.
10. Neispravan JSON ili neispravan datum → izlaz 2.
11. `--samo-izvjestaj` nikad ne vraća 3; umjesto toga popuni `upozorenje`.
12. Tiho ažuriranje uz postojeći nacrt → `nacrta=1`.
13. Bez `--oznake` skripta se ponaša kao da tagova nema.
14. Oznake se uspoređuju kao cijeli redak: uz postojeći `v2026.11.23.1`, zapis `2026-11-23` bez nastavka i dalje nema oznaku.
15. Bilješke: točan naslov, sve stavke i poveznica; nepoznata oznaka → izlaz 2.

Nove `.sh` datoteke moraju u indeksu imati LF završetke; provjeri s `git ls-files --eol`. `.gitattributes` ih drži na LF i u radnom stablu na Windowsu (`skripte/izdanja/**` i `skripte/testovi/izdanja/**`), da rade i u Git Bashu. Workflowi ih pozivaju kao `bash skripte/izdanja/…` i ne oslanjaju se na izvršni bit, jer se razvija na Windowsu.

### 8.6 Workflow `promoviraj-produkciju.yml`

Postojeći koraci i njihov redoslijed ostaju. Ulaz ostaje samo `digest`; nema novih polja u formi.

**U jobu `promocija`**, nakon koraka „Preuzeti repozitorij na commit slike”, a prije koraka „Pripremiti SSH vjerodajnice”:

1. Novi korak preuzima `skripte/izdanja` s grane workflowa (`ref: ${{ github.sha }}`) u mapu `_workflow`, kao sparse checkout. Razlog: skripte moraju biti aktualne i kad se promovira stara slika, dok se podaci čitaju s commita slike. Ovaj checkout mora doći nakon checkouta commita slike, jer bi ga taj inače obrisao.
2. Novi korak `vrsta_objave`:
   - dohvati postojeće tagove u datoteku, uz `GH_TOKEN` kao u postojećem koraku staging gatea: `gh api --paginate "/repos/${GITHUB_REPOSITORY}/git/matching-refs/tags/v" --jq '.[].ref | ltrimstr("refs/tags/")'`;
   - pokrene `bash _workflow/skripte/izdanja/odredi-izdanje.sh --izdanja aplikacije/web/src/lib/izdanja.json --oznake <datoteka>`;
   - izlaz doda u `$GITHUB_OUTPUT`;
   - u `$GITHUB_STEP_SUMMARY` upiše ili „Vrsta objave: IZDANJE v2026.11.23” ili „Vrsta objave: tiho ažuriranje”;
   - ako je objava tiha, a `nacrta` je veći od 0, u sažetak doda upozorenje: „Postoji nacrt izdanja. Ova objava ga ne objavljuje u Novostima; ako slika već sadrži te promjene, izlaze bez najave.”;
   - pri izlazu različitom od 0 korak pada, a poruka skripte ulazi u sažetak. Dohvat tagova koji ne uspije također ruši korak.
3. Job dobiva `outputs`: `vrsta`, `oznaka`, `sidro`, `naslov_releasea` i `verzija`.

Budući da je korak prije SSH pripreme, blokirana promocija ne dira produkciju i ne pokreće backup.

**Novi job `izdanje`:**

```yaml
  izdanje:
    name: Objaviti CalVer oznaku i GitHub Release
    needs: promocija
    if: ${{ needs.promocija.result == 'success' && needs.promocija.outputs.vrsta == 'izdanje' }}
    runs-on: ubuntu-24.04
    permissions:
      contents: write
```

Koraci:

1. Checkout commita slike (`needs.promocija.outputs.verzija`), zatim sparse checkout skripti u `_workflow`.
2. Potvrda da produkcija prikazuje izdanje, uz nekoliko ponovnih pokušaja:
   - `https://kaladont.hr/novosti` sadrži `id="<sidro>"`;
   - `https://kaladont.hr/` sadrži `datetime="<datum>"` i „Vidi što je novo”.
3. Ako Release s tom oznakom već postoji, job završava uspješno bez izmjena.
4. Ako tag postoji bez Releasea, mora pokazivati na commit slike; inače job pada s jasnom porukom.
5. Generira bilješke i stvara Release:

   ```bash
   bash _workflow/skripte/izdanja/biljeske-izdanja.sh \
     --izdanja aplikacije/web/src/lib/izdanja.json --oznaka "$OZNAKA" > "$RUNNER_TEMP/biljeske.md"
   gh release create "$OZNAKA" --repo "$GITHUB_REPOSITORY" --target "$VERZIJA" \
     --title "$NASLOV_RELEASEA" --notes-file "$RUNNER_TEMP/biljeske.md" --latest
   ```

   `--target` s punim commit SHA-om stvara tag točno na commitu slike.

   Ako naredba ne uspije, job u sažetak upisuje postupak oporavka: prvo „Re-run failed jobs”, a ako opet padne, ručno stvaranje oznake naredbom `gh api -X POST repos/<repo>/git/refs -f ref=refs/tags/<oznaka> -f sha=<commit>`, nakon koje ponovljeni job sam stvara Release.

Napomene:

- **Dozvola za workflowe.** Ugrađeni `GITHUB_TOKEN` ne može dobiti dozvolu za workflowe. GitHub zato odbija (HTTP 403 ili 404) stvaranje oznake na commitu čije workflow datoteke ne postoje, s istim sadržajem, ni na jednoj grani. To se može dogoditi kad su workflowi na `main` izmijenjeni nakon promoviranog commita. Isto vrijedi za osobni token bez opsega `workflow` (`gh auth refresh -h github.com -s workflow`). Job prihvaća ručno stvorenu oznaku ako pokazuje na promovirani commit.
- Job `izdanje` nema `environment` i ne koristi produkcijske tajne; dovoljan mu je `GITHUB_TOKEN` (kao `GH_TOKEN`).
- Dozvola `contents: write` vrijedi samo u tom jobu. Job `promocija` ostaje na dozvolama na razini workflowa.
- Job se ne pokreće ako `promocija` padne. Pad joba `izdanje` ne vraća deploy: produkcija je tada već ažurirana, a oporavak opisuje poglavlje 12.
- Vrijednosti prosljeđuj u `run:` blokove kroz `env:`, kao u postojećim koracima; bez interpolacije `${{ … }}` unutar skripte.
- HTTP odgovor spremi u datoteku pa ga pretraži. Ne koristi `curl … | grep -q`: uz `shell: bash` Actions uključuje `pipefail`, pa rani izlazak `grep`-a može srušiti korak. Isti je problem workflow već imao u staging gateu.
- Akcije pinaj na isti SHA koji datoteka već koristi za `actions/checkout`.
- CI validira workflowe alatom `actionlint`; izmjene moraju proći.

### 8.7 Workflow `objavi-staging.yml`

U jobu `objava`, nakon checkouta, dodaj informativni korak „Najaviti vrstu sljedeće produkcijske promocije”:

- dohvati tagove kao u 8.6 i pokrene `bash skripte/izdanja/odredi-izdanje.sh --samo-izvjestaj` nad `izdanja.json` s istog commita;
- u sažetak upiše što bi se dogodilo pri promociji ovog digesta, npr. „Sljedeća promocija: IZDANJE v2026.11.23” ili „Sljedeća promocija: tiho ažuriranje”;
- doda upozorenje ako bi promocija danas bila blokirana, te upozorenje o nacrtu iz 8.6 ako je objava tiha, a `nacrta` je veći od 0;
- **nikad ne ruši job**: sve greške hvata i završava s izlazom 0, a korak dodatno ima `continue-on-error: true`. Ako skripta na tom commitu ne postoji, korak se preskače.

Ostatak staging workflowa se ne mijenja.

Sažetak staging runa već sadrži digest koji vlasnik kopira za promociju, pa upozorenje vidi prije nego što išta pokrene.

Očekivano ponašanje neposredno nakon spajanja PR-a, a prije faze D: sažetak upozorava da izdanje `2026-11-14` nema oznaku. To je ispravno i nestaje kad se u fazi D stvori `v2026.11.14`. Od tada do dana izdanja sažetak najavljuje tiho ažuriranje uz upozorenje o nacrtu paketa Troboj.

### 8.8 CI: `ci.yml`

1. Job `kod`: uz korak „Provjeriti backup skripte” dodaj „Provjeriti skripte izdanja” koji pokreće `bash skripte/testovi/izdanja/pokreni.sh`.
2. Job `slika`: nakon koraka „Provjeriti health endpoint CI imagea” dodaj korak koji dokazuje da skripta i izgrađena slika vide isto izdanje:
   - `odredi-izdanje.sh --samo-izvjestaj` daje `sidro` i `datum` najnovijeg datiranog zapisa;
   - `http://127.0.0.1:3000/novosti` mora sadržavati `id="<sidro>"` i `datetime="<datum>"`;
   - `http://127.0.0.1:3000/` mora sadržavati `datetime="<datum>"` i „Vidi što je novo”;
   - odgovore spremi u datoteke pa ih pretraži (vidi napomenu o `pipefail` u 8.6);
   - ako nema datiranih zapisa, korak se preskače.

   To je ista provjera koju job `izdanje` radi nad produkcijom, pa se neslaganje između TypeScripta i basha otkriva u PR-u, a ne na dan izdanja.
3. Jedinični testovi weba ulaze u CI sami, kroz postojeći `pnpm test` (vidi 8.9).

`izdanja.json` je unutar `aplikacije/web/`, pa izmjena datuma nije „docs-only” i ispravno pokreće puni CI i novu sliku.

### 8.9 Testovi

**Ključno pravilo:** nijedan test ne smije tvrdo kodirati datum ni naslov stvarnog izdanja. PR na dan izdanja mijenja jedan redak u `izdanja.json` i CI mora ostati zelen bez ikakve izmjene testova.

#### Jedinični testovi weba (novo)

- U `aplikacije/web/package.json` dodaj `vitest` (ista glavna verzija kao u `paketi/zajednicko`) i skriptu `"test": "svelte-kit sync && vitest run"`. `svelte-kit sync` je potreban jer `tsconfig.json` nasljeđuje generiranu konfiguraciju, a u CI-ju se testovi pokreću prije `check` koraka.
- Ograniči Vitest na `src/**/*.test.ts`.
- Ažuriraj `pnpm-lock.yaml` naredbom `pnpm install` u čistom worktreeu.

`aplikacije/web/src/lib/izdanja.test.ts`, nad sintetičkim podacima:

1. `formatirajDatumHr`: `2026-11-23` → `23. 11. 2026.`, `2026-12-05` → `5. 12. 2026.`, `2027-01-12` → `12. 1. 2027.`.
2. Nacrti se izbacuju.
3. Sortiranje je silazno po datumu, zatim po nastavku.
4. Dva izdanja isti dan imaju jedinstvene `id`, `sidro` i `oznaka`; zapis s `nastavak: 1` je ispred zapisa bez njega.
5. Svaka povreda validacije iz 8.2 baca grešku.
6. `urlIzdanja` vraća `/novosti#<sidro>`.

Nad stvarnim podacima: `IZDANJA` nije prazno, `NAJNOVIJE_IZDANJE` je prvi element, sva sidra su jedinstvena i nijedan element nije nacrt.

#### Playwright: `e2e/naslovnica.spec.ts`

Zamijeni test „PR15: /novosti je javna stranica izdanja 0.2.0 i 0.1.0”. Očekivanja izvedi iz `izdanja.json`, pročitanog preko `fs.readFileSync` i `JSON.parse`. Ne uvozi JSON ni `izdanja.ts` izravno u spec, jer Playwrightov loader u ESM načinu to ne jamči. Očekivana sidra i hrvatske datume izračunaj malim pomoćnikom u `e2e/pomocnici/`; tako test ima neovisan izračun i ne ponavlja eventualnu grešku modula.

Stranica Novosti:

1. `/novosti` vraća 200, bez preusmjeravanja, s `meta robots` vrijednošću `index, follow`; `sitemap.xml` sadrži `/novosti`.
2. Redoslijed `article.objava` po `id`-u jednak je očekivanom silaznom redoslijedu.
3. Svaki zapis ima `<time>` s ispravnim ISO `datetime` i hrvatskim tekstom datuma.
4. Naslov nacrta se ne pojavljuje na stranici.
5. HTML ne sadrži `Kaladont 0.1.0`, `Kaladont 0.2.0`, `v0-1-0`, `v0-2-0`, `closed-alpha` ni CalVer oznake.

Naslovnica:

6. Tekst bloka je `Zadnje ažuriranje: <datumHr> · Vidi što je novo`, a datum odgovara najnovijem objavljenom zapisu.
7. „Zadnje ažuriranje:” nije unutar poveznice.
8. Klik na „Vidi što je novo” vodi na `/novosti`; datum nije poveznica.
9. „Vidi što je novo” vodi na `/novosti`.
10. Blok postoji u SSR HTML-u dobivenom preko `request.get('/')`.
11. Na zaslonima 320×568, 380×760, 390×844, 1100×700, 1440×900 i 1366×500 nema vodoravnog overflowa, blok je iznad footera i ne preklapa glavnu navigaciju, kontrole pristupačnosti ni ilustraciju. Od 1000 px naviše blok ne povećava visinu stranice.
12. Isto vrijedi u tamnoj temi te u svijetloj temi s fontom za disleksiju (tema ne mijenja raspored, pa se svijetla provjerava zajedno s fontom). Postavke se uključuju preko `localStorage` ključeva `kaladont_tema_v1` i `kaladont_font_postavke_v1`, po uzoru na `e2e/mobilni-tok.spec.ts`.
13. Svi postojeći testovi naslovnice i footera i dalje prolaze.

Provjeru teksta `v0.3.0-closed-alpha.1` u postojećem testu zamijeni općom provjerom da naslovnica ne prikazuje nikakvu oznaku verzije.

### 8.10 Dokumentacija

Izmijeniti:

- **`docs/03-arhitektura/odluke/018-calver-izdanja-i-tiha-azuriranja.md`** (novi ADR). Kontekst, odluka (objava ≠ izdanje, CalVer, datum u repou uz čuvara, automatski tag i Release, bez hitne grane), odbačene alternative (SemVer, datum zapisan pri deployu, svaka objava kao izdanje, hitna grana) i posljedice. Prati oblik postojećih ADR-ova.
- **`docs/03-arhitektura/odluke/README.md`**. Dodati ADR-018 u popis.
- **`docs/07-operacije/release-shema.md`**. Ukloniti SemVer i closed-alpha odlomak. U tablici identiteta zamijeniti „Verzija za ljude” retkom „Oznaka izdanja” (CalVer; samo za javna izdanja; ne koristi se za deploy, migracije ni rollback). Dodati poglavlja „Objava i izdanje”, „Postupak izdanja”, „Tiho ažuriranje”, „Rollback i izdanja” i „Više izdanja istoga dana”. Ispraviti zastarjelu napomenu o stanju automatike.
- **`docs/07-operacije/ci-cd.md`**. Ukloniti rečenicu da se SemVer ne uvodi. Opisati nove korake produkcijskog workflowa, job `izdanje` i njegovu dozvolu, informativni korak staginga, testove skripti i ugovornu provjeru u jobu `slika`.
- **`docs/07-operacije/runbook-objava-i-rollback.md`**. U „Redovnu objavu” dodati granu za izdanje. Poglavlje o hotfixu proširiti u „Tiho ažuriranje i hitni popravak”, uključujući ograničenje da produkcija dobiva samo ono što je na `main`. U „Rollback” dodati ponašanje Novosti i tagova. Ovamo premjestiti napomenu o rollbacku paketa Troboj iz `release-notes-v0.2.0.md`. Dodati tablicu „Što ako” iz poglavlja 12, s potpunim naredbama.
- **`docs/07-operacije/produkcija-i-objava.md`**. Uskladiti odlomak „Objava nove verzije” i ispraviti tvrdnju da produkcijska promocija nije potvrđena kao automatizirana.
- **`docs/07-operacije/odrzavanje.md`**. U uvod evidencije dodati da se uz izdanje bilježi i CalVer oznaka.
- **`docs/05-ux-ui/ekrani.md`**. Opis naslovnice: novi blok. Opis `/novosti`: datumi i sidra `izdanje-YYYY-MM-DD` umjesto `0.1.0` i `0.2.0`.
- **`docs/06-razvoj/testiranje.md`**. Ispraviti rečenicu o `/novosti#v0-2-0`; spomenuti jedinične testove weba i testove skripti izdanja. Izmjena neka bude minimalna: istu je datoteku 17. 11. 2026. mijenjao i PR #93, pa veće preslagivanje izaziva konflikte.
- **`docs/README.md`**. Ukloniti šest redaka o `release-notes-*.md`.
- **`.github/copilot-instructions.md`**. Dodati pravila: izdanja opisuje `aplikacije/web/src/lib/izdanja.json`; `objavljeno` ostaje `null` do dana produkcijske objave; datum se ne upisuje bez izričitog zahtjeva vlasnika; javno sučelje ne prikazuje oznake verzija.
- **`README.md` u korijenu**. Provjeriti reference; 17. 11. 2026. ih nije bilo.

Obrisati:

- `docs/07-operacije/release-notes-v0.1.0.md`
- `docs/07-operacije/release-notes-v0.2.0.md`
- `docs/07-operacije/release-notes-v0.2.0-closed-alpha.1.md`
- `docs/07-operacije/release-notes-v0.3.0-closed-alpha.1.md`
- `docs/07-operacije/release-notes-v0.4.0-closed-alpha.1.md`
- `docs/07-operacije/release-notes-v0.5.0-closed-alpha.1.md`

Nakon izmjena pretraži cijeli repozitorij (bez `node_modules`) za `closed-alpha`, `SemVer`, `release-notes-v`, `v0-1-0`, `v0-2-0`, `Kaladont 0.` i ukloni preostale reference. Iznimke su negativne provjere u testovima, ADR-018 i ovaj dokument, koji te oznake spominju kao povijest.

## 9. Faza C — verifikacija

1. Lokalno, u worktreeu: `pnpm lint`, `pnpm test`, `pnpm --filter web check`, `pnpm build`, `pnpm test:e2e`.
2. Testovi skripti izdanja traže `bash` i `jq`. Ako ih na Windowsu nema, mjerodavan je CI.
3. Pregledaj cijeli diff. Provjeri da PR ne sadrži nepovezane datoteke.
4. Otvori jedan PR prema `main` i dočekaj zeleni CI, uključujući `actionlint`, testove skripti i ugovornu provjeru u jobu `slika`.
5. U opis PR-a upiši: sažetak, odstupanja pronađena u stavkama prvog izdanja i podsjetnik da faza D mora prethoditi prvoj promociji.
6. PR spaja vlasnik. Nakon toga staging se ažurira automatski i prikazuje „Zadnje ažuriranje: 14. 11. 2026.” te Novosti s jednim zapisom.

**Upozorenje za vlasnika.** Nakon spajanja `main` ne ide na produkciju prije faza D i E:

- prije faze D čuvar datuma blokira svaku promociju, jer izdanje `2026-11-14` još nema oznaku;
- nakon faze D, a prije upisa datuma u fazi E, promocija bi prošla kao tiho ažuriranje i paket Troboj bi izašao bez unosa u Novostima. Na to upozorava sažetak staging runa (upozorenje o nacrtu).

## 10. Faza D — čišćenje GitHuba i prvo izdanje

Izvodi se nakon spajanja PR-a, a prije prve produkcijske promocije. Traži izričitu potvrdu vlasnika.

1. Potvrdi da je produkcija i dalje na commitu `6d17dacb…` i digestu iz poglavlja 4. Ako nije, stani i prijavi.
2. Ispiši svježu inventuru i usporedi je s poglavljem 4:

   ```bash
   gh release list --repo josipmestrovic/kaladont --limit 100
   git ls-remote --tags origin
   ```

3. Obriši stare Releaseove zajedno s tagovima:

   ```bash
   gh release delete v0.1.0-closed-alpha.1 --repo josipmestrovic/kaladont --cleanup-tag --yes
   gh release delete v0.2.0-closed-alpha.1 --repo josipmestrovic/kaladont --cleanup-tag --yes
   gh release delete v0.3.0-closed-alpha.1 --repo josipmestrovic/kaladont --cleanup-tag --yes
   ```

4. Stvori prvo CalVer izdanje na produkcijskom commitu, s bilješkama iz spojenog `izdanja.json`. Naredbe pokreni u Git Bashu, a ne u PowerShellu: ondje preusmjeravanje `>` zapisuje UTF-16, pa bi dijakritici u bilješkama bili pokvareni.

   ```bash
   bash skripte/izdanja/biljeske-izdanja.sh --izdanja aplikacije/web/src/lib/izdanja.json --oznaka v2026.11.14 > biljeske.md
   gh release create v2026.11.14 --repo josipmestrovic/kaladont \
     --target 6d17dacb29ede44b532c61accebb3fbcc863b772 \
     --title "Kaladont | 14. 11. 2026." --notes-file biljeske.md --latest
   ```

   Ako lokalno nema `jq` (`winget install jqlang.jq`), bilješke sastavi ručno u istom obliku. Privremenu datoteku `biljeske.md` ne commitaj.

   Ako `gh release create` vrati HTTP 404 uz napomenu o opsegu `workflow`, pokreni `gh auth refresh -h github.com -s workflow` i ponovi. Opseg je potreban kad se workflow datoteke na ciljanom commitu razlikuju od onih na granama (vidi napomenu u 8.6); token vlasnika ga 17. 11. 2026. nije imao.

   Poveznica „Javni zapis” u tim bilješkama vodit će na preusmjeravanje sve dok prva slika s ovim sustavom ne dođe na produkciju. To je očekivano.

5. Provjeri: `git ls-remote --tags origin` pokazuje samo `v2026.11.14` na `6d17dacb…`, a na stranici Releases je jedan Release označen kao najnoviji.
6. Očisti stare tagove iz lokalnih klonova, da ih kasniji `git push --tags` ne vrati na GitHub:

   ```bash
   git fetch origin --prune --prune-tags
   ```

   Naredba briše sve lokalne tagove kojih nema na GitHubu. Worktree dijeli tagove s glavnim klonom, pa je dovoljno pokrenuti je jednom. Ako vlasnik ima i druge klonove, neka je pokrene i ondje.

7. Provjeri najavu lokalno, bez novog staging deploya:

   ```bash
   git ls-remote --tags --refs origin | sed 's#.*refs/tags/##' > oznake.txt
   bash skripte/izdanja/odredi-izdanje.sh --izdanja aplikacije/web/src/lib/izdanja.json --oznake oznake.txt --samo-izvjestaj
   ```

   Očekivano: `vrsta=tiho`, `nacrta=1` i prazno `upozorenje`. Ako lokalno nema `bash` i `jq`, isto će pokazati sažetak sljedećeg staging runa. Privremenu datoteku `oznake.txt` ne commitaj.

Ne brisati: commit povijest, grane, GHCR slike i digeste, sigurnosne kopije ni operativnu evidenciju.

Vraćanje obrisanog taga, ako ikad zatreba (zatim `git push origin <oznaka>`):

```bash
git tag v0.1.0-closed-alpha.1 7f8c5061ee5b29f28769be037583f51985864e5b
git tag v0.2.0-closed-alpha.1 988b4433daa1941598a767820f1eddc35a32f2f9
git tag v0.3.0-closed-alpha.1 ed143500d2015b031865e9a2b7a712a8f1acd87a
```

## 11. Faza E — dan izdanja paketa Troboj

Izvodi vlasnik; agent priprema PR na zahtjev. Produkcijske korake paketa koji nisu vezani uz ovaj sustav (npr. backfill iz `docs/07-operacije/odrzavanje.md`) ovaj dokument ne mijenja.

1. Paket je prošao staging checklistu iz release sheme.
2. Usporedi stavke nacrta sa stvarnim završnim diffom i po potrebi ih ispravi.
3. PR „Objaviti izdanje”: u `izdanja.json` zamijeni `"objavljeno": null` datumom objave. Ništa drugo. Datum je današnji; ako PR spajaš dan ranije, upiši sutrašnji (čuvar tada blokira promociju do tog dana).
4. Nakon spajanja pričekaj CI, GHCR i staging. Sažetak staging runa mora reći „Sljedeća promocija: IZDANJE vYYYY.MM.DD”.
5. Na stagingu provjeri naslovnicu i `/novosti`.
6. Pokreni „Promoviraj produkciju” s digestom iz staging sažetka, **na dan upisan u `izdanja.json`**.
7. Po završetku provjeri: job „Objaviti CalVer oznaku i GitHub Release” je zelen, novi Release postoji i pokazuje na promovirani commit, naslovnica i `/novosti` na produkciji prikazuju novo izdanje.
8. Upiši objavu u evidenciju u `odrzavanje.md`, uključujući oznaku izdanja.

## 12. Svakodnevni rad nakon uvođenja

**Tiho ažuriranje (brzi popravak).** PR → `main` → CI → staging → „Promoviraj produkciju”. U `izdanja.json` se ništa ne dodaje. Nema taga, nema unosa u Novostima i datum na naslovnici ostaje isti. Staging gate i backup gate se ne preskaču, a objava se upisuje u evidenciju u `odrzavanje.md` kao i dosad.

**Izdanje.** Dok se značajke razvijaju, zapis je nacrt (`objavljeno: null`). Na dan objave slijedi postupak iz poglavlja 11.

**Spominjanje popravka igračima.** Dopiši stavku u postojeći zapis. Datum se ne mijenja; GitHub Release po potrebi uredi ručno.

Što ako (potpune naredbe su u [runbooku](07-operacije/runbook-objava-i-rollback.md#što-ako)):

| Situacija | Što učiniti |
| --- | --- |
| Objava sklizne na sutra | Novi PR s novim datumom, pričekati CI i staging, promovirati. |
| Workflow blokira promociju zbog datuma | Datum u slici nije današnji. Upisati današnji datum ili vratiti `null` za tiho ažuriranje. |
| Datum je upisan, ali izdanje se odgađa na neodređeno | Vratiti `objavljeno` na `null`, da tiha ažuriranja opet prolaze. |
| Sažetak staginga upozorava na nacrt | Ako slika već sadrži promjene iz nacrta, prvo upisati datum pa objaviti kao izdanje. Ako ih ne sadrži, upozorenje se može zanemariti. |
| Promocija je uspjela, a job `izdanje` je pao | Otvoriti run i odabrati „Re-run failed jobs”; ponavlja se samo job `izdanje`. Ne koristiti „Re-run all jobs”, jer ponavlja i deploy. Ako ni to ne uspije, ručno stvoriti oznaku naredbom iz sažetka joba pa ponoviti job; on tada sam stvara Release. |
| Čuvar blokira objavu koju svjesno želiš provesti, npr. rollback na izdanje čiji je tag obrisan ili nije ni nastao | Ručno stvoriti oznaku na commitu tog izdanja (`gh api -X POST repos/josipmestrovic/kaladont/git/refs -f ref=refs/tags/<oznaka> -f sha=<sha>`). Postojeća oznaka znači „već objavljeno”, pa objava prolazi kao tiha. |
| Rollback izdanja | Promovirati prethodni digest. Novosti se vraćaju same, jer su u slici. Tag i Release ostaju. Ponovna objava ispravljenog paketa je tiho ažuriranje s izvornim datumom. |
| Ponovna objava treba novi datum | Obrisati Release i tag (`gh release delete <oznaka> --cleanup-tag`), upisati novi datum i objaviti kao novo izdanje. Dok taga nema, čuvar blokira i rollback na sliku tog izdanja. |
| Rollback na sliku stariju od ovog sustava | Slika nema `izdanja.json`, pa je objava tiha; `/novosti` na produkciji opet preusmjerava. |
| Dva izdanja isti dan | Drugom zapisu dodati `"nastavak": 1`. |
| Tag postoji, a Release ne | „Re-run failed jobs” na runu te promocije; ako run više nije dostupan, `gh release create <oznaka> --verify-tag --title "<naslov>" --notes "<bilješke>"`. |
| Hitan popravak dok `main` nosi neobjavljen paket | Nije podržano. Popravak ide zajedno s paketom. Zato se veliki paket spaja na `main` tek kad je blizu objave. |

## 13. Kriteriji prihvaćanja

1. Naslovnica prikazuje „Zadnje ažuriranje” s hrvatskim datumom i dvjema poveznicama.
2. Datum na naslovnici uvijek odgovara najnovijem objavljenom zapisu u Novostima, jer oboje čitaju isti modul.
3. Novosti prikazuju izdanja po datumima, najnovije prvo; nacrti se ne vide.
4. U javnom sučelju nema oznaka `0.1.0`, `0.2.0`, CalVer tagova ni commit SHA-a.
5. Promocija bez novog datiranog zapisa prolazi kao tiho ažuriranje, bez taga i Releasea.
6. Promocija novog izdanja s datumom koji nije današnji pada prije SSH koraka.
7. Uspješna promocija novog izdanja stvara tag na commitu slike i GitHub Release s bilješkama iz `izdanja.json`.
8. Rollback na stariji digest, uključujući digeste bez `izdanja.json`, radi kao i dosad.
9. Sažetak staging runa najavljuje vrstu sljedeće promocije i upozorava na nacrt.
10. Na dan izdanja mijenja se jedan redak i nijedan test.
11. GitHub sadrži samo CalVer Releaseove; stari su uklonjeni, a nijedan produkcijski ni rollback identifikator nije izgubljen.
12. Lint, check, jedinični testovi, build, E2E, `actionlint` i testovi skripti prolaze.
13. Dokumentacija opisuje novi sustav bez proturječja; SemVer i closed-alpha oznake spominju se još samo kao povijest, u ADR-018 i ovom dokumentu.

## 14. Završni izvještaj

1. Sažetak promjena i popis izmijenjenih datoteka.
2. Produkcijski SHA i digest korišteni za `v2026.11.14`.
3. Uklonjeni Releaseovi i tagovi te eventualne iznimke.
4. Nove CalVer oznake.
5. Rezultati svih provjera.
6. Odstupanja pronađena u stavkama prvog izdanja i što je vlasnik odlučio.
7. Neriješeni problemi i blokirajuće nedoumice.
8. Što ostaje vlasniku: faza E i upis u evidenciju.
