# ADR-014: Operativni model MVP-a

- **Status:** prihvaćen
- **Datum:** 2026-09-08
- **Djelomično zamjenjuje:** [ADR-009](009-hetzner-docker-caddy.md) i [ADR-011](011-staging-promocija-digesta.md)

## Kontekst

ADR-009 odabrao je Hetzner, Docker Compose i Caddy, a ADR-011 uveo zasebna staging i produkcijska okruženja te promociju istog image digesta. Prije implementacije operativne faze trebalo je precizirati stvarnu topologiju, zaštitu staginga, samostalni način rada, ciljeve oporavka i granicu MVP-a. Razvojno računalo je Windows bez dostupne virtualizacije; produkcijska slika zato se gradi i testira na GitHubovu Linux runneru, ne lokalno.

## Odluka

### Topologija i dostupnost

Kaladont u MVP-u koristi **tri VPS-a ukupno**:

1. postojeći VPS za Discourse forum;
2. staging VPS za aplikaciju, Caddy i vlastiti PostgreSQL;
3. produkcijski VPS za aplikaciju, Caddy i vlastiti PostgreSQL.

PostgreSQL staginga i produkcije nije na zasebnom VPS-u: u svakom okruženju radi na istom stroju kao aplikacija, u privatnoj Docker mreži i bez javno objavljenog porta. Produkcija je svjesno jedna točka kvara. Baza se izdvaja tek kada mjereno opterećenje ili stroži cilj dostupnosti opravdaju dodatnu mrežnu i operativnu složenost.

Staging i produkcija koriste Ubuntu 24.04 LTS na x86/amd64 instancama u istoj Hetzner lokaciji kao forum. U početku se koristi samo IPv4. Oba aplikacijska VPS-a imaju zasebnu, zaštićenu Primary IPv4 adresu kojoj je isključeno automatsko brisanje; pri obnovi se ista adresa može dodijeliti zamjenskom VPS-u u istoj lokaciji.

### Staging i objava

Staging je stalno uključen, ima vlastitu bazu, tajne, rječnik i isključivo sintetičke račune. Produkcijski podaci nikad se ne kopiraju na staging. Za privremeno ručno multiplayer testiranje staging nema Caddy Basic Auth jer browser HTTP Basic izazovi nisu pouzdani preko Socket.IO polling/upgrade zahtjeva; cijelo okruženje šalje `X-Robots-Tag: noindex`, što nije kontrola pristupa. Prije šireg dijeljenja staginga treba uvesti VPN, IP allowlist ili drugi session-based gateway.

Početni razvoj i objava imaju jednog operatera:

1. promjena nastaje na radnoj grani;
2. otvara se Pull Request (PR);
3. PR se spaja u `main` tek nakon zelenog CI-ja;
4. merge automatski objavljuje staging;
5. operater provjerava staging;
6. operater ručno pokreće produkcijski workflow s digestom koji je prošao staging.

Nema obveznog drugog reviewera ni dodatnog GitHub Environment odobrenja. Ručno pokretanje produkcijskog workflowa namjerna je kontrolna točka. Produkcija ne rebuilda sliku: povlači **isti privatni GHCR image digest** koji je provjeren na stagingu. VPS ne čuva trajni registry token; workflow koristi kratkotrajni `GITHUB_TOKEN` s najmanjim potrebnim ovlastima i nakon povlačenja uklanja Docker vjerodajnice.

Produkcijski deploy može prekinuti aktivne partije. Izvodi se u vrijeme slabog prometa, bez automatske provjere aktivnih partija i bez automatskog rollbacka. Ako provjera nove verzije ne prođe, operater ručno promovira prethodni poznato-zdravi digest; cilj je vratiti uslugu unutar 15 minuta. Migracije baze moraju biti unatrag kompatibilne barem jedan ciklus objave.

### Sigurnost i tajne

Hetzner Cloud Firewall i lokalni UFW dopuštaju samo SSH, HTTP i HTTPS. Compose javno objavljuje samo Caddyjeve portove 80 i 443; aplikacija i baza ostaju u privatnoj Docker mreži. SSH koristi ključeve, pinane host fingerprintove, isključenu root prijavu i prijavu lozinkom te fail2ban.

Osobni administrativni korisnik `kaladont` ima sudo ovlasti. Zasebni korisnik `deploy` nema sudo, ali je član Docker grupe radi objave; prihvaća se da Docker grupa praktično daje root-ekvivalentne ovlasti. Deploy ključevi odvojeni su po okruženju. Tajne se čuvaju u Bitwardenu, GitHub Environment tajnama ili root-only/VPS konfiguraciji, ovisno o vlasniku tajne, i nikad u repozitoriju.

DNS za `kaladont.hr` uređuje XHosting podrška. Koriste se A zapisi bez Cloudflare proxyja i bez početnih AAAA zapisa. Zaštićene Primary IPv4 adrese uklanjaju DNS promjenu iz redovnog postupka obnove VPS-a.

### Backup i oporavak

Ciljevi su:

- **RPO:** najviše 24 sata izgubljenih produkcijskih podataka;
- **RTO:** povrat cijele produkcijske usluge unutar 4 sata;
- **rollback loše objave:** povrat prethodnog digesta unutar 15 minuta.

Autoritativni backup baze je dnevni `pg_dump` u custom formatu, šifriran javnim `age` ključem i prenesen na Hetzner Storage Box. Privatni `age` ključ ostaje u Bitwardenu i šifriranom offline recovery izvozu, ne na VPS-u. Jedan Storage Box koristi zasebne podračune za forum i produkciju; privremeni staging podračun služi dokazivanju postupka prije kupnje produkcijskog VPS-a. Zadržava se 7 dnevnih i 4 tjedne kopije, a Storage Box ima dnevne snapshotove.

Hetznerov dnevni backup cijelog produkcijskog i forumskog VPS-a pomoćni je sloj za brzu obnovu stroja. Nije autoritativni backup baze: snimka aktivnog diska nema zajamčenu konzistentnost i briše se zajedno sa serverom. Prije svake produkcijske migracije izrađuje se i potvrđuje svježi off-site dump.

Vraćanje produkcijskog dumpa testira se mjesečno u izoliranoj privremenoj bazi na produkcijskom VPS-u. Potpuna obnova VPS-a testira se prije lansiranja i zatim svakih šest mjeseci. UptimeRobot nadzire javni `/zdravlje`, a Healthchecks.io očekuje heartbeat poslova backupa i provjere diska; alarmi dolaze e-mailom. Serveri i systemd timeri koriste UTC.

Storage Box i VPS-ovi ostaju kod istog pružatelja. Za MVP se prihvaća da ova postava ne štiti od potpunog gubitka Hetzner računa ili cijelog pružatelja.

### Granica lansiranja

Umami nije preduvjet javnog ranog pristupa. Početno se koriste vlastite metrike iz baze, a Umami se dodaje nakon stabilizacije kao zaseban, provjeren korak na produkcijskom VPS-u.

Produkcijski VPS ne stvara se dok staging ne prođe puni deploy, ručnu partiju, šifrirani backup i restore drill. Dokumentirane naredbe za nepostojeće Docker, CI/CD, backup i administrativne artefakte opisuju ciljano stanje i ne smiju se izvršavati dok odgovarajući production-readiness kriteriji nisu ispunjeni.

## Razmotrene alternative

- **Zaseban VPS za svaku bazu** — odbačeno za MVP; povećava trošak, mrežnu površinu i broj kvarova bez mjerljive potrebe.
- **Javni staging samo uz `noindex`** — odbačeno; `noindex` nije kontrola pristupa.
- **Automatska produkcija nakon staginga** — odbačeno; operater mora svjesno odabrati verziju i termin objave.
- **Obvezan drugi reviewer** — odbačeno dok postoji jedan stvarni operater; dokumentacija ne smije stvarati lažni sigurnosni proces.
- **Trajni GHCR token na VPS-u** — odbačeno; povećava posljedice kompromitacije stroja.
- **Samo Hetzner backup diska** — odbačeno kao nedovoljan i teško provjerljiv backup PostgreSQL-a.
- **Backup kod drugog pružatelja** — odgođeno; dodatna neovisna kopija razmatra se nakon MVP-a.
- **Umami prije lansiranja** — odbačeno kao nepotreban bloker prvog produkcijskog izlaska.
- **Visoka dostupnost s više aplikacijskih čvorova** — odgođeno do stvarnog opterećenja i strožih ciljeva dostupnosti.

## Posljedice

- Početni sustav ostaje financijski i operativno malen, ali kvar produkcijskog VPS-a prekida cijelu igru do obnove.
- Staging je dovoljno sličan produkciji za provjeru Linux slike, migracija, Caddyja, TLS-a i WebSocketa, ali nije kopija produkcijskih podataka.
- Oporavak ovisi o redovitim dumpovima, valjanom `age` ključu, sačuvanoj Primary IPv4 adresi i stvarno izvedenim drillovima.
- Jedan operater može sam objaviti pogrešnu promjenu; ublažavanje su PR, zeleni CI, staging, ručna promocija i jasan rollback, ne nepostojeći ljudski reviewer.
- Postava foruma ostaje odvojena, ali njegov postojeći lokalni backup mora se kao prioritet kopirati na zaseban Storage Box podračun i testno vratiti.
- ADR definira ciljano operativno stanje. Dok pripadajući artefakti ne postoje, produkcijski deploy nije moguć.
