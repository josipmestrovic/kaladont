# Vodič: postava Discourse foruma (forum.kaladont.hr)

Forum zajednice radi na **zasebnom VPS-u** — kvar, opterećenje ili nadogradnja foruma ne smiju dotaknuti igru ([produkcija-i-objava.md](produkcija-i-objava.md#okruženja)). Uloga foruma, kategorije, moderiranje i pravila: [zajednica-i-rani-pristup.md](../08-plan-razvoja/zajednica-i-rani-pristup.md). Računi foruma i igre su **odvojeni**; SSO se ne uvodi ([zajednica-i-rani-pristup.md → Izvan opsega](../08-plan-razvoja/zajednica-i-rani-pristup.md#izvan-opsega)).

> **Trenutačno stanje 2026-09-08:** forumski VPS već radi na Ubuntu 24.04 LTS, a postoje lokalni Discourse backup i Hetzner daily backup. Kopija izvan forumskog VPS-a na Storage Boxu još nije postavljena. To je prioritetni operativni rizik koji se zatvara prije kupnje novih aplikacijskih VPS-ova.

## Zašto zaseban stroj i službeni setup

Discourse dolazi s vlastitim, službeno podržanim Docker postavom (`discourse_docker`) koji u jednom paketu nosi aplikaciju, vlastiti PostgreSQL i Redis. Ne spajamo ga na bazu igre, ne guramo ga u aplikacijski compose i ne izmišljamo vlastiti raspored — službeni put znači primjenjive upute pri svakoj nadogradnji.

## Preduvjeti

- VPS: Ubuntu LTS, ≥ 2 vCPU / 4 GB RAM (Discourse je zahtjevniji od igre; uz manje RAM-a obavezno dodati swap prema službenim uputama).
- Očvršćivanje stroja identično igri: SSH ključ, bez root/lozinki, `ufw` (22/80/443), fail2ban, unattended-upgrades — koraci 1–4 u [vodic-postava-vps.md](vodic-postava-vps.md).
- DNS `A` zapis `forum.kaladont.hr` → IP forumskog VPS-a.
- SMTP pristup za forumske mailove (potvrde računa, obavijesti): Resend SMTP ili EU alternativa — isti kriterij kao za igru ([sigurnost-i-privatnost.md](sigurnost-i-privatnost.md#izvršitelji-obrade-treće-strane)); SPF/DKIM zapisi za domenu.

## Instalacija (službeni put)

1. Na VPS klonirati `discourse_docker` (github.com/discourse/discourse_docker) u `/var/discourse` i pokrenuti `./discourse-setup`.
2. Čarobnjak pita: domenu (`forum.kaladont.hr`), admin e-mail, SMTP podatke — TLS certifikat rješava sam (Let's Encrypt).
3. Nakon builda otvoriti `https://forum.kaladont.hr`, dovršiti admin račun i **odmah uključiti dvofaktorsku prijavu**.

## Obavezne postavke prije javnog otvaranja

Iz [zajednica-i-rani-pristup.md](../08-plan-razvoja/zajednica-i-rani-pristup.md#infrastruktura-i-zaštita):

- potvrda e-maila za nove račune; zaštita protiv spama i ograničenja za nove članove (razine povjerenja);
- prijava sadržaja uključena; kategorije i prikvačene teme prvog dana po planu zajednice;
- backup: dnevni ugrađeni Discourse backup (baza + uploadi), Hetzner daily backup stroja i šifrirana kopija na zasebni Storage Box podračun; **testno vraćanje obavezno je prije nego se off-server backup proglasi gotovim** ([runbook backupa](runbook-backup-i-vracanje.md#forum-i-početni-staging-dokaz));
- stranice pravila ponašanja i privatnosti foruma (Discourse ima vlastite kolačiće i obradu e-maila — odvojeno od `/privatnost` igre).

## Nadogradnje

Mjesečno (u sklopu [održavanja](odrzavanje.md)):

```bash
cd /var/discourse
git pull
./launcher rebuild app
```

Rebuild znači nekoliko minuta nedostupnosti foruma. Očekivani prekid dulji od 5 minuta najavljuje se u kategoriji Obavijesti najmanje 24 sata unaprijed; hitne sigurnosne objave ne čekaju redovni termin. Prije svakog rebuilda potvrdi svjež lokalni i off-server backup.

## Off-server backup na Storage Box

Forum dobiva zaseban Storage Box podračun i zaseban SSH ključ. Ne koristi produkcijski podračun igre i ne može vidjeti njegove datoteke. Glavni Storage Box pristup ostaje samo u Bitwardenu.

Ciljani periodični posao:

1. potvrđuje da je ugrađeni Discourse backup baze i uploadova svjež i dovršen;
2. šifrira datoteku javnim `age` recipientom prije prijenosa;
3. prenosi samo `.age` datoteku na forumski podračun;
4. provjerava udaljenu veličinu i SHA-256;
5. provodi dogovorenu retenciju bez pristupa direktoriju igre;
6. šalje success/fail heartbeat zasebnom Healthchecks.io checku.

Privatni `age` ključ ne ostaje na forumskom VPS-u. Vraćanje se testira na izoliranoj privremenoj Discourse instanci prema službenoj Discourse proceduri; ne koristi staging ni produkcijsku bazu igre. Rezultat i trajanje zapisuju se u [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata).

Hetzner daily backup ostaje pomoćna slika diska. Može biti nekonzistentan dok Discourse/PostgreSQL radi i briše se zajedno sa serverom, zato nije zamjena za ugrađeni Discourse backup kopiran na Storage Box.

## Granice

- Nema SSO-a ni dijeljenja podataka s igrom; poveznice iz igre na forum su obične vanjske poveznice.
- Forum ne šalje newsletter; važne obavijesti žive u kategoriji Obavijesti.
- Incident na forumu rješava se na forumskom stroju i ne dira runbook igre ([incidentni-postupak.md](incidentni-postupak.md#česte-situacije)).
- Forumski Storage Box podračun, SSH ključ, Healthchecks URL i backup evidencija potpuno su odvojeni od produkcijske igre, iako koriste isti glavni Storage Box.
