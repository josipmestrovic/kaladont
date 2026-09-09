# Sigurnost i privatnost

> **Status:** aplikacijska pravila u ovom dokumentu jesu sigurnosni zahtjevi; dio je već implementiran, a infrastrukturne kontrole i produkcijske integracije još su ciljano stanje Faze 8. Prije servera provjeriti STOP listu u [Operacije for dummies](operacije-for-dummies.md). Operativni model definira [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md).

## Autentikacija i računi

- Lozinke: **argon2id** (memorijski tvrd), nikad u logovima; minimalna duljina 8 znakova bez glupih pravila kompleksnosti.
- Sesije: httpOnly + Secure + SameSite=Lax kolačić s potpisanim tokenom; Socket.IO handshake prima isti token.
- Gost identitet: nasumični UUID u localStorage — ne otisak uređaja, ne kolačić za praćenje.
- Potvrda emaila poveznicom s istekom (24 h); reset lozinke istim mehanizmom, bez otkrivanja postoji li račun.

## Validacija ulaza — server ne vjeruje nikome

- Svaka Socket.IO poruka i HTTP tijelo validiraju se shemom (zod) izvedenom iz tipova u `protokol.ts` — nevaljan payload = odbijen, bez rušenja.
- Riječ: normalizacija (trim, mala slova, NFC Unicode normalizacija zbog dijakritika) **pa tek onda** provjera pravila.
- SQL injection: nemoguć uz Drizzle parametrizirane upite — string konkatenacija SQL-a je zabranjena konvencijom.
- XSS: nadimci i poruke prijava prikazuju se kao tekst (Svelte escapa automatski); nikad `{@html}` s korisničkim sadržajem.

## Rate limiting

| Resurs               | Ograničenje                                         | RS    |
| -------------------- | --------------------------------------------------- | ----- |
| Pokušaji poteza      | 3 u sekundi po igraču                               | RS-23 |
| Emoji reakcije       | 1 svake 2 s                                         | RS-22 |
| Prijave grešaka      | 5 na sat po identitetu                              | —     |
| Registracija/prijava | 5 pokušaja u 15 min po IP-u                         | —     |
| HTTP općenito        | razuman globalni limit po IP-u (Fastify rate-limit) | —     |

## Površina napada

- Hetzner Cloud Firewall i UFW dopuštaju samo SSH (22), HTTP (80) i HTTPS (443). Compose javno objavljuje samo Caddyjeve 80/443; aplikacija i PostgreSQL nemaju host port jer Dockerova pravila mogu zaobići očekivano UFW filtriranje.
- SSH koristi samo ključeve i pinane host fingerprintove. Root prijava i prijava lozinkom su isključene; fail2ban usporava automatizirane pokušaje. `StrictHostKeyChecking=no` nije dopušten ni ljudima ni workflowima.
- Osobni korisnik `kaladont` ima sudo. Korisnik `deploy` nema sudo, ali je član Docker grupe radi objave; Docker grupa daje praktično root-ekvivalentne ovlasti, pa svaki VPS ima zaseban deploy ključ koji služi samo GitHub Actionsu.
- Staging (`staging.kaladont.hr`) štiti jedan zajednički Caddy Basic Auth račun, osim javnog `/zdravlje`. Caddy prima samo Argon2id hash, ne plaintext lozinku. `X-Robots-Tag: noindex, nofollow` ostaje dodatna uputa tražilicama, ne sigurnosna kontrola.
- Staging ima vlastite sintetičke podatke, tajne i email allowlistu. Produkcijski dump, račun, email popis ni tajna nikad ne završavaju na stagingu.
- Sigurnosna zaglavlja (Caddy/SvelteKit): CSP bez inline skripti, `X-Content-Type-Options`, `Referrer-Policy`.
- Ovisnosti: Dependabot tjedno; `pnpm audit` u CI-ju (upozorenje, ne bloker).
- Third-party GitHub Actions pinaju se na puni commit SHA. PostgreSQL, Caddy i aplikacija pokreću se po točnoj verziji i digestu, nikad preko `latest` taga.

## Tajne i pristupi

Jedna tajna ima jedno autoritativno mjesto. Vrijednosti se nikad ne lijepe u issue, Pull Request, commit, dokument, screenshot, chat ili argument procesa.

| Mjesto                                    | Što smije sadržavati                                                                                                                                                  | Što ne smije sadržavati                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Bitwarden                                 | osobni SSH privatni ključ/recovery, deploy recovery kopije, Primary IPv4, Basic Auth plaintext, Storage Box glavni pristup, privatni `age` ključ, 2FA recovery kodovi | podatke igrača i nešifrirane dumpove                                          |
| GitHub Environment `staging`/`produkcija` | odgovarajući deploy SSH privatni ključ, host/IP i pinani `known_hosts` zapis                                                                                          | `BAZA_URL`, `SESIJA_TAJNA`, Resend ključ, Storage Box glavni pristup          |
| VPS konfiguracija                         | tajne samo tog okruženja: baza/sesija, Caddy hash, Storage Box podračun, Healthchecks ping URL; Resend i email allowlista prema okruženju                             | tajne drugog okruženja i privatni `age` ključ                                 |
| Repozitorij                               | nazive varijabli, sheme, javne ključeve/recipient vrijednosti ako su namjerno objavljene i očite placeholdere                                                         | stvarne lozinke, tokene, hashove, privatne ključeve, IP adrese i ping URL-ove |

VPS datoteke s tajnama čitljive su samo korisniku `deploy`/rootu koji ih nužno koristi. To nije jaka granica prema `deploy` računu jer Docker ovlasti već omogućuju root-ekvivalentan pristup; zaštita je ograničiti i nadzirati sam deploy ključ.

GitHubov ugrađeni `GITHUB_TOKEN` koristi se s najmanjim ovlastima. Tijekom deploya vrijedi samo dok traje job, šalje se preko SSH-a na `docker login --password-stdin`, sprema u privremeni Docker config i odmah uklanja. Trajni GHCR PAT na VPS-u je zabranjen.

Bitwarden ima 2FA. Jednom godišnje radi se šifrirani izvoz vaulta na odvojeni offline medij i testira može li se otvoriti. Izvoz i recovery kodovi ne ostaju samo na istom računalu s kojeg se upravlja serverima.

## Backup enkripcija

Produkcijski i forumski off-server backup šifrira se alatom `age` **prije** prijenosa na Storage Box. Javni recipient nalazi se na VPS-u i dovoljan je za izradu kopije. Privatni `age` ključ ne nalazi se na VPS-u: čuva se u Bitwardenu i šifriranom offline recovery izvozu te se unosi samo privremeno tijekom restorea.

Jedan Storage Box koristi odvojene podračune za forum i produkciju, tako da kompromitirani VPS vidi samo svoj direktorij. Glavni Storage Box račun ne nalazi se ni na jednom VPS-u. Dnevni Storage Box snapshotovi ublažavaju slučajno ili zlonamjerno brisanje kroz podračun.

## Privatnost (GDPR minimum, pošteno proveden)

**Načelo: skupljamo najmanje što igra treba.**

| Podatak                     | Tko          | Svrha                                                | Pravna osnova              |
| --------------------------- | ------------ | ---------------------------------------------------- | -------------------------- |
| Email                       | registrirani | prijava, oporavak računa, notifikacije prijava       | ugovor (pružanje usluge)   |
| Nadimak, statistika partija | svi          | sama igra i ljestvica                                | ugovor / legitimni interes |
| Potezi partija              | svi          | povijest, prijave grešaka, integritet igre           | legitimni interes          |
| IP u logovima               | svi          | sigurnost (rate limit, zlouporaba), kratka retencija | legitimni interes          |

- **Bez kolačića za praćenje**: početni MVP nema web analitiku; sesijski kolačić nužan je za rad. Nakon naknadnog uključivanja Umami je cookieless i ne profilira korisnike, pa se ne uvodi analitički kolačić.
- **Brisanje računa**: samoposlužno na profilu — briše email/lozinku, nadimak anonimizira („ObrisaniIgrač"), potezi ostaju anonimizirani (integritet povijesti partija drugih igrača).
- Gosti: UUID nije izravno osobni podatak, ali se prema njemu odnosimo kao da jest (iste retencije).
- `/privatnost` stranica piše ovo istim jezikom, ljudski i kratko; voditelj obrade i kontakt navedeni.

### Izvršitelji obrade (treće strane)

| Servis          | Uloga                                                                             | Podaci                               | Napomena                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Hetzner (DE)    | hosting VPS-ova, pomoćni server backup i Storage Box                              | svi podaci igre; šifrirani dumpovi   | EU; DPA sklopljen pri otvaranju računa; isti pružatelj za server i backup prihvaćen je MVP rizik                                               |
| Resend          | transakcijski email (potvrda registracije, reset lozinke, obavijesti o prijavama) | email adrese primatelja              | produkcijski pošiljatelj `noreply@kaladont.hr`; prije aktivacije provjeriti DPA/EU obradu i SPF/DKIM; ljudski kontakt je `kontakt@kaladont.hr` |
| GitHub / GHCR   | kod, CI i Docker slike                                                            | bez podataka igrača                  | tajne aplikacije nikad u repozitoriju ni logovima                                                                                              |
| UptimeRobot     | javni HTTP nadzor `/zdravlje`                                                     | javni URL, status i vrijeme odgovora | samo email alarmi; endpoint ne vraća osobne podatke                                                                                            |
| Healthchecks.io | heartbeat backupa i provjere diska                                                | naziv posla i vrijeme pinga          | ping URL je tajna; ne šalju se logovi, dumpovi ni podaci igrača                                                                                |
| XHosting        | DNS upravljanje domene                                                            | domena i infrastrukturne IP adrese   | podrška postavlja A i Resend DNS zapise; nema pristup aplikaciji ni bazi                                                                       |
| Umami (kasnije) | cookieless web analitika                                                          | anonimni posjeti i odabrani događaji | nije dio prvog lansiranja; dodaje se u popis obrade prije uključivanja                                                                         |

Popis se održava ažurnim na `/privatnost` stranici; novi izvršitelj = izmjena ovog dokumenta **prije** uvođenja.

### Email po okruženju

- Produkcija šalje preko Resenda s verificirane domene i pošiljatelja `noreply@kaladont.hr`; odgovori i ljudski upiti vode na `kontakt@kaladont.hr`.
- Staging koristi zasebnu konfiguraciju i `STAGING_EMAIL_ALLOWLIST` s punim, točno dopuštenim adresama. Adapter mora fail-closed odbiti i evidentirati svaki pokušaj slanja izvan popisa. Dopuštena domena ili ljudsko obećanje nisu dovoljna kontrola.
- Razvoj bez API ključa ispisuje testnu poruku lokalno. Takav stub nije dokaz produkcijskog slanja.

### Forum zajednice

- Discourse na `forum.kaladont.hr` zaseban je sustav s vlastitim računima, bazom i pravilima privatnosti; identiteti i podaci igre ne prenose se na forum.
- Teme su javno čitljive, pa članovi ne objavljuju osobne podatke, email adrese ni identifikatore partija. Za sporove oko presuda koriste gumb „Prijavi” u igri.
- Za objavu je potreban potvrđen forum račun. Uključeni su zaštita protiv spama, prijava sadržaja, ograničenja za nove članove i dvofaktorska prijava za administratore.
- Forum ne šalje newsletter niti koristi podatke računa igre za obavijesti.

## Što svjesno NE radimo

- Ne kupujemo oglase ni SDK-ove trećih strana (nula tuđih skripti = nula tuđih kolačića).
- Ne bilježimo sadržaj neuspjelih pokušaja riječi uz identitet (samo brojčano) — igračevo nagađanje je njegovo.
- Ne izvozimo podatke izvan EU (Hetzner DE); vanjski izvršitelji obrade biraju se uz taj uvjet (vidi tablicu gore).

## Blokatori javnog lansiranja

Prije prvog staging/produkcijskog deploya moraju biti implementirani i testirani:

- Fastify iza jedinog Caddy proxyja koristi točno konfiguriran `trustProxy`; same-origin klijent ne treba široki reflektirani CORS;
- centralna konfiguracijska shema prekida startup ako nedostaje tajna, koristi se razvojna zadana vrijednost ili je uključen `ONEMOGUCI_TIMER_POTEZA`;
- Resend stvarno šalje, staging allowlista radi fail-closed, a SPF/DKIM provjera prolazi;
- `/zdravlje` vraća 503 za nedostupnu bazu ili prazan rječnik i ne otkriva tajne/osobne podatke;
- jednokratni admin CLI uklanja potrebu za ručnim produkcijskim SQL-om;
- stranice `/privatnost` i `/uvjeti` postoje i navode aktualne izvršitelje obrade;
- Docker/Compose/Caddy, workflowi, backup enkripcija, restore i alarmi prolaze staging provjeru.
