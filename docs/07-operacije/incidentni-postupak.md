# Incidentni postupak

Što raditi kad nešto ne radi. Cilj: smireno, redom, bez ručnih improvizacija koje incident pretvaraju u dva incidenta.

Za objašnjenje svake naredbe i potpuni početnički recovery tok vidi [Operacije for dummies](operacije-for-dummies.md). Ciljevi su: ručni rollback loše objave unutar 15 minuta, potpuni povrat produkcije unutar 4 sata i najviše 24 sata izgubljenih baznih podataka ([ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md)).

## Redoslijed razmišljanja (uvijek isti)

1. **Zabilježi početak:** UTC vrijeme kada je alarm stigao i kada je utjecaj potvrđen. Time počinje RTO.
2. **Utjecaj:** mogu li igrači otvoriti stranicu, ući u red i igrati? Provjeri `https://kaladont.hr/zdravlje` i naslovnicu s druge mreže ako je moguće.
3. **Promjena:** što se posljednje mijenjalo? Novi digest, migracija, OS/Docker nadogradnja, DNS ili certifikat su prvi tragovi, ne dokazi.
4. **Dokazi prije popravka:** spremi health odgovor, aktivni digest, GitHub Deployment, `docker compose ps`, resurse i relevantne logove. Ne spremaj tajne ni cijeli dump u incidentni zapis.
5. **Klasificiraj:** aplikacijski release → rollback; baza → izolirana procjena/restore; cijeli VPS → recovery; pristup/sigurnost → opoziv ključa i očuvanje dokaza.
6. **Najmanji zahvat koji vraća uslugu:** ne mijenjaj istodobno image, bazu, DNS i firewall. Dubinska analiza ide poslije, na stagingu.
7. **Zapiši završetak i posljedice:** vrijeme povrata, potvrđeni gubitak podataka i privremene mjere.

## Česte situacije

| Simptom                                 | Prva provjera                                                  | Najvjerojatniji popravak                                                                                  |
| --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Health pao odmah nakon promocije        | workflow, aktivni/prethodni digest, aplikacijski log           | spremi dokaze i ručno promoviraj prethodni digest; cilj 15 min                                            |
| Health 200, ali UI/partije ne rade      | digest, browser konzola, Socket.IO i aplikacijski log          | rollback; ako stara verzija također griješi, klasificiraj bazu/mrežu                                      |
| `/zdravlje` vraća 503 i `brojRijeci: 0` | stanje baze, startup/uvoz log, broj aktivnih riječi u DB-u     | ne uvozi naslijepo; razlikuj nedostupnu bazu, prazan DB i neuspjelo učitavanje                            |
| Cijeli VPS nedostupan, ni SSH ne radi   | Hetzner status, konzola, graf CPU/RAM/disk, Cloud Firewall     | jedan kontrolirani reboot; ako se ne oporavi, rebuild sa sačuvanom Primary IPv4                           |
| Disk > 80 % ili pun                     | `df -h`, Docker usage, logovi i lokalni backup direktorij      | oslobodi dokazano nepotrebno; sačuvaj aktivni i prethodni digest, ne diraj udaljene backupe               |
| Baza ne prima veze                      | DB log, disk, memorija, volume i zadnja migracija              | ne briši volume; prvo restart samo baze ako je uzrok jasan, zatim kontrolirani restore u novu bazu        |
| TLS/certifikat ne radi                  | Caddy log, A zapis, portovi 80/443 i vrijeme sustava           | ispravi Caddy/firewall; XHosting kontaktiraj samo ako A zapis nije tražena Primary IPv4                   |
| Healthchecks javlja propušten backup    | systemd service/timer i Storage Box dostupnost                 | ispravi uzrok i odmah ručno ponovi cijeli backup s udaljenom provjerom                                    |
| Resend ne šalje                         | status servisa, aplikacijski log bez sadržaja poruke, SPF/DKIM | igra ostaje dostupna; označi račune/email tok degradiranim, ne zaobilazi potvrdu ručnim SQL-om            |
| SSH ključ izgubljen                     | postoji li drugi osobni ključ; Hetzner konzola                 | koristi out-of-band konzolu, dodaj novi javni ključ i opozovi stari; ne uključuj login lozinkom           |
| Sumnja na kompromitiran deploy ključ    | GitHub/VPS SSH tragovi i neočekivani digest/kontejner          | odmah ukloni javni ključ, rotiraj Environment tajnu i pregledaj stroj kao potencijalno root-kompromitiran |
| Val prometa / zlouporaba                | Caddy/rate-limit log, resursi, fail2ban                        | potvrdi izvor; pooštri rubna pravila bez izlaganja baze i bez blokiranja vlastitog recovery pristupa      |
| Forum pao                               | zaseban VPS i njegov health/backup                             | rješavaj na forumskom stroju; ne diraj igru ([vodič Discoursea](vodic-postava-discourse.md))              |

## Loša objava

Ako je incident počeo neposredno nakon deploya i stara shema ostaje kompatibilna, slijedi [rollback runbook](runbook-objava-i-rollback.md#rollback-vraćanje-prethodne-verzije). Ne rebuildaj sliku i ne vraćaj bazu. Workflow nema automatski rollback, zato prethodni digest mora biti poznat prije svake promocije.

Ako se prethodni digest vrati, ali kvar ostane, zaustavi ponavljanje workflowa. Problem je vjerojatno u bazi, konfiguraciji, mreži ili vanjskom servisu.

## Oštećena baza

Restore je zadnja mjera jer gubi podatke nastale nakon odabrane kopije. Zaustavi aplikaciju, očuvaj postojeći volume i vrati šifrirani dump u **novu** bazu prema [backup runbooku](runbook-backup-i-vracanje.md#stvarno-vraćanje-nakon-incidenta). Tek nakon provjere preusmjeri aplikaciju. Produkcijski podaci nikad se ne nose na staging.

## Potpuni gubitak VPS-a

Ako jedan kontrolirani reboot ne vraća stroj ili je kompromitiran, pokreni potpuni recovery. Zamjenski Ubuntu 24.04 x86 VPS mora biti u istoj Hetzner lokaciji kako bi preuzeo zaštićenu Primary IPv4. Primijeni verzionirani bootstrap, vrati bazu iz autoritativnog Storage Box dumpa, pokreni zadnji zdravi digest i ponovno potvrdi backup/alarme. Detaljni redoslijed je u [backup runbooku](runbook-backup-i-vracanje.md#potpuni-oporavak-vps-a-rto-4-sata).

Ne briši stari VPS prije očuvanja dokaza i provjere kopija. Hetzner daily backup vezan je uz server i može nestati njegovim brisanjem; Primary IPv4 mora imati isključen `Auto delete` i zaštitu od brisanja.

## Komunikacija prema igračima

- Prekid kraći od 15 min bez gubitka podataka: nije potrebna zasebna retrospektivna objava.
- Očekivani planirani prekid dulji od 5 min: forum + prethodno objavljen banner najmanje 24 sata unaprijed; vrijeme navesti u Europe/Zagreb.
- Neplanirani prekid dulji od 15 min: kratka forumska obavijest s poznatim utjecajem i vremenom sljedećeg ažuriranja.
- Potvrđeni gubitak podataka: jasno navesti pogođeno razdoblje i koje vrste podataka nedostaju. Ne tvrditi da je sve vraćeno dok provjere nisu završene.

## Nakon incidenta (post-mortem, 15 min)

U kratkoj bilješci (interni zapis ili PR u docs ako mijenja pravila rada):

1. Vremenska crta: kad je počelo, kad smo saznali, kad je riješeno.
2. Utjecaj: prekid, broj pogođenih partija/računa i potvrđeni gubitak podataka.
3. Uzrok (stvarni, ne simptom) i zašto ga postojeće kontrole nisu zaustavile.
4. Što je pomoglo, što je odmoglo i jesu li 15-minutni/4-satni ciljevi ispunjeni.
5. Jedna konkretna promjena da se ne ponovi ili ranije otkrije, s vlasnikom i rokom.

Ako incident mijenja arhitekturu ili proces objave, promjena ide u `docs/` **prije** implementacije, po pravilima projekta.
