# Kaladont.hr · Od finskog staginga do prve javne igre

**Operativni vodič za Joku • provjereno 3. studenoga 2026. • Windows PowerShell + Ubuntu Server 24.04 LTS**

**Produkcijski VPS još ne bih kupovao.** Prvo popravi crveni CI, osiguraj ponovljivu objavu na praznu bazu i dokaži vraćanje šifriranog staging backupa. Kad su te tri stvari zelene, kupuješ **jedan dodatni Hetzner VPS** za igru i njezinu bazu. Domenu usmjeravaš tek kad su novi server i njegova IP adresa spremni. Širu promociju pokrećeš nakon najmanje 20 dovršenih igara bez kritične greške.

Ovo je vodič za izvođenje. Pregledani su izvorni kod, GitHub Actions i dokumentacija. Stvarne postavke tvojih Hetzner, DNS, Resend, Bitwarden i monitoring računa provjeravaš u koracima ispod. Primjeri u izvornim dokumentima nisu zapis o obavljenom poslu.

**Brzi pristup** · [Blokeri](#blokeri) · [Lozinke](#lozinke) · [Storage Box](#spremiste) · [Kupnja servera](#odabir) · [SSH i Docker](#ulaz) · [Produkcijske tajne](#tajne) · [DNS](#dns) · [Backup i oporavak](#oporavak) · [Prva objava](#objava) · [Promocija](#promocija)

## Redoslijed rada

| Kada | Što radiš | Što moraš vidjeti prije nastavka |
|---|---|---|
| Danas | Koraci 1–3. Agent priprema kod, ti pripremaš pristupe i spremište za backup. | Tri zelena GitHub runa za isti commit, cijela igra na stagingu, šifrirana kopija preuzeta sa Storage Boxa i vraćena u odvojenu bazu. |
| Nakon uspješne probe | Koraci 4–6. Kupiš VPS, zaštitiš SSH, postaviš Docker, produkcijske tajne i ključ za deploy. | Možeš ući kao `kaladont`. Actions može ući kao `deploy`. Produkcija ima vlastiti disk, bazu i IP. |
| Prije prvog javnog pristupa | Koraci 7–9. XHosting objavljuje DNS, provjeravaš mail, backup, prvi deploy i oporavak. | HTTPS i WebSocket rade na pravoj domeni, stiže mail, baza se može vratiti, postoji izmjereno vrijeme oporavka. |
| Prije šire promocije | Korak 10. Pozivaš mali prvi krug, pratiš greške i isprobavaš podršku. | Najmanje 20 završenih igara bez kritične greške i prva redovita noćna kopija potvrđena izvan VPS-a. |

**Gdje upisuješ naredbe.** `PowerShell` znači terminal na tvom Windows računalu. `Ubuntu · root` je prva administratorska prijava na **novi** server. `Ubuntu · kaladont` je tvoj svakodnevni korisnik sa `sudo`. `deploy` koristi automatika. Tekst u obliku `<PROD_IPV4>` mijenjaš svojom stvarnom vrijednošću. Naredbe za postavljanje novog servera ne izvršavaš na stagingu ili forumu. Nakon svake cjeline zapisuj dokaz u privatnu bilješku.

<a id="blokeri"></a>

## 1. Što danas blokira produkciju

Pregledani vrh `main` je `c707029d526b532a8c36805d5191cfbf78007322`. Dana 3. studenoga CI je pao na koraku **Pokrenuti lint**. U `paketi/zajednicko/src/dnk.ts`, redak 158, argument `_iskustvo` nije korišten. Objava slike i staging za taj commit su preskočeni. Prethodni uspješni staging run za `a4cfbdc205affe20f425f41c624aa060a964c96d` potvrdio je digest `sha256:74202920052c87ae53ff17a75d3ce88722306484446b45df1e11a3e36d7537a7`. To je povijesna provjera, ne automatski izbor za launch. Prije promocije očitaj aktualni staging ponovno. [Neuspjeli posao i log](https://github.com/josipmestrovic/kaladont/actions/runs/41609916586/job/125828931938) · [Prethodni uspješan staging](https://github.com/josipmestrovic/kaladont/actions/runs/41597182514)

| Stavka | Što sam našao | Tko zatvara i kojim dokazom |
|---|---|---|
| Provjera prije spajanja koda | CI se pokreće na push u `main`. GitHub je za `main` vratio `protected=false`, a popis ruleseta je prazan. | Agent dodaje read-only CI na PR, bez objave slike i bez produkcijskih tajni. Ti u GitHubu uključiš obveznu provjeru nakon što se jednom pojavila. Dokaz je probni crveni PR koji se ne može spojiti te zeleni CI na spojenom commitu. |
| Produkcijska objava | Postoje Dockerfile, produkcijski Compose, Caddy, migracije i automatski staging. Nema workflowa za produkcijsku promociju. | Agent dodaje ručno pokretanje s punim digestom, provjerom uspješnog staginga za isti commit, backupom prije migracije i provjerom produkcijskog zdravlja. Testira i povratak na prethodnu verziju. |
| Prvi start prazne baze | Staging već ima pravi rječnik. Uvoznik hrLex postoji u workspaceu, ali ga završni Docker runtime ne isporučuje kao gotovu operatersku naredbu. Staging skripta izvršava migracije i pretpostavlja već učitani rječnik. | Agent pakira podržani jednokratni uvoz ili dokumentirani, provjereni uvoz **samo rječnika**. Dokaz je pokretanje iz praznog volumena s punim rječnikom i bez prenesenih računa. |
| Prvi administrator | README identificira nedostajući CLI. Varijabla `ADMIN_TAJNI_KLJUC` sama ne pretvara tvoj račun u admina. | Agent dodaje jednokratni alat za dodjelu ovlasti točno jednom postojećem potvrđenom ljudskom računu. Dokaz je stvarna prijava u `/admin` i odbijanje običnog korisnika. |
| Backup, alarm i oporavak | Verzionirane skripte i systemd jedinice su u `skripte/backup/`; gate `zahtijevaj-svjez-offserver-backup.sh` pokreće novi pre-migracija dump. | Ti na VPS-u instaliraš alate, vratiš kopiju sa Storage Boxa, primiš probne alarme i izmjeriš oporavak. |
| Oporavak korisničkog računa | ~~Trenutačni reset provjerava potpis i rok tokena te mijenja hash lozinke. U toj ruti nema jednokratne potrošnje tokena ni opoziva prethodnih sesija.~~ **Zatvoreno:** jednokratni token s `reset_lozinke_verzija`, atomski race, opoziv svih HTTP i Socket.IO sesija. | Dokaz: zeleni CI i testovi u `racuni.test.ts` (jednokratnost, race, socket). |
| Pouzdan upis odigranih riječi | ~~Funkcija `zapisiPotez` uhvati pogrešku baze i samo ju zapiše u log. Završna obrada tada može prijaviti spremanje iako jedan potez nedostaje.~~ **Zatvoreno:** idempotentan `zapisiPotez` + UNIQUE `(partija_id, redni_broj)`; završni tok osigurava sve poteze prije XP-a. | Dokaz: testovi u `upis-partije.test.ts` (propagacija greške, idempotencija, prekid→retry→potpuna povijest + jedan XP). |
| Baza i ponovljivost | Produkcijski Compose daje aplikaciji isti DB račun kojim Docker inicijalizira PostgreSQL. Za Caddy i PostgreSQL koristi verzijske tagove, bez digesta, a dio GitHub Actionsa koristi verzijske tagove. Tvoja sigurnosna dokumentacija traži strože granice. | Agent odvoji aplikacijsku DB ulogu bez superuser ovlasti od migracija/administracije i dokaže backup s odgovarajućom ulogom. Pina provjerene slike i vanjske Actions reference kako predviđa dokumentacija. |
| Javni sadržaj | `/uvjeti` sadrži samo „Bit će napisano uskoro.” `/privatnost` kaže da su hosting i baza u Njemačkoj. | Ti dovršavaš uvjete i provjeravaš točnu lokaciju produkcije, obradu podataka, kontakt i stvarni postupak za brisanje. Ako produkcija ide u Helsinki, ažuriraš tvrdnju o Njemačkoj. Naslovnica prikazuje oznaku Demo. Usuglasi je s nazivom javnog izdanja prije promocije. |
| Staging i nadzor | Staging ima `noindex`, ali privremeno dopušta pristup izvana. Mail adapter šalje na dostavljenu adresu kada ima valjan Resend ključ. | Prije šire distribucije zaštiti staging pristupom za testere koji radi i s WebSocketom, npr. mrežnom dozvolom ili VPN-om. Actions health provjera i ovlašteni tester moraju i dalje raditi. Promotivni link vodi na produkciju. |

[README](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/README.md) · [CI](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/.github/workflows/ci.yml) · [Dockerfile](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/Dockerfile) · [Produkcijski Compose](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docker-compose.prod.yml) · [Reset lozinke](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/posluzitelj/src/racuni/rute.ts) · [Upis poteza](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/posluzitelj/src/igra/upis-partije.ts) · [Naslovnica](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/web/src/routes/%2Bpage.svelte) · [Uvjeti](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/web/src/routes/uvjeti/+page.svelte) · [Privatnost](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/web/src/routes/privatnost/+page.svelte) · [Tvoja sigurnosna analiza](https://chatgpt.com/library?file_id=libfile_dbd007ab8798819192d6b28af250ef1f&account_id=personal)

### Tekst koji možeš dati agentu

> Radi u grani na `josipmestrovic/kaladont`. Prvo popravi konkretni lint pad uz zadržavanje ponašanja postojećih pozivatelja. Zatim pripremi odvojene provjerljive PR-ove za stavke iz koraka 1. Dodaj CI na PR s minimalnim read-only ovlastima, a objavu zadrži na zelenom `main`. Implementiraj ručni `promoviraj-produkciju` za već testirani puni GHCR digest, s environmentom `produkcija`, serijalizacijom objava, prethodnim digestom, svježim provjerenim off-server backupom prije migracija i jasnom dijagnostikom bez tajni. Obradi prvu instalaciju iz prazne baze, idempotentan uvoz hrLex, prvi admin i ponovni pokušaj nakon parcijalnog pada. Implementiraj šifrirani backup, zaštićeni povrat u zaseban cilj i nadzor diska prema operativnom runbooku. Dokaži potpuni upis svih poteza i jednokratni obračun i nakon privremenog kvara baze. Provjeri sigurnosne stavke za račune, DB uloge, retenciju i redakciju tokena u logovima. Isprobaj povrat prethodnog digesta nad kompatibilnom shemom. Priloži točne operatorske naredbe, primjer bez tajni, instalaciju systemd jedinica, testove grešaka i dokaze sa staginga. Produkcijska baza, DNS i objava ostaju pod ručnom kontrolom operatera.

**Tvoja provjera u GitHubu.** Otvori `Actions → CI` i odaberi željeni commit. Za taj isti commit traži zelene `CI`, `Objaviti Docker sliku` i `Objaviti staging`. Otvori sažetak zadnjeg, kopiraj puni `sha256:…` i commit SHA. Kad read-only provjera radi na probnom PR-u, u `Settings → Rules → Rulesets` napravi aktivno pravilo za `main` koje traži PR i točan naziv uspješne provjere. Jedan operater može zadržati nula obveznih ljudskih odobrenja. Na probnoj promjeni provjeri i zabranu force-pusha/brisanja grane.

**PowerShell · dokaz staginga**

```powershell
$staging = Invoke-RestMethod 'https://staging.kaladont.hr/zdravlje'
$staging | Select-Object ok,baza,brojRijeci,verzija,digest
```

Očekuj `ok=True`, `baza=dostupna`, `brojRijeci` veći od nule i **identičan puni digest** iz runa. Ako kasnije zaštitiš staging, pokreni ovo kroz testerski pristup. S četiri odvojena profila preglednika odigraj cijeli Četveroboj, zatim Dvoboj. Osvježi ljestvicu i profil pa potvrdi da je rezultat ostao spremljen jednom. Za test ponovnog spajanja kratko ugasi mrežu na jednom uređaju pa je vrati unutar 10 sekundi, uz isti identitet. Provjeri da se igrač vratio u svoju igru. Ako je CI crven ili digest različit, stani na tom koraku.

**Na postojećem staging VPS-u** nakon prijave očitaj `hostname`, `cat /etc/os-release`, `dpkg --print-architecture`, `sudo docker version --format '{{.Server.Version}}'`, `sudo docker compose version`, `free -h` i `df -h`. Zapiši verzije i raspoloživi prostor. Verzija Ubuntu runnera u Actionsu ne dokazuje verziju tvog VPS-a.

<a id="lozinke"></a>

## 2. Bitwarden i ključevi prije kupnje

1. U Bitwardenu napravi mapu `Kaladont / produkcija`. Staging drži u drugoj mapi. Na Bitwardenu, Hetzneru i GitHubu uključi 2FA. Recovery kodove spremi i neovisno o usluzi za koju služe, tako da pri gubitku mobitela još možeš ući u trezor.
2. Napravi **password-protected encrypted JSON** izvoz trezora na šifrirani offline medij. Lozinka izvoza i pristup u nuždi moraju ti biti dostupni kad izgubiš računalo. Ako su ključevi privitci, osiguraj i njihovu zasebnu šifriranu kopiju. Provjeri čitljivost recovery paketa prije nego obrišeš radne kopije. [Bitwardenov vodič](https://bitwarden.com/help/encrypted-export/)
3. U Windows PowerShellu provjeri klijente. Ako `ssh` nedostaje, u Windows **Optional features** instaliraj **OpenSSH Client** i ponovno otvori terminal.
4. Generiraj namjenski osobni ključ za produkciju. Odaberi dugu lozinku za privatni ključ. Ako datoteka tog imena postoji, stani i identificiraj je prije stvaranja nove.

```powershell
Get-Command ssh, ssh-keygen, ssh-keyscan
$keyDir = Join-Path $env:USERPROFILE '.ssh'
New-Item -ItemType Directory -Force $keyDir | Out-Null
$adminKey = Join-Path $keyDir 'kaladont_prod_admin'
if (Test-Path $adminKey) { throw 'Ovaj ključ već postoji. Provjeri ga prije nastavka.' }
ssh-keygen -t ed25519 -a 100 -f $adminKey -C 'joka-kaladont-produkcija'
Get-Content "$adminKey.pub"
```

Ispis završne naredbe je **javni** ključ koji smiješ zalijepiti u Hetzner. Istoimena datoteka bez `.pub` je privatna. Drži je u svojem privatnom korisničkom profilu i šifriranom recovery paketu.

| Podatak | Gdje je njegova radna kopija | Kako ga oporavljaš |
|---|---|---|
| Osobni SSH ključ, sudo lozinka, podaci za konzolu, IP i host fingerprint | Tvoj Windows i trezor. Na VPS-u je samo javni osobni SSH ključ. | Bitwarden + šifrirani offline primjerak. |
| Produkcijski deploy SSH ključ | Zasebni par. Privatni dio u GitHub Environmentu `produkcija`, javni u računu `deploy` na produkciji. | Šifrirana recovery kopija, odvojena od staging ključa. |
| DB lozinke, `SESIJA_TAJNA`, `ADMIN_TAJNI_KLJUC`, Resend produkcijski API ključ | Potrebne radne vrijednosti u `/opt/kaladont/.env`, mode `600`. Backup/migracijska uloga samo gdje je nužna. | Zasebne imenovane stavke u Bitwardenu. |
| Glavni Storage Box račun | Trezor. VPS dobiva ograničeni SSH pristup samo svojem podračunu. | Offline recovery. Druge aplikacije nemaju pristup direktoriju igre. |
| `age` ključ za dešifriranje | Privatni dio u Bitwardenu i offline kopiji. Na VPS-u trajno stoji samo javni `age1…` recipient za šifriranje. | Probno dešifriranje i mjesečni povrat dokazuju da koristiš pravi ključ. |
| Healthchecks ping URL-ovi | Datoteka za servis, samo root, i trezor. | Poseban za svaki posao. Samo status, bez logova. |

Ne lijepi stvarne vrijednosti u chat, screenshot, GitHub issue, git ili naredbu u shell povijesti. GitHubu ne treba produkcijska lozinka baze. Zapiši i tko može preuzeti sustav ako si nedostupan te gdje su upute za hitan pristup.

<a id="spremiste"></a>

## 3. Storage Box i dokaz na stagingu prije novog VPS-a

**3.1 · Spremište.** U Hetzner Console pronađi **Storage Boxes**. Ako već imaš slobodnog prostora na postojećem Boxu, koristi njega. Inače je **BX11** početni izbor iz projekta. Otvori detalje, uključi SSH podršku za port 23 i dnevne automatske snapshote. Stvori odvojene direktorije i podračune za `forum`, privremeni `kaladont-staging-dokaz` i `kaladont-produkcija`. Svakom daj vlastiti SSH ključ. Zapiši host, korisnika i vrstu pristupa koje je izdala konzola. Za pristup izvan Hetznerove mreže po potrebi uključi **External Reachability**. Za port 23 podračun treba vlastiti `authorized_keys` s javnim ključem u OpenSSH formatu. Pri prvom spajanju usporedi otisak s Hetznerovim službenim popisom. Agentov installer treba instalirati ključ podračuna i pinani `known_hosts` za račun koji pokreće backup. [Javni ključevi Storage Boxa](https://docs.hetzner.com/storage/storage-box/ssh-keys/add-ssh-keys/) · [Službeni otisci](https://docs.hetzner.com/storage/storage-box/general/#ssh-host-keys) · [Postavljanje Storage Boxa](https://docs.hetzner.com/storage/storage-box/getting-started/creating-a-storage-box/) · [Portovi, podračuni i SSH](https://docs.hetzner.com/storage/storage-box/access/access-overview/)

**3.2 · Ključ za šifriranje.** Na vlastitom računalu koristi službeni `age`. Privatni ključ stvori na uređaju sa šifriranim diskom, izvan Git repozitorija, OneDrivea i ostalih sinkroniziranih mapa. Sljedeći primjer koristi novu lokalnu mapu. Ako već imaš provjereni ključ za Kaladont, provjeri njegov javni dio i offline kopiju. [Službene upute za age](https://github.com/FiloSottile/age)

```powershell
winget install --id FiloSottile.age --exact
# Po potrebi otvori novi PowerShell nakon instalacije.
$recoveryDir = Join-Path $env:LOCALAPPDATA 'Kaladont-Recovery'
New-Item -ItemType Directory -Force $recoveryDir | Out-Null
$ageFile = Join-Path $recoveryDir 'kaladont-prod-age.txt'
if (Test-Path $ageFile) { throw 'Ključ već postoji. Nemoj ga prepisati.' }
age-keygen -o $ageFile
age-keygen -y $ageFile
```

Posljednja naredba ispisuje samo **javni** `age1…` recipient. Privatni sadržaj datoteke spremi u trezor i zaštićeni offline primjerak. Za sintetički staging možeš napraviti poseban par pod drugim imenom. Za povrat stvarnih podataka koristi se baš privatni ključ koji pripada produkcijskom recipientu. Kad si dokazao povrat iz trezora i offline kopije, ukloni radnu tekstualnu datoteku s računala ili je trajno čuvaj samo unutar zaštićenog recovery spremnika.

**3.3 · Dvije probe.** Prema ADR-014 prvo potvrdi i off-server backup postojećeg Discoursea, uključujući uploadove. Provjeri povrat na zasebnoj testnoj Discourse instanci. Zatim na stagingu isprobaj **iste verzionirane alate** koje agent priprema za produkciju.

1. Odigraj testnu igru. Zapiši njezin ID i broj riječi iz `/zdravlje`.
2. Operater instalira alate: `sudo bash skripte/backup/instaliraj-backup-jedinice.sh`, popuni `/etc/kaladont/backup.env`, postavi Box ključ. Tek kad `systemctl cat kaladont-backup.service` potvrdi da jedinica postoji, okini probni backup (`sudo systemctl start kaladont-backup.service` ili status CLI).
3. U Storage Box podračunu mora se pojaviti šifrirana datoteka `.age`. Usporedi veličinu i SHA-256 iz zapisa s ponovnim preuzimanjem pohranjenih bajtova. Agentov alat treba postupak obaviti i kad se na Storage Boxu ne može pokrenuti proizvoljna shell naredba.
4. Preuzmi baš tu udaljenu kopiju, dešifriraj je i vrati u **novu izoliranu praznu PostgreSQL instancu**, bez javnog porta i bez produkcijskog URL-a. U njoj provjeri `rijeci`, `igraci`, `partije`, sudionike, poteze i spremljeni rezultat poznate igre. Zapiši trajanje i očisti samo jednokratne resurse.
5. Provjeri da stvarni staging još radi, da se primio e-mail probnog alarma i zatim poruka oporavka. Ukloni ili onemogući privremeni staging podračun nakon zabilježenog dokaza.


**Kako se napravi jedan dump na postojećem stagingu.** Ovaj primjer pokazuje čitanje stvarne staging baze i šifriranje bez lokalnog nešifriranog dumpa. Dobiveni artefakt je samo početak probe iz 3.3. Za dovršenje treba proći i prijenos na Box te pravi povrat u novu bazu. U starom SSH prozoru najprije provjeri `hostname`. Na **STAGINGU**, kao `kaladont`, provjeri `command -v age`. Ako program nije instaliran, administrator ga na Ubuntu stagingu instalira s `sudo apt install age`. Potom izvrši `sudo -iu deploy` i sljedeći Bash blok. Unosi se samo javni staging `age1…` recipient.

```bash
(
  set -euo pipefail
  umask 077
  cd /opt/kaladont
  test -f docker-compose.staging.yml
  cilj=$(docker compose -f docker-compose.staging.yml exec -T baza \
    psql -U kaladont -d kaladont_staging -Atc 'SELECT current_database()')
  test "$cilj" = kaladont_staging
  read -r -p 'Javni age1 recipient za staging: ' recipient
  [[ "$recipient" == age1* ]]
  radni_dir=$(mktemp -d)
  privremena="$radni_dir/staging.dump.age.part"
  trap 'rm -f -- "$privremena"' EXIT
  docker compose -f docker-compose.staging.yml exec -T baza \
    pg_dump -U kaladont -d kaladont_staging -Fc \
    | age -r "$recipient" -o "$privremena"
  mv -- "$privremena" "$radni_dir/staging.dump.age"
  sha256sum "$radni_dir/staging.dump.age"
)
```

Zadnji redak daje hash i putanju nove šifrirane datoteke. Ako korak padne, nema završne `staging.dump.age`. Za pravo pokrivanje produkcije koristi testirani timer i backup ulogu iz novog PR-a. [PostgreSQL · izrada dumpa](https://www.postgresql.org/docs/16/app-pgdump.html)

**Stani prije kupnje ako imaš samo lokalni dump, screenshot datoteke, `pg_restore --list` ili uspješnu poruku skripte.** Za odluku o kupnji treba ti poznata igra pročitana iz vraćene baze. [Runbook oporavka](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/runbook-backup-i-vracanje.md)

<a id="odabir"></a>

## 4. Novi Hetzner VPS · što odabrati

Otvori Hetzner Console, odaberi svoj projekt i u popisu postojećih servera provjeri njihove lokacije. Staging je prema tvojoj informaciji u Finskoj. Projekt predviđa istu lokaciju kao forum. Ako je i forum u Helsinkiju, za produkciju odaberi **Helsinki (`hel1`)**. Ako nije ili nema kapaciteta, zabilježi zasebnu odluku o lokaciji i cijeni prije narudžbe. Bitno za oporavak je da **budući zamjenski VPS može preuzeti produkcijsku Primary IPv4 u istoj lokaciji**.

| Polje u konzoli | Odabir za početni Kaladont |
|---|---|
| Name | `kaladont-produkcija`. Stvaraš novi stroj. |
| Image | **Ubuntu Server 24.04 LTS**, čista službena OS slika. |
| Architecture / Type | **x86 / amd64, Intel ili AMD**. Polazni plan **CX23, 2 vCPU, 4 GB RAM i 40 GB NVMe**. CI danas gradi samo za `linux/amd64`. |
| Ako CX23 ne možeš naručiti | Javni katalog prikazuje ograničenu dostupnost. Provjeri konzolu u trenutku kupnje. Ako je dostupan samo skuplji x86 plan, usporedi cijenu ekvivalentnog `CPX22` i odluči o budžetu. Dosadašnji dokument traži tu odluku, a ne automatsku zamjenu. |
| Networking | Najprije u resursima **Primary IPs** rezerviraj vlastitu javnu **IPv4**, nazovi je `kaladont-produkcija-ip`, odaberi istu lokaciju, isključi **Auto delete** i uključi zaštitu od brisanja adrese. Pri stvaranju servera odaberi **tu postojeću IP**. Projekt zasad koristi samo javni IPv4. |
| SSH keys | Dodaj javni ključ `kaladont_prod_admin.pub` iz koraka 2 i označi ga prije stvaranja servera. |
| Firewall | Napravi i dodijeli `kaladont-produkcija-fw`. Inbound **TCP 22, 80 i 443**. 80/443 su za sve igrače, 22 za administraciju i GitHub-hosted deploy prema projektu. Odlazne veze su potrebne za ažuriranja, GHCR, Resend, backup i nadzor. |
| Backups | Uključi **Hetzner Backups** za produkciju. Oni daju dodatni način obnove diska. Za vraćanje baze koristiš zaseban šifrirani dump. |
| Dodatni resursi | Za prvi release aplikacija, Caddy i PostgreSQL dijele ovaj VPS. Forum ima svoj postojeći VPS. Za početak nisu potrebni dodatni volumen, load balancer ni poseban DB server. |
| Prije plaćanja | Pogledaj prikazani mjesečni iznos za stroj, IPv4, backup i eventualni novi Storage Box te kako je prikazan PDV. Kapacitet za istovremene igre utvrđuješ testom na ciljanoj konfiguraciji. |

**Budžet.** Tvoja projektna procjena za CX23 s jednim IPv4 iznosi oko **5,99 €/mj. bez PDV-a** kad je taj plan dostupan. Dnevni backup VPS-a i eventualno novi Storage Box dodatne su stavke. Točan iznos i dostupnost potvrdi u konzoli neposredno prije narudžbe. Postojeći staging i forum već su zasebni troškovi.

**Provjera.** U detaljima novog servera vidiš njegov naziv, lokaciju, dodijeljeni firewall i baš rezerviranu IPv4. Privatno zapiši te vrijednosti. Tek tada imaš adresu koju možeš poslati XHostingu. [Hetzner Console](https://console.hetzner.cloud/) · [Hetzner · stvaranje servera](https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server/) · [Primary IP](https://docs.hetzner.com/cloud/servers/primary-ips/overview/) · [Dostupnost CX planova](https://www.hetzner.com/cloud/cost-optimized/) · [Dimenzioniranje Kaladonta](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/dimenzioniranje-posluzitelja.md)

<a id="ulaz"></a>

## 5. Prva prijava i siguran pristup serveru

### 5.1 Potvrdi da je to tvoj server

**Hetzner · Console.** Na stranici baš novog servera otvori njegovu web konzolu. Za lokalnu prijavu konzole, ako si server stvorio samo sa SSH ključem i nemaš root lozinku, Hetznerov postupak je **Rescue → Root Password → Reset Root Password**. Spremi je u trezor i prijavi se u web konzolu. Ovo je lokalna konzola, ne uključuješ vanjsku SSH prijavu lozinkom. U njoj izvrši:

```bash
hostname
ssh-keygen -E sha256 -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Privatno zapiši otisak oblika `SHA256:…`. [Pristup preko Hetznerove web konzole](https://docs.hetzner.com/cloud/servers/getting-started/vnc-console/)

**Windows · PowerShell.** Upiši *produkcijski* IP kada ga zatraži. Ako otvaraš novi PowerShell, ponovno postavi varijable iz bloka.

```powershell
$ProdIp = Read-Host 'Produkcijski IPv4 iz Hetznera'
$keyDir = Join-Path $env:USERPROFILE '.ssh'
$adminKey = Join-Path $keyDir 'kaladont_prod_admin'
$knownHosts = Join-Path $keyDir 'kaladont_prod_known_hosts'
ssh-keyscan -t ed25519 $ProdIp 2>$null | Set-Content -Encoding ascii $knownHosts
ssh-keygen -E sha256 -lf $knownHosts
```

Usporedi cijeli otisak s web konzolom. Prazan rezultat ili različit otisak znači da se ne prijavljuješ dok ne utvrdiš pravi IP/ključ. Nakon potpunog podudaranja:

```powershell
ssh -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -i $adminKey "root@$ProdIp"
```

**Ubuntu · root.** Sad si na produkcijskom VPS-u. Provjeri metu i vrijeme:

```bash
hostname
cat /etc/os-release
dpkg --print-architecture
timedatectl status
```

Očekuješ novi server, Ubuntu 24.04 i `amd64`. Namjesti `UTC` ako već nije aktivan. Sljedeće naredbe vrijede za čist, nov stroj. Korisnik `kaladont` dobiva novu jaku lokalnu lozinku iz Bitwardena kad je `adduser` zatraži. Njome kasnije potvrđuješ `sudo`.

```bash
timedatectl set-timezone UTC
apt update
apt upgrade -y
apt install -y ufw fail2ban python3-systemd unattended-upgrades curl ca-certificates nano
dpkg-reconfigure -plow unattended-upgrades
adduser kaladont
usermod -aG sudo kaladont
install -d -m 700 -o kaladont -g kaladont /home/kaladont/.ssh
install -m 600 -o kaladont -g kaladont /root/.ssh/authorized_keys /home/kaladont/.ssh/authorized_keys
adduser --disabled-password --gecos "" deploy
```

**Zadrži root prozor otvoren.** Otvori drugi Windows terminal, ponovno postavi `$ProdIp`, `$adminKey` i `$knownHosts` kao gore i uđi:

```powershell
ssh -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -i $adminKey "kaladont@$ProdIp"
```

U drugom prozoru izvrši `whoami` pa `sudo -v`. Rezultat prvoga je `kaladont`, a drugi prihvaća njegovu lokalnu lozinku. Tek tada nastavi. Ako nadogradnja traži restart, zasada zadrži pristup web konzoli, ponovno provjeri prijavu i nastavi tek nakon povratka servera.

### 5.2 Zaključaj SSH i otvori potrebne portove

**Ubuntu · kaladont.** Na novom stroju napravi rani SSH drop-in. Na Ubuntuu prva učitana vrijednost obično pobjeđuje, zato provjeri efektivne vrijednosti prije reloada.

```bash
sudo tee /etc/ssh/sshd_config.d/00-kaladont.conf >/dev/null <<'SSH_CONFIG'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
SSH_CONFIG
sudo /usr/sbin/sshd -t
sudo /usr/sbin/sshd -T | grep -E '^(permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication) '
```

Trebaš vidjeti redom za odgovarajuća imena `no`, `no`, `no`, `yes`. Ako test prijavi pogrešku ili vrijednosti nisu te, ostavi postojeću sesiju i uskladi konfiguraciju. Kad su dobre:

```bash
sudo systemctl reload ssh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw show added
sudo ufw enable
sudo ufw status verbose
```

Potvrdi s `y` tek kada među pravilima vidiš `22/tcp`. Na svježem VPS-u uključi i SSH jail:

```bash
sudo tee /etc/fail2ban/jail.d/kaladont-sshd.local >/dev/null <<'JAIL'
[sshd]
enabled = true
backend = systemd
JAIL
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

**Provjera.** Otvori još jednu novu SSH sesiju kao `kaladont`. Tek kad uspije, zatvori stari root terminal. Ako si izgubio pristup, koristi Hetznerovu web konzolu da provjeriš SSH konfiguraciju i oba firewalla. [Ubuntu · OpenSSH](https://ubuntu.com/server/docs/how-to/security/openssh-server/)

### 5.3 Instaliraj Docker

**Ubuntu · kaladont.** Koristi ovaj blok samo na svježem Ubuntu 24.04 serveru bez prethodno instaliranog Dockera. Ako radiš na već pripremljenom serveru, prvo usporedi njegove postojeće apt izvore i verzije sa stagingom.

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$(dpkg --print-architecture)" "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
apt-cache policy docker-ce docker-compose-plugin
```

Provjeri da paketi dolaze s `download.docker.com`. Usporedi verzije s onima provjerenima na stagingu. Sljedeći blok instalira **trenutačne** pakete iz tog izvora. Ako bi produkcija tako dobila novu glavnu verziju Enginea/Composea, prvo je provjeri na stagingu ili odaberi testiranu dostupnu verziju po službenim uputama.

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker deploy
sudo docker version --format '{{.Server.Version}}'
sudo docker compose version
sudo -iu deploy docker run --rm hello-world
```

Očekuješ verzije i `Hello from Docker!`. Docker grupa daje praktično administratorske ovlasti. Pristup korisniku `deploy` zato pripada samo produkcijskom workflowu. Na praznom stroju postavi ograničeno zapisivanje Docker logova prije prvog kontejnera igre. Ako još nema `/etc/docker/daemon.json`, stvori ga s `{"log-driver":"local"}`, provjeri `sudo dockerd --validate --config-file=/etc/docker/daemon.json`, restartaj Docker i potvrdi `sudo docker info --format '{{.LoggingDriver}}'` daje `local`. Ako datoteka postoji, novu vrijednost uklopi u postojeći JSON. [Docker · Ubuntu](https://docs.docker.com/engine/install/ubuntu/) · [Docker · ograničeni lokalni logovi](https://docs.docker.com/engine/logging/drivers/local/)

<a id="tajne"></a>

## 6. Deploy ključ, GitHub i produkcijske tajne

**6.1 · Poseban ključ za automatiku.** U PowerShell prozoru s varijablama iz 5.1:

```powershell
$deployKey = Join-Path $keyDir 'kaladont_prod_actions'
if (Test-Path $deployKey) { throw 'Deploy ključ već postoji. Prvo ga identificiraj.' }
ssh-keygen -t ed25519 -f $deployKey -C 'actions-kaladont-produkcija'
$target = 'kaladont@{0}:/home/kaladont/kaladont_actions.pub' -f $ProdIp
scp -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -i $adminKey "$deployKey.pub" $target
```

Za ovaj namjenski automatizirani ključ pritisni Enter na oba upita za passphrase ako workflow očekuje ključ bez nje. Osobni admin ključ zadržava svoju passphrase. Kopiran je samo javni dio. **Ubuntu · kaladont**, jednom na novom računu `deploy`:

```bash
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo test ! -e /home/deploy/.ssh/authorized_keys && sudo install -m 600 -o deploy -g deploy /home/kaladont/kaladont_actions.pub /home/deploy/.ssh/authorized_keys
```

Ako već postoji `authorized_keys`, pogledaj s administratorom tko ima pristup umjesto prepisivanja datoteke. Testiraj iz Windows PowerShella:

```powershell
ssh -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" -i $deployKey "deploy@$ProdIp" 'whoami && docker compose version'
```

**6.2 · GitHub web.** Otvori **repo → Settings → Environments → New environment → `produkcija`** ili otvori već postojeći. Ograniči deployment na `main` prema projektu. Dodaj **Environment secrets** s ovim točnim imenima prema ugovoru novog workflowa:

| Ime | Vrijednost |
|---|---|
| `PROD_HOST` | Produkcijska Primary IPv4 koju si upravo provjerio. |
| `PROD_SSH_KLJUC` | Cijeli **privatni** `kaladont_prod_actions`, od prvog do zadnjeg retka, sa stvarnim prijelomima redaka. |
| `PROD_SSH_KNOWN_HOSTS` | Sadržaj provjerene datoteke `kaladont_prod_known_hosts`, uključujući IP, vrstu i javni ključ servera. Sam otisak `SHA256:…` nije dovoljan. |

Privatni dio možeš zalijepiti iz zaštićenog lokalnog editora ili trezora. Ako koristiš međuspremnik, isključi njegovu povijest/sinkronizaciju i očisti ga nakon lijepljenja. U zasebnom `staging` environmentu ostaju samo staging vrijednosti. Za GHCR workflow koristi kratkotrajni `GITHUB_TOKEN` s potrebnim ovlastima. [GitHub · environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

**6.3 · Datoteka na VPS-u.** Ubuntu · kaladont:

```bash
sudo install -d -m 750 -o deploy -g deploy /opt/kaladont
sudo -u deploy sh -c 'umask 077; touch /opt/kaladont/.env'
sudo chmod 600 /opt/kaladont/.env
sudo -u deploy nano /opt/kaladont/.env
```

U `nano` spremi s `Ctrl+O`, Enter, zatvori s `Ctrl+X`. Stvarne vrijednosti unosi samo na server i u svoj trezor. Sljedeća matrica odgovara **pregledanom** produkcijskom Composeu. Kada agent razdvoji DB uloge ili uvede alate, koristi ažuriranu matricu iz njegova spojenog PR-a.

| Naziv u `.env` | Što postaviti |
|---|---|
| `CADDY_EMAIL`, `DEV_MAIL` | Stvarni pretinci koje pratiš za TLS obavijesti i tehničke alarme. Provjeri primitak. |
| `BAZA_LOZINKA` | U Bitwardenu generiraj npr. 48 slučajnih slova i brojeva. Današnji Compose umeće je izravno u URL baze pa ovaj odabir izbjegava probleme s rezerviranim URL znakovima. Promjena teksta u `.env` naknadno ne mijenja lozinku postojeće PostgreSQL uloge. |
| `SESIJA_TAJNA`, `ADMIN_TAJNI_KLJUC` | Svakoj dodijeli **vlastitu** novu kriptografski nasumičnu vrijednost. Ne koristi onu sa staginga. |
| `EMAIL_API_KLJUC`, `EMAIL_POSILJATELJ` | Produkcijski Resend ključ s pravom slanja za verificiranu domenu, pošiljatelj `noreply@kaladont.hr`. |
| `JAVNA_ADRESA` | `https://kaladont.hr`. Utječe na poveznice potvrde i oporavka računa. |
| `LJESTVICE_POCETAK` | Odaberi stvarni početak javnog praćenja ljestvica u ISO 8601 s pomakom, primjer oblika `2026-11-15T10:00:00+01:00`. Primjer nije odabrani datum lansiranja. |
| `KALADONT_IMAGE`, `VERZIJA`, `DIGEST` | Iz provjerenog releasea: `ghcr.io/josipmestrovic/kaladont@sha256:…`, puni commit SHA, puni `sha256:…`. Novi workflow treba ažurirati ova tri polja zajedno. |
| `NADZOR_EMAIL_OMOGUCEN` | Za launch `true`; pošalji probnu obavijest iz admina i provjeri stvarni inbox. |
| `BOTOVI_DVOBOJ`, `BOTOVI_CETVEROBOJ`, `TRENING_OMOGUCEN` | Eksplicitno odaberi ponašanje za release. Compose zadano uključuje trening i isključuje javne botove. Ako želiš popunu javnih redova od prvog dana, provjeri i trajne postavke, fond botova i jednu stvarnu igru s jednim čovjekom. |
| Vrijednosti koje Compose određuje | `NODE_ENV=production`, interna adresa baze, port 3000, isključenje razvojnog preskakanja timera i tolerancija prekida. Produkcija ima svoju `kaladont_prod` i trajan volume. Umami može pričekati. |


**Predložak za današnji Compose.** Svaka varijabla zauzima jedan redak. Lijevo je doslovno ime, desno je vrijednost, bez razmaka oko znaka jednakosti. Ako agentova isporuka doda DB uloge ili promijeni imena, uzmi novu verziju predloška iz te isporuke. Svaki `__ZAMIJENI_…__` mora biti zamijenjen privatno u editoru prije prvog deploya.

```dotenv
CADDY_EMAIL=__ZAMIJENI_ADRESOM_ZA_TLS__
DEV_MAIL=__ZAMIJENI_ADRESOM_ZA_ALARME__
BAZA_LOZINKA=__ZAMIJENI_DB_LOZINKOM__
SESIJA_TAJNA=__ZAMIJENI_TAJNOM_SESIJE__
ADMIN_TAJNI_KLJUC=__ZAMIJENI_ZASEBNOM_ADMIN_TAJNOM__
EMAIL_API_KLJUC=__ZAMIJENI_RESEND_KLJUCEM__
EMAIL_POSILJATELJ=noreply@kaladont.hr
JAVNA_ADRESA=https://kaladont.hr
LJESTVICE_POCETAK=__ZAMIJENI_ISO_DATUMOM_S_VREMENSKIM_POMAKOM__
KALADONT_IMAGE=ghcr.io/josipmestrovic/kaladont@sha256:__ZAMIJENI_64_HEX_DIGESTOM__
DIGEST=sha256:__ZAMIJENI_ISTIM_64_HEX_DIGESTOM__
VERZIJA=__ZAMIJENI_PUNIM_COMMIT_SHA__
NADZOR_EMAIL_OMOGUCEN=true
TRENING_OMOGUCEN=true
BOTOVI_DVOBOJ=false
BOTOVI_CETVEROBOJ=false
```

Kad želiš javnu popunu botovima, promijeni odgovarajuća `false` u `true` prema provjerenom releaseu. U `nano` pritisni `Ctrl+W` i potraži `__ZAMIJENI_`. Nastavi kad više nema tog teksta. Tiha Compose provjera u nastavku provjerava strukturu datoteke, a stvarne vjerodajnice dokazuju pokretanje servisa i probno slanje maila.

Podesi produkcijske backup/Healthchecks tajne prema novom servisu u zasebnoj root-only datoteci. Njih ne zahtijevaju svi aplikacijski kontejneri. Na serveru ne trebaš instalirati Node, pnpm, Caddy ili PostgreSQL kao zasebne sistemske servise. **Kada odobreni provisioning/workflow dostavi Compose i Caddyfile iz točnog commita**, provjeri ovlasti i strukturu bez ispisa tajni:

```bash
sudo stat -c '%a %U:%G %n' /opt/kaladont/.env
sudo -iu deploy sh -c 'cd /opt/kaladont && docker compose -f docker-compose.prod.yml config --quiet'
```

Očekuješ `600 deploy:deploy` i drugu naredbu bez pogreške. Običan `docker compose config` može ispisati stvarne tajne. Kod greške popravi prijavljenu varijablu pa ponovi tihu provjeru. [Konfiguracija aplikacije](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/aplikacije/posluzitelj/src/konfiguracija.ts)

<a id="dns"></a>

## 7. Kada i što poslati XHostingu

**Prvi zahtjev možeš poslati dok se priprema kod. Drugi ide tek prije planirane prve objave.** Registracija domene i DNS mogu ostati kod XHostinga. Ne moraš premjestiti domenu u Hetzner niti mijenjati nameservere.

### 7.1 Verifikacija slanja e-maila · može unaprijed

1. U Resendu otvori **Domains → Add domain** ili postojeću konfiguraciju `kaladont.hr`. Ako je staging već koristio verificiranu istu domenu, prvo provjeri postojeće stanje. Produkciji svejedno izdaj zaseban ključ s pravom **Sending access** i, gdje je ponuđeno, samo za tu domenu.
2. Zapiši odabranu regiju slanja i pregledaj DPA/obradu prema odluci projekta, uključujući podizvršitelje. Regija slanja sama ne dokazuje gdje se obrađuju svi podaci. U sučelju kopiraj **točno prikazane** vrste zapisa, hostove, vrijednosti i prioritete za SPF/DKIM i povratnu poštu ako su traženi.
3. Kontaktiraj XHosting postojećim provjerenim kanalom za domenu. Predložak za kopiranje:

> **Predmet · Verifikacija Resend slanja za kaladont.hr**  
> Poštovani, molim postavite zapise iz priložene tablice kako bismo mogli slati potvrde registracije i reset lozinke s noreply@kaladont.hr. Za svaki zapis navodim tip, host, vrijednost i prioritet točno kako ih prikazuje Resend. Molim zadržite postojeće zapise za primanje pošte na kaladont.hr i javite ako neki predloženi zapis kolidira s postojećim.  
> [Ovdje zalijepi samo tablicu javnih DNS zapisa.]  
> Molim potvrdu nakon primjene. Hvala, Josip.

Ne šalješ Resend API ključ niti dodaješ drugi SPF na istom imenu. Ako postoji konflikt, XHosting provjerava kako sačuvati postojeće slanje. U Resendu pričekaj **Verified**, a zatim testiraj stvarni inbox. Ako projekt želi odgovore na `info@kaladont.hr`, provjeri da pretinac prima mail i gdje odlazi „Odgovori”. Trenutačni adapter šalje `from`, ali nema posebno `reply_to` polje. Dogovori očekivano ponašanje i testiraj ga. [Resend · domene](https://resend.com/docs/dashboard/domains/introduction) · [API ključevi](https://resend.com/docs/dashboard/api-keys/introduction) · [DPA](https://resend.com/legal/dpa)

### 7.2 A zapisi za web · nakon pripreme produkcijskog IP-a

Ako domena danas već prikazuje neku stranicu, prije promjene zatraži postojeće vrijednosti za `@` i `www`, provjeri ima li `AAAA` ili konfliktnog `CNAME` i zapiši plan povratka. Po potrebi zamoli podršku da ranije spusti TTL, npr. na 300 s ako je moguće. Promjena TTL-a utječe na buduća dohvaćanja tek kad stari cache istekne.

**Kada poslati.** Imaš rezerviranu IP, radi SSH, otvoreni su 80/443, spremljene su tajne i spreman odobreni workflow za prvu objavu. S XHostingom dogovori termin. Ako postojeći web mora ostati vidljiv, dogovori kratku stranicu održavanja ili odgovarajući trenutak prebacivanja. Caddy izdaje javni TLS certifikat kad imena pokazuju na novi server i može mu se pristupiti.

> **Predmet · Produkcijski A zapisi za kaladont.hr i www.kaladont.hr**  
> Poštovani, molim u dogovorenom terminu usmjerite `kaladont.hr` (A, `@`) i `www.kaladont.hr` (A, `www`) na `<PROD_IPV4>`. Koristimo IPv4 i izravan DNS prema VPS-u. Ako za ta dva imena već postoji AAAA, CNAME ili drugi A zapis koji kolidira, molim javite prije izmjene. Postojeći `staging.kaladont.hr`, `forum.kaladont.hr`, nameservere i poštanske zapise zadržite kako su podešeni. Molim potvrdu nakon primjene. Hvala, Josip.

**PowerShell · vanjska provjera.** Ako odgovoriš preko više resolvera, DNS cache može neko vrijeme pokazivati različite vrijednosti.

```powershell
Resolve-DnsName kaladont.hr -Type A
Resolve-DnsName www.kaladont.hr -Type A
Resolve-DnsName kaladont.hr -Type A -Server 1.1.1.1
Resolve-DnsName www.kaladont.hr -Type A -Server 8.8.8.8
Resolve-DnsName kaladont.hr -Type AAAA
Resolve-DnsName www.kaladont.hr -Type AAAA
```

**Prolaz.** Oba imena daju isključivo dogovoreni produkcijski IPv4. U planu bez IPv6 nema starog `AAAA` odgovora za drugo odredište. Nakon pokretanja Caddyja provjerit ćeš i HTTPS te preusmjeravanje `www` na glavnu domenu. [Caddy i automatski HTTPS](https://caddyserver.com/docs/automatic-https)

<a id="oporavak"></a>

## 8. Kako osigurati database dump i dokazati oporavak

**Dogovor projekta.** Dnevni dump znači da pri potpunom gubitku diska možeš izgubiti do **24 sata** novih podataka ako zadnja potvrđena kopija nije starija od 24 sata. Obnova cijele usluge cilja **4 sata**, povrat nakon loše verzije aplikacije **15 minuta**. To su ciljevi koje mjeriš. Ako ti gubitak posljednjeg dana računa i igara nije prihvatljiv, prije lansiranja odaberi kraći interval ili s agentom planiraj kontinuirano arhiviranje WAL-a i povrat u trenutak. Oba sustava, VPS i Storage Box, ostaju kod Hetznera. Za MVP postoji zajednički rizik gubitka cijelog pružateljskog računa. [ADR-014](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/03-arhitektura/odluke/014-operativni-model-mvp-a.md)

### 8.1 Što mora napraviti automatika

1. Na produkciji postavi zaseban `kaladont-produkcija` Storage Box podračun. Njegov ključ ima pristup samo direktoriju igre. Uskladi dopuštenje ovog računa za pisanje, port, format javnog ključa i `known_hosts` prema Hetznerovoj dokumentaciji. Glavni Box pristup i upravljanje snapshotovima zadrži zasebno. [Storage Box SSH i podržane naredbe](https://docs.hetzner.com/storage/storage-box/access/access-ssh-rsync-borg/)
2. Oko **04:00 UTC** svaki dan systemd servis šalje Healthchecks `/start`, provjerava bazu i prostor te radi PostgreSQL custom dump (`pg_dump -Fc`) iz `kaladont_prod`. Koristi kompatibilni klijent PostgreSQL 16 i odgovarajuću backup ulogu. Šifrira javnim `age` recipientom prije prijenosa. Ako koristi cjevovod, servis mora provjeriti pogrešku svakog koraka (`pipefail`). Privremeni sadržaj se čisti i pri grešci.
3. Prenosi šifriranu datoteku, provjerava njenu **udaljenu veličinu i SHA-256** prema lokalnoj, pa tek tada potvrđuje novu generaciju. Prekinuti upload označava kao nedovršen. Čuva **7 dnevnih + 4 tjedne** generacije i dnevne Storage Box snapshote. Ne briše zdravu staru generaciju samo zato što je pokušao novu.
4. Posao šalje **success** tek po dovršenoj udaljenoj provjeri i retenciji. Pri pogrešci šalje `/fail`, a izostanak posla izaziva alarm po isteku tolerancije. Za svaku produkcijsku migraciju traži **novi uspješan off-server dump prije izmjene sheme**. Dnevni dump od sinoć nije zamjena za tu provjeru.
5. Na **prvoj objavi** workflow najprije podigne samo bazu i trajni volumen, čeka `pg_isready` te osigura pristup backupu. I praznu novoimenovanu bazu može kopirati prije prve migracije. Prvi koristan dump s rječnikom i probnom igrom napravi odmah nakon inicijalizacije. Pri prvoj instalaciji zapiši puno ime produkcijskog volumena i Compose projekta. Druga objava i prelazak iz bete u rani pristup moraju koristiti isti volumen i zadržati postojeće račune. Na produkciji ne koristi `docker compose down -v`, `docker volume prune` ili testni seed koji briše podatke. [PostgreSQL · pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html) · [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html)

### 8.2 Tvoja provjera timera i alarma

**Prvo** agent isporučuje i instalira verzionirane jedinice. Imena ispod su ugovor iz projekta. Ako ih je implementirao drukčije, traži točne naredbe uz PR. Ako `systemctl` kaže `Unit … could not be found`, ovaj korak nije postavljen.

**Ubuntu · kaladont**, nakon instalacije jedinica i nakon što produkcijska baza postoji:

```bash
sudo bash skripte/backup/instaliraj-backup-jedinice.sh   # ako još nije
sudo systemctl list-unit-files 'kaladont-*'
sudo systemctl list-timers --all 'kaladont-*'
sudo systemctl start kaladont-backup.service
sudo systemctl show kaladont-backup.service -p Result -p ExecMainStatus
sudo journalctl -u kaladont-backup.service --since '30 minutes ago' --no-pager
sudo /usr/local/lib/kaladont/kaladont-backup-status.sh
```

Očekuješ termin sljedeće izvedbe, `Result=success`, `ExecMainStatus=0`, novi udaljeni objekt i prijavljen uspjeh na Healthchecksu. `oneshot` servis može nakon uspjeha biti neaktivan do idućeg pokretanja. Uključi `Persistent=true` u timeru i provjeri operativni UTC. **04:00 UTC je 05:00 zimi ili 06:00 ljeti u Hrvatskoj.**

U **Healthchecks.io** napravi zasebne provjere za backup i disk, u UTC-u i s razumnim vremenom tolerancije za trajanje posla. Disk servis signalizira pogrešku iznad 80 % zauzeća. U **UptimeRobotu** dodaj HTTPS monitor za `https://kaladont.hr/zdravlje` svakih 5 minuta, očekuj 200. Probaj alarm i oporavak kontroliranim testom prije javne promocije. Ako ti je testni alarm prihvatio servis, a e-mail nije stigao do čovjeka, nadzor još nije gotov. [Healthchecks · postavljanje](https://healthchecks.io/docs/configuring_checks/) · [UptimeRobot](https://uptimerobot.com/help/)

### 8.3 Prvi povrat i proba gubitka cijelog stroja

**Povrat baze radiš iz preuzete udaljene kopije.** Agentov alat za drill mora odbiti živu bazu/volume i neodređeni cilj. U produkciji je cilj zaseban privremeni PostgreSQL na izoliranoj mreži ili bez mreže, bez javnog porta. Tijekom mjesečne probe na produkcijskom VPS-u privatni `age` ključ koristiš samo privremeno u zaštićenom RAM direktoriju, uz prava `600` i čišćenje na kraju. Podaci produkcijskih igrača ne idu na staging.

- Provjeri slobodan disk/RAM, identitet kopije, vanjski SHA-256, dešifriranje i `pg_restore --list`. Zatim **izvrši stvarni `pg_restore` s prekidom na grešci** u praznu probnu bazu. Sačuvaj izlazni status i provjeri referencijalni integritet te ID i rezultate poznate igre.
- Usporedi broj očekivanih riječi i stanje poznatih igrača, igara i poteza u vraćenoj kopiji. Uspoređuj sa stanjem u vrijeme backupa, ne s naknadnim živim brojem. Ne upisuj identitete osoba ili sadržaj dumpa u javni repo. Zapiši vrijeme, SHA-256, naziv generacije i rezultat, ukloni samo probne resurse i ponovno provjeri živu aplikaciju.
- **Prije širokog poziva** izvedi i obnovu na privremenom zamjenskom VPS-u. Iskoristi izoliranu mrežu, privremeni testni IP/ime i spriječi slanje korisničkih mailova ili lažnih produkcijskih heartbeatova. Najsigurnije je probu obaviti prije stvarnih igrača. Iz trezora rekonstruiraj pristup, podigni isti poznato-zdravi digest, vrati kopiju u novi volumen i provjeri zdravlje, HTTPS, pristup administratora i cijelu igru. Zapiši trajanje do 4 sata. Stvarno preuzimanje produkcijskog IP-a možeš uvježbati odgovarajućim probnim IP-om istog tipa. Kod pravog kvara odvoji sačuvani Primary IP s ugašenog starog stroja i dodijeli ga ugašenom zamjenskom stroju u istoj lokaciji prije pokretanja. Na novom stroju potvrdi novi SSH host fingerprint kroz konzolu i ažuriraj `PROD_SSH_KNOWN_HOSTS`, inače će ispravno pinani deploy odbiti vezu.
- Probu baze ponavljaj **mjesečno**, a obnovu cijelog servera **svakih šest mjeseci**. U dogovorenom ranom terminu potvrdi i povrat prethodnog aplikacijskog digesta unutar 15 minuta nad unaprijed kompatibilnom shemom. U prvoj objavi još nema prethodne produkcijske verzije. Pad tada zadržava objavu zatvorenom, uz dijagnostiku i kontrolirani ponovni pokušaj.


### Primjer cijele probe sa sintetičkim podacima na stagingu

Ako želiš s agentom **osobno vidjeti što radi `pg_restore`**, ovo je izolirana proba za postojeći staging. Preduvjeti su dovoljno mjesta za drugu kopiju baze, aktivan servis `baza`, dostupni `age` i `openssl` te ranije verificirani pristup **staging** Box podračunu. Izvodi se izvan opterećenja. Za pravu produkcijsku kopiju koristi verzionirani, testirani postupak iz PR-a na produkcijskom stroju.

1. Na stagingu kao `kaladont` provjeri `hostname`, `df -h` i `free -h`, pa pokreni `sudo -i`. U istom root terminalu pripremi radnu mapu i preuzmi datoteku s Boxa:

```bash
umask 077
proba=$(mktemp -d /var/tmp/kaladont-proba.XXXXXXXX)
cd "$proba"
read -r -p 'Korisnik@host staging Box podračuna iz konzole: ' box
read -r -p 'Putanja do namjenskog SSH ključa staging Boxa: ' boxkey
read -r -p 'Putanja do provjerenog known_hosts za Box na portu 23: ' boxhosts
sftp -P 23 -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$boxhosts" -i "$boxkey" "$box"
```

2. Kad prompt postane `sftp>`, upiši `ls`, po potrebi `cd` u direktorij kopija, zatim `get TOCNO_IME_UDALJENE_KOPIJE kopija.age` i `bye`. Zamijeni veliko ime stvarnim imenom iz `ls`. U root terminalu provjeri `sha256sum "$proba/kopija.age"` prema zapisu o originalnom backupu. Sljedeći blok ponavlja tu provjeru i prekida se na nepodudarnosti. Pripremi privatni **staging** ključ iz trezora za unos u editor. Ne lijepi ga u naredbeni red.

```bash
(
  set -euo pipefail
  umask 077
  cd /opt/kaladont
  test -f docker-compose.staging.yml
  read -r -p 'Očekivani SHA-256 iz zapisa backupa: ' ocekivani
  [[ "$ocekivani" =~ ^[0-9a-fA-F]{64}$ ]]
  printf '%s  %s\n' "$ocekivani" "$proba/kopija.age" | sha256sum --check --status
  db=$(docker compose -f docker-compose.staging.yml ps -q baza)
  test -n "$db"
  pgslika=$(docker inspect --format '{{.Image}}' "$db")
  ram=$(mktemp -d /dev/shm/kaladont-restore.XXXXXXXX)
  cid=''
  pocisti() {
    rm -f -- "$ram/identity" "$ram/identity~"
    rmdir -- "$ram" || true
    if [ -n "$cid" ]; then docker stop "$cid" >/dev/null || printf 'Provjeri je li probni kontejner zaustavljen: %s\n' "$cid" >&2; fi
  }
  trap pocisti EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  nano "$ram/identity"
  test -s "$ram/identity"
  POSTGRES_PASSWORD=$(openssl rand -hex 32)
  export POSTGRES_PASSWORD
  cid=$(docker run -d --rm --network none -e POSTGRES_PASSWORD \
    -e POSTGRES_DB=kaladont_drill "$pgslika")
  for i in {1..60}; do
    if docker exec "$cid" pg_isready -h 127.0.0.1 -U postgres -d kaladont_drill >/dev/null 2>&1; then break; fi
    sleep 2
  done
  docker exec "$cid" pg_isready -h 127.0.0.1 -U postgres -d kaladont_drill
  age -d -i "$ram/identity" "$proba/kopija.age" | docker exec -i "$cid" \
    pg_restore --exit-on-error --no-owner --no-acl -U postgres -d kaladont_drill
  docker exec "$cid" psql -v ON_ERROR_STOP=1 -U postgres -d kaladont_drill -c \
    'SELECT (SELECT count(*) FROM rijeci) AS rijeci, (SELECT count(*) FROM igraci) AS igraci, (SELECT count(*) FROM partije) AS igre, (SELECT count(*) FROM potezi) AS potezi;'
  docker exec -it "$cid" psql -U postgres -d kaladont_drill
)
```

3. Dok je otvoren `kaladont_drill=#`, upiši `SELECT id FROM partije;` i provjeri zabilježeni ID. Za tu igru usporedi spremljene riječi, primjerice `SELECT rijec FROM potezi WHERE partija_id = 'OVDJE_STVARNI_UUID' ORDER BY redni_broj;`. Upiši `\q` za izlaz. Blok zatvara točno onaj probni kontejner čiji je ID upravo stvorio. `--rm` uklanja njegov anonimni volume. Ključ i dešifrirani podaci ne ostaju kao dump na disku. `--no-owner --no-acl` ovdje provjeravaju podatke u izoliranoj bazi; u punoj obnovi još treba dokazati stvarne DB uloge i prava aplikacije.
4. Zabilježi rezultat, provjeri živi staging `/zdravlje` i ukloni preuzetu **lokalnu probnu** kopiju kad više nije potrebna (`rm -- "$proba/kopija.age"` zatim `rmdir -- "$proba"`). Udaljena generacija ostaje. Ako probni broj riječi ili očekivana igra nisu ispravni, ne prelazi na narudžbu produkcijskog VPS-a.

**Privatna evidencija jedne probe**

| Datum i vrijeme UTC | Okruženje i commit/digest | Kopija i SHA-256 | Izolirani cilj i dokaz provjere | Trajanje | Tko je provjerio / rezultat |
|---|---|---|---|---|---|
| upiši | upiši | upiši | npr. poznata igra, broj riječi, upisi i alarm | upiši | prošlo / za popraviti |

<a id="objava"></a>

## 9. Prvi produkcijski deploy i provjera stvarne igre

**Tek nakon što je novi workflow spojen i testiran.** Otvori GitHub **Actions → Promoviraj produkciju → Run workflow** (predloženi naziv iz repozitorija). Odaberi `main` i zalijepi puni digest provjerenog staging izdanja. Sačuvaj identitet releasea i broj runa. Ako nema gumba/workflowa, taj dio tek treba implementirati. Ručno podizanje Composea ne izvršava samo od sebe migracije, prvi uvoz ili dodjelu administratora.

Redoslijed koji tražiš u sažetku prvog deploya:

1. Potvrda da odabrani digest postoji u GHCR-u, pripada uspješnom CI-ju i tom istom staging deployu koji si osobno provjerio.
2. Priprema produkcijskog Composea i Caddyfilea, baza na trajnom produkcijskom volumenu, svježi provjereni off-server backup, zatim migracije. Uvoz pravog hrLexa prema inicijalizacijskom postupku. Ako se uvoz prekine između grupa, ponovi idempotentan uvoz do pune provjere, ne označavaj djelomičan rječnik gotovim.
3. Pokretanje aplikacije i Caddyja, izdavanje TLS certifikata i javni health koji prijavljuje pravi commit i digest. Produkcijski `Caddyfile` usmjerava `www.kaladont.hr` na `kaladont.hr`. Staging podaci i računi nisu dio inicijalizacije.
4. Registriraj svoj stvarni operaterski račun, potvrdi njegov e-mail pa ga provjerenim jednokratnim alatom promoviraj u administratora. Zapiši naredbu iz odobrenog PR-a u privatnu operativnu bilješku. Napravi jedan produktivan backup nakon što postoji poznata probna igra.

**PowerShell · provjera izvana**

```powershell
curl.exe -sSI http://kaladont.hr/
curl.exe -sSI https://www.kaladont.hr/
$prod = Invoke-RestMethod 'https://kaladont.hr/zdravlje'
$prod | Select-Object ok,baza,brojRijeci,verzija,digest,aktivnePartije
```

Očekuješ preusmjeravanje na `https://kaladont.hr/`, valjan HTTPS, `ok=True`, `baza=dostupna` i vrijednosti iz odabranog runa. Usporedi broj riječi s očekivanim importom i stagingom za istu verziju podataka. `brojRijeci > 0` sam po sebi ne otkriva djelomičan uvoz ili mali CI fixture.

**Ubuntu · kaladont · ne ispisuje tajne**

```bash
sudo -iu deploy sh -c 'cd /opt/kaladont && docker compose -f docker-compose.prod.yml ps'
sudo -iu deploy sh -c 'cd /opt/kaladont && id=$(docker compose -f docker-compose.prod.yml ps -q aplikacija) && docker inspect --format "{{.Config.Image}}" "$id"'
sudo ss -lnt
df -h
free -h
```

U Composeu su zdravi baza i aplikacija, Caddy radi. Ispisana Docker referenca mora imati puni očekivani digest. Javno dostupni trebaju biti TCP 22/80/443, a 3000/5432 samo interno. Posebno provjeri s vlastitog računala da su 3000 i 5432 nedostupni (`Test-NetConnection $ProdIp -Port 5432` i isto za 3000). Docker objavljeni portovi mogu zaobići UFW, pa provjera obuhvaća Compose, Hetzner Firewall i vanjsku dostupnost.

**Probna igra prije pozivanja ljudi**

| Test | Rezultat kojim prolazi |
|---|---|
| Registracija, potvrda i reset | Stiže pravi mail na barem dva kontrolirana pretinca. Link vodi na produkciju. Reset se može iskoristiti jednom. Stara sesija nakon reseta gubi pristup. |
| Gost i prijava | Gost igra, zatim se registrira/prijavi na istom uređaju. Stari gost token ne dobiva pristup računu preko HTTP-a ili socketa. |
| Četveroboj i Dvoboj | Različite neovisne sesije, uključujući mobitel. Od reda do rezultata rade unos riječi, kriva riječ, timer, eliminacija i ponovni ulazak. Rezultat se trajno sprema jednom. |
| Privatna soba, profil i ljestvica | Otvaranje sobe ne traži ručni refresh, nakon osvježavanja profil/ljestvica prikazuju stranicu, privatna pobjeda se ne udvostručuje i ne kvari javnu ljestvicu. |
| Prvi igrači kad je red prazan | Ako su javni botovi dio launch plana, potvrdi stvarni fond i ulazak u oba moda uz završenu igru. Trening se može odigrati bez drugih ljudi. |
| Admin, podrška, nadzor | Admin vidi prijavu i probni alarm. Običan korisnik ne može u admin. `info@kaladont.hr` prima poruke, a `/uvjeti` i `/privatnost` su objavljeni i točni. |
| Opterećenje prvog vala | Na stagingu provedite postojeći miješani test s realnim rječnikom za očekivanu vršnu posjećenost. Po kriteriju projekta p95 poteza ≤ 250 ms, provjerite i pogreške, završno spremanje, memoriju, event loop i prekide veza. Kapacitet staginga ne prenosi se automatski na drugi tip procesora. Za školski razred isprobajte više uređaja iza jedne javne IP zbog limita handshaka. |

**Prije poziva djeci ili školama** uskladi stvarne uvjete igre, postupak registracije djece i ulogu roditelja. U privatnosti provjeri i traje li stvarno zadržavanje logova koliko stranica tvrdi. Ako obrađuješ podatke na temelju privole pri izravnoj ponudi usluge informacijskog društva djetetu, hrvatsko pravilo o dobi ima konkretne uvjete. Provjeri svoj model s nadležnom osobom prije takve kampanje. [AZOP · privola](https://azop.hr/privola/) · [Članak 19. hrvatskog provedbenog zakona](https://narodne-novine.nn.hr/clanci/sluzbeni/2018_05_42_805.html)

<a id="promocija"></a>

## 10. Odluka o promociji i prvi tjedan

**Prvi mali poziv.** Kad su sigurnost računa, cjelokupna proba oporavka i gore navedene provjere prošle, pošalji nekoliko poznatih igrača na `https://kaladont.hr`. To su već pravi produkcijski računi. Zapiši početak javnog praćenja, ne resetiraj podatke pri prelasku iz bete u rani pristup. Za prvi termin dogovori osobu koja prati inbox, prijave, admin nadzor i završene igre.

**Širi poziv.** Dokumentacija postavlja prag od **najmanje 20 dovršenih igara prvog vala bez kritične greške**. Prije objave streameru, školama ili zajednicama provjeri i prvu uspješnu redovitu noćnu kopiju te da se može doći do čovjeka preko `info@kaladont.hr`. Ako se rezultat gubi, reset računa nije siguran, baza se ne vraća ili veći broj igrača ne može završiti igru, odgodi sljedeći val, spremi dokaze i vrati se na staging. [Projektna pravila ranog pristupa](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/08-plan-razvoja/zajednica-i-rani-pristup.md)

| Ritam | Tvoja radnja |
|---|---|
| Svaki dan u početku | Otvori `/zdravlje`, zadnji backup check i novu generaciju na Boxu. Pregledaj završene igre, prekide, prostor diska i neriješene prijave. |
| Prije svake promjene | PR → zeleni CI → ista slika na stagingu → ručna provjera → ručna produkcijska promocija. Sačuvaj prethodni digest. Migracija počinje tek nakon potvrđenog novog off-server backupa. |
| Ako objava pokvari igru | Sačuvaj vrijeme, commit, prethodni digest i fazu pada. Ako je shema kompatibilna, promoviraj prethodni digest i potvrdi health. Povrat baze briše novije upise i pripada zasebnom incidentnom postupku. Na prvom izdanju bez prethodne verzije zatvori pristup i popravi uzrok. |
| Ako backup izostane | Zaustavi sljedeću migraciju. Provjeri disk, posao, podračun, ključ, udaljeni prostor i hash. Nakon popravka pokreni isti servis odmah i potvrdi novu udaljenu kopiju. |
| Tjedno / mjesečno | Tjedno provjeri veličinu/retenciju i snapshot te dogovor za zakrpe. Mjesečno izvrši pravi izolirani restore. Svakih šest mjeseci obnovi cijeli VPS i osvježi podatke za hitni pristup. |
| Ako ima najavljene nedostupnosti | Redovni deploy može prekinuti aktivnu igru. Biraj slabiji promet. Prema projektnom runbooku prekid dulji od pet minuta najavi najmanje 24 sata ranije u igri i na forumu. |

### Završna kartica prije poziva široj publici

- [ ] Znam commit, puni digest, rezultat staging probe i gdje je prethodna dobra verzija.
- [ ] Glavni server ima zaštićenu IPv4, siguran SSH i privatnu bazu. Provjerio sam da imam pristup i nakon gubitka laptopa.
- [ ] Imam svježu off-server kopiju, dokaz stvarno vraćene igre i izmjeren povrat cijelog servera unutar cilja.
- [ ] Verificirani mailovi, sigurni računi, uvjeti, privatnost i kontakt za pomoć rade.
- [ ] HTTPS, WebSocket, admin, alarm o kvaru **i** poruka oporavka rade.
- [ ] Najmanje 20 produkcijskih igara prvog kruga završilo je bez kritične greške i postoji prva redovita dnevna kopija.
- [ ] Imam termin, osobu koja prati sustav i mjesto gdje igrač prijavljuje problem. Link za promociju je **https://kaladont.hr**.

**Projektni postupci.** [Postava VPS-a](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/vodic-postava-vps.md) · [Vodič za početnike](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/operacije-for-dummies.md) · [Postupak objave i rollbacka](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/runbook-objava-i-rollback.md) · [Nadzor i dnevnici](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/nadzor-i-dnevnici.md) · [Incidentni postupak](https://github.com/josipmestrovic/kaladont/blob/c707029d526b532a8c36805d5191cfbf78007322/docs/07-operacije/incidentni-postupak.md)
