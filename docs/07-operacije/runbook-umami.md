# Runbook: uključivanje Umamija (početnički)

> **Ne treba novi VPS.** Umami ide na **isti** produkcijski server kao `kaladont.hr`. Staging **nema** Umami servis ni tracker.

SSH ulaz: [runbook-ssh-produkcija.md](runbook-ssh-produkcija.md).  
Kod + Compose: `umami` servis u [`docker-compose.prod.yml`](../../docker-compose.prod.yml), Caddy host u [`Caddyfile`](../../Caddyfile).

## Što radiš u jednoj rečenici

Tajne na postojeći prod VPS → bootstrap baze `umami` → digneš kontejner → XHosting A zapis na **istu IP** → login + Website ID → upišeš `UMAMI_URL` / `UMAMI_WEBSITE_ID` → backup.env → test da igra živi bez Umamija.

## Preduvjeti

- [ ] Mergean/deployan digest koji sadrži Umami Compose + Caddy `analitika.kaladont.hr`
- [ ] `https://kaladont.hr` radi
- [ ] Na VPS-u ima ~0,2 GB slobodnog RAM-a (`free -h`)
- [ ] Znaš `<PROD_IPV4>` iz Bitwardena (ista IP kao za `kaladont.hr`)

---

## 1. Tajne (Bitwarden + `/opt/kaladont/.env`)

Na Windowsu (Git Bash / WSL) ili lokalno:

```bash
openssl rand -hex 24   # → UMAMI_BAZA_LOZINKA
openssl rand -hex 32   # → UMAMI_APP_SECRET
```

Spremi u Bitwarden (`Kaladont / produkcija`). Nikad u git.

SSH na produkciju kao `kaladont`, zatim:

```bash
sudo -u deploy nano /opt/kaladont/.env
```

Dodaj (tracker još **prazan**):

```env
UMAMI_BAZA_LOZINKA=<iz Bitwardena>
UMAMI_APP_SECRET=<iz Bitwardena>
UMAMI_URL=
UMAMI_WEBSITE_ID=
```

Spremi. Prava ostaju `600`, vlasnik `deploy`.

---

## 2. Bootstrap baze `umami`

Na VPS-u trebaš kopiju skripte iz repoa (npr. privremeno `scp` ili već deployani artefakt). Primjer ako si u klonu na laptopu i SSH-aš naredbu:

```bash
cd /opt/kaladont
export UMAMI_BAZA_LOZINKA   # ista vrijednost kao u .env — unesi ručno u sesiju, ne echoaj u chat
# Primjer: skripta je u /tmp ili /home/kaladont/kaladont-repo/skripte/umami/
bash /putanja/do/skripte/umami/bootstrap-umami-bazu.sh \
  --compose-dir=/opt/kaladont \
  --compose-datoteka=/opt/kaladont/docker-compose.prod.yml \
  --baza-servis=baza
```

Očekuješ: `bootstrap-umami-bazu: uloga i baza umami su spremne.`  
To **ne dira** `kaladont_prod`.

---

## 3. Podigni Umami kontejner

Umami je iza Compose profila `umami` — obični deploy igre **ne** pokreće ga i **ne** traži Umami tajne.
Compose **nema** poznate defaulte za `UMAMI_BAZA_LOZINKA` / `UMAMI_APP_SECRET` — bez pravih tajni kontejner neće zdravije dignuti.

```bash
cd /opt/kaladont
# Fail-fast na prazne/slabe tajne (skripta iz repoa):
bash /putanja/do/skripte/umami/provjeri-umami-tajne.sh
sudo -u deploy docker compose --profile umami -f docker-compose.prod.yml --env-file .env up -d umami
sudo -u deploy docker compose --profile umami -f docker-compose.prod.yml ps
```

`umami` treba biti `running` / healthy. Ako pada, `docker compose --profile umami -f docker-compose.prod.yml logs umami --tail=80` (često: baza nije bootstrapana ili kriva lozinka).

### Ograničenja resursa

Umami je namjerno ograničen u Composeu (`cpus: 0.5`, `mem_limit: 512m`, `mem_reservation: 256m`) kako analitika ne bi mogla zauzeti nerazmjeran dio produkcijskog VPS-a. Kaladont i njegova baza imaju prednost.

- Procijenjena stvarna potrošnja je ~0,2 GB RAM-a; tvrdi limit 512 MiB je strop, ne očekivano zauzeće.
- `mem_reservation: 256m` je meki signal pri pritisku na memoriju — nije garantiran niti unaprijed alociran RAM.
- Ako Umami prijeđe `mem_limit`, Docker ga može OOM-ubiti i `restart: unless-stopped` ga digne ponovno.
- Umami i dalje dijeli PostgreSQL (`baza`) s igrom; ograničenja vrijede samo za Umami kontejner, ne za Postgres.

Provjera stvarne potrošnje i statusa:

```bash
docker stats --no-stream
```

```bash
docker compose --profile umami \
  -f docker-compose.prod.yml ps
```

Provjera stvarno primijenjenih limita (zamijeni ime kontejnera ako treba):

```bash
docker inspect "$(docker compose --profile umami -f docker-compose.prod.yml ps -q umami)" \
  --format 'Memory={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}} NanoCpus={{.HostConfig.NanoCpus}}'
```

Očekivano: `Memory=536870912` (512 MiB), `MemoryReservation=268435456` (256 MiB), `NanoCpus=500000000` (0,5 CPU). Ako Umami redovito doseže limit ili se zbog njega restartira, prilagodi ograničenja na temelju mjerenja.

Ako je Caddy već star bez `analitika` bloka, treba redeploy/compose koji povuče novi `Caddyfile`, zatim:

```bash
sudo -u deploy docker compose -f docker-compose.prod.yml up -d caddy
```

---

## 4. DNS kod XHostinga

Pošalji postojećim kanalom (predložak):

> **Predmet:** A zapis analitika.kaladont.hr  
> Poštovani, molim A zapis `analitika.kaladont.hr` na `<PROD_IPV4>` (ista IPv4 kao `kaladont.hr`). Nameservere, `forum.kaladont.hr`, mail zapise i postojeće A zapise ne dirati. Molim potvrdu nakon primjene. Hvala, Josip.

Na Windowsu:

```powershell
Resolve-DnsName analitika.kaladont.hr -Type A
```

Mora pokazati baš `<PROD_IPV4>`. Pričekaj propagaciju (često minute, ponekad dulje). Caddy sam izdaje TLS kad DNS i portovi 80/443 rade.

---

## 5. Prvi login + Website ID

Admin UI je na **`https://analitika.kaladont.hr`** (Caddy reverse_proxy na `umami:3000`). Tracker (`/script.js`, `/api/send`) ide na isti host.

1. Otvori `https://analitika.kaladont.hr`
2. Default prijava (obično `admin` / `umami`) — **odmah promijeni lozinku**; spremi u Bitwarden
3. Websites → Add → site za `kaladont.hr`
4. Kopiraj **Website ID**

Opcionalni backup bez javnog UI-a: Compose i dalje publisha `127.0.0.1:3002` (`umami_loopback`); SSH tunnel `-L 3002:127.0.0.1:3002` ako treba.

---

## 6. Uključi tracker na igri

U `/opt/kaladont/.env`:

```env
UMAMI_URL=https://analitika.kaladont.hr
UMAMI_WEBSITE_ID=<ID iz koraka 5>
```

Restart aplikacije (isti način kako inače redeployaš env), npr.:

```bash
cd /opt/kaladont
sudo -u deploy docker compose -f docker-compose.prod.yml --env-file .env up -d aplikacija
```

Provjera:

1. `https://kaladont.hr` → DevTools → Network → zahtjevi prema `analitika.kaladont.hr`
2. Klik **Brza igra** na naslovnici → događaj `mod-klik` s `mod=brza_igra`, `izvor=naslovnica`
3. Automatski `?igraj=1` **ne** šalje `mod-klik`
4. Ostali smoke: kartice načina (`izazovi` / `trening` / `privatna_soba`), prečac ljestvica → `navigacija-klik`, CTA registracije → `registracija-klik`

Gašenje trackera bez gašenja kontejnera: isprazni `UMAMI_URL` i `UMAMI_WEBSITE_ID`, restart `aplikacija`.

### Katalog prilagođenih događaja

Umami prati **korisničku namjeru i web navigaciju** (klikovi, otvaranje editora, uspješno kopiranje poveznice). **Interna analitika** Kaladonta prati stvarno ponašanje igre: partije, registracije, konverzije, retenciju, botove i gamifikaciju. Ne dupliciramo te podatke u Umami događajima.

Centralni helper: `aplikacije/web/src/lib/umami.ts` (`zabiljeziUmamiDogadjaj`). Automatski pageview / posjetitelji / UTM / uređaji ostaju ugrađeni u tracker; ne šaljemo vlastite pageview događaje.

| Događaj | Parametri | Trenutak slanja |
| --- | --- | --- |
| `mod-klik` | `mod`, `izvor` | Svjesni klik na način igranja (ne `?igraj=1`, ne reconnect, ne „igraj opet”) |
| `navigacija-klik` | `odrediste`, `izvor` | Klik na sekundarnu funkcionalnost (ne tabovi unutar stranice) |
| `registracija-klik` | `izvor` | Klik na CTA prema `/registracija` |
| `prijava-klik` | `izvor` | Klik na CTA prema `/prijava` (ne submit obrasca, ne obnova sesije) |
| `privatna-soba-kreirana` | — | Nakon potvrde `soba:stvorena` |
| `privatna-soba-link-kopiran` | — | Nakon uspješnog `clipboard.writeText` (bez linka/koda u payloadu) |
| `avatar-uredjivanje-otvoreno` | `izvor` | Svjesno otvaranje editora (`/profil/avatar`) |
| `avatar-spremljen` | — | Nakon uspješnog PUT avatara |
| `povratne-informacije-poslane` | — | Nakon uspješnog POST-a forme |

Dopuštene vrijednosti:

- `mod`: `brza_igra`, `izazovi`, `trening`, `privatna_soba`
- `odrediste`: `ljestvice`, `misije`, `kolekcija`, `dostignuca`, `profil`, `pravila`, `novosti`
- `izvor`: `naslovnica`, `izbornik_profila`, `zavrsetak_partije`, `zavrsetak_izazova`, `zavrsetak_treninga`, `profil`, `footer`, `misije`, `ljestvice`, `postavke`, `prijava`, `registracija`, `zahvala`, `avatar_editor`, `obavijest_misije`, `ostalo` (samo kad nema preciznijeg)

**Namjera vs potvrda:** `mod-klik` / `*-klik` / `avatar-uredjivanje-otvoreno` = namjera. `privatna-soba-kreirana`, `privatna-soba-link-kopiran`, `avatar-spremljen`, `povratne-informacije-poslane` = potvrđena akcija.

**Ukloništa događaja:** više se ne šalju `igraj-klik`, `forum-klik-landing`, `forum-klik-o-igri` ni `naslovnica-*-klik`. Interes za Brzu igru: `mod-klik` + `mod=brza_igra`. Povijesni zapisi u Umami bazi ostaju; dashboardi na starim imenima više ne reflektuju nove klikove.

U Umami UI-ju: Events → odaberi događaj → Properties / Filter po `mod`, `odrediste` ili `izvor`.

### Privatnost payloada (before-send)

Jedini izvor logike: `aplikacije/web/src/lib/umami-sanitizacija.ts`. Produkcijski `/umami-before-send.js` generira Vite/esbuild IIFE (ne uređuj ručno).

Učitavanje: sync inline stub (`return false`, fail-closed) → `defer` IIFE → `defer` Umami s `data-before-send="kaladontUmamiBeforeSend"`. Nema sync mrežnog fetcha sanitizera. Ako IIFE ne stigne ili padne, stub sprječava slanje nesanitiziranih podataka.

| Stvarni URL | Analitički URL |
| --- | --- |
| `/partija/<uuid>` | `/partija/:id` |
| `/partija/arhiva/<uuid>` | `/partija/arhiva/:id` |
| `/soba/AB23CD` | `/soba/:kod` |
| `/soba/kreiraj` | `/soba/kreiraj` (statička ruta) |
| `/profil/javni/<id>` | `/profil/javni/:id` |
| `/potvrda-emaila?token=…` | `/potvrda-emaila` |
| `/racuni/resetiraj-lozinku?token=…` | `/racuni/resetiraj-lozinku` |

Iz queryja ostaju samo `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (vrijednosti skraćene; UTM nije zajamčeno anoniman). Vanjski referrer: samo origin. Naslov: UUID i kod sobe. Ako sanitizacija ne uspije, payload se **ne šalje**.

Prilagođeni događaji i dalje ne smiju sadržavati email, nadimak, ID igrača/partije/sesije, kod sobe, riječi, chat, sadržaj feedbacka ni avatar konfiguraciju.

**Napomena (`/zahvala`):** linkovi „Igrati Dvoboj / Četveroboj” i dalje vode na `/red?mod=…`, a u analitici su `mod-klik` + `mod=brza_igra` + `izvor=zahvala`. UX formata nije mijenjan u ovom commitu — eventualno usklađivanje UI-ja je zasebna odluka.

**Operativni zadatak (nije dio deploya koda):** nakon uključivanja sanitizacije, ručno pregledati već prikupljene produkcijske pageviewove u Umamiju (URL-ovi s tokenima / kodovima soba / ID-evima partija) i odlučiti treba li čišćenje ili filtriranje u dashboardima. Povijesni podaci se automatski ne brišu.

---

## 7. Backup

```bash
sudo nano /etc/kaladont/backup.env
```

Dodaj:

```env
UMAMI_BAZA_IME=umami
```

Sljedeći uspješan `kaladont-backup` dumpa i bazu `umami` (artefakt `kaladont_umami_….dump.age`). Umami restore nije kritičan za igru.

---

## 8. Test izolacije

```bash
cd /opt/kaladont
sudo -u deploy docker compose --profile umami -f docker-compose.prod.yml stop umami
```

`https://kaladont.hr` mora i dalje raditi (partija, login). Zatim:

```bash
sudo -u deploy docker compose --profile umami -f docker-compose.prod.yml start umami
```

Napomena: CSP na `kaladont.hr` dopušta `https://analitika.kaladont.hr` — `UMAMI_URL` mora biti točno ta vrijednost. Admin UI je na tom istom javnom hostu.

---

## Staging

Staging Compose **nema** Umami servis. Ne traži `analitika.staging` DNS. `UMAMI_URL` / `UMAMI_WEBSITE_ID` na stagingu ostaju prazni.

## Što namjerno ne radiš

- Drugi Hetzner VPS samo za Umami
- Cloudflare proxy za analitiku (nije u početnom modelu)
- Google Analytics / cookie banner
