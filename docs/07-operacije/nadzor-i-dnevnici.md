# Nadzor i dnevnici

Skromno, ali dovoljno da se kvar ne otkriva od igrača: strukturirani lokalni logovi, javni health check, dnevne kopije baze i heartbeat periodičnih poslova.

> **Status:** Pino logovi i prošireni `/zdravlje` postoje. Docker rotacija, UptimeRobot, Healthchecks.io te systemd poslovi još su ciljano stanje Faze 8. Pokuse opterećenja nadzirati postojećim alatima; ne uvoditi novu monitoring infrastrukturu radi njih.

## Admin nadzor aplikacije

Bot politika v2 raspodjeljuje javne isteke na namjerne (0,5 % poteza) i neočekivane. Admin ih prikazuje odvojeno, a alarm reagira samo na neočekivani istek. Javni health zadržava kumulativni `botIsteci` za sve isteke i dodaje `botNamjerniIsteci`; razlika daje neočekivane isteke. Trening nema namjerni istek. Raniji rezultati mjerenja ne prepravljaju se zbog promjene politike.

`GET /api/admin/statistike/posluzitelj` zahtijeva admin sesiju i vraća `Cache-Control: no-store`. Pregled se osvježava svakih 5 s dok je kartica vidljiva. Povijest čuva najviše 180 uzoraka (15 minuta) u memoriji; restart briše povijest i brojače. Ne sadrži tokene, IP adrese, sadržaj zahtjeva ni korisničke identitete.

CPU je potrošnja Node procesa izražena u postotku jednog jezgrenog procesora (može prijeći 100 %); RSS, heap i vanjska memorija također pripadaju aplikaciji, ne cijelom VPS-u. HTTP p95 i 5xx odnose se na završene poslovne `/api/` zahtjeve u prozoru; javni health, HTML/statičke datoteke i admin rute ne ulaze u taj prozor. Socket.IO brojači prate prihvat/odbijanje transporta, autorizaciju i prekide, ali ne vide mrežni timeout koji nikad ne stigne do servera. Baza se provjerava periodično, bez upita pri svakom admin osvježavanju. Javna health shema ostaje kompatibilna; event-loop p95 čita dovršeni petosekundni uzorak i poziv ga ne resetira.

Email alarmi su izričito uključivi preko `NADZOR_EMAIL_OMOGUCEN=true`, samo na stagingu/produkciji, i šalju se na `DEV_MAIL` postojećim servisom. Prvih 60 s nakon pokretanja nema alarma. Zadani pragovi: CPU > 90 % jednog jezgrenog procesora, RSS > 1024 MiB, event-loop p95 > 100 ms i poslovni HTTP p95 > 1000 ms ili 5xx >= 1 %. Degradacija mora trajati 2 minute; HTTP alarm traži najmanje 20 zahtjeva u svakoj minuti. Dvije uzastopne neuspjele DB provjere i novi botovi isteci/tehničke greške također stvaraju alarm. Pragovi CPU/RSS/latencija su konfigurabilni. Isti alarm ponavlja se najviše jednom u 15 minuta; oporavak šalje zasebnu poruku. Neuspjelo slanje prikazuje se u adminu i zapisuje bez tajni; ograničeni ponovni pokušaj ne blokira zahtjeve. Admin može izričito poslati probnu obavijest (najviše jednom u minuti); prihvat mail servisa nije dokaz primitka u inboxu.

Alarm iz aplikacije ne može javiti potpuno gašenje procesa/VPS-a, prekid mreže ili kvar samog mail servisa. Za to je potrebna zasebna vanjska provjera `/zdravlje` (npr. UptimeRobot). Ona nije automatski konfigurirana ovom implementacijom. Prije produkcije uključiti vanjsku provjeru i potvrditi primitak probnog emaila.

### VPS preko konzole

HTTP alarm latencije traži da barem polovica zahtjeva posljednje minute pripada petosekundnim intervalima s p95 iznad praga; ne radi se o izračunu jedinstvenog minutnog p95. DB provjera ima rok 3 s; dok jedan upit ne završi, novi se ne otvara, a svako sljedeće desetosekundno opažanje isteklog upita računa se kao nedostupnost. Time su provjere ograničene i kod neodgovarajuće baze.

Spojiti se postojećim SSH ključem uz `StrictHostKeyChecking=yes`, zatim koristiti `docker stats` za CPU/RAM pojedinih kontejnera i `top` za cijeli VPS. `free -h` prikazuje raspoloživu memoriju (`available`, ne samo `free` jer Linux koristi cache); `df -h` pokazuje slobodan disk. Aplikaciji se ne daje Docker socket niti administratorske ovlasti. Dnevnici: `docker compose -f docker-compose.staging.yml logs -f --tail 100 aplikacija` (za produkciju odgovarajući Compose). `Ctrl+C` zatvara samo pregled. Ne restartati server tijekom aktivnih partija samo radi zatvaranja konzole.

Kod alarma pregledati vrijeme/izdanje i trend, zatim `docker stats`, `top`, dostupni RAM/disk i aplikacijske/DB dnevnike. Ne povećavati limite niti proglašavati kapacitet samo zbog niskog CPU-a. Visoki CPU po jezgru ne mora značiti da je cijeli VPS zauzet. Podaci admina nisu trajna evidencija performansi.

## Dnevnici (logovi)

- **pino** strukturirani JSON logovi na stdout; ciljna Compose konfiguracija koristi Dockerov `local` logging driver ili izričita ograničenja `max-size`/`max-file`.
- Svaki zapis nosi kontekst: `partijaId`, `igracId` (UUID, ne email!), događaj.
- Razine: `info` (životni ciklus partija, prijave), `warn` (odbijeni potezi izvan protokola, rate limit), `error` (iznimke).
- Pregled na VPS-u: `docker compose logs -f aplikacija` — za MVP dovoljno; centralizacija tek s više strojeva.
- Caddy pristupni log ne zapisuje Authorization zaglavlje, kolačiće, token ni tijelo zahtjeva. IP adrese imaju kratku operativnu retenciju definiranu na stranici privatnosti.
- Server i logovi koriste UTC. Pri komunikaciji korisnicima vrijeme se pretvara u Europe/Zagreb.

## Što se obavezno loga

| Događaj                                   | Razina | Zašto                                        |
| ----------------------------------------- | ------ | -------------------------------------------- |
| Start poslužitelja + broj učitanih riječi | info   | Prazan rječnik = mrtva igra                  |
| Početak/kraj partije s trajanjem          | info   | Osnovna vitalnost                            |
| Eliminacija s razlogom                    | info   | Distribucija razloga = balans (vidi metrike) |
| Nova prijava greške                       | info   | Dupla potvrda uz email                       |
| Prekid veze u partiji                     | warn   | Skok = mrežni/infra problem                  |
| Neuhvaćena iznimka                        | error  | Uvijek istražiti                             |
| Start aplikacije + verzija/digest         | info   | Dokazuje koji je artefakt stvarno pokrenut   |
| Rezultat migracije i uvoza                | info   | Bez SQL sadržaja i tajni; deploy trag        |
| Neuspjelo transakcijsko slanje emaila     | error  | Samo kontekst i status; bez tokena, poruke i pune adrese |

## Health check

**Implementirani javni ugovor:** `GET /zdravlje` provjerava bazu i učitani rječnik te vraća sigurna, strojno stabilna polja. Endpoint ne traži staging Basic Auth:

```json
{
  "ok": true,
  "baza": "dostupna",
  "brojRijeci": 32846,
  "aktivnePartije": 0,
  "aktivneVeze": 0,
  "rssBajtovi": 268435456,
  "heapUsedBajtovi": 134217728,
  "heapTotalBajtovi": 201326592,
  "eventLoopP95Ms": 4.2,
  "aktivniTreninzi": 0,
  "botoviUPartiji": 0,
  "fondSlobodni": 40,
  "fondIscrpljenja": 0,
  "botIsteci": 0,
  "botTehnickeGreske": 0,
  "botoviDvoboj": false,
  "botoviCetveroboj": false,
  "uptimeSekunde": 1234,
  "verzija": "sha-0123456789abcdef",
  "digest": "sha256:PLACEHOLDER"
}
```

- HTTP 200 znači: proces odgovara, baza prihvaća provjeru i `brojRijeci > 0`.
- HTTP 503 znači: proces je živ, ali baza nije dostupna ili je rječnik prazan/neučitan. Tijelo zadržava istu shemu, `ok: false` i siguran opis komponente; ne vraća stack trace, konekcijski string ni SQL grešku.
- Neočekivana shema, pogrešan digest ili timeout također ruše deploy check čak i ako je HTTP status 200.
- Broj aktivnih partija je informacija operateru, ali produkcijski workflow prema odluci ne blokira deploy na temelju te brojke.
- Metrike računalnih protivnika ([ADR-017](../03-arhitektura/odluke/017-botovi-i-zagrijavanje.md)) su samo brojevi bez identiteta: `eventLoopP95Ms` je p95 kašnjenja event-loopa od prošlog health poziva (resetira se po zahtjevu), `aktivniTreninzi` broj tekućih Zagrijavanja, `botoviUPartiji`/`fondSlobodni`/`fondIscrpljenja` stanje javnog fonda (iscrpljenja su kumulativni broj neuspjelih rezervacija), `botIsteci` kumulativne eliminacije bota istekom vremena, `botTehnickeGreske` kumulativne greške bot kontrolera, a `botoviDvoboj`/`botoviCetveroboj` jesu li popune reda uključene. Stres test (profil v5) i predtest popune odbijaju poslužitelj bez tih polja i ocjenjuju delte od početnog uzorka; `botIsteci` i `botTehnickeGreske` koji rastu izvan testa znak su zagušenja ili kvara i traže pregled dnevnika.

Endpoint koriste CI smoke test, staging/produkcijski deploy i UptimeRobot. Prazan rječnik je pad: živi HTTP bez valjanih riječi nije zdrava igra.

## Praćenje ručnog staging pokusa

Veliki pokus nije dio običnih testova, CI-ja, pusha ni objave. Pokretati ga samo na izričit nalog, po jednu razinu: **100 → 500 → 1000 → 2000 → 5000 → 10000**. Najviša stabilna razina može biti manja od 10000. Ne objavljivati aplikaciju ni mijenjati rječnik tijekom mjerenja.

### Prvi terminal: lokalni generator

Prije pokusa pregledati `pnpm --filter posluzitelj opterecenje:status`, prethodni TXT/JSON i spremljeni digest. To je lokalna evidencija, ne dohvat aktualnog staginga. Detaljni preduvjeti i naredbe nalaze se u [testiranje.md](../06-razvoj/testiranje.md#priprema-staging-pokusa).

Prvi staging pokus ima 100 ukupnih korisnika i deset minuta držanja nakon rampe. Pokreće se zasebnom naredbom `test:opterecenje:mijesano`, zatim unosom `POKRENI 100`. Sljedeći pokus zahtijeva zasebnu naredbu i `POKRENI 500`, i tako dalje. Razina 10000 uz to zahtijeva `--potvrdi-10000=DA`. Ne unositi potvrdu prije pregleda prethodnog izvještaja i VPS metrika.

Kad su za termin uključeni računalni protivnici, redoslijed je: predtest popune reda (`test:opterecenje:popuna`, `POKRENI 20`, oko 10 minuta) → pregled sažetka i `/admin/statistike/cekanje` → miješani test razina po razina. Miješani profil v5 uključuje treninge protiv Računala (100 na razini 10000); živi status prikazuje redak `Treninzi x/y; Računalo u partijama; isteci Računala; event-loop p95`. Rast isteka Računala ili event-loop p95 iznad 100 ms tijekom držanja znak je da je poslužitelj zagušen i razina ne prolazi, bez obzira na HTTP metrike.

Generator prikazuje faze i periodični status, ali **ne mjeri živi HTTP promet ni CPU cijelog VPS-a**. `Veze` su stvarni Socket.IO korisnici; `aktivni sudionici` isključuju čekanje, eliminirane igrače i rezultate. Ne dodavati rezervne botove radi umjetnog održavanja 7000 aktivnih sudionika. Finalni HTTP dokaz dolazi iz k6-a, a CPU/RAM generatora iz Node procesa.

### Drugi terminal: VPS preko SSH-a

Koristiti provjereni SSH pristup iz sigurnog spremišta. Trenutačni staging postupak koristi `root`, direktorij `/opt/kaladont` i servise `aplikacija`, `baza`, `caddy`; vidi [objava-staginga-za-pocetnike.md](objava-staginga-za-pocetnike.md#5-provjeriti-staging-prije-promjene). Ovdje ne pretpostavljamo da je SSH pristup uspješno provjeren niti ga automatski otvaramo.

Na staging VPS-u najprije potvrditi host, zdravlje servisa, točno izdanje i slobodne resurse, bez ispisivanja cijelog `.env`:

```bash
cd /opt/kaladont
hostname
docker compose -f docker-compose.staging.yml ps
grep -E '^(KALADONT_IMAGE|VERZIJA|DIGEST)=' .env
free -h
df -h
```

Za žive CPU, RAM, mrežne i diskovne pokazatelje postojećih kontejnera:

```bash
docker compose -f docker-compose.staging.yml stats aplikacija baza caddy
```

`Ctrl+C` u ovom SSH prikazu zaustavlja **prikaz statistike**, ne lokalni generator. Za pregled grešaka prekinuti prikaz statistike pa provjeriti dnevnike; ne ispisivati tajne ili sadržaj računa:

```bash
docker compose -f docker-compose.staging.yml logs --since 10m --tail 200 aplikacija baza caddy
```

Po potrebi kratko provjeriti konekcije i čekanje na zaključavanja stvarne **staging** baze; ove naredbe ne mijenjaju podatke:

```bash
docker compose -f docker-compose.staging.yml exec -T baza psql -U kaladont -d kaladont_staging -c "SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state;"
docker compose -f docker-compose.staging.yml exec -T baza psql -U kaladont -d kaladont_staging -c "SELECT pid, state, wait_event_type, wait_event FROM pg_stat_activity WHERE datname = current_database() AND (wait_event_type = 'Lock' OR state = 'idle in transaction');"
```

Prije početka potvrditi zasebnu staging bazu, važeći rječnik, točan `STAGING_TEST_IP`, lease i samo staging limite. Za svaku razinu sačuvati opažanja VPS statistike i relevantne greške uz `runId`; generator ih ne prikuplja automatski. Pino/Caddy/SQL izlaze ne objavljivati bez pregleda osjetljivih podataka.

### Završetak i odluka

Pročitati `sazetak.txt` i neuspjele provjere u `rezultat.json` iz `%LOCALAPPDATA%\Kaladont\opterecenje\<runId>` (na drugim sustavima `~/.kaladont/opterecenje/<runId>`). Provjeriti sva tri načina igre, HTTP držanje, latencije, trajne rezultate, duplikate i preostale veze/sobe. Povratak u uobičajene limite i uklanjanje privremene IP iznimke obvezni su nakon dogovorenog termina; ne mijenjati produkciju.

PROŠAO znači samo da je određeni profil i izdanje zadovoljilo tehničke kriterije. Nova veća razina **nije automatski odobrena**. NIJE PROŠAO ili PREKINUT znače da povećanje nije dopušteno; prvo provjeriti razlog, dnevnike i zasićenje resursa. Kasni prekid ili neuspješno čišćenje/zapis ne smiju se smatrati prolazom. Nepotpuna mapa nakon prisilnog gašenja nije dokaz kapaciteta. Lokalni smoke od 13 korisnika provjerava generator, ne kapacitet staginga.

## Vanjski nadzor

### UptimeRobot

- Provjerava `https://kaladont.hr/zdravlje` svakih 5 minuta i očekuje HTTP 200.
- Staging health koristi deploy workflow; stalni vanjski staging monitor nije potreban za MVP.
- Alarm i poruka oporavka šalju se samo na operaterov email.
- Prije lansiranja namjerno se izazove probni pad monitora, potvrdi dolazak alarma i zatim poruka oporavka.

### Healthchecks.io

Zaseban check prati svaki periodični posao: produkcijski backup, forumski off-server backup i provjeru diska. Systemd service šalje `/start`, zatim success ili `/fail`; ako se očekivani ping ne pojavi unutar grace perioda, Healthchecks.io šalje email.

Ping URL je tajna jer ga netko drugi može lažno označiti uspješnim. Čuva se u Bitwardenu i konfiguraciji odgovarajućeg VPS-a, ne u gitu. Šalje se samo stanje i vrijeme izvršenja; stdout, stderr, putanja backupa, IP, dump i podaci igrača ne šalju se Healthchecks.io.

Backup se očekuje jednom dnevno nakon 04:00 UTC. Provjera zauzeća diska izvodi se periodično i pada kada bilo koji relevantni filesystem prijeđe 80 %. Točan OnCalendar izraz i grace period definiraju se u verzioniranim systemd jedinicama.

Politika i postupak backupa nalaze se u [runbooku backupa i vraćanja](runbook-backup-i-vracanje.md).

## Praćenje grešaka klijenta

MVP: globalni `window.onerror` handler šalje sažetak na poslužitelj (`POST /greske-klijenta`, rate-limitirano) — bez vanjskog servisa. Sentry se uvodi tek ako obujam grešaka to opravda. Poruka ne šalje email, token, unesenu riječ ni drugi korisnički sadržaj.

## Alarmi (minimalni skup)

| Signal                                                     | Kanal                   | Prva reakcija                                                                                   |
| ---------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| Produkcijski health nije 200 dulje od 5 min                | UptimeRobot email       | Otvoriti [incidentni postupak](incidentni-postupak.md), provjeriti utjecaj i zadnju promjenu    |
| Disk > 80 % ili provjera nije izvršena                     | Healthchecks.io email   | Provjeriti `df -h`, Docker slike/logove i backup retenciju; ne brisati aktivni/prethodni digest |
| Backup, enkripcija, prijenos ili verifikacija nisu uspjeli | Healthchecks.io email   | Ispraviti uzrok, ručno ponoviti backup i potvrditi udaljenu datoteku; ne čekati sljedeći dan    |
| Crveni staging/produkcijski workflow                       | GitHub email/UI         | Ne ponavljati naslijepo; spremiti log i odrediti korak koji je djelomično izvršen               |
| Nijedna partija 24 h nakon lansiranja                      | ručni produktni pregled | Nije infrastrukturni alarm; vidi [metrike uspjeha](../01-proizvod/metrike-uspjeha.md)           |

Redovite provjere (dnevne/tjedne/mjesečne) i tko što radi: [odrzavanje.md](odrzavanje.md).
