# Vodič: postava VPS-a od nule (staging i produkcija)

Ovo je **sažeti tehnički checklist** za postavu aplikacijskog VPS-a. Potpuno početničko objašnjenje svake naredbe, očekivanog rezultata i sigurne reakcije na grešku nalazi se u [Operacije for dummies](operacije-for-dummies.md). Kontekst i arhitektura definirani su u [produkciji i objavi](produkcija-i-objava.md) te [ADR-u 014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md).

> **STOP — ciljano stanje još nije implementirano.** Ne postoje svi potrebni Docker/Compose/Caddy artefakti, workflowi, operativni CLI alati, prošireni health check ni backup automatika. Ne kupovati niti postavljati novi VPS prema ovom dokumentu dok production-readiness lista iz početničkog vodiča nije potpuno zelena.

> **Zlatna pravila:** ništa se ne deploya ručno (objava ide kroz GitHub Actions — [CI/CD](ci-cd.md)); VPS ne klonira git repozitorij; stvarne IP adrese, ključevi, hashovi i lozinke nikad se ne zapisuju u repozitorij.

## Pojmovnik (60 sekundi)

| Pojam          | Što je to, ljudski                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| VPS            | Iznajmljeno virtualno računalo koje radi 24/7; „unmanaged" znači da ga mi održavamo                            |
| SSH            | Siguran način prijave na VPS iz terminala; umjesto lozinke koristi par ključeva (privatni ostaje kod tebe)     |
| Docker         | Pokreće aplikaciju u izoliranom kontejneru s točno određenim verzijama svega                                   |
| Docker Compose | Datoteka koja opisuje sve kontejnere jednog okruženja (aplikacija, baza, Caddy) i kako su povezani             |
| Image / digest | „Smrznuta" snimka aplikacije; digest je njezin jedinstveni otisak — isti digest = bajt-za-bajt ista aplikacija |
| GHCR           | GitHubov registar u koji CI sprema buildane slike, a VPS ih odande povlači                                     |
| DNS A zapis    | Uputa „ova domena pokazuje na ovu IP adresu"                                                                   |
| Caddy          | Reverse proxy: prima sav promet na 80/443, sam pribavlja HTTPS certifikate i prosljeđuje aplikaciji            |

## Korak 0 — preduvjeti prije kupnje VPS-a

1. Svi blokatori Faze 8 su riješeni; GitHubov Ubuntu runner gradi i smoke-testira produkcijsku amd64 sliku.
2. `main` je zaštićen obveznim zelenim CI-jem. Promjene idu kroz radnu granu i Pull Request; required reviewer se ne postavlja dok postoji jedan operater.
3. GitHub Environmenti `staging` i `produkcija` postoje, ali produkcija nema dodatno approval pravilo. Produkciju pokreće isključivo ručni workflow.
4. GitHub, Hetzner i Bitwarden računi imaju 2FA, a recovery kodovi i šifrirani Bitwarden izvoz postoje izvan računala.
5. Osobni administratorski SSH ključ postoji i njegov javni dio dodan je u Hetzner projekt. Privatni dio ostaje u korisničkom profilu/Bitwardenu i nikamo se ne šalje kao tekst.
6. Storage Box je postavljen sa zasebnim forumskim podračunom; postojeći Discourse backup poslan je izvan forumskog VPS-a i testno vraćen.
7. Staging Primary IPv4 i VPS stvaraju se prvi. Produkcijski resursi čekaju uspješan staging deploy i restore drill.
8. Resend je odabran, ali produkcijska aktivacija čeka provjeru DPA/EU obrade i SPF/DKIM zapisa kod XHostinga.

## Korak 1 — Stvori VPS

U Hetzner konzoli prvo stvori zasebnu **Primary IPv4** adresu u istoj lokaciji u kojoj radi forum. Isključi `Auto delete` i uključi zaštitu od brisanja. Zatim stvori x86/amd64 VPS s **Ubuntu 24.04 LTS**, najmanje 2 vCPU i 4 GB RAM-a, dodijeli mu tu IP adresu i postojeći osobni javni SSH ključ. IPv6/Primary IPv6 se u početnoj postavi ne dodaje.

Zapiši naziv, lokaciju, Primary IPv4 i očekivani SSH host fingerprint u Bitwarden. Stvarna vrijednost ne ulazi u git.

Prva prijava s Windowsa (PowerShell):

```powershell
ssh root@IP_ADRESA
```

## Korak 2 — Osnovno očvršćivanje (kao root)

```bash
# Ažuriraj sustav
apt update && apt upgrade -y

# Automatske sigurnosne zakrpe
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Osobni administrativni korisnik (upiši njegovu zasebnu jaku lozinku kad pita)
adduser kaladont
usermod -aG sudo kaladont

# Prekopiraj SSH ključ roota novom korisniku
rsync --archive --chown=kaladont:kaladont ~/.ssh /home/kaladont

# Deploy korisnik nema sudo ni lozinku; njegov ključ dodaje se kasnije
adduser --disabled-password --gecos "" deploy
```

Isključi prijavu roota i prijavu lozinkom:

```bash
printf 'PermitRootLogin no\nPasswordAuthentication no\n' > /etc/ssh/sshd_config.d/99-kaladont.conf
systemctl restart ssh
```

**Prije odjave** u drugom terminalu provjeri da `ssh kaladont@IP_ADRESA` radi i da `sudo -v` prihvaća lozinku korisnika `kaladont`. Tek tada zatvori root sesiju. Deploy korisnik nikad ne dobiva sudo ovlasti.

## Korak 3 — Cloud Firewall, UFW i fail2ban

U Hetzner Cloud Firewallu prvo dopusti dolazni TCP promet samo na 22, 80 i 443 za IPv4 te pridruži firewall VPS-u. SSH port 22 ostaje javno dostupan jer GitHub-hosted runneri nemaju mali stabilni raspon izlaznih IP adresa; zaštita su isključivo ključevi, pinani host fingerprint, isključene lozinke i fail2ban.

Na VPS-u kao `kaladont`, uz `sudo`:

```bash
sudo apt install -y ufw fail2ban
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable          # potvrdi s y
sudo systemctl enable --now fail2ban
```

Otvoreno je samo ono što mora biti: SSH, HTTP, HTTPS. Baza nikad nije javno dostupna (živi u Docker mreži).

**Važno:** Dockerovi objavljeni portovi mogu zaobići očekivana UFW pravila. Compose zato smije javno objaviti samo Caddyjeve 80/443; aplikacija 3000 i PostgreSQL 5432 ostaju bez host `ports` mapiranja. To se provjerava nakon svakog prvog deploya naredbom za popis slušanih portova.

## Korak 4 — Docker

Instaliraj Docker Engine iz službenog Docker apt repozitorija za Ubuntu 24.04, zajedno s paketima `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` i `docker-compose-plugin`. Ne koristi convenience skriptu `get.docker.com` ni distribucijski paket `docker.io` za produkcijsku postavu.

Zatim dodaj samo korisnika `deploy` u Docker grupu i provjeri servis:

```bash
sudo usermod -aG docker deploy
sudo systemctl enable --now docker containerd
sudo -iu deploy
docker run --rm hello-world
exit
```

Konfiguriraj Dockerov `local` logging driver ili ograničenja `max-size`/`max-file` prije aplikacijskog deploya. Članstvo u `docker` grupi praktički je root ovlast na tom stroju; zato ključ korisnika `deploy` služi isključivo GitHub Actionsu i razlikuje se po okruženju.

## Korak 5 — Deploy direktorij i `.env`

```bash
sudo mkdir -p /opt/kaladont
sudo chown deploy:deploy /opt/kaladont
sudo chmod 750 /opt/kaladont
cd /opt/kaladont
```

U njemu žive tri stvari (workflow ih osvježava pri objavi — git checkout nije potreban):

- verzionirani `docker-compose.staging.yml` **ili** `docker-compose.prod.yml`;
- verzionirani staging ili produkcijski Caddyfile;
- `.env`, koji se stvara ručno iz dokumentirane matrice varijabli i nikad ne dolazi iz repozitorija.

```bash
sudo -u deploy touch /opt/kaladont/.env
sudo chmod 600 /opt/kaladont/.env
```

Konačan popis varijabli mora potjecati iz implementirane centralne konfiguracijske sheme. Najmanje obuhvaća internu `BAZA_URL`, jedinstvenu `SESIJA_TAJNA`, oznaku okruženja, digest/verziju, Resend konfiguraciju i staging email allowlistu. Privremeni multiplayer staging nema Caddy Basic Auth jer bi izazivao ponavljajuće promptove na Socket.IO prometu; prije šireg dijeljenja treba uvesti VPN, IP allowlist ili drugi gateway. `ONEMOGUCI_TIMER_POTEZA` ne postavlja se; aplikacija mora odbiti produkcijski/staging start ako je uključena.

PostgreSQL i Caddy navode se točnom verzijom i digestom, bez `latest`. Aplikacija se navodi isključivo punim GHCR digestom.

## Korak 6 — Deploy ključ za GitHub Actions

Na svojem računalu generiraj **zaseban** par ključeva po okruženju (ne administratorski):

```powershell
ssh-keygen -t ed25519 -f deploy_kaladont_staging -C "actions-staging"
```

- Javni dio dodaj u `/home/deploy/.ssh/authorized_keys` uz vlasništvo `deploy:deploy` i prava 700/600.
- Privatni dio spremi u odgovarajuću GitHub Environment tajnu (`STAGING_SSH_KLJUC` ili `PROD_SSH_KLJUC`).
- Iz Hetzner console pristupa neovisno provjeri SSH host fingerprint i spremi puni `known_hosts` zapis u `STAGING_SSH_KNOWN_HOSTS` ili `PROD_SSH_KNOWN_HOSTS`.
- Environment host je odgovarajuća Primary IPv4, a korisničko ime fiksno je `deploy` u workflowu.
- Sigurnom ručnom probom potvrdi ključ, zatim lokalnu privatnu kopiju pohrani u Bitwarden ili sigurno ukloni.

VPS ne dobiva trajni GHCR token. Workflow tijekom svakog deploya prosljeđuje kratkotrajni `GITHUB_TOKEN` samo procesu `docker login --password-stdin`, povlači digest i odmah uklanja Docker vjerodajnice.

## Korak 7 — DNS preko XHostinga

XHosting podršci pošalji zahtjev za A zapis `staging.kaladont.hr` prema zaštićenoj staging Primary IPv4. Za produkciju se, tek nakon staging dokaza, traže A zapisi `kaladont.hr` i `www.kaladont.hr` prema produkcijskoj Primary IPv4. `analitika` se ne dodaje dok se naknadno ne uvodi Umami; AAAA zapisi se ne dodaju u početnoj postavi.

Provjera prije nastavka, iz Windows PowerShella:

```powershell
Resolve-DnsName staging.kaladont.hr -Type A
```

Rezultat mora sadržavati točno sačuvanu staging Primary IPv4. Caddy ne može izdati certifikat dok DNS i portovi 80/443 nisu ispravni.

## Korak 8 — Prvi deploy

1. Merge u `main` nakon zelenog CI-ja pokreće automatski staging deploy ([CI/CD specifikacija](ci-cd.md)).
2. Workflow validira konfiguraciju, povlači točan digest, primjenjuje migracije i provjerava je li rječnik prazan.
3. Samo pri prvom praznom rječniku workflow iz istog digesta pokreće puni hrLex uvoz; kasniji deployi ga preskaču.
4. Workflow pokreće aplikaciju i zahtijeva javni `/zdravlje` 200 s dostupnom bazom, `brojRijeci > 0` i očekivanim digestom.
5. Bez Basic Autha `/zdravlje` mora biti dostupan, a ostale staging rute moraju vratiti 401. S vjerodajnicama mora raditi cijeli web i WebSocket.
6. Ručno odigraj cijelu partiju u četiri odvojene sesije, testiraj Resend samo prema točnoj staging allowlisti i jednokratnim CLI alatom dodijeli prvi admin račun.
7. Napravi šifrirani staging dump na privremeni Storage Box podračun i vrati ga u praznu izoliranu bazu.
8. Tek nakon svih zelenih koraka ponovi provisioning za produkciju i ručno promoviraj staging digest.

## Korak 9 — Backup i nadzor

- Produkcija dobiva zaseban Storage Box podračun, dnevni šifrirani `pg_dump`, 7 dnevnih + 4 tjedne kopije, dnevne Storage Box snapshotove i **odmah testirano vraćanje**: [runbook backupa](runbook-backup-i-vracanje.md).
- Uključi Hetzner daily backup produkcijskog VPS-a kao pomoćni image backup, ne kao zamjenu za dump baze.
- Systemd timeri i server ostaju u UTC-u. Healthchecks.io prati izvršenje backupa i provjere diska; UptimeRobot prati `https://kaladont.hr/zdravlje`. Oba šalju samo e-mail alarme.
- Upiši stroj, digest, testnu partiju i restore rezultat u [evidenciju održavanja](odrzavanje.md).

## Završna kontrola (checklist)

- [ ] Ubuntu 24.04 LTS, x86/amd64, ista lokacija kao forum, bez Primary IPv6
- [ ] Primary IPv4: `Auto delete` isključen i zaštita od brisanja uključena
- [ ] SSH: root i lozinka odbijeni; `kaladont` ulazi osobnim ključem; `deploy` samo zasebnim Actions ključem
- [ ] SSH host fingerprint pinan je u odgovarajućem GitHub Environmentu
- [ ] Hetzner Cloud Firewall i `sudo ufw status`: samo 22/80/443
- [ ] Javno slušaju samo 22/80/443; aplikacija i PostgreSQL nisu objavljeni na hostu
- [ ] `https://<domena>/zdravlje` vraća 200 uz `brojRijeci > 0`
- [ ] `http://` preusmjerava na `https://`; na produkciji `www` preusmjerava na golu domenu
- [ ] Partija odigrana kroz preglednik (WebSocket radi kroz Caddy)
- [ ] Staging bez vjerodajnica vraća 401 osim `/zdravlje`; prisutan je `X-Robots-Tag: noindex`
- [ ] Resend na stagingu šalje samo točno allowlistanim adresama; produkcijski SPF/DKIM prolaze provjeru
- [ ] Backup je šifriran, prenesen i **vraćen** u praznu izoliranu bazu
- [ ] UptimeRobot i Healthchecks.io poslali su probni e-mail alarm i poruku oporavka
- [ ] Deploy ključ radi samo za `deploy`; nema trajnog GHCR tokena; tajne nisu u gitu ni logovima
- [ ] Produkcijski VPS nije stvoren prije zelenog staging deploya i restore drilla
