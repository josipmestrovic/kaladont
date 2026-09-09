# Nadzor i dnevnici

Skromno, ali dovoljno da se kvar ne otkriva od igrača: strukturirani lokalni logovi, javni health check, dnevne kopije baze i heartbeat periodičnih poslova.

> **Status:** Pino logovi i osnovni `/zdravlje` postoje. Prošireni health ugovor, Docker rotacija, UptimeRobot, Healthchecks.io te systemd poslovi još su ciljano stanje Faze 8. Ne postavljati monitor prema zamišljenom payloadu dok endpoint nije implementiran i testiran.

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

## Health check

**Danas:** `GET /zdravlje` vraća samo `{ "ok": true, "brojRijeci": N }`, uvijek sa statusom 200. Ne provjerava bazu, broj aktivnih partija, uptime ni digest. To nije dovoljno za deploy ili produkcijski monitoring.

**Ciljani javni ugovor:** endpoint ne traži staging Basic Auth i vraća sigurna, strojno stabilna polja:

```json
{
  "ok": true,
  "baza": "dostupna",
  "brojRijeci": 32846,
  "aktivnePartije": 0,
  "uptimeSekunde": 1234,
  "verzija": "sha-0123456789abcdef",
  "digest": "sha256:PLACEHOLDER"
}
```

- HTTP 200 znači: proces odgovara, baza prihvaća provjeru i `brojRijeci > 0`.
- HTTP 503 znači: proces je živ, ali baza nije dostupna ili je rječnik prazan/neučitan. Tijelo zadržava istu shemu, `ok: false` i siguran opis komponente; ne vraća stack trace, konekcijski string ni SQL grešku.
- Neočekivana shema, pogrešan digest ili timeout također ruše deploy check čak i ako je HTTP status 200.
- Broj aktivnih partija je informacija operateru, ali produkcijski workflow prema odluci ne blokira deploy na temelju te brojke.

Endpoint koriste CI smoke test, staging/produkcijski deploy i UptimeRobot. Prazan rječnik je pad: živi HTTP bez valjanih riječi nije zdrava igra.

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
