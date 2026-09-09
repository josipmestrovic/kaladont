# Runbook: objava i vraćanje unatrag

Postupci za svakodnevne objave. Release identitet, statusi i checkliste opisani su u [release shemi](release-shema.md), automatika u [ci-cd.md](ci-cd.md), a ovdje je ono što radi čovjek. Pravilo: **promocija u produkciju uvijek nosi digest koji je već prošao staging** — nikad svježi build, nikad ručni SSH deploy.

> **Status: djelomično izvedivo.** CI, Docker smoke test i GHCR objava postoje. Staging je ručno postavljen i ručno se ažurira digestom. Automatski staging deploy i produkcijska promocija workflowom još ne postoje; koraci koji ih pretpostavljaju ostaju ciljani budući postupak.

## Prije svakog release kandidata

1. Promjena je na radnoj grani i ima Pull Request (PR) prema `main`.
2. CI, testovi i po potrebi Docker smoke test stvarne slike su zeleni.
3. Operater razumije migracije, konfiguracijske promjene i način rollbacka prije mergea.
4. Za očekivani prekid dulji od 5 minuta objavljena je forumska obavijest i banner najmanje 24 sata unaprijed. Banner mora doći u ranijem izdanju; deploy koji ruši aplikaciju ne može sam najaviti vlastiti početak.
5. Redovni kratki deploy nema posebnu najavu, ali se izvodi u doba slabog prometa jer nema automatskog čekanja aktivnih partija.

## Redovna objava

1. **Spoji PR u `main`** tek kada su obvezne provjere zelene. CI zatim objavljuje image u GHCR-u.
2. **Zabilježi release kandidata** prema [release shemi](release-shema.md#predložak-zapisa-releasea): puni digest, commit SHA, workflow run, prethodni staging digest, kratak opis promjene i početni status `kandidat`.
3. **Ručno ažuriraj staging** punim `sha256:...` digestom iz GHCR workflowa i rekreiraj samo aplikaciju. Dok automatski staging workflow ne postoji, ovo je službeni staging postupak, ne zaobilaženje procesa.
4. **Provjeri staging** bez Basic Autha; staging je privremeno javno dostupan uz `noindex`:
   - `/zdravlje` vraća 200;
   - landing, registracija/prijava, red i WebSocket rade;
   - odigraj cijelu partiju u četiri odvojene pregledničke sesije, od reda do rezultata;
   - provjeri potez, odbijanje riječi, „Ne znam”, timer/eliminaciju, reakciju, povijest, bodove i povratak na novu igru;
   - ciljano provjeri svako područje koje je promjena dirala;
   - za email promjenu potvrdi stvarnu isporuku samo točno allowlistanoj adresi i odbijanje adrese izvan popisa;
   - za baznu promjenu pregledaj migracijski korak i potvrdi da stara aplikacija može raditi nad novom shemom barem jedan ciklus.
5. **Zabilježi staging rezultat** kao `staging-provjereno` ili `odbačeno`. Ne promoviraj i ne dijeli closed testerima poznatu grešku uz obećanje da će se popraviti poslije.
6. **Za closed test release** pošalji testerima samo staging link, kratku napomenu što se testira i način prijave greške. Popis testera i privatni kontakt podaci ne ulaze u git.
7. **Za buduću produkciju odaberi vrijeme slabog prometa.** Workflow ne blokira aktivne partije; zamjena procesa može ih prekinuti.
8. **Pokreni `promoviraj-produkciju`** preko Actions → Run workflow i unesi puni staging digest. Nema dodatnog Environment odobrenja jer postoji jedan operater. Ovaj korak je ciljano stanje dok produkcijski workflow ne postoji.
9. **Prati svaki korak:** prethodni digest, svježi šifrirani off-server backup, migracije, pull istog digesta, zamjena i health check. Crveni korak nije poziv na naslijepo ponovno pokretanje.
10. **Provjeri produkciju:** `/zdravlje` vraća 200 i očekivani digest; landing, Pravila, O igri, Privatnost i Uvjeti rade; zatim odigraj cijelu partiju u četiri odvojene sesije. Ta partija ostaje u običnoj statistici.
11. **Pregledaj logove** bez ispisivanja tajni:

   ```bash
   ssh kaladont@PROD_IP 'cd /opt/kaladont && docker compose -f docker-compose.prod.yml logs --since 10m aplikacija'
   ```

12. U [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata) upiši vrijeme, status, digest, commit SHA, workflow, rezultat, trajanje prekida i identitete/ID probne produkcijske partije kako bi se mogla prepoznati u malom uzorku metrika.

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

1. **Spremi dokaze prije restarta:** problematični digest, health odgovor, workflow sažetak i relevantne logove od trenutka deploya. Ne troši cijeli rollback cilj na dubinsku dijagnostiku.
2. **Potvrdi prethodni digest** iz upravo završenog workflowa i GitHub Deployments zapisa. Mora biti puni digest, ne `latest` ili SHA tag.
3. **Pokreni isti ručni produkcijski workflow** s prethodnim poznato-zdravim digestom. Ne rebuildaj i ne mijenjaj datoteke SSH-om.
4. **Prati health check** i potvrdi da javni `/zdravlje` prikazuje vraćeni digest.
5. **Provjeri ključne stranice i cijelu partiju** čim je servis vraćen. Ako stara verzija također ne radi, prijeđi na bazni/infrastrukturni incident umjesto ponavljanja deploya.
6. **Zapiši incident i vremena:** detekcija, odluka, početak rollbacka i povrat usluge. Uzrok se poslije reproducira na stagingu.

**Važno za bazu:** rollback vraća samo aplikaciju. Migracije su dizajnirane unatrag-kompatibilno (expand/contract), pa starija aplikacija radi nad novijom shemom barem jedan ciklus. Ako je migracija sama uzrok kvara, to je incident nad bazom — vidi [runbook-backup-i-vracanje.md](runbook-backup-i-vracanje.md), ne „rollback migracije na živo".

Restore baze nije prvi odgovor na loš deploy. Znači stvarni gubitak novijih podataka i koristi se tek kada je baza potvrđeno oštećena ili logički nepopravljiva.

## Hitna objava (hotfix)

Isti put, samo usmjerenije: PR → zeleni CI + smoke → staging → cijela partija i provjera konkretnog popravka → ručna promocija. Koraci se **ne preskaču**. Ako je sigurnosni rizik veći od kratkog prekida, forum/banner najava može biti kraća od 24 sata, ali razlog se zapisuje u incident.
