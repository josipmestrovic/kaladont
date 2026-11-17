# Release shema

Ovaj dokument je operativni izvor istine za označavanje, provjeru i evidenciju releaseova. Arhitektonske odluke definiraju [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md) (operativni model) i [ADR-018](../03-arhitektura/odluke/018-calver-izdanja-i-tiha-azuriranja.md) (izdanja), CI i objavu slike opisuje [CI/CD](ci-cd.md), a ručne korake objave i rollbacka [runbook objave i rollbacka](runbook-objava-i-rollback.md).

> **Stanje automatike (2026-11-17):** CI gradi i smoke-testira Docker candidate, GHCR promotion dodjeljuje commit SHA i `main` tag istom manifestu, a `objavi-staging.yml` automatski deploya isti digest i provjerava health. Operater i dalje ručno provodi staging checklistu. Produkciju promovira ručni workflow `promoviraj-produkciju.yml` uz staging gate i backup gate; isti workflow prepoznaje je li objava izdanje i tada, nakon provjere produkcije, stvara CalVer oznaku i GitHub Release. Ova napomena ne potvrđuje trenutačni digest ni status pojedinog izdanja.

## Cilj

Release mora odgovoriti na pet pitanja bez gledanja u privatne bilješke:

1. koji je točno artefakt objavljen;
2. koji ga je commit proizveo;
3. što je provjereno prije dijeljenja testerima ili produkcijom;
4. koja je odluka donesena nakon provjere;
5. na koji se prethodni poznato-zdravi digest možemo vratiti.

Puni GHCR digest ostaje autoritativan tehnički identitet releasea. CalVer oznaka izdanja služi javnoj komunikaciji (Novosti, GitHub Release): ne dobiva je svaka objava i sama po sebi ne dokazuje deploy ni staging provjeru (vidi [Objava i izdanje](#objava-i-izdanje)). Ne iskazivati dostupnost novih mogućnosti produkcijskim korisnicima prije `staging-provjereno` i eksplicitne promocije.

## Identitet releasea

| Polje            | Pravilo                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Digest           | Puni `sha256:...` GHCR digest je jedini autoritativni artefakt za staging, produkciju i rollback.     |
| Commit SHA       | Puni Git commit SHA veže digest uz diff, PR i CI zapis.                                               |
| Oznaka izdanja   | CalVer `vYYYY.MM.DD`, samo za javna izdanja; ne koristi se za deploy, migracije ni rollback.          |
| Ljudski opis     | Jedna rečenica: što release mijenja i što posebno treba testirati.                                    |
| Status           | Jedan od statusa iz ovog dokumenta.                                                                   |

Nije dopušteno deployati `latest`, branch tag, lokalno buildanu sliku, skraćeni digest ili digest za koji nije jasno koji ga je workflow proizveo. Produkcija smije dobiti samo isti digest koji je prošao staging.

## Objava i izdanje

Nije svaka produkcijska objava izdanje ([ADR-018](../03-arhitektura/odluke/018-calver-izdanja-i-tiha-azuriranja.md)).

| Pojam           | Značenje                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objava          | Svaka uspješna promocija digesta na produkciju.                                                                                                                                  |
| Izdanje         | Objava koja na produkciju prvi put donosi novi datirani zapis iz `aplikacije/web/src/lib/izdanja.json`. Dobiva CalVer oznaku, GitHub Release i unos u Novostima.                 |
| Tiho ažuriranje | Objava bez novog datiranog zapisa: popravci, sitnice, ponovna promocija i rollback. Nema oznake ni unosa u Novostima, a datum „Zadnje ažuriranje” na naslovnici ostaje isti.     |
| Nacrt           | Zapis s `"objavljeno": null`. Ne prikazuje se nigdje.                                                                                                                            |

`izdanja.json` je jedini izvor istine o izdanjima. Čitaju ga stranica Novosti i naslovnica, a skripte u `skripte/izdanja/` iz njega izvode oznaku, naslov i bilješke GitHub Releasea.

| Polje        | Pravilo                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `objavljeno` | Dan produkcijske objave u zoni Europe/Zagreb (`YYYY-MM-DD`) ili `null` za nacrt.                     |
| `nastavak`   | Samo za drugo i svako sljedeće izdanje istoga dana: `1`, `2`… Prvo izdanje dana ga nema.              |
| `naslov`     | Kratak naslov izdanja u jednom retku.                                                                |
| `stavke`     | Popis promjena kao običan tekst. Na webu se prikazuje doslovno, a GitHub ga tumači kao Markdown.     |

Iz datuma `2026-11-23` izvode se Git oznaka `v2026.11.23`, sidro `izdanje-2026-11-23` na stranici Novosti i naslov GitHub Releasea `Kaladont | 23. 11. 2026.`. Igračima se prikazuje samo hrvatski datum; javno sučelje ne prikazuje oznake verzija ni commit SHA.

Workflow **Promoviraj produkciju** sam prepoznaje vrstu objave, bez dodatnog polja u formi:

1. uzme najnoviji datirani zapis iz `izdanja.json` na commitu slike i izračuna njegovu oznaku;
2. ako ta oznaka već postoji, objava je tiho ažuriranje;
3. ako ne postoji, objava je izdanje i vrijedi **čuvar datuma**: datum zapisa mora biti jednak današnjem (Europe/Zagreb), a sva starija izdanja moraju već imati oznaku. Inače workflow staje prije backupa i prije nego što dirne produkciju, uz poruku što treba popraviti.

Tako se datum u Novostima, datum u oznaci i stvarni dan objave ne mogu razići. Sažetak runa **Objaviti staging** unaprijed najavljuje vrstu sljedeće promocije i upozorava ako bi bila blokirana ili ako postoji nacrt.

## Statusi

| Status               | Značenje                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `kandidat`           | CI je zelen i GHCR je objavio sliku, ali staging provjera još nije završena.                                         |
| `staging-provjereno` | Digest je na stagingu, health i ručne provjere su prošle, i može se dijeliti closed testerima ili promovirati dalje. |
| `odbačeno`           | Staging je otkrio kvar ili neprihvatljiv rizik; digest se ne promovira i ne dijeli dalje.                            |
| `promovirano`        | Isti digest je ručno promoviran u produkciju.                                                                        |
| `rollbackano`        | Release je zamijenjen prethodnim poznato-zdravim digestom.                                                           |

Status se zapisuje u [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata). Ako isti digest mijenja status, dodaje se novi redak umjesto prepisivanja starog.

## Kanali

| Kanal               | Kako nastaje                                                                      | Tko ga vidi                       | Izlaz                                        |
| ------------------- | --------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------- |
| `main` kandidat     | PR je spojen u `main`, CI je zelen i GHCR objava je uspjela.                      | Operater.                         | Digest spreman za automatski staging deploy. |
| Staging closed test | Workflow automatski postavi digest, a operater provjeri staging.                  | Mali ručno odabrani krug testera. | `staging-provjereno` ili `odbačeno`.         |
| Produkcija          | Operater ručno promovira isti staging-provjereni digest u vrijeme slabog prometa. | Svi korisnici.                    | `promovirano` ili rollback.                  |

Staging štiti pristup cookie gateom (`STAGING_PRISTUP_SIFRA`, `/pristup`) i šalje `X-Robots-Tag: noindex, nofollow`. Link i šifru dijeliti samo malom ručno odabranom krugu testera.

## Tok za današnji ručni staging

1. Napravi promjenu na radnoj grani i otvori PR prema `main`.
2. Prije mergea potvrdi da je CI zelen i da razumiješ migracije, konfiguracijske promjene i rollback rizik.
3. Spoji PR u `main`.
4. Pričekaj da CI pushne candidate, provede smoke test po digestu, a zatim [GHCR promotion workflow](../../.github/workflows/objavi-ghcr.yml) promovira isti manifest.
5. Pričekaj da [staging workflow](../../.github/workflows/objavi-staging.yml) povuče isti digest, izvrši migracije i potvrdi javni health.
6. Iz workflowa zapiši puni digest, puni commit SHA i poveznicu na workflow run.
7. Provjeri staging checklistu iz ovog dokumenta.
8. Zapiši rezultat kao `staging-provjereno` ili `odbačeno`.
9. Tek nakon statusa `staging-provjereno` pošalji link i napomene closed testerima.

Ako staging workflow padne, ne ponavljaj naslijepo: provjeri SSH, Compose/migracije, health odgovor i trenutno aktivni digest. Ručni staging deploy ostaje incidentni fallback, ne redovni put.

## Checklist: prije mergea

- [ ] PR postoji i diff je pregledan kao cjelina.
- [ ] CI je zelen; Docker smoke test nije preskočen za promjene koje diraju build, startup, bazu, Caddy, Compose, migracije ili workflowe.
- [ ] Ako postoje migracije, stara aplikacija može raditi nad novom shemom barem jedan release ciklus.
- [ ] Ako se očekuje prekid dulji od 5 minuta, najava je objavljena najmanje 24 sata ranije kroz raniji release.
- [ ] Za promjene emaila potvrđeno je slanje na testne adrese s više uređaja.
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

Produkciju promovira ručni workflow **Promoviraj produkciju** ([CI/CD](ci-cd.md)). Pravila vrijede za svaku objavu, bila ona izdanje ili tiho ažuriranje:

1. Produkcija prima samo digest koji ima status `staging-provjereno`.
2. Promocija se pokreće ručno i u vrijeme slabog prometa.
3. Prije produkcijske migracije mora uspjeti svježi šifrirani off-server backup (backup gate u workflowu).
4. Produkcijski health mora vratiti 200 i očekivani digest.
5. Nakon promocije provjeravaju se ključne stranice i cijela partija u četiri odvojene sesije.
6. Release se zapisuje kao `promovirano`, uz trajanje prekida, ID probne produkcijske partije ako postoji i oznaku izdanja ako je objava bila izdanje.

Aktivne partije se u MVP-u ne čuvaju preko deploya. Zato se produkcija ne objavljuje u doba očekivanog prometa osim za hitni sigurnosni popravak.

## Postupak izdanja

Izdanje je redovna produkcijska promocija s jednim korakom više na početku: upisom datuma.

1. Dok se značajke razvijaju, zapis u `izdanja.json` je nacrt (`"objavljeno": null`). Naslov i stavke mogu se dopunjavati uz svaki PR.
2. Paket provjeri na stagingu prije dana objave, da taj dan ne ode na otkrivanje grešaka.
3. Na dan objave otvori PR koji `"objavljeno": null` mijenja u današnji datum i usklađuje stavke sa stvarnim sadržajem paketa. Taj PR ne mijenja nijedan test. PR se smije spojiti i dan ranije, sa sutrašnjim datumom: čuvar tada blokira promociju do tog dana.
4. Nakon spajanja pričekaj CI, GHCR promociju i staging. Digest s datumom je novi kandidat i prolazi staging checklistu iz ovog dokumenta kao svaki drugi. Sažetak runa **Objaviti staging** mora najaviti `IZDANJE vYYYY.MM.DD`; na stagingu provjeri i naslovnicu i `/novosti`.
5. Na dan upisan u `izdanja.json` pokreni **Promoviraj produkciju** s digestom iz tog staging runa.
6. Nakon zelenog health checka job **Objaviti CalVer oznaku i GitHub Release** potvrdi da produkcija prikazuje izdanje, pa stvori oznaku na commitu promovirane slike i GitHub Release s bilješkama iz `izdanja.json`.
7. Provjeri „Zadnje ažuriranje” na naslovnici, `/novosti` i stranicu Releases, pa objavu upiši u [evidenciju održavanja](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata) zajedno s oznakom izdanja.

Ako objava sklizne na sutra, potreban je novi PR s novim datumom i novi prolaz kroz CI i staging. Ostale situacije opisuje tablica [„Što ako”](runbook-objava-i-rollback.md#što-ako) u runbooku.

### Više izdanja istoga dana

Drugom izdanju istoga dana dodaj `"nastavak": 1`, trećem `"nastavak": 2`. Oznaka je tada `v2026.11.23.1`, sidro `izdanje-2026-11-23-1`, a naslov GitHub Releasea `Kaladont | 23. 11. 2026. (2)`. Igrači na oba zapisa vide isti datum.

## Tiho ažuriranje

Brzi popravak ide istim putem kao svaka objava: PR → `main` → CI → staging → **Promoviraj produkciju**. U `izdanja.json` se ništa ne dodaje, pa nema oznake ni unosa u Novostima, a datum na naslovnici ostaje isti. Staging gate, backup gate i upis u evidenciju vrijede kao i za izdanje.

- Popravak koji želiš spomenuti igračima dopiši kao stavku u postojeći zapis. Datum i oznaka se ne mijenjaju; tekst GitHub Releasea po potrebi uredi ručno.
- Ako u `izdanja.json` postoji nacrt, a slika već sadrži njegove promjene, tiha promocija objavljuje ih bez unosa u Novostima. Sažeci staging i produkcijskog runa na to upozoravaju; tada prvo upiši datum i objavi kao izdanje.
- Nema hitne grane: produkcija dobiva samo ono što je na `main`. Dok `main` nosi neobjavljen paket, popravak može izaći samo zajedno s njim. Veliki paket zato spajaj na `main` tek kad je blizu objave.

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

### Rollback i izdanja

- Rollback je uvijek tiho ažuriranje: oznaka izdanja na koje se vraćaš već postoji, a slika starija od sustava izdanja nema `izdanja.json`. Čuvar datuma ga zato ne blokira.
- Novosti i datum na naslovnici vraćaju se sami, jer su dio slike. Oznaka i GitHub Release vraćenog izdanja ostaju.
- Ponovna objava ispravljenog izdanja je tiho ažuriranje s izvornim datumom. Ako ipak treba novi datum, obriši Release i oznaku (`gh release delete <oznaka> --cleanup-tag`), upiši novi datum i objavi kao novo izdanje. Dok oznake nema, čuvar blokira i promociju slike tog izdanja; postupak za taj slučaj je u tablici [„Što ako”](runbook-objava-i-rollback.md#što-ako).

## Predložak zapisa releasea

| Polje             | Vrijednost                                                                     |
| ----------------- | ------------------------------------------------------------------------------ |
| UTC vrijeme       |                                                                                |
| Status            | `kandidat` / `staging-provjereno` / `odbačeno` / `promovirano` / `rollbackano` |
| Digest            | `sha256:`                                                                      |
| Commit SHA        |                                                                                |
| Oznaka izdanja    | `vYYYY.MM.DD` ili „tiho ažuriranje”                                            |
| Workflow          |                                                                                |
| Prethodni digest  |                                                                                |
| Okruženje         | staging / produkcija                                                           |
| Operater          |                                                                                |
| Sažetak promjene  |                                                                                |
| Ručna provjera    |                                                                                |
| Odluka i napomena |                                                                                |

Za trajnu evidenciju koristi tablicu u [održavanju](odrzavanje.md#evidencija-drillova-objava-i-većih-zahvata). Ovaj predložak služi kao podsjetnik što treba prikupiti prije upisa.
