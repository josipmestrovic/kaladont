# Produkcija i objava

> **Status: djelomično implementirano.** Dockerfile, CI smoke test, `docker-compose.staging.yml`, `docker-compose.prod.yml`, `Caddyfile` i `Caddyfile.staging` postoje i validiraju se u CI-ju. GHCR objava, VPS workflowi, backupi i stvarna staging/produkcijska postava još nisu implementirani. Ovaj dokument i dalje definira operativni ugovor koji implementacija mora zadovoljiti. Potpuno početničko vođenje i STOP kriteriji nalaze se u [Operacije for dummies](operacije-for-dummies.md).

Izvor odluke je [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md). Lokalni Windows razvoj ostaje odvojen i opisan u [postavljanju razvojne okoline](../06-razvoj/postavljanje-okoline.md).

## Okruženja

Aplikacija živi na **dva odvojena Hetzner VPS-a**; postojeći treći VPS nosi Discourse forum. To su tri VPS-a ukupno, ne zaseban aplikacijski i bazni VPS za svako okruženje:

| Okruženje  | Domena                | VPS                                              | Objava                                                                   |
| ---------- | --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Staging    | `staging.kaladont.hr` | vlastiti x86 VPS; aplikacija + vlastiti Postgres | automatski, svaki merge u `main` sa zelenim CI-jem                       |
| Produkcija | `kaladont.hr`         | vlastiti x86 VPS; aplikacija + vlastiti Postgres | ručna promocija **istog image digesta** sa staginga                      |
| Forum      | `forum.kaladont.hr`   | postojeći zasebni VPS (Discourse + njegova baza) | neovisno o igri — [vodič postave Discoursea](vodic-postava-discourse.md) |

Oba nova VPS-a koriste Ubuntu 24.04 LTS, arhitekturu x86/amd64 i istu Hetzner lokaciju kao forum. U početku imaju samo Primary IPv4; automatsko brisanje IP adrese isključeno je, a resurs je zaštićen od slučajnog brisanja. Zamjenski VPS u istoj lokaciji zato može preuzeti istu IP adresu bez čekanja XHosting DNS promjene.

Staging i produkcija ne dijele bazu, `.env`, tajne, Docker mrežu ni volumene. **Produkcijski podaci nikad ne idu na staging**; staging koristi trajne sintetičke podatke i vlastiti uvoz rječnika. Produkcijski VPS stvara se tek kada staging prođe puni deploy, ručnu partiju te šifrirani backup i restore drill. Odabir veličine i trošak opisani su u [dimenzioniranju poslužitelja](dimenzioniranje-posluzitelja.md).

## Sastav aplikacijskog VPS-a

Ciljane datoteke su `docker-compose.staging.yml` i `docker-compose.prod.yml`; konfiguracije postoje u korijenu repozitorija i koriste isti image digest kroz `KALADONT_IMAGE`.

| Servis       | Uloga                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `caddy`      | Reverse proxy, automatski HTTPS i jedini servis koji javno objavljuje portove 80/443                                                         |
| `aplikacija` | **Jedan Node proces**: Fastify + Socket.IO + posluženi SvelteKit build ([ADR-012](../03-arhitektura/odluke/012-jedan-proces-same-origin.md)) |
| `baza`       | PostgreSQL 16 s imenovanim trajnim volumenom, dostupan samo u privatnoj Compose mreži                                                        |

PostgreSQL i Caddy slike navode čitljivu točnu verziju i nepromjenjivi digest. Redovna objava aplikacije ne mijenja PostgreSQL motor niti njegov volume. Patch nadogradnja servisa ide kroz PR, staging i ručnu produkcijsku promociju; nadogradnja PostgreSQL-a na novu glavnu verziju zaseban je planirani zahvat.

Discourse **nije** dio ovih composeova. Umami također nije dio početnog produkcijskog Composea; dodaje se nakon stabilizacije javnog pristupa kao zaseban, dokumentiran korak.

Hetzner Cloud Firewall i UFW dopuštaju samo 22/tcp, 80/tcp i 443/tcp. Compose ne smije objaviti aplikacijski port 3000 ni PostgreSQL port 5432 na hostu, jer Dockerovi objavljeni portovi mogu zaobići očekivana UFW pravila.

## Domena i DNS preko XHostinga

Domenu `kaladont.hr` vodi XHosting, a DNS zapise prema zahtjevu postavlja njihova podrška. Operater nema vlastiti DNS panel. Za početak se traže samo A zapisi:

| Zapis                 | Vrijednost                                                             |
| --------------------- | ---------------------------------------------------------------------- |
| `staging.kaladont.hr` | zaštićena Primary IPv4 staging VPS-a                                   |
| `kaladont.hr`         | zaštićena Primary IPv4 produkcijskog VPS-a                             |
| `www.kaladont.hr`     | ista produkcijska Primary IPv4                                         |
| `forum.kaladont.hr`   | postojeća IP adresa forumskog VPS-a; ne mijenjati tijekom postave igre |

AAAA zapisi i Cloudflare proxy ne uvode se u početku. `analitika.kaladont.hr` ne traži se dok se naknadno ne uvodi Umami. Za Resend se XHostingu šalju točno oni SPF/DKIM zapisi koje prikaže Resend, bez ručnog prepisivanja ili spajanja vrijednosti napamet. Gotovi predlošci poruka podršci i naredbe `Resolve-DnsName`/`nslookup` nalaze se u početničkom vodiču.

Caddy može izdati javni TLS certifikat tek kada DNS pokazuje na odgovarajući VPS i portovi 80/443 su dostupni.

## Caddy

Produkcijska konfiguracija nalazi se u `Caddyfile`, a staging konfiguracija u `Caddyfile.staging`. Obje se validiraju u CI-ju; stvarni TLS certifikat može se izdati tek nakon DNS-a i otvaranja portova 80/443.

```text
kaladont.hr {
    encode gzip
    reverse_proxy aplikacija:3000
}
www.kaladont.hr {
    redir https://kaladont.hr{uri}
}
```

Staging štiti sve osim health checka. Caddy prihvaća samo hashiranu lozinku; plaintext lozinka ne ide u Caddyfile ni git:

```text
staging.kaladont.hr {
    header X-Robots-Tag "noindex, nofollow"

    @zdravlje path /zdravlje
    handle @zdravlje {
        reverse_proxy aplikacija:3000
    }

    handle {
        basic_auth argon2id {
            {$STAGING_BASIC_AUTH_KORISNIK} {$STAGING_BASIC_AUTH_HASH}
        }
        reverse_proxy aplikacija:3000
    }
}
```

Javni `/zdravlje` vraća samo sigurne operativne podatke: stanje baze, broj učitanih riječi, broj aktivnih partija, uptime i verziju/digest. Vraća 503 ako baza nije dostupna ili je rječnik prazan. Točne nazive polja i HTTP semantiku definira jedini detaljni [health check ugovor](nadzor-i-dnevnici.md#health-check).

Forum zadržava vlastiti službeni Discourse reverse proxy i deployment. Ne prebacuje se u Caddy/Compose igre.

## Redoslijed prve postave

Detaljni koraci za početnika nalaze se u [Operacije for dummies](operacije-for-dummies.md), a tehnički sažetak u [vodiču postave VPS-a](vodic-postava-vps.md). Redoslijed se ne preskače:

1. Dovršiti sve production-readiness blokere u kodu i repozitoriju; CI mora izgraditi i smoke-testirati stvarnu sliku.
2. Postaviti Storage Box i dokazati off-server backup/restore postojećeg Discoursea.
3. Stvoriti samo staging Primary IPv4 i VPS; očvrsnuti SSH, firewall i Docker.
4. Zatražiti staging A zapis od XHostinga i postaviti Basic Auth.
5. Prvi workflow izvršava migracije, uvozi hrLex samo ako je rječnik prazan, pokreće aplikaciju i provjerava `/zdravlje`.
6. Ručno odigrati staging partiju i dokazati šifrirani backup/restore staging baze.
7. Tek tada stvoriti i postaviti produkcijski Primary IPv4/VPS, Resend DNS, backup i monitoring.
8. Ručno promovirati isti digest koji je prošao staging.

## Objava nove verzije

Automatika i njezin ciljani ugovor opisani su u [CI/CD dokumentu](ci-cd.md); ljudski postupci su u [runbooku objave i rollbacka](runbook-objava-i-rollback.md). Tok je: radna grana → Pull Request → zeleni CI → merge u `main` → automatski staging → ručna provjera → ručno pokrenuta promocija **istog digesta** u produkciju.

- Postoji jedan stvarni operater. Nema obveznog drugog reviewera ni dodatnog GitHub Environment approval koraka; ručno pokretanje produkcijskog workflowa kontrolna je točka.
- Redovni deploy može prekinuti aktivne partije i ne blokira se automatski. Radi se u doba slabog prometa. Očekivani prekid dulji od 5 minuta najavljuje se najmanje 24 sata unaprijed na forumu i bannerom objavljenim prethodnim izdanjem.
- Migracije se izvode prije zamjene kontejnera; moraju biti kompatibilne unatrag (stara verzija radi nad novom shemom barem jedan ciklus).
- Prije svake produkcijske migracije mora uspjeti svježi šifrirani off-server backup.
- Serveri, logovi i systemd timeri koriste UTC; najava korisnicima navodi lokalno vrijeme Europe/Zagreb.

## Vraćanje unatrag

Slike su tagirane SHA-om commita i identificirane digestom. Automatskog rollbacka nema: pad produkcijske provjere zaustavlja workflow i jasno prikazuje prethodni digest, a operater ručno pokreće promociju tog digesta. Cilj je vratiti aplikaciju unutar 15 minuta. Baza se pri rollbacku aplikacije ne vraća, zato migracije moraju biti unatrag kompatibilne. Koraci su u [runbooku objave i rollbacka](runbook-objava-i-rollback.md).

## Umami nakon stabilizacije

Umami nije preduvjet javnog ranog pristupa. Kada se postojeći stack stabilizira, dodaje se kao zaseban produkcijski servis na istom VPS-u, s `analitika.kaladont.hr`, vlastitim migracijama, backup obuhvatom i nadzorom. Ta promjena prolazi isti PR → staging provjera konfiguracije → ručna produkcijska promocija tok; prije nje se od XHostinga zasebno traži DNS zapis.
