# Runbook: objava i vraćanje unatrag

Postupci za svakodnevne objave. Release identitet, statusi i checkliste opisani su u [release shemi](release-shema.md), automatika u [ci-cd.md](ci-cd.md), a ovdje je ono što radi čovjek. Pravilo: **promocija u produkciju uvijek nosi digest koji je već prošao staging** — nikad svježi build, nikad ručni SSH deploy.

> **Status: djelomično izvedivo.** CI, Docker smoke test, GHCR promotion, automatski staging i ručni workflow **Promoviraj produkciju** postoje. Produkcijski run zahtijeva Environment `produkcija`, `PROD_*` tajne, VPS `.env` i (nakon backup PR-a) instaliran off-server backup; do tada backup gate namjerno blokira deploy prije migracija.

## Prije svakog release kandidata

1. Promjena je na radnoj grani i ima Pull Request (PR) prema `main`.
2. CI, testovi i po potrebi Docker smoke test stvarne slike su zeleni.
3. Operater razumije migracije, konfiguracijske promjene i način rollbacka prije mergea.
4. Za očekivani prekid dulji od 5 minuta objavljena je forumska obavijest i banner najmanje 24 sata unaprijed. Banner mora doći u ranijoj objavi; deploy koji ruši aplikaciju ne može sam najaviti vlastiti početak.
5. Redovni kratki deploy nema posebnu najavu, ali se izvodi u doba slabog prometa jer nema automatskog čekanja aktivnih partija.

## Redovna objava

1. **Spoji PR u `main`** tek kada su obvezne provjere zelene. CI zatim objavljuje image u GHCR-u.
2. **Zabilježi release kandidata** prema [release shemi](release-shema.md#predložak-zapisa-releasea): puni digest, commit SHA, workflow run, prethodni staging digest, kratak opis promjene i početni status `kandidat`.
3. **Pričekaj automatski staging workflow**. On koristi isti puni `sha256:...` digest, šalje verzionirane konfiguracije, izvršava migracije, rekreira aplikaciju i Caddy te provjerava health. Sažetak runa najavljuje i vrstu sljedeće promocije: `IZDANJE vYYYY.MM.DD` ili tiho ažuriranje. Upozorenje u toj najavi riješi prije promocije (vidi [Što ako](#što-ako)).
4. **Provjeri staging** health (javni `/zdravlje`); ostatak sitea traži cookie gate (`/pristup`), uz `noindex`:
   - `/zdravlje` vraća 200;
   - landing, registracija/prijava, red i WebSocket rade;
   - odigraj cijelu partiju u četiri odvojene pregledničke sesije, od reda do rezultata;
   - provjeri potez, odbijanje riječi, „Ne znam”, timer/eliminaciju, reakciju, povijest, bodove i povratak na novu igru;
   - ciljano provjeri svako područje koje je promjena dirala;
   - za email promjenu potvrdi stvarnu isporuku na testnim adresama i različitim uređajima;
   - za baznu promjenu pregledaj migracijski korak i potvrdi da stara aplikacija može raditi nad novom shemom barem jedan ciklus.
5. **Zabilježi staging rezultat** kao `staging-provjereno` ili `odbačeno`. Ne promoviraj i ne dijeli closed testerima poznatu grešku uz obećanje da će se popraviti poslije.
6. **Za closed test release** pošalji testerima samo staging link, kratku napomenu što se testira i način prijave greške. Popis testera i privatni kontakt podaci ne ulaze u git.
7. **Odaberi vrijeme slabog prometa.** Workflow ne blokira aktivne partije; zamjena procesa može ih prekinuti.
8. **Pokreni Actions → Promoviraj produkciju → Run workflow** i unesi puni staging digest (`sha256:` + 64 hex). Nema dodatnog Environment odobrenja jer postoji jedan operater. Workflow odbija digest bez uspješnog staginga; backup gate mora proći prije migracija. Vrstu objave workflow prepoznaje sam: novo izdanje čiji datum nije današnji zaustavlja prije backupa i produkcije.
9. **Prati svaki korak:** vrsta objave, prethodni digest, svježi šifrirani off-server backup, migracije, pull istog digesta, zamjena i health check. Crveni korak nije poziv na naslijepo ponovno pokretanje.
10. **Provjeri produkciju:** `/zdravlje` vraća 200 i očekivani digest; landing, Pravila, O igri, Privatnost i Uvjeti rade; zatim odigraj cijelu partiju u četiri odvojene sesije. Ta partija ostaje u običnoj statistici. Ako je objava izdanje, provjeri i korake iz odjeljka [Izdanje](#izdanje-objava-s-unosom-u-novostima).
11. **Pregledaj logove** bez ispisivanja tajni:

```bash
ssh kaladont@PROD_IP 'cd /opt/kaladont && docker compose -f docker-compose.prod.yml logs --since 10m aplikacija'
```

12. U [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata) upiši vrijeme, status, digest, commit SHA, oznaku izdanja (ili „tiho ažuriranje”), workflow, rezultat, trajanje prekida i identitete/ID probne produkcijske partije kako bi se mogla prepoznati u malom uzorku metrika.

## Izdanje: objava s unosom u Novostima

Izdanje je redovna objava koja igračima donosi novi datirani zapis u Novostima i novi datum „Zadnje ažuriranje” na naslovnici. Pravila su u [release shemi](release-shema.md#objava-i-izdanje); ovdje je samo ono što radiš drukčije.

1. **Na dan objave** otvori PR koji u `aplikacije/web/src/lib/izdanja.json` nacrtu mijenja `"objavljeno": null` u današnji datum (npr. `"2026-11-23"`) i po potrebi usklađuje stavke sa stvarnim sadržajem. Datum mora biti dan stvarne promocije u zoni Europe/Zagreb.
2. Nakon spajanja prođi korake 1–7 redovne objave. Sažetak runa **Objaviti staging** mora najaviti `IZDANJE v2026.11.23`; na stagingu provjeri naslovnicu i `/novosti`.
3. **Istoga dana** pokreni **Promoviraj produkciju**. Ako datum u slici nije današnji, workflow staje prije backupa i produkcije, a sažetak kaže što popraviti.
4. Nakon deploya pričekaj job **Objaviti CalVer oznaku i GitHub Release**. Zatim provjeri naslovnicu, `/novosti` i stranicu Releases na GitHubu.
5. U evidenciju uz digest upiši i oznaku izdanja.

Oznaku i GitHub Release ne stvaraj ručno unaprijed. Postojeća oznaka za workflow znači „već objavljeno”, pa bi promocija prošla kao tiho ažuriranje.

## Kada NE objavljivati

- Vrijeme visokog prometa (večer, vikend) — osim za hitne sigurnosne popravke.
- Crveni ili preskočeni smoke test — bez iznimke.
- Neprovjeren staging („radilo je lokalno" ne postoji kao argument — lokalno nema Dockera).
- Nepoznat prethodni produkcijski digest ili neuspješan off-server backup.
- Migracija koja nije unatrag kompatibilna i nema zaseban odobren postupak.
- Aktivni incident, pun disk ili nedovoljno prostora za privremeni dump/migraciju.
- Petak navečer, ako sutradan nitko ne prati alarme.

## Rollback (vraćanje prethodne verzije)

Automatskog rollbacka nema. Kada nova verzija pokaže kvar, cilj je vratiti aplikaciju unutar **15 minuta**:

1. **Spremi dokaze prije restarta:** problematični digest, health odgovor, workflow sažetak, deploy fazu, snapshot datoteku i relevantne logove od trenutka deploya. Ne troši cijeli rollback cilj na dubinsku dijagnostiku.
2. **Potvrdi prethodni digest** iz upravo završenog workflowa i GitHub Deployments zapisa. Mora biti puni digest, ne `latest` ili SHA tag.
3. **Pokreni isti ručni produkcijski workflow** s prethodnim poznato-zdravim digestom. Ne rebuildaj i ne mijenjaj datoteke SSH-om.
4. **Prati health check** i potvrdi da javni `/zdravlje` prikazuje vraćeni digest.
5. **Provjeri ključne stranice i cijelu partiju** čim je servis vraćen. Ako stara verzija također ne radi, prijeđi na bazni/infrastrukturni incident umjesto ponavljanja deploya.
6. **Zapiši incident i vremena:** detekcija, odluka, početak rollbacka i povrat usluge. Uzrok se poslije reproducira na stagingu.

Deploy skripta koristi privremeni kandidat `.env` za validaciju Composea, povlačenje slike i migracije. Stvarni `.env` smije dobiti novi release zapis tek nakon uspješnih migracija; ako padne ranije, ostaje na prethodnom zapisu ili ga skripta idempotentno vrati. Nakon faze `migracije_pokrenute` crveni workflow ostaje incident za ljudsku odluku: prvo sačuvaj dijagnostiku, zatim rollback aplikacije radi samo ako je nova shema potvrđeno kompatibilna sa starom aplikacijom. Ne vraćaj bazu i ne pokreći obrnuti SQL kao dio uobičajenog rollbacka.

**Važno za bazu:** rollback vraća samo aplikaciju. Migracije su dizajnirane unatrag-kompatibilno (expand/contract), pa starija aplikacija radi nad novijom shemom barem jedan ciklus. Ako je migracija sama uzrok kvara, to je incident nad bazom — vidi [runbook-backup-i-vracanje.md](runbook-backup-i-vracanje.md), ne „rollback migracije na živo".

Restore baze nije prvi odgovor na loš deploy. Znači stvarni gubitak novijih podataka i koristi se tek kada je baza potvrđeno oštećena ili logički nepopravljiva.

### Rollback i izdanja

- Rollback je za workflow uvijek tiho ažuriranje: oznaka izdanja na koje se vraćaš već postoji, a slika starija od sustava izdanja nema `izdanja.json`. Čuvar datuma ga ne blokira.
- Novosti i datum „Zadnje ažuriranje” vraćaju se sami, jer su dio slike. Oznaka i GitHub Release vraćenog izdanja ostaju; ne briši ih.
- Rollback na sliku stariju od sustava izdanja (commit `6d17dac` i ranije) vraća i staro ponašanje: `/novosti` preusmjerava na `/o-igri`, a naslovnica nema blok „Zadnje ažuriranje”.
- Ponovna objava ispravljenog izdanja je tiho ažuriranje s izvornim datumom.
- **Paket Troboj:** shema je aditivna, pa nova povijest Troboja i odabiri ostaju u bazi. Ne vraćaj stari binarni kod bez čitanja novih enum vrijednosti; koristi kompatibilan build koji gasi novi ulaz dok ispravak ide na staging.

## Tiho ažuriranje i hitni popravak

Brzi popravak ne traži novo izdanje. Put je isti kao za svaku objavu: PR → zeleni CI + smoke → staging → cijela partija i provjera konkretnog popravka → ručna promocija. Koraci se **ne preskaču**. U `izdanja.json` se ništa ne dodaje, pa workflow objavu prepoznaje kao tiho ažuriranje: nema oznake ni unosa u Novostima, a datum na naslovnici ostaje isti.

- Ako je sigurnosni rizik veći od kratkog prekida, forum/banner najava može biti kraća od 24 sata, ali razlog se zapisuje u incident.
- Popravak koji želiš spomenuti igračima dopiši kao stavku u postojeći zapis u `izdanja.json`. Datum i oznaka se ne mijenjaju.
- Nema hitne grane: produkcija dobiva samo ono što je na `main`. Dok `main` nosi neobjavljen paket, popravak izlazi zajedno s njim. Veliki paket zato spajaj na `main` tek kad je blizu objave.
- Ako sažetak upozori na nacrt izdanja, a slika već sadrži njegove promjene, tiha promocija objavila bi ih bez unosa u Novostima. Tada prvo upiši datum i objavi kao izdanje.

## Što ako

| Situacija | Što učiniti |
| --- | --- |
| Objava izdanja sklizne na sutra | Novi PR s novim datumom, pričekati CI i staging, promovirati istoga dana. |
| Workflow stane s porukom „Izdanje … nema oznaku …, a danas je …” | Datum u slici nije današnji. Ako izdanje još nije objavljeno, novim PR-om upiši današnji datum ili vrati `"objavljeno": null`. Ako je izdanje već na produkciji, a oznaka nedostaje, [stvori je ručno](#ručno-stvaranje-oznake-izdanja). |
| Workflow stane s porukom „Starije izdanje nema oznaku …” | Svako izdanje mora dobiti oznaku prije sljedećeg. Ako je starije izdanje na produkciji, [stvori njegovu oznaku ručno](#ručno-stvaranje-oznake-izdanja); ako nije, vrati mu `"objavljeno": null`. |
| Datum je upisan, ali se izdanje odgađa na neodređeno | Vrati `"objavljeno"` na `null`, da tiha ažuriranja opet prolaze. |
| Sažetak upozorava na nacrt izdanja | Ako slika već sadrži promjene iz nacrta, prvo upiši datum pa objavi kao izdanje. Ako ih ne sadrži, upozorenje se može zanemariti. |
| Promocija je uspjela, a job **Objaviti CalVer oznaku i GitHub Release** je pao | Produkcija je ažurirana; nedostaju oznaka i Release. Na runu odaberi **Re-run failed jobs** (ne **Re-run all jobs**, jer ponavlja i deploy). Ako opet padne, slijedi naredbu iz sažetka joba ili [stvori oznaku ručno](#ručno-stvaranje-oznake-izdanja), pa ponovi job. Dok oznake nema, od sutradan je blokirana promocija svake slike koja sadrži to izdanje. |
| Oznaka postoji, a GitHub Release ne | **Re-run failed jobs** na runu te promocije; job prihvaća postojeću oznaku na promoviranom commitu. Ako run više nije dostupan, stvori Release ručno (korak 3 u [ručnom stvaranju oznake](#ručno-stvaranje-oznake-izdanja)). |
| Rollback izdanja | Promoviraj prethodni digest. Novosti i datum vraćaju se sami; oznaka i Release ostaju. |
| Ponovna objava ispravljenog izdanja treba novi datum | `gh release delete <oznaka> --cleanup-tag --yes`, novim PR-om upiši novi datum i objavi kao novo izdanje. Dok oznake nema, čuvar blokira i promociju slike sa starim datumom. |
| Dva izdanja istoga dana | Drugom zapisu dodaj `"nastavak": 1`, trećem `"nastavak": 2`. |
| Hitan popravak dok `main` nosi neobjavljen paket | Nije podržano; popravak izlazi zajedno s paketom. |

### Ručno stvaranje oznake izdanja

Potrebno je samo kad je izdanje već na produkciji, a oznaka nije nastala ili je obrisana. Ne stvaraj oznaku za izdanje koje još nije na produkciji: workflow bi ga smatrao objavljenim.

1. Nađi puni commit SHA promovirane slike tog izdanja: redak „Novi commit” u sažetku runa **Promoviraj produkciju** ili polje `verzija` na `https://kaladont.hr/zdravlje` dok je to izdanje aktivno.
2. Stvori oznaku (primjer za izdanje od 23. 11. 2026.):

   ```bash
   gh api -X POST repos/josipmestrovic/kaladont/git/refs -f ref=refs/tags/v2026.11.23 -f sha=<puni-commit-sha>
   ```

   Ako GitHub odbije zahtjev (HTTP 403 ili 404), tokenu nedostaje opseg `workflow`. Potreban je kad se workflow datoteke na tom commitu razlikuju od onih na granama. Dodaj ga naredbom `gh auth refresh -h github.com -s workflow` i ponovi.

3. Stvori GitHub Release. Na runu promocije odaberi **Re-run failed jobs**: job sam stvara Release s bilješkama iz `izdanja.json`. Ako taj run više nije dostupan ili produkcija više ne prikazuje to izdanje kao najnovije, stvori ga ručno i tekst po potrebi dopuni na GitHubu:

   ```bash
   gh release create v2026.11.23 --repo josipmestrovic/kaladont --verify-tag --title "Kaladont | 23. 11. 2026." --notes "Javni zapis: https://kaladont.hr/novosti#izdanje-2026-11-23"
   ```
