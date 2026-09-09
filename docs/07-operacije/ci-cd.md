# CI/CD (GitHub Actions)

> **Status: specifikacija, još nije implementirano.** Datoteke `.github/workflows/ci.yml`, `.github/workflows/objavi-staging.yml` i `.github/workflows/promoviraj-produkciju.yml`, Dockerfile, Compose/Caddy konfiguracije i sintetički fixture rječnika još ne postoje. Ovaj dokument je ugovor koji buduća implementacija mora zadovoljiti. Ne pokušavati objavu dok production-readiness lista iz [Operacije for dummies](operacije-for-dummies.md) nije zelena.

Tok objave definiran je [ADR-om 014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md):

```mermaid
flowchart LR
    A[merge u main] --> B[CI: lint + test + build]
    B --> C[Smoke test Docker slike]
    C --> D[Privatni GHCR - SHA tag + digest]
    D --> E[Auto-deploy staging]
    E --> F[Ručna provjera na stagingu]
    F --> G[Ručni produkcijski workflow]
    G --> H[Isti digest u produkciju]
```

Razvojno računalo nema virtualizaciju pa se Docker slika ne može testirati lokalno — **CI je jedino mjesto koje dokazuje da slika radi** prije staginga. Zato smoke test nije opcionalan korak nego bloker objave.

## Pravila koja vrijede za sve workflowe

- Sve third-party GitHub Actions reference pinaju se na puni commit SHA; komentar uz SHA navodi čitljivu verziju. Dependabot ih ažurira kroz Pull Request (PR).
- Svaki job dobiva samo nužne `GITHUB_TOKEN` ovlasti. Zadano je `contents: read`; samo job koji objavljuje sliku dobiva `packages: write`.
- Aplikacijska slika gradi se samo za `linux/amd64`. ARM/multi-arch nije dio početne postave.
- Staging i produkcija imaju zasebne GitHub Environmente i SSH ključeve. Produkcijski Environment nema required reviewer jer postoji jedan operater; ručni `workflow_dispatch` jest kontrolna točka.
- `concurrency` dopušta najviše jedan aktivni deploy po okruženju. Novi staging deploy ne smije se utrkivati sa starim, a produkcijski deploy nikad ne prekida drugi produkcijski deploy.
- SSH veza provjerava unaprijed spremljen host fingerprint. `StrictHostKeyChecking=no` je zabranjen.
- Nema `git pull` ni builda na VPS-u. VPS prima verzionirane konfiguracije i povlači gotovu sliku po digestu.
- Docs-only promjene (`docs/**` i Markdown datoteke koje ne utječu na build) prolaze provjeru dokumentacije, ali preskaču build slike i deploy.

## Preduvjeti implementacije

Prije uključivanja workflowa moraju postojati i biti međusobno usklađeni:

1. produkcijski Dockerfile s jednim Node procesom i OCI oznakom izvornog repozitorija;
2. `docker-compose.staging.yml` i `docker-compose.prod.yml` bez javnog aplikacijskog ili DB porta;
3. staging i produkcijski Caddyfile;
4. jednokratne naredbe u istoj aplikacijskoj slici za migracije, provjeru/uvoz rječnika i dodjelu prvog admina;
5. mali licencno čist sintetički fixture rječnika za CI;
6. prošireni `/zdravlje` koji provjerava bazu i rječnik te vraća 503 kad servis nije spreman;
7. stvarno slanje preko Resenda i fail-closed staging email allowlista;
8. verzionirane backup/restore skripte i pripadajuće systemd jedinice.

## PR i `main` provjere — ciljani `ci.yml`

Promjena se radi na radnoj grani i otvara kao Pull Request prema `main`. Iako isti operater otvara i spaja PR, on daje čitljiv diff, zapis odluke i mjesto na kojem CI zaustavlja neispravnu promjenu. Branch protection zabranjuje spajanje dok obvezne provjere nisu zelene; ljudski reviewer nije obvezan.

Workflow se okida na svaki PR i push na `main`:

1. Checkout + pnpm cache → `pnpm install --frozen-lockfile`.
2. ESLint i Prettier check, bez automatskog prepisivanja datoteka u CI-ju.
3. Vitest za sve pakete; testovi koji trebaju Postgres koriste service container s istom točnom PostgreSQL verzijom kao staging i produkcija.
4. `svelte-check` i TypeScript build svih workspace paketa.
5. Provjera relativnih Markdown poveznica za dokumentacijske promjene.

Push na `main` ponavlja iste provjere prije builda i objave slike. Nije dopušten put kojim PR testira jedno, a objava gradi drugi commit.

## Build i smoke test stvarne slike

Na `main` se slika gradi jednom. Taj lokalni image ili registry digest koristi se u svim sljedećim koracima; nakon testa nema rebuilda za staging ili produkciju.

1. Build multi-stage Dockerfilea za `linux/amd64`.
2. Podizanje izoliranog Compose stacka s točno pinanom PostgreSQL slikom.
3. Migracije jednokratnom naredbom iz aplikacijskog digesta.
4. Uvoz **malog sintetičkog testnog rječnika** iz repozitorija; pravi hrLex ne ulazi u git ni CI fixture.
5. Pokretanje aplikacije kao ne-root korisnika u kontejneru.
6. `GET /zdravlje` mora vratiti 200, dostupnu bazu, `brojRijeci > 0` i očekivanu verziju/digest.
7. Skripta `simulacija` spaja četiri Socket.IO klijenta i odigra **cijelu partiju** protiv kontejnera.
8. Gašenje stacka i volumena čak i kada prethodni korak padne.

Padne li bilo koji korak, slika se ne objavljuje i staging se ne dira. Ista provjera izvodi se na PR-u koji dira Dockerfile, Compose, Caddy, migracije, startup ili workflowe kako se kvar ne bi otkrio tek nakon mergea.

## Privatni GHCR i nepromjenjivi digest

Nakon zelenog smoke testa workflow se prijavljuje u `ghcr.io` ugrađenim `GITHUB_TOKEN`-om i ovlašću `packages: write`. Objavljuje oznaku `sha-<puni-commit>` te bilježi vraćeni `sha256:...` digest u job output i sažetak. Package ostaje privatan i povezan s repozitorijem.

Tag `latest` smije biti informativan, ali se nikad ne koristi za deploy, migraciju ni rollback. Jedina dopuštena referenca na serveru je `ghcr.io/<vlasnik>/kaladont@sha256:<digest>`.

VPS ne čuva osobni access token ni trajnu GHCR prijavu. Tijekom deploy joba kratkotrajni `GITHUB_TOKEN` šalje se udaljenom `docker login --password-stdin` procesu preko zaštićene SSH veze i koristi s privremenim `DOCKER_CONFIG` direktorijem. Token se ne stavlja u argument naredbe ni log. Nakon `docker pull`/`compose pull` workflow izvršava `docker logout` i briše privremeni direktorij čak i kada deploy padne.

## Automatski staging — ciljani `objavi-staging.yml`

Staging job smije početi samo za commit čiji su CI, smoke test i GHCR push uspjeli. Koristi GitHub Environment `staging`, zasebni SSH ključ i korisnika `deploy`; host fingerprint nalazi se u zasebnoj Environment tajni.

1. Zapiše trenutno aktivni staging digest radi dijagnostike.
2. Sigurno prenese verzionirane Compose/Caddy konfiguracije u `/opt/kaladont`; `.env` i tajne nikad se ne kopiraju iz repozitorija.
3. Validira renderirani Compose i Caddy config prije primjene.
4. Kratkotrajno se prijavi u privatni GHCR i povuče točan novi digest.
5. Jednokratnim alatom iz **novog digesta** primijeni migracije.
6. Provjeri broj riječi. Samo pri prvom praznom rječniku pokreće puni hrLex uvoz; kod svakog kasnijeg deploya uvoz se preskače.
7. Pokrene/zamijeni aplikaciju s točnim digestom.
8. Odjavi GHCR i ukloni privremene vjerodajnice.
9. Ponavlja javni `https://staging.kaladont.hr/zdravlje` do uspjeha ili zadanog kratkog roka; odgovor mora sadržavati očekivani digest.
10. Zapisuje GitHub Deployment i sažetak s digestom, URL-om i rezultatom.

Staging tijekom privremenog multiplayer testiranja nema Basic Auth kako browser ne bi izazivao ponovne promptove na Socket.IO zahtjevima. `X-Robots-Tag: noindex, nofollow` nije kontrola pristupa; prije šireg dijeljenja treba uvesti VPN, IP allowlist ili drugi gateway.

## Ručna produkcija — ciljani `promoviraj-produkciju.yml`

Workflow se pokreće isključivo ručno (`workflow_dispatch`). Ulaz je puni digest koji već ima uspješan staging Deployment zapis. Workflow odbija tag, skraćeni digest, nepoznat digest i digest koji nije prošao staging.

1. Koristi Environment `produkcija`; nema required reviewer ni dodatnog approval koraka.
2. Provjerava i zapisuje trenutno aktivni digest kao kandidat za rollback.
3. Pokreće produkcijski backup i nastavlja tek kada su `pg_dump`, `age` enkripcija, prijenos na Storage Box i verifikacija uspješni.
4. Sigurno prenosi i validira verzionirane konfiguracije.
5. Kratkotrajno se prijavljuje u GHCR i povlači **identičan staging digest**.
6. Jednokratnim alatom iz novog digesta izvršava samo unatrag kompatibilne migracije.
7. Pokreće `docker compose up -d` s novim digestom, zatim uklanja GHCR vjerodajnice.
8. Ponavlja `https://kaladont.hr/zdravlje`; odgovor mora sadržavati očekivani digest.
9. Zapisuje GitHub Deployment, prethodni i novi digest, rezultat backupa i health checka.

Workflow ne provjerava postoje li aktivne partije i može ih prekinuti. Operater ga zato pokreće u doba slabog prometa. Ako se očekuje prekid dulji od 5 minuta, održavanje se najavljuje najmanje 24 sata unaprijed.

Automatskog rollbacka nema. Ako migracija, startup ili health check padnu, workflow završava crveno i u sažetku prikazuje prethodni digest te poveznicu na [ručni rollback](runbook-objava-i-rollback.md#rollback-vraćanje-prethodne-verzije). Operater prvo sprema dokaze, zatim ručno promovira prethodni digest; cilj povrata je 15 minuta.

## Ručna provjera nakon workflowa

Automatski zeleni deploy nije dovoljan za promociju. Za svaki release kandidat operater na stagingu odigra cijelu partiju u četiri odvojene sesije i ciljano provjeri promijenjeno područje. Nakon produkcijske promocije provjerava health, ključne stranice, registraciju ako je relevantna i cijelu partiju. Produkcijska probna partija ostaje u običnoj statistici i evidentira se u [održavanju](odrzavanje.md).

## Tajne (GitHub Secrets, po Environmentu)

| Tajna                                                          | Environment  | Svrha                                                                                |
| -------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `STAGING_HOST`, `STAGING_SSH_KLJUC`, `STAGING_SSH_KNOWN_HOSTS` | `staging`    | SSH kao fiksni korisnik `deploy` uz pinani host fingerprint                          |
| `PROD_HOST`, `PROD_SSH_KLJUC`, `PROD_SSH_KNOWN_HOSTS`          | `produkcija` | SSH kao fiksni korisnik `deploy` uz pinani host fingerprint                          |
| ugrađeni `GITHUB_TOKEN`                                        | job-scoped   | Push privatne slike i kratkotrajni udaljeni pull; nikad se ne sprema kao ručna tajna |

Aplikacijske tajne (baza, email, sesije, staging allowlista, Basic Auth hash, Storage Box i Healthchecks URL) žive u VPS konfiguraciji s pravima 600, dostupnoj samo računu koji je mora čitati i rootu, te u Bitwardenu prema [sigurnosnoj matrici](sigurnost-i-privatnost.md). Ne ulaze u repozitorij ni workflow logove.

## Pravila

- Nema ručnog SSH deploya „na brzinu”; operater smije koristiti SSH za pregled i dokumentirane incidentne radnje, ne za zaobilaženje workflowa.
- Produkcija nikad ne dobiva sliku koja nije prošla staging s istim digestom.
- `latest`, branch tag i lokalni build nisu dopušteni produkcijski inputi.
- Tajne se ne ispisuju, ne spremaju u command history i ne šalju kao argument procesa.
- Neuspjeli job mora očistiti privremeni Docker config i završiti crveno; ne smije prikriti djelomično izvršenu migraciju.
- Workflow datoteke, Dockerfile, Compose, Caddy i migracije nemaju obvezan ljudski review dok postoji jedan operater. To je prihvaćen rizik, ublažen PR-om, obveznim CI-jem, stagingom i ručnom promocijom.
