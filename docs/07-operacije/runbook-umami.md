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

```bash
cd /opt/kaladont
sudo -u deploy docker compose -f docker-compose.prod.yml --env-file .env up -d umami
sudo -u deploy docker compose -f docker-compose.prod.yml ps
```

`umami` treba biti `running` / healthy. Ako pada, `docker compose logs umami --tail=80` (često: baza nije bootstrapana ili kriva lozinka).

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

1. Otvori `https://analitika.kaladont.hr`
2. Default prijava (obično `admin` / `umami`) — **odmah promijeni lozinku**; spremi u Bitwarden
3. Websites → Add → site za `kaladont.hr`
4. Kopiraj **Website ID**

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
2. Klik **Igraj** → u Umami eventu `igraj-klik`
3. Klik **Pridruži se zajednici** → `forum-klik-landing`
4. Na `/o-igri` forum CTA → `forum-klik-o-igri`

Gašenje trackera bez gašenja kontejnera: isprazni `UMAMI_URL` i `UMAMI_WEBSITE_ID`, restart `aplikacija`.

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
sudo -u deploy docker compose -f docker-compose.prod.yml stop umami
```

`https://kaladont.hr` mora i dalje raditi (partija, login). Zatim:

```bash
sudo -u deploy docker compose -f docker-compose.prod.yml start umami
```

---

## Staging

Staging Compose **nema** Umami servis. Ne traži `analitika.staging` DNS. `UMAMI_URL` / `UMAMI_WEBSITE_ID` na stagingu ostaju prazni.

## Što namjerno ne radiš

- Drugi Hetzner VPS samo za Umami
- Cloudflare proxy za analitiku (nije u početnom modelu)
- Google Analytics / cookie banner
