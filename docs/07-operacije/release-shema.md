# Release shema

Ovaj dokument je operativni izvor istine za označavanje, provjeru i evidenciju releaseova. Arhitektonsku odluku definira [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md), CI i objavu slike opisuje [CI/CD](ci-cd.md), a ručne korake objave i rollbacka [runbook objave i rollbacka](runbook-objava-i-rollback.md).

> **Status 2026-09-09:** staging je online i ažurira se ručno punim GHCR digestom nakon zelenog CI-ja i GHCR objave. Automatski staging deploy, produkcijski VPS i produkcijski promotion workflow još nisu implementirani. Ova shema zato namjerno razlikuje današnji ručni tok od ciljanog produkcijskog toka.

## Cilj

Release mora odgovoriti na pet pitanja bez gledanja u privatne bilješke:

1. koji je točno artefakt objavljen;
2. koji ga je commit proizveo;
3. što je provjereno prije dijeljenja testerima ili produkcijom;
4. koja je odluka donesena nakon provjere;
5. na koji se prethodni poznato-zdravi digest možemo vratiti.

Za prve zatvorene testove ne uvodi se SemVer ni datumsko imenovanje. To bi dodalo ceremoniju prije nego postoji javni ritam izdanja. Autoritativan identitet releasea je puni image digest.

## Identitet releasea

| Polje | Pravilo |
| ----- | ------- |
| Digest | Puni `sha256:...` GHCR digest je jedini autoritativni artefakt za staging, produkciju i rollback. |
| Commit SHA | Puni Git commit SHA veže digest uz diff, PR i CI zapis. |
| Ljudski opis | Jedna rečenica: što release mijenja i što posebno treba testirati. |
| Status | Jedan od statusa iz ovog dokumenta. |

Nije dopušteno deployati `latest`, branch tag, lokalno buildanu sliku, skraćeni digest ili digest za koji nije jasno koji ga je workflow proizveo. Produkcija, kada bude postavljena, smije dobiti samo isti digest koji je prošao staging.

## Statusi

| Status | Značenje |
| ------ | -------- |
| `kandidat` | CI je zelen i GHCR je objavio sliku, ali staging provjera još nije završena. |
| `staging-provjereno` | Digest je na stagingu, health i ručne provjere su prošle, i može se dijeliti closed testerima ili promovirati dalje. |
| `odbačeno` | Staging je otkrio kvar ili neprihvatljiv rizik; digest se ne promovira i ne dijeli dalje. |
| `promovirano` | Isti digest je ručno promoviran u produkciju. |
| `rollbackano` | Release je zamijenjen prethodnim poznato-zdravim digestom. |

Status se zapisuje u [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata). Ako isti digest mijenja status, dodaje se novi redak umjesto prepisivanja starog.

## Kanali

| Kanal | Kako nastaje | Tko ga vidi | Izlaz |
| ----- | ------------ | ----------- | ----- |
| `main` kandidat | PR je spojen u `main`, CI je zelen i GHCR objava je uspjela. | Operater. | Digest spreman za ručni staging deploy. |
| Staging closed test | Operater ručno postavi digest na `staging.kaladont.hr` i provjeri ga. | Mali ručno odabrani krug testera. | `staging-provjereno` ili `odbačeno`. |
| Produkcija | Operater ručno promovira isti staging-provjereni digest u vrijeme slabog prometa. | Svi korisnici. | `promovirano` ili rollback. |

Staging tijekom prvih closed testova ostaje bez Basic Autha zbog Socket.IO promptova. Koristi `X-Robots-Tag: noindex, nofollow`, ali to nije kontrola pristupa. Link se dijeli samo malom ručno odabranom krugu testera. Prije šireg dijeljenja treba uvesti VPN, IP allowlist ili drugi gateway.

## Tok za današnji ručni staging

1. Napravi promjenu na radnoj grani i otvori PR prema `main`.
2. Prije mergea potvrdi da je CI zelen i da razumiješ migracije, konfiguracijske promjene i rollback rizik.
3. Spoji PR u `main`.
4. Pričekaj da [GHCR workflow](../../.github/workflows/objavi-ghcr.yml) objavi sliku.
5. Iz workflowa zapiši puni digest, puni commit SHA i poveznicu na workflow run.
6. Zapiši trenutno aktivni staging digest prije promjene.
7. Na staging VPS-u ručno postavi novi digest u `/opt/kaladont/.env`, povuci sliku i rekreiraj samo aplikaciju prema [runbooku objave](runbook-objava-i-rollback.md#redovna-objava).
8. Provjeri staging checklistu iz ovog dokumenta.
9. Zapiši rezultat kao `staging-provjereno` ili `odbačeno`.
10. Tek nakon statusa `staging-provjereno` pošalji link i napomene closed testerima.

Automatski staging workflow je kasnija automatizacija. Dok ne postoji, ručni staging deploy punim digestom nije zaobilaženje procesa nego službeni postupak.

## Checklist: prije mergea

- [ ] PR postoji i diff je pregledan kao cjelina.
- [ ] CI je zelen; Docker smoke test nije preskočen za promjene koje diraju build, startup, bazu, Caddy, Compose, migracije ili workflowe.
- [ ] Ako postoje migracije, stara aplikacija može raditi nad novom shemom barem jedan release ciklus.
- [ ] Ako se očekuje prekid dulji od 5 minuta, najava je objavljena najmanje 24 sata ranije kroz raniji release.
- [ ] Za promjene emaila provjereno je da staging allowlista i dalje fail-closed odbija adrese izvan popisa.
- [ ] Poznat je prethodni staging digest ili je jasno da se radi prvi deploy.

## Checklist: nakon GHCR objave

- [ ] Zabilježen je puni digest `sha256:...`.
- [ ] Zabilježen je puni commit SHA.
- [ ] Zabilježena je poveznica na CI/GHCR workflow run.
- [ ] Zabilježen je prethodni staging digest.
- [ ] Nije korišten `latest`, branch tag ni lokalni build.

## Checklist: staging provjera

- [ ] `https://staging.kaladont.hr/zdravlje` vraća 200.
- [ ] Ako endpoint prikazuje verziju i digest, vrijednosti odgovaraju release kandidatu.
- [ ] Landing, Pravila, O igri, Privatnost i Uvjeti rade.
- [ ] Registracija ili prijava rade, ovisno o području koje release dira.
- [ ] Red čekanja i WebSocket spajanje rade u odvojenim pregledničkim sesijama.
- [ ] Odigrana je cijela partija u četiri odvojene sesije, od reda do rezultata.
- [ ] Provjereni su prihvaćen potez, odbijena riječ, „Ne znam”, timer/eliminacija, reakcija, povijest, bodovi i povratak na novu igru.
- [ ] Ciljano je provjereno svako područje koje je release mijenjao.
- [ ] Pregledani su aplikacijski logovi za nove `error` zapise bez preuzimanja tajni ili osobnih podataka.

Ako bilo koja obavezna provjera padne, release dobiva status `odbačeno`. Ne promovira se i ne dijeli closed testerima uz napomenu „popravit ćemo poslije”.

## Checklist: closed test izlaz

Prije slanja linka testerima zapiši:

- digest i commit SHA;
- kratak opis promjene;
- što testeri trebaju posebno pokušati;
- poznata ograničenja koja su prihvatljiva za taj test;
- kriterij za prekid testa;
- način prijave greške.

Ne zapisuj privatne email adrese, lozinke, tokene ni osobne podatke testera u repozitorij. Ako treba voditi popis testera, drži ga izvan gita.

## Produkcijska promocija

Produkcijski dio je ciljano stanje dok produkcijski VPS i workflow ne postoje. Pravila vrijede već sada jer definiraju što se smije implementirati:

1. Produkcija prima samo digest koji ima status `staging-provjereno`.
2. Promocija se pokreće ručno i u vrijeme slabog prometa.
3. Prije produkcijske migracije mora uspjeti svježi šifrirani off-server backup kada backup automatika bude postavljena.
4. Produkcijski health mora vratiti 200 i očekivani digest.
5. Nakon promocije provjeravaju se ključne stranice i cijela partija u četiri odvojene sesije.
6. Release se zapisuje kao `promovirano`, uz trajanje prekida i ID probne produkcijske partije ako postoji.

Aktivne partije se u MVP-u ne čuvaju preko deploya. Zato se produkcija ne objavljuje u doba očekivanog prometa osim za hitni sigurnosni popravak.

## Rollback

Rollback je ručna promocija prethodnog poznato-zdravog digesta. Ne rebuilda se slika, ne koristi se `latest` i ne vraća se baza za običan loš deploy.

Cilj povrata aplikacije je 15 minuta:

1. spremi dokaze: problematični digest, health odgovor, workflow sažetak i relevantne logove;
2. potvrdi prethodni poznato-zdravi digest;
3. pokreni isti postupak promocije s prethodnim digestom;
4. potvrdi health i očekivani digest;
5. odigraj kratku produkcijsku provjeru čim je servis vraćen;
6. zapiši redak `rollbackano` i otvori zasebnu analizu uzroka.

Ako je problem u podacima ili migraciji, to je bazni incident i rješava se prema [runbooku backupa i vraćanja](runbook-backup-i-vracanje.md), ne naslijepim vraćanjem dumpa.

## Predložak zapisa releasea

| Polje | Vrijednost |
| ----- | ---------- |
| UTC vrijeme |  |
| Status | `kandidat` / `staging-provjereno` / `odbačeno` / `promovirano` / `rollbackano` |
| Digest | `sha256:` |
| Commit SHA |  |
| Workflow |  |
| Prethodni digest |  |
| Okruženje | staging / produkcija |
| Operater |  |
| Sažetak promjene |  |
| Ručna provjera |  |
| Odluka i napomena |  |

Za trajnu evidenciju koristi tablicu u [održavanju](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata). Ovaj predložak služi kao podsjetnik što treba prikupiti prije upisa.