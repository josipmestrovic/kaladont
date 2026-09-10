# Objava nove verzije na staging

Ovo je **glavni početnički runbook za svaku novu objavu na staging**.

Primjenjuje se na:

- `staging.kaladont.hr`;
- direktni push na `main`;
- GitHub Actions CI;
- objavu Docker slike u GHCR;
- ručnu migraciju staging baze;
- ručnu provjeru nove verzije;
- rollback staging aplikacije ako nova verzija ne radi.

Ovaj dokument **ne objavljuje produkciju**. Produkcija ne postoji u ovom postupku i ne smije se dirati.

## Najkraća verzija postupka

```text
1. Provjeriti lokalne promjene.
2. Usporediti lokalni kod i migracije s GitHubom.
3. Napraviti commit.
4. Direktno pushati commit na main.
5. Pričekati zeleni CI.
6. Pričekati GHCR objavu i zapisati puni digest.
7. Zapisati trenutni staging digest.
8. Na stagingu primijeniti migracije iz novog imagea.
9. Pokrenuti novi application container.
10. Provjeriti health, stranice i igru.
11. Zapisati rezultat ili vratiti prethodni digest.
```

`main` je u ovom projektu kontrolirana ulazna točka za staging release. Push na `main` nije obična sigurnosna kopija koda: on pokreće službeni CI i, nakon uspjeha, objavu imagea u GHCR.

## Crvene zabrane

Odmah stani ako bi sljedeći korak zahtijevao nešto od ovoga:

- diranje produkcije ili produkcijskih datoteka;
- korištenje `latest`, `main` taga ili skraćenog SHA-a umjesto punog digesta;
- brisanje PostgreSQL containera s njegovim volumeom;
- naredbu `docker compose down --volumes` na stagingu;
- build Docker slike na staging VPS-u;
- `git pull` na staging VPS-u;
- prepisivanje cijelog staging `.env` sadržajem iz repozitorija;
- ispis lozinke, API ključa, sesijske tajne ili privatnog ključa u terminal, chat ili GitHub log;
- ponovni puni uvoz hrLex rječnika ako staging već ima rječnik;
- ručno vraćanje migracije unatrag bez zasebnog odobrenog postupka.

Ako naredba ne odgovara ovom dokumentu ili ne znaš što znači rezultat, ne pokušavaj nasumične naredbe. Sačuvaj izlaz i stani.

## Pojmovnik

| Pojam | Značenje |
| --- | --- |
| `main` | Glavna Git grana iz koje se objavljuje image za staging. |
| commit | Spremljena verzija promjena u Git repozitoriju. |
| CI | GitHub Actions provjera koja pokreće lint, testove, build i Docker smoke test. |
| GHCR | GitHub Container Registry, mjesto gdje se objavljuje Docker image. |
| image | Paket aplikacije koji se pokreće na stagingu. |
| digest | Puni nepromjenjivi identitet imagea, oblika `sha256:...`. |
| migracija | SQL promjena kojom se baza usklađuje s novim kodom. |
| staging | Testno okruženje na `staging.kaladont.hr`, s vlastitom bazom i rječnikom. |
| rollback | Vraćanje aplikacije na prethodni poznato-zdravi image. |

## Gdje se što radi

| Mjesto | Što se tamo radi |
| --- | --- |
| VS Code PowerShell | pregled koda, Git provjere, commit i push |
| GitHub web | praćenje CI-ja i GHCR workflowa, kopiranje digesta |
| staging VPS preko SSH-a | provjera stacka, migracija baze i zamjena aplikacijskog containera |
| preglednik | provjera staging stranice i igra u četiri sesije |

Nikada nemoj lijepiti tajne u ovaj dokument, GitHub issue, commit, chat ili log.

## 1. Priprema prije objave

### 1.1. Odabrati termin

Deploy može prekinuti aktivne partije. Odaberi vrijeme kada nitko ne igra na stagingu. Za kratki staging deploy ne treba posebna javna najava, ali testere treba obavijestiti da će staging kratko biti nedostupan ako očekuješ prekid.

### 1.2. Potvrditi što se objavljuje

Moraš znati:

- što se promijenilo;
- koje područje treba posebno testirati;
- mijenja li se baza;
- koji je trenutni staging digest;
- kako se vratiti na prethodni digest.

U ovoj proceduri pretpostavljamo da staging bazu treba migrirati. To ne znači da treba izmišljati migraciju: migrira se samo ono što postoji u repozitoriju i što je prošlo CI.

## 2. Provjera lokalnog repozitorija

**Gdje:** VS Code PowerShell, korijen repozitorija.

### 2.1. Provjeriti radni direktorij

```powershell
git status --short
```

Očekuješ popis namjernih datoteka koje pripadaju ovoj turi. Ako vidiš nepoznatu datoteku, ne dodaj je automatski. Prvo utvrdi čemu pripada.

### 2.2. Pregledati promjene

```powershell
git diff --stat
git diff -- aplikacije/posluzitelj/src/baza/migracije
```

Za novu datoteku migracije koristi:

```powershell
Get-ChildItem aplikacije/posluzitelj/src/baza/migracije -File | Sort-Object Name
Get-Content aplikacije/posluzitelj/src/baza/migracije/0005_randomizirati_avatara.sql
```

Ako je broj migracije drugačiji, koristi stvarni naziv iz popisa. Ne prepisuj slijepo primjer `0005`.

### 2.3. Usporediti lokalni `main` s GitHubom

```powershell
git fetch origin main
git status -sb
git log --oneline --decorate -5
git log --oneline HEAD..origin/main
git log --oneline origin/main..HEAD
```

Tumačenje:

- `HEAD..origin/main` pokazuje commitove koji postoje na GitHubu, a nedostaju lokalno;
- `origin/main..HEAD` pokazuje lokalne commitove koji još nisu na GitHubu;
- ako postoje neočekivani commitovi u bilo kojem smjeru, stani prije pusha.

Ova usporedba je obavezna prije svake ture. Lokalna migracija nije dokaz da je migracija na GitHubu, a GitHub migracija nije dokaz da je primijenjena na stagingu.

### 2.4. Usporediti migracije s GitHubom

```powershell
git diff origin/main..HEAD --name-status -- aplikacije/posluzitelj/src/baza/migracije
git diff origin/main..HEAD -- aplikacije/posluzitelj/src/baza/migracije
```

Zapiši:

- koje migracije postoje lokalno, a ne postoje na GitHubu;
- koje su migracije promijenjene;
- što svaka SQL migracija radi;
- je li promjena kompatibilna s prethodnom verzijom aplikacije.

Migracija se normalno ne uređuje nakon što je već primijenjena na zajedničku bazu. Ako je migracija već na stagingu, ne mijenjaj njezin sadržaj. Napravi novu migraciju.

### 2.5. Provjeriti lokalni build i testove

Pokreni provjere koje odgovaraju promjeni. Za promjenu baze najmanje:

```powershell
pnpm --filter posluzitelj build
pnpm --filter posluzitelj test
pnpm --filter web check
pnpm build
```

Ako lokalno nema Dockera, to nije problem: Docker smoke test izvodi GitHub CI na Linux runneru. Lokalni zeleni testovi nisu zamjena za zeleni GitHub CI.

## 3. Commit i direktni push

### 3.1. Dodati samo namjerne datoteke

Primjer prilagodi stvarnim datotekama ove ture:

```powershell
git add aplikacije/posluzitelj/src/baza/migracije/0005_randomizirati_avatara.sql
git add <ostale-namjerne-datoteke>
git status --short
git diff --cached --stat
git diff --cached
```

Ako staged diff sadrži nešto što ne želiš objaviti, ne nastavljaj. Ukloni samo tu datoteku iz staged područja:

```powershell
git restore --staged <datoteka>
```

Ova naredba ne briše lokalnu datoteku. Samo je uklanja iz pripreme commita.

### 3.2. Napraviti commit

Commit poruka je na hrvatskom, s glagolom u infinitivu:

```powershell
git commit -m "Dodati migraciju za nasumične avatere"
```

Nakon commita provjeri:

```powershell
git status -sb
git show --stat --oneline HEAD
```

### 3.3. Direktno pushati na `main`

```powershell
git push origin main
```

Ovo je namjerni trenutak objave kandidata. Nakon uspješnog pusha GitHub će pokrenuti CI. Ne pokreći ručni deploy na VPS-u dok CI i GHCR koraci nisu uspješno završeni.

## 4. Pričekati GitHub Actions

**Gdje:** GitHub web, kartica `Actions`.

### 4.1. CI

Otvori CI run koji pripada upravo pushanom commit SHA-u. Očekuješ zelene korake za:

- instalaciju ovisnosti;
- migracije CI baze;
- sintetički rječnik;
- lint;
- testove;
- web provjeru;
- build;
- Docker build;
- Caddy validaciju;
- Docker health;
- simulaciju četiri igrača.

Ako CI padne:

1. ne diraj staging;
2. otvori crveni korak;
3. sačuvaj poruku greške bez tajni;
4. popravi problem lokalno;
5. napravi novi commit i ponovi postupak.

### 4.2. GHCR objava

Tek nakon zelenog CI-ja očekuješ workflow `Objaviti Docker sliku`. Zapiši:

- URL CI workflowa;
- URL GHCR workflowa;
- puni commit SHA;
- puni image digest;
- vrijeme objave.

Digest mora izgledati ovako:

```text
ghcr.io/josipmestrovic/kaladont@sha256:NEPREKINUTI_PUNI_DIGEST
```

Ne koristi:

- `latest`;
- `main`;
- samo commit SHA kao zamjenu za digest;
- skraćeni digest;
- lokalno izgrađeni image.

Ako GHCR workflow ne objavi digest ili je nejasno koji digest pripada commitu, stani. Ne pogađaj vrijednost.

## 5. Provjeriti staging prije promjene

**Gdje:** Windows PowerShell, zatim staging VPS preko SSH-a.

Stvarnu staging IP adresu i SSH podatke uzmi iz sigurnog spremišta. Ne zapisuj ih u repozitorij.

```powershell
ssh deploy@<STAGING_IPV4>
```

Na VPS-u:

```bash
cd /opt/kaladont
pwd
docker compose -f docker-compose.staging.yml ps
```

Očekuješ direktorij `/opt/kaladont` i postojeće servise `caddy`, `aplikacija` i `baza`. Ako servis nedostaje ili je u stanju `Exited`, sačuvaj izlaz i stani.

Prije izmjene zabilježi trenutni image i release varijable bez ispisivanja cijelog `.env`:

```bash
docker inspect kaladont-aplikacija-1 --format '{{.Config.Image}}'
grep -E '^(KALADONT_IMAGE|VERZIJA|DIGEST)=' /opt/kaladont/.env
```

Ako ime containera nije `kaladont-aplikacija-1`, pronađi ga ovako:

```bash
docker compose -f docker-compose.staging.yml ps -q aplikacija
```

U `.env` nemoj koristiti `cat`, `less` ili naredbu koja bi ispisala tajne u terminal. Prije deploya zapiši prethodni puni digest u privatnu evidenciju. On je rollback vrijednost.

Provjeri disk:

```bash
df -h /
docker system df
```

Ako je disk gotovo pun ili nema dovoljno prostora za novi image i migraciju, stani. Nemoj naslijepo pokretati `docker system prune`.

## 6. Ažurirati image za staging

### 6.1. Promijeniti samo release varijable

Otvori `.env` lokalnim editorom na VPS-u ili koristi postojeći siguran postupak koji već primjenjuješ. Promijeni samo:

```dotenv
KALADONT_IMAGE=ghcr.io/josipmestrovic/kaladont@sha256:...
VERZIJA=<puni-commit-sha-ili-dogovorena-verzija>
DIGEST=sha256:...
```

Ne mijenjaj:

- `BAZA_LOZINKA`;
- `SESIJA_TAJNA`;
- `EMAIL_API_KLJUC`;
- `ADMIN_TAJNI_KLJUC`;
- `STAGING_EMAIL_ALLOWLIST`;
- domenu;
- Docker volumee;
- PostgreSQL postavke.

Ako aplikacija koristi privatni GHCR, image mora biti povučen postojećim sigurnim postupkom za prijavu u GHCR. Ne spremaj trajni token na VPS i ne stavljaj token u argument naredbe.

### 6.2. Validirati Compose

```bash
cd /opt/kaladont
docker compose -f docker-compose.staging.yml config --quiet
```

Ako naredba ispiše grešku ili nedostaje obavezna varijabla, stani i ne pokreći migraciju.

### 6.3. Povlačiti točan image

```bash
docker compose -f docker-compose.staging.yml pull aplikacija
```

Očekuješ da se povuče image iz novog punog digesta. Ako pull ne uspije, ne pokreći `up` i ne mijenjaj bazu.

## 7. Migrirati staging bazu

Staging baza se u ovoj proceduri uvijek tretira kao baza koju treba migrirati. Drizzle će primijeniti samo migracije koje još nisu zapisane kao primijenjene.

Prvo provjeri da je baza pokrenuta i zdrava:

```bash
docker compose -f docker-compose.staging.yml ps baza
```

Očekuješ stanje `Up` i health `healthy`. Ako baza nije zdrava, stani.

Pokreni migraciju iz novog application imagea:

```bash
docker compose -f docker-compose.staging.yml run --rm --no-deps aplikacija pnpm migracije
```

Što naredba radi:

- stvara privremeni kontejner iz novog imagea;
- koristi postojeću staging `.env` konfiguraciju;
- spaja se na postojeći servis `baza`;
- Drizzle provjerava migracijsku evidenciju;
- primjenjuje samo neprimijenjene SQL migracije;
- privremeni kontejner se briše nakon završetka.

`--no-deps` ovdje znači da Compose neće pokušati ponovno stvarati ovisne servise. Zato `baza` mora već biti pokrenuta i zdrava.

Očekivani rezultat je uspješan izlazni kod. Ako migracija padne:

1. ne pokreći novi application container;
2. ne briši bazu ni volume;
3. spremi poruku greške bez tajni;
4. utvrdi je li migracija djelomično primijenjena;
5. ne pokreći istu migraciju naslijepo više puta;
6. zaustavi se i prijeđi na incidentni postupak.

Migracije se ne vraćaju ručnim obrnutim SQL-om. Aplikacijski rollback moguć je samo ako je nova shema kompatibilna sa starom aplikacijom.

## 8. Pokrenuti novu aplikaciju

Nakon uspješne migracije rekreiraj samo aplikacijski servis:

```bash
docker compose -f docker-compose.staging.yml up -d --no-deps aplikacija
```

Ova naredba ne smije brisati PostgreSQL volume i ne treba rekreirati Caddy ako se Caddy konfiguracija nije mijenjala.

Provjeri stanje:

```bash
docker compose -f docker-compose.staging.yml ps
```

Aplikacija mora biti `Up` i nakon kratkog vremena `healthy`. Pregledaj zadnje logove:

```bash
docker compose -f docker-compose.staging.yml logs --since 10m --tail 200 aplikacija
```

Ne kopiraj cijele logove u javne kanale. Provjeri postoje li novi `error` zapisi, greške pri učitavanju baze ili greške pri učitavanju rječnika.

## 9. Provjeriti staging izvana

**Gdje:** Windows PowerShell.

```powershell
$zdravlje = Invoke-RestMethod https://staging.kaladont.hr/zdravlje
$zdravlje | ConvertTo-Json -Depth 5
```

Očekuješ:

- HTTP status 200;
- `ok` jednako `true`;
- dostupnu bazu;
- `brojRijeci` veći od nule;
- novu verziju ili commit identitet;
- novi puni digest.

Ako endpoint vrati 503, `brojRijeci` je nula ili digest nije očekivan, stani i ne dijeli staging link.

Provjeri naslovnicu i noindex zaglavlje:

```powershell
$odgovor = Invoke-WebRequest https://staging.kaladont.hr/ -UseBasicParsing
$odgovor.StatusCode
$odgovor.Headers['X-Robots-Tag']
```

Očekuješ `200` i `X-Robots-Tag` vrijednost `noindex, nofollow`.

## 10. Ručno testirati igru

Otvori četiri odvojene pregledničke sesije. To mogu biti četiri prozora, privatni prozori ili zasebni profili, ali svaka sesija mora imati odvojenog igrača.

Obavezno provjeri:

- učitavanje naslovnice;
- prijavu ili registraciju ako je promjena relevantna;
- spajanje u red;
- ulazak četiri igrača u istu partiju;
- Socket.IO vezu;
- prihvaćen potez;
- odbijenu riječ;
- potez „Ne znam";
- timer i istek vremena;
- eliminaciju;
- reakcije;
- povijest poteza;
- bodove i konačne rezultate;
- povratak na novu igru.

Dodatno provjeri područje koje se mijenjalo. Za promjenu avatara provjeri postojeće korisnike, prikaz avatara u zaglavlju i partiji, spremanje postavke te nasumičnu dodjelu iz migracije `0005`.

Ako bilo koja obavezna provjera padne, release je `odbačeno`. Ne šalji testerima poruku da će se kvar popraviti kasnije.

## 11. Završiti i evidentirati release

U privatnu operativnu evidenciju zapiši:

- UTC vrijeme;
- status `staging-provjereno` ili `odbačeno`;
- puni digest;
- puni commit SHA;
- URL CI workflowa;
- URL GHCR workflowa;
- prethodni staging digest;
- kratak opis promjene;
- migraciju koja je primijenjena;
- ručne provjere koje su prošle;
- eventualne napomene ili ograničenja.

Staging link dijeli se testerima tek kada su health i obavezne ručne provjere prošle.

## 12. Rollback staging aplikacije

Rollback se koristi kada je problem u novom application imageu, a baza i migracije nisu oštećene.

Prvo sačuvaj:

- novi digest;
- prethodni digest;
- health odgovor;
- vrijeme problema;
- relevantne aplikacijske logove;
- rezultat zadnje migracije.

Vrati prethodni puni digest u `/opt/kaladont/.env`, zatim pokreni:

```bash
cd /opt/kaladont
docker compose -f docker-compose.staging.yml config --quiet
docker compose -f docker-compose.staging.yml pull aplikacija
docker compose -f docker-compose.staging.yml up -d --no-deps aplikacija
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --since 10m --tail 200 aplikacija
```

Nakon toga ponovno provjeri:

```powershell
Invoke-RestMethod https://staging.kaladont.hr/zdravlje
```

Rollback aplikacije ne vraća bazu. Ako je problem nastao u migraciji, ako baza nije dostupna ili ako je schema nekompatibilna, ne pokušavaj ručno poništiti SQL. Zaustavi se i koristi [incidentni postupak](incidentni-postupak.md) i [runbook backupa i vraćanja](runbook-backup-i-vracanje.md).

## 13. Česti problemi i prva reakcija

| Problem | Prva reakcija |
| --- | --- |
| CI je crven | Ne dirati staging; pročitati crveni korak i popraviti lokalno. |
| GHCR nije objavio image | Ne dirati staging; provjeriti GHCR workflow i digest. |
| `docker compose config` ne prolazi | Provjeriti samo release varijable i postojeći `.env`; ne prepisivati tajne. |
| Image se ne može povući | Provjeriti puni digest i GHCR pristup; ne koristiti tag kao zamjenu. |
| Migracija padne | Ne ponavljati naslijepo, ne brisati volume, sačuvati grešku. |
| Health vraća 503 | Provjeriti status aplikacije, baze i logove; ne uvoziti rječnik naslijepo. |
| `brojRijeci` je nula | Zaustaviti se; razlikovati prazan DB od problema učitavanja rječnika. |
| UI radi, ali partija ne radi | Provjeriti Socket.IO i aplikacijske logove; ne mijenjati Caddy i image istovremeno. |
| Disk je pun | Ne koristiti slijepi `prune`; prvo sačuvati aktivni i prethodni digest. |
| TLS ne radi | Provjeriti Caddy logove, DNS i portove 80/443; ne mijenjati aplikaciju naslijepo. |

## Završna checklista

Prije proglašenja releasea uspješnim sve mora biti označeno:

- [ ] Lokalne promjene pregledane.
- [ ] Udaljeni GitHub `main` dohvaćen i uspoređen.
- [ ] Migracije uspoređene s GitHub `main`.
- [ ] Commit sadrži samo namjerne datoteke.
- [ ] Direktni push na `main` uspješan.
- [ ] CI zelen.
- [ ] GHCR objava uspješna.
- [ ] Puni digest zapisan.
- [ ] Prethodni staging digest zapisan.
- [ ] Staging servisi provjereni prije promjene.
- [ ] Compose konfiguracija validirana.
- [ ] Image povučen po punom digestu.
- [ ] Staging baza migrirana iz novog imagea.
- [ ] Aplikacija pokrenuta bez diranja PostgreSQL volumea.
- [ ] `/zdravlje` vraća očekivani rezultat.
- [ ] Naslovnica i noindex zaglavlje provjereni.
- [ ] Četiri odvojene sesije prošle osnovnu partiju.
- [ ] Promijenjeno područje posebno testirano.
- [ ] Logovi pregledani.
- [ ] Release evidentiran kao `staging-provjereno` ili `odbačeno`.

## Povezana dokumentacija

- [Release shema](release-shema.md)
- [CI/CD](ci-cd.md)
- [Runbook objave i rollbacka](runbook-objava-i-rollback.md)
- [Incidentni postupak](incidentni-postupak.md)
- [Operacije for dummies](operacije-for-dummies.md)
- [Održavanje](odrzavanje.md)
