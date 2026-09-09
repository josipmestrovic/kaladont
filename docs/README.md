# Dokumentacija projekta Kaladont

Kaladont je hrvatska višeigračka igra riječi na domeni **kaladont.hr**. Ova dokumentacija je jedini izvor istine projekta: svaka odluka o pravilima, arhitekturi i dizajnu ovdje je zapisana **prije** implementacije.

## Kako čitati

Folderi su numerirani redoslijedom čitanja. Novi suradnik kreće od `01-proizvod` i `02-pravila-igre`; developer koji ulazi u kod treba još `03-arhitektura` i `06-razvoj`.

## Kazalo

### 01 — Proizvod

| Dokument                                               | Sadržaj                           |
| ------------------------------------------------------ | --------------------------------- |
| [vizija-proizvoda.md](01-proizvod/vizija-proizvoda.md) | Što gradimo, za koga i zašto      |
| [opseg-mvp.md](01-proizvod/opseg-mvp.md)               | Što ulazi u MVP, a što svjesno ne |
| [metrike-uspjeha.md](01-proizvod/metrike-uspjeha.md)   | KPI-jevi i način mjerenja         |

### 02 — Pravila igre

| Dokument                                                         | Sadržaj                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| [pravila-igre.md](02-pravila-igre/pravila-igre.md)               | Službena pravila digitalne verzije           |
| [digrafi-i-grafemi.md](02-pravila-igre/digrafi-i-grafemi.md)     | nj/lj/dž kao jedno slovo, iznimke, algoritam |
| [bodovanje-i-rangovi.md](02-pravila-igre/bodovanje-i-rangovi.md) | Bodovi, rang-ljestvica, kalibracija          |
| [rubni-slucajevi.md](02-pravila-igre/rubni-slucajevi.md)         | Katalog svih rubnih slučajeva s odlukama     |

### 03 — Arhitektura

| Dokument                                                              | Sadržaj                                  |
| --------------------------------------------------------------------- | ---------------------------------------- |
| [pregled-arhitekture.md](03-arhitektura/pregled-arhitekture.md)       | Komponente sustava i tijek podataka      |
| [model-podataka.md](03-arhitektura/model-podataka.md)                 | Sve tablice baze s opisima               |
| [protokol-poruka.md](03-arhitektura/protokol-poruka.md)               | Socket.IO događaji klijent ↔ poslužitelj |
| [zivotni-ciklus-partije.md](03-arhitektura/zivotni-ciklus-partije.md) | Dijagram stanja partije                  |
| [odluke/](03-arhitektura/odluke/README.md)                            | Zapisi arhitektonskih odluka (ADR)       |

### 04 — Rječnik

| Dokument                                                    | Sadržaj                                |
| ----------------------------------------------------------- | -------------------------------------- |
| [izvor-i-licenca.md](04-rjecnik/izvor-i-licenca.md)         | hrLex, CC BY-SA 4.0, obveze atribucije |
| [uvoz-rjecnika.md](04-rjecnik/uvoz-rjecnika.md)             | Cjevovod uvoza riječi u bazu           |
| [odrzavanje-rjecnika.md](04-rjecnik/odrzavanje-rjecnika.md) | Prijave igrača i izmjene rječnika      |

### 05 — UX/UI

| Dokument                                                | Sadržaj                                   |
| ------------------------------------------------------- | ----------------------------------------- |
| [vizualni-identitet.md](05-ux-ui/vizualni-identitet.md) | Retro identitet, paleta, tipografija, ton |
| [tijek-korisnika.md](05-ux-ui/tijek-korisnika.md)       | Korisnički tokovi kroz aplikaciju         |
| [ekrani.md](05-ux-ui/ekrani.md)                         | Specifikacija svih ekrana                 |

### 06 — Razvoj

| Dokument                                                         | Sadržaj                            |
| ---------------------------------------------------------------- | ---------------------------------- |
| [postavljanje-okoline.md](06-razvoj/postavljanje-okoline.md)     | Od nule do pokrenutog localhosta   |
| [struktura-repozitorija.md](06-razvoj/struktura-repozitorija.md) | Monorepo raspored                  |
| [konvencije.md](06-razvoj/konvencije.md)                         | Jezik, imenovanje, commitovi, stil |
| [testiranje.md](06-razvoj/testiranje.md)                         | Što se testira i kako              |

### 07 — Operacije

Za prvu postavu kreni od **Operacije for dummies**. Ostali dokumenti u ovoj cjelini izvori su istine za pojedinu politiku ili runbook; početnički vodič ih povezuje u jedan redoslijed.

| Dokument                                                                        | Sadržaj                                                                                |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [operacije-for-dummies.md](07-operacije/operacije-for-dummies.md)               | Linearni vodič od nule: preduvjeti, staging, produkcija, backup, održavanje i recovery |
| [produkcija-i-objava.md](07-operacije/produkcija-i-objava.md)                   | Okruženja (staging/produkcija), Hetzner, Docker, Caddy, DNS                            |
| [dimenzioniranje-posluzitelja.md](07-operacije/dimenzioniranje-posluzitelja.md) | Procjena resursa i veličine servera po ulozi                                           |
| [ci-cd.md](07-operacije/ci-cd.md)                                               | GitHub Actions: CI, smoke test slike, staging, promocija digesta                       |
| [nadzor-i-dnevnici.md](07-operacije/nadzor-i-dnevnici.md)                       | Logovi, sigurnosne kopije, zdravlje sustava, alarmi                                    |
| [sigurnost-i-privatnost.md](07-operacije/sigurnost-i-privatnost.md)             | Zaštita, GDPR, rate limiting, izvršitelji obrade                                       |
| [vodic-postava-vps.md](07-operacije/vodic-postava-vps.md)                       | Početnički vodič: od praznog VPS-a do žive igre                                        |
| [vodic-postava-discourse.md](07-operacije/vodic-postava-discourse.md)           | Postava foruma na zasebnom VPS-u                                                       |
| [runbook-objava-i-rollback.md](07-operacije/runbook-objava-i-rollback.md)       | Postupak objave, promocije i vraćanja unatrag                                          |
| [runbook-backup-i-vracanje.md](07-operacije/runbook-backup-i-vracanje.md)       | Backup postupci i drill vraćanja                                                       |
| [incidentni-postupak.md](07-operacije/incidentni-postupak.md)                   | Što raditi kad nešto padne                                                             |
| [odrzavanje.md](07-operacije/odrzavanje.md)                                     | Dnevne/tjedne/mjesečne rutine održavanja                                               |

### 08 — Plan razvoja

| Dokument                                                                   | Sadržaj                                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [faze-razvoja.md](08-plan-razvoja/faze-razvoja.md)                         | Faze 0–9 s kriterijima završetka                            |
| [zajednica-i-rani-pristup.md](08-plan-razvoja/zajednica-i-rani-pristup.md) | Forum, organsko lansiranje i mjerenje javnog ranog pristupa |
| [buduce-znacajke.md](08-plan-razvoja/buduce-znacajke.md)                   | Što dolazi nakon MVP-a                                      |

## Ključne brojke (brzi podsjetnik)

| Parametar                | Vrijednost                                |
| ------------------------ | ----------------------------------------- |
| Igrača po partiji        | točno 4                                   |
| Vrijeme po potezu        | 30 sekundi                                |
| Bodovi po partiji (stol) | 10 (plasmani 6 + eliminacije 3 + bonus 1) |
| Maksimum po igraču       | 7 bodova                                  |
| Kalibracija              | 10 partija (rang „Piskaralo")             |
| Najviši rang             | Kaladont                                  |
